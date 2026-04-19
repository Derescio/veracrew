import { prisma } from "@/lib/db/prisma";
import { AuditAction } from "@/generated/prisma/client";

/**
 * Central list of all tenant-scoped models. CI test must fail if a new model
 * is added to schema.prisma without also being added here.
 *
 * NOTE: R2DeletionJob is intentionally absent — it is global-ops only.
 * Models without organizationId (Break, InvoiceLineItem, ThreadParticipant,
 * Message) are included so scopedPrisma callers get consistent behaviour;
 * the organizationId injection for those is a no-op at the DB level (Prisma
 * will ignore unknown where clauses). Their tenant isolation is enforced via
 * their parent table's RLS cascade.
 */
export const TENANT_SCOPED_MODELS = new Set([
  "Organization", "Membership", "Invite", "JobRole", "Location",
  "Shift", "ShiftAssignment", "Team", "TeamMember", "Client", "Project",
  "Job", "JobAssignment", "JobActivity", "DocumentTemplate", "UserDocument",
  "JobRequiredDocument", "TimeEntry", "Break", "PayRule", "Holiday",
  "PayrollExport", "TimeOffRequest", "Invoice", "InvoiceLineItem",
  "OrgSubscription", "ActivityEvent", "Notification", "MessageThread",
  "ThreadParticipant", "Message", "AuditEvent",
]);

// PII fields redacted in AuditEvent.before / after
const PII_FIELDS = new Set(["email", "name", "phone", "image", "locale"]);

/**
 * Models that emit an AuditEvent on every mutating write.
 * Excludes pure-junction and ephemeral models (Notification, ActivityEvent,
 * Message, ThreadParticipant, Break) to avoid audit noise.
 */
const AUDIT_EMIT_MODELS = new Set([
  "Organization", "Membership", "Invite", "JobRole", "Location",
  "Shift", "ShiftAssignment", "Team", "TeamMember", "Client", "Project",
  "Job", "JobAssignment", "JobActivity", "DocumentTemplate", "UserDocument",
  "JobRequiredDocument", "TimeEntry", "PayRule", "Holiday", "PayrollExport",
  "TimeOffRequest", "Invoice", "InvoiceLineItem", "OrgSubscription",
  "MessageThread",
]);

const MUTATING_OPS = new Set([
  "create", "createMany", "update", "updateMany", "delete", "deleteMany", "upsert",
]);

/**
 * Returns a Prisma client extension that:
 *  1. Injects `organizationId` on all reads and writes for tenant-scoped models.
 *  2. Sets retention fields (purgeAfter, legalHoldUntil) on create.
 *  3. Redacts PII in AuditEvent before/after JSON blobs.
 *  4. Auto-emits an AuditEvent for every mutating write on audit-tracked models
 *     (only when `actorUserId` is supplied — system/internal calls omit it).
 *
 * SECURITY: `organizationId` MUST come from `requireOrgContext()`.
 */
export function scopedPrisma(organizationId: string, actorUserId?: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const isTenantModel = model ? TENANT_SCOPED_MODELS.has(model) : false;

          if (isTenantModel) {
            const whereArgs = args as { where?: Record<string, unknown> };

            if (
              ["findUnique", "findFirst", "findMany", "count", "aggregate"].includes(
                operation
              )
            ) {
              whereArgs.where = { ...(whereArgs.where ?? {}), organizationId };
            }

            if (operation === "create") {
              (args as { data: Record<string, unknown> }).data = {
                ...(args as { data: Record<string, unknown> }).data,
                organizationId,
                ...computeRetentionFields(
                  model,
                  args as { data: Record<string, unknown> }
                ),
              };
            }

            if (operation === "createMany") {
              (args as { data: Record<string, unknown>[] }).data = (
                args as { data: Record<string, unknown>[] }
              ).data.map((row) => ({
                ...row,
                organizationId,
                ...computeRetentionFields(model, { data: row }),
              }));
            }

            if (["update", "updateMany"].includes(operation)) {
              whereArgs.where = { ...(whereArgs.where ?? {}), organizationId };
            }

            if (["delete", "deleteMany"].includes(operation)) {
              whereArgs.where = { ...(whereArgs.where ?? {}), organizationId };
            }
          }

          if (
            model === "AuditEvent" &&
            (operation === "create" || operation === "createMany")
          ) {
            redactPiiInAuditArgs(args as { data: Record<string, unknown> });
          }

          const result = await query(args);

          // Fire-and-forget audit event. Never throws in the parent operation.
          if (
            actorUserId &&
            model &&
            AUDIT_EMIT_MODELS.has(model) &&
            MUTATING_OPS.has(operation) &&
            model !== "AuditEvent" // prevent infinite recursion
          ) {
            const auditAction = operationToAuditAction(operation);
            const resourceId = extractResourceId(
              args as Record<string, unknown>,
              result
            );
            if (auditAction && resourceId) {
              prisma.auditEvent
                .create({
                  data: {
                    organizationId,
                    actorUserId,
                    action: auditAction as AuditAction,
                    resourceType: model,
                    resourceId,
                  },
                })
                .catch((err: unknown) => {
                  console.error("[scopedPrisma] AuditEvent emit failed:", err);
                });
            }
          }

          return result;
        },
      },
    },
  });
}

function operationToAuditAction(op: string): AuditAction | null {
  if (op === "create" || op === "createMany") return AuditAction.CREATE;
  if (op === "update" || op === "updateMany" || op === "upsert")
    return AuditAction.UPDATE;
  if (op === "delete" || op === "deleteMany") return AuditAction.DELETE;
  return null;
}

function extractResourceId(
  args: Record<string, unknown>,
  result: unknown
): string | null {
  if (result && typeof result === "object" && "id" in result) {
    return (result as { id: string }).id;
  }
  if (
    args.where &&
    typeof args.where === "object" &&
    "id" in (args.where as object)
  ) {
    return (args.where as { id: string }).id;
  }
  return null;
}

function computeRetentionFields(
  model: string | undefined,
  args: { data: Record<string, unknown> }
): Record<string, unknown> {
  const now = (args.data.createdAt as Date | undefined) ?? new Date();

  if (model === "Notification") return { purgeAfter: addDays(now, 90) };
  if (model === "ActivityEvent") return { purgeAfter: addDays(now, 545) };
  if (model === "Message") {
    // Callers pass __retentionDays as a sentinel field; remove it before the DB write.
    const days =
      typeof args.data.__retentionDays === "number"
        ? args.data.__retentionDays
        : 730;
    delete args.data.__retentionDays;
    return { purgeAfter: addDays(now, days) };
  }
  if (model === "TimeEntry") return { legalHoldUntil: addYears(now, 7) };
  if (model === "Invoice") return { legalHoldUntil: addYears(now, 7) };

  return {};
}

function redactPiiInAuditArgs(args: { data: Record<string, unknown> }) {
  for (const jsonField of ["before", "after"] as const) {
    const val = args.data[jsonField];
    if (val && typeof val === "object") {
      const redacted = { ...(val as Record<string, unknown>) };
      for (const key of Object.keys(redacted)) {
        if (PII_FIELDS.has(key)) redacted[key] = "[redacted]";
      }
      args.data[jsonField] = redacted;
    }
  }
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function addYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}
