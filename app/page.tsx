import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { clearSession, getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function signOut() {
  "use server";
  clearSession();
  redirect("/");
}
// serviceDate is stored as midnight UTC of the local day (same as calendarDate in prisma/seed.ts)
function calendarDate(offsetDays: number) {
  const now = new Date();
  return new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays),
  );
}

function dayLabel(d: Date) {
  if (d.getTime() === calendarDate(0).getTime()) return "Today";
  if (d.getTime() === calendarDate(-1).getTime()) return "Yesterday";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function mealLabel(meal: string) {
  return meal.charAt(0).toUpperCase() + meal.slice(1).toLowerCase();
}

function priceLabel(included: boolean, priceRupees: number | null) {
  if (included) return "included";
  if (priceRupees == null) return "no price set";
  return `₹${priceRupees}`;
}

type Rating = { average: number; count: number };

function ratingLabel(rating: Rating | undefined) {
  if (!rating || rating.count === 0) return "no reviews";
  return `${rating.average.toFixed(1)} (${rating.count})`;
}

export default async function Home() {
  let rows: {
    id: string;
    menuItemId: string;
    quantityLeft: number;
    quantityTotal: number;
    menuItem: {
      name: string;
      description: string;
      included: boolean;
      priceRupees: number | null;
    };
    service: { meal: string; serviceDate: Date; cutoffAt: Date };
  }[] = [];
  const ratings = new Map<string, Rating>();
  let dbDown = false;
  const user = await getCurrentUser();

  try {
    rows = await prisma.offering.findMany({
      where: {
        service: { published: true },
        menuItem: { active: true },
      },
      include: {
        menuItem: {
          select: {
            name: true,
            description: true,
            included: true,
            priceRupees: true,
          },
        },
        service: { select: { meal: true, serviceDate: true, cutoffAt: true } },
      },
      orderBy: [
        { service: { serviceDate: "desc" } },
        { service: { meal: "asc" } },
        { menuItem: { name: "asc" } },
      ],
    });

    // The database does the averaging, so no review rows are loaded.
    const grouped = await prisma.review.groupBy({
      by: ["menuItemId"],
      where: { menuItemId: { in: rows.map((row) => row.menuItemId) } },
      _avg: { stars: true },
      _count: { stars: true },
    });
    for (const group of grouped) {
      if (group._avg.stars != null) {
        ratings.set(group.menuItemId, {
          average: group._avg.stars,
          count: group._count.stars,
        });
      }
    }
  } catch {
    dbDown = true;
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Messline</h1>
      <div className="mt-2 text-sm">
        {user ? (
          <form action={signOut} className="flex items-center gap-3">
            <span>Signed in as {user.name} ({user.role.toLowerCase()})</span>
            <button type="submit" className="underline">
              Sign out
            </button>
          </form>
        ) : (
          <Link href="/login" className="underline">
            Sign in
          </Link>
        )}
      </div>
      <p className="mt-2 text-sm leading-6 text-neutral-700">
        This page only prints the seed so you can see the database is up. Booking,
        cancel, complaints, and reviews do not exist yet. Take a task from an issue.
      </p>

      {dbDown ? (
        <p className="mt-6 text-sm">
          Could not read Postgres. Check README for the docker and seed commands.
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm">No published offerings found.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-300">
              <th className="py-2 pr-3 font-medium">When</th>
              <th className="py-2 pr-3 font-medium">Item</th>
              <th className="py-2 pr-3 font-medium">Price</th>
              <th className="py-2 pr-3 font-medium">Rating</th>
              <th className="py-2 font-medium">Left</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-neutral-200">
                <td className="py-2 pr-3">
                  {dayLabel(row.service.serviceDate)} {mealLabel(row.service.meal)}
                </td>
                <td className="py-2 pr-3">
                  <div>{row.menuItem.name}</div>
                  {row.menuItem.description && (
                    <div className="text-xs text-neutral-500">
                      {row.menuItem.description}
                    </div>
                  )}
                </td>
                <td className="py-2 pr-3">
                  {priceLabel(row.menuItem.included, row.menuItem.priceRupees)}
                </td>
                <td className="py-2 pr-3">
                  {ratingLabel(ratings.get(row.menuItemId))}
                </td>
                <td className="py-2">
                  {row.quantityLeft} / {row.quantityTotal}
                  {row.quantityLeft === 0 && (
                    <span className="ml-2 text-neutral-500">sold out</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      )}
    </main>
  );
}