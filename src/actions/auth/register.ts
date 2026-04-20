"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";

const RegisterSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.email(),
  password: z.string().min(8).max(128),
});

export type RegisterResult =
  | { success: true; userId: string }
  | { error: string };

export async function registerUser(input: unknown): Promise<RegisterResult> {
  const parsed = RegisterSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, deletedAt: true },
  });

  if (existing) {
    if (existing.deletedAt) {
      return { error: "This email address is not available." };
    }
    return { error: "An account with this email already exists." };
  }

  const hash = await hashPassword(password);

  const user = await prisma.user.create({
    data: { name, email },
    select: { id: true },
  });

  await prisma.account.create({
    data: {
      userId: user.id,
      type: "credentials",
      provider: "credentials",
      providerAccountId: user.id,
      access_token: hash,
    },
  });

  return { success: true, userId: user.id };
}
