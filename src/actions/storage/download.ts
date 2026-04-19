"use server";

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireOrgContext } from "@/lib/auth/context";
import { r2 } from "@/lib/storage/r2";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/db/prisma";
import { headers } from "next/headers";

interface PresignedDownloadResult {
  url: string;
}

/**
 * Generates a time-limited presigned download URL for an org-owned document.
 *
 * - Enforces org-prefix ownership on the objectKey.
 * - Fetches the original filename from DB (never trusts client input).
 * - Fires an audit log entry in the background (non-blocking).
 */
export async function getPresignedDownloadUrl(
  documentId: string
): Promise<{ data: PresignedDownloadResult } | { error: string }> {
  const ctx = await requireOrgContext();

  const rateLimitResult = await checkRateLimit("downloadUrl", ctx.userId);
  if (!rateLimitResult.allowed) {
    return { error: `Rate limit exceeded. Retry in ${rateLimitResult.retryAfter}s.` };
  }

  const document = await prisma.userDocument.findUnique({
    where: { id: documentId },
    select: { organizationId: true, fileUrl: true },
  });

  if (!document) {
    return { error: "Document not found." };
  }

  if (document.organizationId !== ctx.organizationId) {
    return { error: "You do not have access to this document." };
  }

  // Derive the object key from the stored fileUrl
  const objectKey = extractObjectKey(document.fileUrl);
  const expectedPrefix = `org_${ctx.organizationId}/`;
  if (!objectKey.startsWith(expectedPrefix)) {
    return { error: "Document key does not belong to your organization." };
  }

  // Derive a safe filename for Content-Disposition from the objectKey
  const rawFilename = objectKey.split("/").pop() ?? "download";
  const safeFilename = sanitizeFilename(rawFilename);

  const command = new GetObjectCommand({
    Bucket: getBucketFromKey(objectKey),
    Key: objectKey,
    ResponseContentDisposition: `attachment; filename="${safeFilename}"`,
  });

  const url = await getSignedUrl(r2, command, { expiresIn: 300 });

  // Fire-and-forget audit log — failure is non-fatal
  void logAuditEvent(ctx.organizationId, ctx.userId, documentId);

  return { data: { url } };
}

function extractObjectKey(fileUrl: string): string {
  // Handles both absolute URLs (when R2_PUBLIC_URL is set) and bare keys
  try {
    const parsed = new URL(fileUrl);
    return parsed.pathname.replace(/^\//, "");
  } catch {
    return fileUrl;
  }
}

function getBucketFromKey(objectKey: string): string {
  // Key shape: org_{id}/docs/... or org_{id}/images/... etc.
  // Bucket mapping is embedded in the key's second segment.
  const segment = objectKey.split("/")[1];
  if (segment === "images") return process.env.R2_BUCKET_IMAGES ?? "";
  return process.env.R2_BUCKET_DOCS ?? "";
}

/** Strip non-ASCII characters and quotes to produce a safe Content-Disposition filename. */
function sanitizeFilename(name: string): string {
  return name.replace(/[^\x20-\x7E]/g, "").replace(/["]/g, "'");
}

async function logAuditEvent(
  organizationId: string,
  actorUserId: string,
  documentId: string
): Promise<void> {
  try {
    const headerStore = await headers();
    const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const userAgent = headerStore.get("user-agent") ?? null;

    await prisma.auditEvent.create({
      data: {
        organizationId,
        actorUserId,
        action: "DOC_DOWNLOAD",
        resourceType: "UserDocument",
        resourceId: documentId,
        ip,
        userAgent,
      },
    });
  } catch (error) {
    console.error("Audit log failed for DOC_DOWNLOAD", { error, documentId });
  }
}
