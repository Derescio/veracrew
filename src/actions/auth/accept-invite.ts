"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { auth } from "@/lib/auth/auth";

const AcceptInviteSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(2).max(100).optional(),
  password: z.string().min(8).max(128).optional(),
});

export type AcceptInviteResult =
  | { success: true; organizationId: string }
  | { error: string };

export async function acceptInvite(input: unknown): Promise<AcceptInviteResult> {
  const parsed = AcceptInviteSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const { token, name, password } = parsed.data;

  const invite = await prisma.invite.findUnique({
    where: { token },
    select: {
      id: true,
      email: true,
      role: true,
      jobRoleId: true,
      organizationId: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
    },
  });

  if (!invite) return { error: "Invite not found." };
  if (invite.revokedAt) return { error: "This invite has been revoked." };
  if (invite.acceptedAt) return { error: "This invite has already been used." };
  if (invite.expiresAt < new Date()) return { error: "This invite has expired." };

  const session = await auth();
  let userId: string;

  if (session?.user?.id) {
    userId = session.user.id;
  } else {
    if (!name || !password) {
      return { error: "Name and password are required to create an account." };
    }

    const existing = await prisma.user.findUnique({
      where: { email: invite.email },
      select: { id: true },
    });

    if (existing) {
      userId = existing.id;
    } else {
      const hash = await hashPassword(password);
      const newUser = await prisma.user.create({
        data: { name, email: invite.email },
        select: { id: true },
      });
      await prisma.account.create({
        data: {
          userId: newUser.id,
          type: "credentials",
          provider: "credentials",
          providerAccountId: newUser.id,
          access_token: hash,
        },
      });
      userId = newUser.id;
    }
  }

  const existingMembership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: { userId, organizationId: invite.organizationId },
    },
    select: { id: true },
  });

  if (!existingMembership) {
    await prisma.membership.create({
      data: {
        userId,
        organizationId: invite.organizationId,
        role: invite.role,
        jobRoleId: invite.jobRoleId,
      },
    });
  }

  await prisma.invite.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date() },
  });

  return { success: true, organizationId: invite.organizationId };
}
