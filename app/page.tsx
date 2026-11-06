import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function dayLabel(d: Date) {
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
  return `Rs ${priceRupees}`;
}

export default async function Home() {
  let rows: {
    id: string;
    quantityLeft: number;
    quantityTotal: number;
    menuItem: { name: string; included: boolean; priceRupees: number | null };
    service: { meal: string; serviceDate: Date; cutoffAt: Date };
  }[] = [];
  let dbDown = false;

  try {
    rows = await prisma.offering.findMany({
      where: { service: { published: true } },
      include: {
        menuItem: { select: { name: true, included: true, priceRupees: true } },
        service: { select: { meal: true, serviceDate: true, cutoffAt: true } },
      },
      orderBy: [{ service: { serviceDate: "desc" } }, { menuItem: { name: "asc" } }],
    });
  } catch {
    dbDown = true;
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Messline</h1>
      <p className="mt-2 text-sm leading-6 text-neutral-700">
        This page only prints the seed so you can see the database is up. Booking,
        cancel, complaints, and reviews do not exist yet. Take a task from an issue.
      </p>

      {dbDown ? (
        <p className="mt-6 text-sm">
          Could not read Postgres. Check README for the docker and seed commands.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-300">
              <th className="py-2 pr-3 font-medium">When</th>
              <th className="py-2 pr-3 font-medium">Item</th>
              <th className="py-2 pr-3 font-medium">Price</th>
              <th className="py-2 font-medium">Left</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-neutral-200">
                <td className="py-2 pr-3">
                  {dayLabel(row.service.serviceDate)} {mealLabel(row.service.meal)}
                </td>
                <td className="py-2 pr-3">{row.menuItem.name}</td>
                <td className="py-2 pr-3">
                  {priceLabel(row.menuItem.included, row.menuItem.priceRupees)}
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
