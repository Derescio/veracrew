"use server";

import { z } from "zod";
import { requireOrgContext, requireRole } from "@/lib/auth/context";
import { requireOrgActive } from "@/lib/auth/org-status";
import { scopedPrisma } from "@/lib/db/scoped-prisma";

export type JobRoleResult = { success: true } | { error: string };

const CreateJobRoleSchema = z.object({
  name: z.string().min(1).max(100),
  defaultRegularRateCents: z.number().int().min(0),
});

const UpdateJobRoleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  defaultRegularRateCents: z.number().int().min(0).optional(),
});

const DeleteJobRoleSchema = z.object({
  id: z.string().min(1),
});

export async function createJobRole(input: unknown): Promise<JobRoleResult> {
  const ctx = await requireOrgContext();
  await requireOrgActive(ctx);
  requireRole("ADMIN", ctx);

  const parsed = CreateJobRoleSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const db = scopedPrisma(ctx.organizationId, ctx.userId);

  await db.jobRole.create({ data: { ...parsed.data, organizationId: ctx.organizationId } });

  return { success: true };
}

export async function updateJobRole(input: unknown): Promise<JobRoleResult> {
  const ctx = await requireOrgContext();
  await requireOrgActive(ctx);
  requireRole("ADMIN", ctx);

  const parsed = UpdateJobRoleSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { id, ...data } = parsed.data;
  const db = scopedPrisma(ctx.organizationId, ctx.userId);

  const existing = await db.jobRole.findFirst({ where: { id }, select: { id: true } });
  if (!existing) return { error: "Trade not found." };

  await db.jobRole.update({ where: { id }, data });

  return { success: true };
}

export async function deleteJobRole(input: unknown): Promise<JobRoleResult> {
  const ctx = await requireOrgContext();
  await requireOrgActive(ctx);
  requireRole("ADMIN", ctx);

  const parsed = DeleteJobRoleSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const db = scopedPrisma(ctx.organizationId, ctx.userId);

  const hasMembers = await db.membership.count({ where: { jobRoleId: parsed.data.id } });
  if (hasMembers > 0) {
    return { error: "Cannot delete a trade that is assigned to team members. Reassign members first." };
  }

  await db.jobRole.delete({ where: { id: parsed.data.id } });

  return { success: true };
}
