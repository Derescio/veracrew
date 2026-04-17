/**
 * Example: well-formed server actions for Veracrew.
 * This demonstrates the exact patterns the AI should follow.
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireOrgContext, requireRole } from "@/lib/auth/context";

// Zod schema — validates every field before touching the DB
const CreateLocationSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  address: z.string().min(1, "Address is required"),
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  radiusMeters: z.coerce.number().int().min(1).max(1000),
});

type CreateLocationResult =
  | { data: { id: string; name: string }; error?: never }
  | { error: string; data?: never };

export async function createLocation(
  formData: FormData,
): Promise<CreateLocationResult> {
  // Org context always first — never trust org or role from client input
  const context = await requireOrgContext();
  requireRole(context.role, "MANAGER");

  // Validate before any DB call
  const parsed = CreateLocationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const location = await prisma.location.create({
      data: {
        ...parsed.data,
        organizationId: context.organizationId,
      },
      // Only select what the caller needs — never return full records
      select: { id: true, name: true },
    });

    // Revalidate cached pages that show this data
    revalidatePath("/locations");
    return { data: location };
  } catch (error) {
    console.error("createLocation failed", { error });
    return { error: "Failed to create location" };
  }
}

// ─── Example: record approval with org scoping ────────────────────────────────

const UpdateDocumentStatusSchema = z.object({
  documentId: z.string().min(1),
  status: z.enum(["APPROVED", "REJECTED"]),
});

type UpdateDocumentStatusResult =
  | { data: true; error?: never }
  | { error: string; data?: never };

export async function updateDocumentStatus(
  formData: FormData,
): Promise<UpdateDocumentStatusResult> {
  const context = await requireOrgContext();
  requireRole(context.role, "MANAGER");

  const parsed = UpdateDocumentStatusSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await prisma.userDocument.updateMany({
      where: {
        id: parsed.data.documentId,
        organizationId: context.organizationId,
      },
      data: { status: parsed.data.status },
    });

    revalidatePath("/documents");
    return { data: true };
  } catch (error) {
    console.error("updateDocumentStatus failed", { error });
    return { error: "Failed to update document status" };
  }
}
