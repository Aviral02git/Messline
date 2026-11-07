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