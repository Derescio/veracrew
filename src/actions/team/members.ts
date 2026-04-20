"use server";

import { z } from "zod";
import { requireOrgContext, requireRole } from "@/lib/auth/context";
import { requireOrgActive } from "@/lib/auth/org-status";
import { scopedPrisma } from "@/lib/db/scoped-prisma";
import type { Role, MemberStatus } from "@/generated/prisma/client";

export type MemberActionResult = { success: true } | { error: string };

const MemberIdSchema = z.object({ membershipId: z.string().min(1) });

const ChangeRoleSchema = z.object({
  membershipId: z.string().min(1),
  role: z.enum(["ADMIN", "MANAGER", "WORKER"]),
});

const ChangeJobRoleSchema = z.object({
  membershipId: z.string().min(1),
  jobRoleId: z.string().nullable(),
});

const ChangeRateSchema = z.object({
  membershipId: z.string().min(1),
  hourlyRateOverrideCents: z.number().int().min(0).nullable(),
});

export async function changeMemberRole(input: unknown): Promise<MemberActionResult> {
  const ctx = await requireOrgContext();
  await requireOrgActive(ctx);
  requireRole("ADMIN", ctx);

  const parsed = ChangeRoleSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const db = scopedPrisma(ctx.organizationId, ctx.userId);

  const member = await db.membership.findFirst({
    where: { id: parsed.data.membershipId },
    select: { id: true, role: true },
  });

  if (!member) return { error: "Member not found." };
  if (member.role === "OWNER") return { error: "Cannot change an Owner's role." };

  await db.membership.update({
    where: { id: member.id },
    data: { role: parsed.data.role as Role },
  });

  return { success: true };
}

export async function changeMemberJobRole(input: unknown): Promise<MemberActionResult> {
  const ctx = await requireOrgContext();
  await requireOrgActive(ctx);
  requireRole("ADMIN", ctx);

  const parsed = ChangeJobRoleSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const db = scopedPrisma(ctx.organizationId, ctx.userId);

  await db.membership.updateMany({
    where: { id: parsed.data.membershipId },
    data: { jobRoleId: parsed.data.jobRoleId },
  });

  return { success: true };
}

export async function suspendMember(input: unknown): Promise<MemberActionResult> {
  const ctx = await requireOrgContext();
  await requireOrgActive(ctx);
  requireRole("ADMIN", ctx);

  const parsed = MemberIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const db = scopedPrisma(ctx.organizationId, ctx.userId);

  const member = await db.membership.findFirst({
    where: { id: parsed.data.membershipId },
    select: { id: true, role: true },
  });

  if (!member) return { error: "Member not found." };
  if (member.role === "OWNER") return { error: "Cannot suspend an Owner." };

  await db.membership.update({
    where: { id: member.id },
    data: { status: "SUSPENDED" as MemberStatus },
  });

  return { success: true };
}

export async function reactivateMember(input: unknown): Promise<MemberActionResult> {
  const ctx = await requireOrgContext();
  await requireOrgActive(ctx);
  requireRole("ADMIN", ctx);

  const parsed = MemberIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const db = scopedPrisma(ctx.organizationId, ctx.userId);

  await db.membership.updateMany({
    where: { id: parsed.data.membershipId },
    data: { status: "ACTIVE" as MemberStatus },
  });

  return { success: true };
}

export async function removeMemberFromOrg(input: unknown): Promise<MemberActionResult> {
  const ctx = await requireOrgContext();
  await requireOrgActive(ctx);
  requireRole("ADMIN", ctx);

  const parsed = MemberIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const db = scopedPrisma(ctx.organizationId, ctx.userId);

  const member = await db.membership.findFirst({
    where: { id: parsed.data.membershipId },
    select: { id: true, role: true },
  });

  if (!member) return { error: "Member not found." };
  if (member.role === "OWNER") return { error: "Cannot remove an Owner from the organization." };

  await db.membership.delete({ where: { id: member.id } });

  return { success: true };
}

export async function updateMemberRate(input: unknown): Promise<MemberActionResult> {
  const ctx = await requireOrgContext();
  await requireOrgActive(ctx);
  requireRole("ADMIN", ctx);

  const parsed = ChangeRateSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const db = scopedPrisma(ctx.organizationId, ctx.userId);

  await db.membership.updateMany({
    where: { id: parsed.data.membershipId },
    data: { hourlyRateOverrideCents: parsed.data.hourlyRateOverrideCents },
  });

  return { success: true };
}
