"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { sendEmail } from "@/lib/email/resend";
import { env } from "@/lib/env";

const RequestResetSchema = z.object({
  email: z.email(),
});

const PerformResetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

export type ActionResult = { success: true } | { error: string };

export async function requestPasswordReset(input: unknown): Promise<ActionResult> {
  const parsed = RequestResetSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid email address" };
  }

  const { email } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email, deletedAt: null },
    select: { id: true },
  });

  if (!user) {
    // Return success to avoid email enumeration
    return { success: true };
  }

  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + 3_600_000); // 1 hour

  await prisma.verificationToken.upsert({
    where: { identifier_token: { identifier: email, token: `reset:${email}` } },
    update: { token, expires },
    create: { identifier: email, token, expires },
  });

  const resetUrl = `${env.NEXTAUTH_URL}/en/auth/reset-password/${token}`;

  await sendEmail({
    to: email,
    subject: "Reset your Veracrew password",
    html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 1 hour.</p>`,
  });

  return { success: true };
}

export async function performPasswordReset(input: unknown): Promise<ActionResult> {
  const parsed = PerformResetSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { token, password } = parsed.data;

  const verificationToken = await prisma.verificationToken.findUnique({
    where: { token },
    select: { identifier: true, expires: true },
  });

  if (!verificationToken || verificationToken.expires < new Date()) {
    return { error: "This link has expired. Please request a new password reset." };
  }

  const user = await prisma.user.findUnique({
    where: { email: verificationToken.identifier, deletedAt: null },
    select: { id: true },
  });

  if (!user) {
    return { error: "Account not found." };
  }

  const hash = await hashPassword(password);

  await prisma.$transaction([
    prisma.account.updateMany({
      where: { userId: user.id, provider: "credentials" },
      data: { access_token: hash },
    }),
    prisma.verificationToken.delete({ where: { token } }),
  ]);

  return { success: true };
}
