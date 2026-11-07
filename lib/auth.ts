import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";

export const SESSION_COOKIE = "messline_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;

export type CurrentUser = { id: string; name: string; role: Role };

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) {
    throw new Error("SESSION_SECRET is not set. Copy it from .env.example into .env.");
  }
  return value;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// Cookie value is `userId.expiresAtMs.signature`. Changing any part breaks the signature.
export function createSession(userId: string) {
  const expiresAt = Date.now() + SESSION_SECONDS * 1000;
  const payload = `${userId}.${expiresAt}`;
  cookies().set(SESSION_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export function clearSession() {
  cookies().delete(SESSION_COOKIE);
}

function readUserId(value: string | undefined): string | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiresAt, signature] = parts;
  if (!safeEqual(signature, sign(`${userId}.${expiresAt}`))) return null;
  if (!(Number(expiresAt) > Date.now())) return null;
  return userId;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const userId = readUserId(cookies().get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  try {
    return await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true },
    });
  } catch {
    return null;
  }
}