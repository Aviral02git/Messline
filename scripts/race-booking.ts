import { prisma } from "../lib/db";
import { bookPlates } from "../lib/booking";

async function main() {
  const [meera, kabir] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "meera@messline.dev" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "kabir@messline.dev" } }),
  ]);

  const offering = await prisma.offering.findFirstOrThrow({
    where: {
      menuItem: { name: { contains: "biryani", mode: "insensitive" } },
      service: { published: true, cutoffAt: { gt: new Date() } },
    },
  });

  if (offering.quantityLeft !== 2) {
    console.error(
      `Expected 2 plates left, found ${offering.quantityLeft}. Run "npm run db:reset" first.`
    );
    process.exit(1);
  }

  console.log("Firing both bookings at the same time...");
  const [a, b] = await Promise.all([
    bookPlates(meera.id, offering.id, 2),
    bookPlates(kabir.id, offering.id, 2),
  ]);

  console.log("Meera:", a);
  console.log("Kabir:", b);

  const after = await prisma.offering.findUniqueOrThrow({
    where: { id: offering.id },
  });
  console.log("quantityLeft now:", after.quantityLeft);

  const wins = [a, b].filter((r) => r.ok).length;
  const soldOut = [a, b].filter(
    (r) => !r.ok && r.reason === "SOLD_OUT"
  ).length;

  if (wins === 1 && soldOut === 1 && after.quantityLeft === 0) {
    console.log("PASS: one booked, one sold out, stock is 0.");
  } else {
    console.error(
      "FAIL: expected one winner, one SOLD_OUT and quantityLeft 0."
    );
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());