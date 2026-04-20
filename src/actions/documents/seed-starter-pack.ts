"use server";

import { z } from "zod";
import { requireOrgContext, requireRole } from "@/lib/auth/context";
import { requireOrgActive } from "@/lib/auth/org-status";
import { scopedPrisma } from "@/lib/db/scoped-prisma";

export const STARTER_PACKS = {
  canadian_construction: {
    key: "canadian_construction",
    label: "Canadian Construction Basic",
    description: "Essential docs for Canadian construction crews: WHMIS, COR, driver's license, first aid.",
    templates: [
      { name: "WHMIS Certificate", required: true, expiryMonths: 12 },
      { name: "Driver's Licence", required: true, expiryMonths: 60 },
      { name: "First Aid Certificate", required: true, expiryMonths: 24 },
      { name: "Void Cheque / Direct Deposit", required: true, expiryMonths: null },
      { name: "COR Safety Training", required: false, expiryMonths: 36 },
    ],
  },
  residential_cleaning: {
    key: "residential_cleaning",
    label: "Residential Cleaning",
    description: "Background check, liability waiver, and ID for cleaning crews.",
    templates: [
      { name: "Government-Issued ID", required: true, expiryMonths: 60 },
      { name: "Background Check", required: true, expiryMonths: 24 },
      { name: "Liability Waiver", required: true, expiryMonths: null },
      { name: "Void Cheque / Direct Deposit", required: true, expiryMonths: null },
    ],
  },
} as const;

export type StarterPackKey = keyof typeof STARTER_PACKS;

const Schema = z.object({
  packKey: z.enum(["canadian_construction", "residential_cleaning"]),
});

export type SeedResult = { success: true } | { error: string };

export async function seedStarterPack(input: unknown): Promise<SeedResult> {
  const ctx = await requireOrgContext();
  await requireOrgActive(ctx);
  requireRole("MANAGER", ctx);

  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { error: "Invalid pack key" };

  const pack = STARTER_PACKS[parsed.data.packKey];
  const db = scopedPrisma(ctx.organizationId, ctx.userId);

  await db.documentTemplate.createMany({
    data: pack.templates.map((t) => ({
      organizationId: ctx.organizationId,
      name: t.name,
      required: t.required,
      expiryMonths: t.expiryMonths ?? undefined,
      isStarterPack: true,
      starterPackKey: pack.key,
    })),
    skipDuplicates: true,
  });

  return { success: true };
}
