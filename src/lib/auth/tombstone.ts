import { prisma } from "@/lib/db/prisma";

/**
 * GDPR erasure: replaces user PII with opaque tokens, revokes all sessions
 * and account links, and marks the user as deleted.
 *
 * Safe to call multiple times (idempotent: subsequent calls overwrite the
 * tombstone values but produce no error).
 */
export async function tombstoneUser(userId: string): Promise<void> {
  // Fix #5: deterministic suffix based on userId makes the function truly idempotent
  // and keeps tombstone events correlatable in audit logs.
  const suffix = userId.slice(-8);
  const tombstoneName = `deleted-user-${suffix}`;
  const tombstoneEmail = `deleted-${suffix}@tombstone.invalid`;

  await prisma.$transaction([
    // Erase PII on the User row.
    prisma.user.update({
      where: { id: userId },
      data: {
        name: tombstoneName,
        email: tombstoneEmail,
        image: null,
        twoFactorSecret: null,
        twoFactorEnabled: false,
        twoFactorBackupCodes: [],
        locale: "en",
        deletedAt: new Date(),
      },
    }),
    // Revoke all active sessions.
    prisma.session.deleteMany({ where: { userId } }),
    // Remove all OAuth / credentials account links.
    prisma.account.deleteMany({ where: { userId } }),
    // Fix #2: suspend memberships so live tokens can't bypass requireOrgContext()
    prisma.membership.updateMany({
      where: { userId },
      data: { status: "SUSPENDED" },
    }),
    // Fix #2: revoke any pending invites the user sent to prevent ghost-inviting
    prisma.invite.updateMany({
      where: { invitedById: userId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}
