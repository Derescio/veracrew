"use server";

import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { generateTotp, verifyTotp, generateBackupCodes } from "@/lib/auth/two-factor";
import { UnauthorizedError } from "@/lib/errors";

export interface TotpSetupData {
  otpauthUrl: string;
  encryptedSecret: string;
}

export type ActionResult = { success: true } | { error: string };

export async function initiate2FASetup(): Promise<TotpSetupData | { error: string }> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return { error: "Not authenticated" };
  }

  const setup = generateTotp(session.user.email);
  return { otpauthUrl: setup.otpauthUrl, encryptedSecret: setup.encryptedSecret };
}

const ConfirmSchema = z.object({
  encryptedSecret: z.string().min(1),
  otp: z.string().length(6),
});

export async function confirm2FASetup(input: unknown): Promise<ActionResult & { backupCodes?: string[] }> {
  const session = await auth();
  if (!session?.user?.id) throw new UnauthorizedError();

  const parsed = ConfirmSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const { encryptedSecret, otp } = parsed.data;

  const isValid = verifyTotp(encryptedSecret, otp);
  if (!isValid) return { error: "Invalid code. Please try again." };

  const { plainCodes, hashedCodes } = await generateBackupCodes();

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      twoFactorEnabled: true,
      twoFactorSecret: encryptedSecret,
      twoFactorBackupCodes: hashedCodes,
    },
  });

  return { success: true, backupCodes: plainCodes };
}
