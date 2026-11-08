import { BookingStatus } from "@prisma/client";
import { prisma } from "../lib/db";
import { bookPlates, cancelBooking, CancelBookingError } from "../lib/booking";

// Shows the cancel rules from docs/rules.md against the seed data.
// Run after `npm run db:reset`:
//   npx tsx scripts/cancel-booking.ts
//
// Bookings are made with bookPlates, so this also exercises the real
// booking path. Cutoff times are moved by hand to show both cancel cases.

let failures = 0;

function check(label: string, ok: boolean, detail = "") {
    if (!ok) failures += 1;
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
}

async function book(userId: string, offeringId: string, count: number) {
    const result = await bookPlates(userId, offeringId, count);
    if (!result.ok) throw new Error(`booking failed: ${result.reason}`);
    return { id: result.bookingId };
}

async function quantityLeft(offeringId: string) {
    const row = await prisma.offering.findUniqueOrThrow({
        where: { id: offeringId },
        select: { quantityLeft: true },
    });
    return row.quantityLeft;
}

async function expectError(label: string, code: string, run: () => Promise<unknown>) {
    try {
        await run();
        check(label, false, "no error thrown");
    } catch (err) {
        const ok = err instanceof CancelBookingError && err.code === code;
        check(label, ok, err instanceof CancelBookingError ? err.code : String(err));
    }
}

async function main() {
    const meera = await prisma.user.findUniqueOrThrow({ where: { email: "meera@messline.dev" } });
    const kabir = await prisma.user.findUniqueOrThrow({ where: { email: "kabir@messline.dev" } });

    const biryani = await prisma.offering.findFirstOrThrow({
        where: { menuItem: { name: "Chicken biryani" }, service: { published: true } },
        include: { service: true },
        orderBy: { service: { serviceDate: "desc" } },
    });
    const originalCutoff = biryani.service.cutoffAt;

    // Start clean: full stock, no bookings, cutoff in the future.
    await prisma.booking.deleteMany({ where: { offeringId: biryani.id } });
    await prisma.offering.update({
        where: { id: biryani.id },
        data: { quantityLeft: biryani.quantityTotal },
    });
    await prisma.service.update({
        where: { id: biryani.serviceId },
        data: { cutoffAt: new Date(Date.now() + 2 * 60 * 60 * 1000) },
    });

    console.log(`\nBiryani offering ${biryani.id}, total ${biryani.quantityTotal}\n`);

    // Case 1: cancel before cutoffAt, plates come back.
    console.log("Case 1: cancel before cutoffAt");
    const b1 = await book(meera.id, biryani.id, 2);
    check("after booking 2 plates, quantityLeft is 0", (await quantityLeft(biryani.id)) === 0);

    await expectError("another student cannot cancel it", "NOT_FOUND", () =>
        cancelBooking(kabir.id, b1.id),
    );
    check("failed attempt changed nothing", (await quantityLeft(biryani.id)) === 0);

    const r1 = await cancelBooking(meera.id, b1.id);
    const row1 = await prisma.booking.findUniqueOrThrow({ where: { id: b1.id } });
    check("status is CANCELLED", row1.status === BookingStatus.CANCELLED);
    check("restocked is true", r1.restocked === true);
    check("quantityLeft went back up to 2", (await quantityLeft(biryani.id)) === 2);

    await expectError("cancelling twice is rejected", "NOT_BOOKED", () =>
        cancelBooking(meera.id, b1.id),
    );
    check("second cancel did not add plates again", (await quantityLeft(biryani.id)) === 2);

    // Case 2: cancel after cutoffAt, plates stay taken.
    console.log("\nCase 2: cancel after cutoffAt");
    const b2 = await book(kabir.id, biryani.id, 1);
    check("after booking 1 plate, quantityLeft is 1", (await quantityLeft(biryani.id)) === 1);

    await prisma.service.update({
        where: { id: biryani.serviceId },
        data: { cutoffAt: new Date(Date.now() - 60 * 1000) },
    });

    const r2 = await cancelBooking(kabir.id, b2.id);
    const row2 = await prisma.booking.findUniqueOrThrow({ where: { id: b2.id } });
    check("status is CANCELLED", row2.status === BookingStatus.CANCELLED);
    check("restocked is false", r2.restocked === false);
    check("quantityLeft did not change, still 1", (await quantityLeft(biryani.id)) === 1);

    // Case 3: stock never goes past quantityTotal.
    console.log("\nCase 3: quantityLeft is capped at quantityTotal");
    await prisma.service.update({
        where: { id: biryani.serviceId },
        data: { cutoffAt: new Date(Date.now() + 2 * 60 * 60 * 1000) },
    });
    await prisma.offering.update({
        where: { id: biryani.id },
        data: { quantityLeft: biryani.quantityTotal },
    });
    // A BOOKED row while stock is already full, only possible if the data was edited by hand.
    const b3 = await prisma.booking.create({
        data: { userId: meera.id, offeringId: biryani.id, count: 2 },
    });
    await cancelBooking(meera.id, b3.id);
    check(
        `quantityLeft stays at ${biryani.quantityTotal}`,
        (await quantityLeft(biryani.id)) === biryani.quantityTotal,
    );

    // Put things back the way the seed had them.
    await prisma.booking.deleteMany({ where: { offeringId: biryani.id } });
    await prisma.offering.update({
        where: { id: biryani.id },
        data: { quantityLeft: biryani.quantityTotal },
    });
    await prisma.service.update({
        where: { id: biryani.serviceId },
        data: { cutoffAt: originalCutoff },
    });

    console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
    if (failures > 0) process.exitCode = 1;
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
    