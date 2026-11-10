import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "File a complaint | Messline",
};

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

const complaintSchema = z.object({
  offeringId: z.string().min(1, "Please select an offering."),
  body: z
    .string()
    .trim()
    .min(10, "Complaint body must be at least 10 characters.")
    .max(1000, "Complaint body must be at most 1000 characters."),
});

async function submitComplaint(formData: FormData) {
  "use server";

  const user = await getCurrentUser();
  if (!user || user.role !== "STUDENT") {
    throw new Error("Unauthorized: Only signed-in students can file complaints.");
  }

  const parsed = complaintSchema.safeParse({
    offeringId: formData.get("offeringId"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    redirect("/complaints/new?error=invalid_body");
  }

  const offering = await prisma.offering.findUnique({
    where: { id: parsed.data.offeringId },
    include: { service: true },
  });

  const today = calendarDate(0);
  if (
    !offering ||
    !offering.service.published ||
    offering.service.serviceDate.getTime() > today.getTime()
  ) {
    redirect("/complaints/new?error=invalid_offering");
  }

  await prisma.complaint.create({
    data: {
      userId: user.id,
      menuItemId: offering.menuItemId,
      serviceId: offering.serviceId,
      body: parsed.data.body,
      status: "OPEN",
    },
  });

  revalidatePath("/complaints");
  redirect("/complaints");
}

export default async function NewComplaintPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "STUDENT") redirect("/");

  const today = calendarDate(0);

  const offerings = await prisma.offering.findMany({
    where: {
      service: {
        published: true,
        serviceDate: { lte: today },
      },
    },
    include: {
      menuItem: { select: { id: true, name: true } },
      service: { select: { id: true, meal: true, serviceDate: true } },
    },
    orderBy: [
      { service: { serviceDate: "desc" } },
      { service: { meal: "asc" } },
      { menuItem: { name: "asc" } },
    ],
  });

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <p className="mb-6 text-sm">
        <Link href="/complaints" className="underline">
          Back to complaints
        </Link>
      </p>

      <h1 className="text-2xl font-semibold">File a complaint</h1>
      <p className="mt-2 text-sm leading-6 text-neutral-700">
        File a complaint about one dish at one service. Complaints are reviewed by the mess secretary.
      </p>

      {searchParams.error === "invalid_body" && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          Complaint body must be between 10 and 1000 characters.
        </p>
      )}

      {searchParams.error === "invalid_offering" && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          The selected dish is not eligible for complaints.
        </p>
      )}

      {offerings.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">
          No eligible meals from today or earlier found to complain about.
        </p>
      ) : (
        <form action={submitComplaint} className="mt-6 space-y-5">
          <div>
            <label
              htmlFor="offeringId"
              className="block text-sm font-medium text-neutral-900"
            >
              Meal & Dish
            </label>
            <select
              id="offeringId"
              name="offeringId"
              required
              defaultValue=""
              className="mt-1 block w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
            >
              <option value="" disabled>
                Select a dish...
              </option>
              {offerings.map((offering) => (
                <option key={offering.id} value={offering.id}>
                  {`${dayLabel(offering.service.serviceDate)} ${mealLabel(offering.service.meal)}: ${offering.menuItem.name}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="body"
              className="block text-sm font-medium text-neutral-900"
            >
              Complaint details
            </label>
            <textarea
              id="body"
              name="body"
              required
              minLength={10}
              maxLength={1000}
              rows={5}
              placeholder="Describe the issue with the dish (10 to 1000 characters)..."
              className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-neutral-500">
              Between 10 and 1000 characters.
            </p>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <button
              type="submit"
              className="rounded bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-800"
            >
              Submit complaint
            </button>
            <Link href="/complaints" className="text-sm underline">
              Cancel
            </Link>
          </div>
        </form>
      )}
    </main>
  );
}

