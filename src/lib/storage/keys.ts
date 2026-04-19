/**
 * Object key generators that enforce per-org namespace isolation.
 * All keys are prefixed with `org_{organizationId}/` to prevent
 * cross-tenant access in presign and download checks.
 */

export function makeDocKey(
  organizationId: string,
  documentId: string,
  filename: string
): string {
  return `org_${organizationId}/docs/${documentId}/${filename}`;
}

export function makeImageKey(
  organizationId: string,
  entityId: string,
  filename: string
): string {
  return `org_${organizationId}/images/${entityId}/${filename}`;
}

export function makeTemplateKey(
  organizationId: string,
  templateId: string,
  filename: string
): string {
  return `org_${organizationId}/templates/${templateId}/${filename}`;
}
