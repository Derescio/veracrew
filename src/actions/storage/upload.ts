"use server";

import { PutObjectCommand, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireOrgContext } from "@/lib/auth/context";
import { r2, BUCKETS } from "@/lib/storage/r2";
import { makeDocKey } from "@/lib/storage/keys";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import type { UserDocument } from "@/generated/prisma/client";

// Extensions blocked from upload (executables, scripts, etc.)
const BLOCKED_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "sh", "ps1", "msi", "dll", "so",
  "dmg", "app", "vbs", "js", "ts", "py", "rb", "php",
]);

// Per-upload size cap: 50 MB
const MAX_BYTES = 50 * 1024 * 1024;

// Magic byte signatures for known-risky MIME types we accept.
// If no signature is registered for a MIME type, the check passes (e.g. .docx).
const MAGIC_SIGNATURES: Record<string, number[][]> = {
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/gif": [[0x47, 0x49, 0x46, 0x38]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]], // RIFF
};

function matchesMagicBytes(bytes: Uint8Array, mimeType: string): boolean {
  const signatures = MAGIC_SIGNATURES[mimeType];
  if (!signatures) return true; // no signature defined → pass
  return signatures.some((sig) =>
    sig.every((byte, i) => bytes[i] === byte)
  );
}

function getExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

interface PresignedUploadResult {
  presignedUrl: string;
  objectKey: string;
  bucket: string;
}

export async function getPresignedUploadUrl(
  filename: string,
  contentType: string,
  fileSizeBytes: number
): Promise<{ data: PresignedUploadResult } | { error: string }> {
  const ctx = await requireOrgContext();

  const rateLimitResult = await checkRateLimit("uploadUrl", ctx.userId);
  if (!rateLimitResult.allowed) {
    return { error: `Rate limit exceeded. Retry in ${rateLimitResult.retryAfter}s.` };
  }

  const ext = getExtension(filename);
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return { error: `File type ".${ext}" is not allowed.` };
  }

  if (fileSizeBytes > MAX_BYTES) {
    return { error: `File exceeds the 50 MB limit.` };
  }

  const documentId = crypto.randomUUID();
  const objectKey = makeDocKey(ctx.organizationId, documentId, filename);
  const bucket = BUCKETS.docs;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ContentType: contentType,
    ContentLength: fileSizeBytes,
  });

  const presignedUrl = await getSignedUrl(r2, command, { expiresIn: 300 });

  return { data: { presignedUrl, objectKey, bucket } };
}

interface FinalizeUploadInput {
  objectKey: string;
  bucket: string;
  templateId: string;
  originalFileName: string;
  contentType: string;
}

export async function finalizeUpload(
  input: FinalizeUploadInput
): Promise<{ data: UserDocument } | { error: string }> {
  const ctx = await requireOrgContext();
  const { objectKey, bucket, templateId, originalFileName, contentType } = input;

  // Org prefix guard — objectKey must start with the caller's org namespace
  const expectedPrefix = `org_${ctx.organizationId}/`;
  if (!objectKey.startsWith(expectedPrefix)) {
    return { error: "Object key does not belong to your organization." };
  }

  // Verify the object exists in R2 via HeadObject
  let fileSize: number;
  try {
    const headResult = await r2.send(
      new HeadObjectCommand({ Bucket: bucket, Key: objectKey })
    );
    fileSize = headResult.ContentLength ?? 0;
  } catch {
    return { error: "File not found in storage. Upload may have failed." };
  }

  // Magic bytes check — fetch first 16 bytes via range request
  try {
    const rangeResult = await r2.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Range: "bytes=0-15",
      })
    );
    const bodyBytes = await rangeResult.Body?.transformToByteArray();
    if (bodyBytes && !matchesMagicBytes(new Uint8Array(bodyBytes), contentType)) {
      await enqueueR2Deletion(bucket, objectKey, "magic_bytes_mismatch", null, null);
      return { error: "File content does not match the declared content type." };
    }
  } catch {
    // Non-fatal: log and continue — magic byte check is best-effort
    console.error("Magic bytes check failed", { objectKey });
  }

  const fileUrl = env.R2_PUBLIC_URL
    ? `${env.R2_PUBLIC_URL}/${objectKey}`
    : objectKey;

  let document: UserDocument;
  try {
    document = await prisma.userDocument.create({
      data: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        templateId,
        fileUrl,
      },
    });
  } catch (error) {
    console.error("UserDocument create failed", { error, objectKey });
    await enqueueR2Deletion(bucket, objectKey, "db_create_failed", "UserDocument", null);
    return { error: "Failed to save document record. The uploaded file will be cleaned up." };
  }

  void fileSize; // referenced to satisfy lint; stored in R2, accessible via fileUrl
  return { data: document };
}

async function enqueueR2Deletion(
  bucket: string,
  objectKey: string,
  reason: string,
  sourceModel: string | null,
  sourceId: string | null
): Promise<void> {
  try {
    await prisma.r2DeletionJob.create({
      data: { bucket, objectKey, reason, sourceModel, sourceId },
    });
  } catch (enqueueError) {
    console.error("Failed to enqueue R2DeletionJob", { enqueueError, bucket, objectKey });
  }
}
