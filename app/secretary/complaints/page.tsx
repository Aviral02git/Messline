import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Complaints | Messline",
};

async function acknowledge(formData: FormData) {
  "use server";

  // The page check is not enough on its own, so the action checks the role again.
  const user = await getCurrentUser();
  if (!user || user.role !== "SECRETARY") return;

  const id = formData.get("id");
  if (typeof id !== "string" || id === "") return;

  // Only OPEN moves to ACKNOWLEDGED. Acknowledging twice matches zero rows.
  await prisma.complaint.updateMany({
    where: { id, status: "OPEN" },
    data: { status: "ACKNOWLEDGED" },
  });

  revalidatePath("/secretary/complaints");
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

function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

export default async function SecretaryComplaintsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "SECRETARY") redirect("/");

  let complaints: {
    id: string;
    body: string;
    status: string;
    user: { name: string };
    menuItem: { name: string };
    service: { meal: string; serviceDate: Date };
  }[] = [];
  let dbDown = false;

  try {
    complaints = await prisma.complaint.findMany({
      select: {
        id: true,
        body: true,
        status: true,
        user: { select: { name: true } },
        menuItem: { select: { name: true } },
        service: { select: { meal: true, serviceDate: true } },
      },
      // ComplaintStatus is declared OPEN then ACKNOWLEDGED, so "asc" puts OPEN first.
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
  } catch {
    dbDown = true;
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Complaints</h1>
      <p className="mt-2 text-sm">
        <Link href="/" className="underline">
          Back to home
        </Link>
      </p>

      {dbDown ? (
        <p className="mt-6 text-sm">
          Could not read Postgres. Check README for the docker and seed commands.
        </p>
      ) : complaints.length === 0 ? (
        <p className="mt-6 text-sm">No complaints.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {complaints.map((complaint) => (
            <li
              key={complaint.id}
              className="rounded border border-neutral-200 p-4 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{complaint.user.name}</span>
                <span className="text-xs text-neutral-500">
                  {statusLabel(complaint.status)}
                </span>
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                {complaint.menuItem.name}, {mealLabel(complaint.service.meal)}{" "}
                {dateLabel(complaint.service.serviceDate)}
              </div>
              <p className="mt-2 leading-6 text-neutral-700">{complaint.body}</p>
              {complaint.status === "OPEN" && (
                <form action={acknowledge} className="mt-3">
                  <input type="hidden" name="id" value={complaint.id} />
                  <button
                    type="submit"
                    className="rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
                  >
                    Mark acknowledged
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
