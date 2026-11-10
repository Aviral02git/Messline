import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BookingStatus, Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Bookings | Messline",
};

export const dynamic = "force-dynamic";

// serviceDate is stored as midnight UTC of the local day (same as calendarDate in app/page.tsx)
function today() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function mealLabel(meal: string) {
  return meal.charAt(0).toUpperCase() + meal.slice(1).toLowerCase();
}

function dateLabel(d: Date) {
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

const markSchema = z.object({
  bookingId: z.string().min(1),
  status: z.enum(["SERVED", "NO_SHOW"]),
});

async function markBooking(formData: FormData) {
  "use server";

  // Checked again here: a server action can be called without opening the page.
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== Role.KITCHEN) redirect("/");

  const parsed = markSchema.safeParse({
    bookingId: formData.get("bookingId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;

  // The BOOKED check is in the WHERE clause, so a double click or a second
  // tab cannot change a booking that already has a final status. quantityLeft
  // is not touched: SERVED and NO_SHOW never move stock (docs/rules.md, Cancel).
  await prisma.booking.updateMany({
    where: {
      id: parsed.data.bookingId,
      status: BookingStatus.BOOKED,
      offering: { service: { serviceDate: { lte: today() } } },
    },
    data: { status: parsed.data.status },
  });

  revalidatePath("/kitchen/bookings");
}

export default async function KitchenBookingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== Role.KITCHEN) redirect("/");

  const bookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.BOOKED,
      offering: { service: { serviceDate: { lte: today() } } },
    },
    select: {
      id: true,
      count: true,
      user: { select: { name: true } },
      offering: {
        select: {
          menuItem: { select: { name: true } },
          service: {
            select: { id: true, meal: true, serviceDate: true },
          },
        },
      },
    },
    orderBy: [
      { offering: { service: { serviceDate: "asc" } } },
      { offering: { service: { meal: "asc" } } },
      { createdAt: "asc" },
    ],
  });

  const groups = new Map<
    string,
    { meal: string; serviceDate: Date; rows: typeof bookings }
  >();
  for (const booking of bookings) {
    const { id, meal, serviceDate } = booking.offering.service;
    const group = groups.get(id) ?? { meal, serviceDate, rows: [] };
    group.rows.push(booking);
    groups.set(id, group);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Bookings</h1>
      <p className="mt-2 text-sm text-neutral-700">
        Mark each booking served or no-show after the meal.
      </p>

      {groups.size === 0 ? (
        <p className="mt-6 text-sm">Nothing to mark.</p>
      ) : (
        Array.from(groups.entries()).map(([serviceId, group]) => (
          <section key={serviceId} className="mt-8">
            <h2 className="text-lg font-medium">
              {mealLabel(group.meal)}, {dateLabel(group.serviceDate)}
            </h2>
            <ul className="mt-2 divide-y divide-neutral-200 border-y border-neutral-200 text-sm">
              {group.rows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2"
                >
                  <div>
                    <div>{row.user.name}</div>
                    <div className="text-xs text-neutral-500">
                      {row.offering.menuItem.name} &times; {row.count}
                    </div>
                  </div>
                  <form action={markBooking} className="flex gap-2">
                    <input type="hidden" name="bookingId" value={row.id} />
                    <button
                      type="submit"
                      name="status"
                      value={BookingStatus.SERVED}
                      className="rounded bg-neutral-900 px-3 py-1.5 text-white"
                    >
                      Served
                    </button>
                    <button
                      type="submit"
                      name="status"
                      value={BookingStatus.NO_SHOW}
                      className="rounded border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100"
                    >
                      No-show
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <p className="mt-8 text-sm">
        <Link href="/" className="underline">
          Back to home
        </Link>
      </p>
    </main>
  );
}
