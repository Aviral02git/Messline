import Link from "next/link";
import { redirect } from "next/navigation";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, getCurrentUser } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

async function login(formData: FormData) {
  "use server";

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) redirect("/login?error=1");

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  const passwordOk = user ? await compare(parsed.data.password, user.password) : false;
  // Same redirect for an unknown email and a wrong password.
  if (!user || !passwordOk) redirect("/login?error=1");

  createSession(user.id);
  redirect("/");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  if (await getCurrentUser()) redirect("/");

  return (
    <main className="mx-auto max-w-sm px-6 py-10">
      <h1 className="text-2xl font-semibold">Sign in</h1>

      {searchParams.error ? (
        <p role="alert" className="mt-4 text-sm text-red-700">
          Wrong email or password.
        </p>
      ) : null}

      <form action={login} className="mt-6 space-y-4">
        <label className="block text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-neutral-900 px-4 py-2 text-sm text-white"
        >
          Sign in
        </button>
      </form>

      <p className="mt-6 text-sm">
        <Link href="/" className="underline">
          Back to home
        </Link>
      </p>
    </main>
  );
}