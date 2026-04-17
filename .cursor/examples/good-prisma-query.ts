/**
 * Example: well-formed Prisma query functions for Veracrew.
 * Lives in src/lib/db/<feature>.ts — read-only, called from Server Components.
 */

import { prisma } from "@/lib/prisma";

// ─── Always explicit select — never return full records ───────────────────────

export interface TeamMemberSummary {
  id: string;
  name: string | null;
  email: string;
  role: "OWNER" | "ADMIN" | "MANAGER" | "WORKER";
  status: string;
}

export async function getTeamMembers(
  organizationId: string,
): Promise<TeamMemberSummary[]> {
  const memberships = await prisma.membership.findMany({
    where: { organizationId },
    select: {
      id: true,
      role: true,
      status: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return memberships.map((membership) => ({
    id: membership.id,
    name: membership.user.name,
    email: membership.user.email,
    role: membership.role,
    status: membership.status,
  }));
}

// ─── Counting with _count — never fetch all records just to count ─────────────

export interface DocumentTemplateWithCount {
  id: string;
  name: string;
  required: boolean;
  documentCount: number;
}

export async function getDocumentTemplates(
  organizationId: string,
): Promise<DocumentTemplateWithCount[]> {
  const templates = await prisma.documentTemplate.findMany({
    where: { organizationId },
    select: {
      id: true,
      name: true,
      required: true,
      _count: { select: { userDocuments: true } },
    },
    orderBy: { name: "asc" },
  });

  return templates.map((template) => ({
    id: template.id,
    name: template.name,
    required: template.required,
    documentCount: template._count.userDocuments,
  }));
}

// ─── Ownership verification on single-record fetches ──────────────────────────

export interface LocationDetails {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  radiusMeters: number;
}

export async function getLocationById(
  organizationId: string,
  locationId: string,
): Promise<LocationDetails | null> {
  return prisma.location.findFirst({
    where: {
      id: locationId,
      organizationId,
    },
    select: {
      id: true,
      name: true,
      address: true,
      lat: true,
      lng: true,
      radiusMeters: true,
    },
  });
}
