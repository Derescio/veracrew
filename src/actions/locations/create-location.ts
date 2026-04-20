"use server";

import { z } from "zod";
import { requireOrgContext, requireRole } from "@/lib/auth/context";
import { requireOrgActive } from "@/lib/auth/org-status";
import { scopedPrisma } from "@/lib/db/scoped-prisma";

const CreateLocationSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().min(1).max(500),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(10).max(5000).default(100),
  timezone: z.string().min(1),
});

export type CreateLocationResult =
  | { success: true; locationId: string }
  | { error: string };

export async function createLocation(input: unknown): Promise<CreateLocationResult> {
  const ctx = await requireOrgContext();
  await requireOrgActive(ctx);
  requireRole("MANAGER", ctx);

  const parsed = CreateLocationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const db = scopedPrisma(ctx.organizationId, ctx.userId);

  const location = await db.location.create({
    data: { ...parsed.data, organizationId: ctx.organizationId },
    select: { id: true },
  });

  return { success: true, locationId: location.id };
}
