import { BookingStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./db";

const countSchema = z.number().int().positive();

export type BookingFailure =
  | "INVALID_COUNT"
  | "NOT_FOUND"
  | "NOT_PUBLISHED"
  | "CUTOFF_PASSED"
  | "ALREADY_BOOKED"
  | "SOLD_OUT";

export type BookPlatesResult =
  | { ok: true; bookingId: string }
  | { ok: false; reason: BookingFailure };

// Thrown inside the transaction so Prisma rolls everything back.
class BookingError extends Error {
  constructor(public reason: BookingFailure) {
    super(reason);
  }
}

export async function bookPlates(
  userId: string,
  offeringId: string,
  count: number
): Promise<BookPlatesResult> {
  const parsed = countSchema.safeParse(count);
  if (!parsed.success) return { ok: false, reason: "INVALID_COUNT" };
  const plates = parsed.data;

  try {
    const booking = await prisma.$transaction(async (tx) => {
      // 1. The offering must exist, its service must be published,
      //    and the cutoff must not have passed.
      const offering = await tx.offering.findUnique({
        where: { id: offeringId },
        select: { service: { select: { published: true, cutoffAt: true } } },
      });
      if (!offering) throw new BookingError("NOT_FOUND");
      if (!offering.service.published) throw new BookingError("NOT_PUBLISHED");
      if (new Date() >= offering.service.cutoffAt) {
        throw new BookingError("CUTOFF_PASSED");
      }

      // 2. The conditional update from docs/rules.md:
      //    UPDATE "Offering" SET "quantityLeft" = "quantityLeft" - $count
      //    WHERE id = $id AND "quantityLeft" >= $count
      //    Zero rows updated means sold out, and no booking is created.
      const updated = await tx.offering.updateMany({
        where: { id: offeringId, quantityLeft: { gte: plates } },
        data: { quantityLeft: { decrement: plates } },
      });
      if (updated.count === 0) throw new BookingError("SOLD_OUT");

      // 3. One open booking per student per offering. This runs after the
      //    update on purpose: the update locks the offering row, so a
      //    concurrent request from the same student waits for the lock and
      //    then sees the first booking. Throwing rolls the decrement back.
      const existing = await tx.booking.findFirst({
        where: { userId, offeringId, status: "BOOKED" },
        select: { id: true },
      });
      if (existing) throw new BookingError("ALREADY_BOOKED");

      // 4. Create the booking.
      return tx.booking.create({
        data: { userId, offeringId, count: plates, status: "BOOKED" },
        select: { id: true },
      });
    });

    return { ok: true, bookingId: booking.id };
  } catch (err) {
    if (err instanceof BookingError) return { ok: false, reason: err.reason };
    throw err; // real errors (DB down, etc.) are not a failed booking
  }
}

export type CancelBookingErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "NOT_BOOKED";

export class CancelBookingError extends Error {
  code: CancelBookingErrorCode;

  constructor(code: CancelBookingErrorCode, message: string) {
    super(message);
    this.name = "CancelBookingError";
    this.code = code;
  }
}

const cancelInput = z.object({
  userId: z.string().min(1),
  bookingId: z.string().min(1),
});

export type CancelBookingResult = {
  bookingId: string;
  // true when the plates went back into quantityLeft (cancelled before cutoffAt)
  restocked: boolean;
  quantityLeft: number;
};

/**
 * Cancel a booking, following the Cancel section of docs/rules.md.
 *
 * - Only the student who made the booking can cancel it.
 * - Only a BOOKED row can be cancelled.
 * - Before cutoffAt: status becomes CANCELLED and quantityLeft goes up by
 *   count, capped at quantityTotal.
 * - At or after cutoffAt: status becomes CANCELLED and quantityLeft does not
 *   change, because the kitchen already cooked for that count.
 *
 * The status change and the stock change run in one transaction.
 */
export async function cancelBooking(
  userId: string,
  bookingId: string,
): Promise<CancelBookingResult> {
  const parsed = cancelInput.safeParse({ userId, bookingId });
  if (!parsed.success) {
    throw new CancelBookingError(
      "INVALID_INPUT",
      "userId and bookingId are required.",
    );
  }

  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: parsed.data.bookingId },
      include: { offering: { include: { service: true } } },
    });

    // Same error for "missing" and "someone else's", so ids can't be probed.
    if (!booking || booking.userId !== parsed.data.userId) {
      throw new CancelBookingError("NOT_FOUND", "Booking not found.");
    }

    if (booking.status !== BookingStatus.BOOKED) {
      throw new CancelBookingError(
        "NOT_BOOKED",
        "Only a booking that is still BOOKED can be cancelled.",
      );
    }

    // The status check sits in the WHERE clause, so if two cancels for the
    // same booking run at the same time, only one of them updates a row and
    // the plates are never given back twice.
    const updated = await tx.booking.updateMany({
      where: {
        id: booking.id,
        userId: parsed.data.userId,
        status: BookingStatus.BOOKED,
      },
      data: { status: BookingStatus.CANCELLED },
    });

    if (updated.count === 0) {
      throw new CancelBookingError(
        "NOT_BOOKED",
        "Only a booking that is still BOOKED can be cancelled.",
      );
    }

    const beforeCutoff = new Date() < booking.offering.service.cutoffAt;

    if (beforeCutoff) {
      // LEAST keeps quantityLeft from going past quantityTotal.
      await tx.$executeRaw`
        UPDATE "Offering"
        SET "quantityLeft" = LEAST("quantityLeft" + ${booking.count}, "quantityTotal")
        WHERE id = ${booking.offeringId}
      `;
    }

    const offering = await tx.offering.findUniqueOrThrow({
      where: { id: booking.offeringId },
      select: { quantityLeft: true },
    });

    return {
      bookingId: booking.id,
      restocked: beforeCutoff,
      quantityLeft: offering.quantityLeft,
    };
  });
}