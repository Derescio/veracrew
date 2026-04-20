"use server";

import { z } from "zod";
import { requireOrgContext, requireRole } from "@/lib/auth/context";
import { requireOrgActive } from "@/lib/auth/org-status";
import { scopedPrisma } from "@/lib/db/scoped-prisma";
import { sendInviteEmail } from "@/lib/email/templates/invite";
import { env } from "@/lib/env";
import type { Role } from "@/generated/prisma/client";

export type InviteResult = { success: true } | { error: string };

const InviteWorkerSchema = z.object({
  email: z.email(),
  jobRoleId: z.string().optional(),
});

const InviteAdminSchema = z.object({
  email: z.email(),
  role: z.enum(["ADMIN", "MANAGER"]),
});

const RevokeSchema = z.object({
  inviteId: z.string().min(1),
});

export async function inviteWorker(input: unknown): Promise<InviteResult> {
  const ctx = await requireOrgContext();
  await requireOrgActive(ctx);
  requireRole("MANAGER", ctx);

  const parsed = InviteWorkerSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  return createInvite(ctx, parsed.data.email, "WORKER", parsed.data.jobRoleId);
}

export async function inviteAdminOrManager(input: unknown): Promise<InviteResult> {
  const ctx = await requireOrgContext();
  await requireOrgActive(ctx);
  requireRole("ADMIN", ctx);

  const parsed = InviteAdminSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  return createInvite(ctx, parsed.data.email, parsed.data.role as Role);
}

export async function revokeInvite(input: unknown): Promise<InviteResult> {
  const ctx = await requireOrgContext();
  await requireOrgActive(ctx);
  requireRole("MANAGER", ctx);

  const parsed = RevokeSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const db = scopedPrisma(ctx.organizationId, ctx.userId);

  const invite = await db.invite.findFirst({
    where: { id: parsed.data.inviteId, acceptedAt: null, revokedAt: null },
    select: { id: true },
  });

  if (!invite) return { error: "Invite not found or already processed." };

  await db.invite.update({
    where: { id: invite.id },
    data: { revokedAt: new Date() },
  });

  return { success: true };
}

async function createInvite(
  ctx: Awaited<ReturnType<typeof requireOrgContext>>,
  email: string,
  role: Role,
  jobRoleId?: string
): Promise<InviteResult> {
  const db = scopedPrisma(ctx.organizationId, ctx.userId);

  const existing = await db.invite.findFirst({
    where: { email, acceptedAt: null, revokedAt: null },
    select: { id: true },
  });

  if (existing) return { error: `A pending invite for ${email} already exists.` };

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 86_400_000);

  await db.invite.create({
    data: {
      organizationId: ctx.organizationId,
      email,
      role,
      jobRoleId,
      token,
      invitedById: ctx.userId,
      expiresAt,
    },
  });

  const orgName = ctx.orgName;
  const inviteUrl = `${env.NEXTAUTH_URL}/en/auth/invite/${token}`;

  await sendInviteEmail({ to: email, orgName, inviteUrl, role });

  return { success: true };
}
