import { prisma } from "@/lib/db/prisma";
import { randomBytes } from "crypto";

/**
 * GDPR erasure: replaces user PII with opaque tokens, revokes all sessions
 * and account links, and marks the user as deleted.
 *
 * Safe to call multiple times (idempotent: subsequent calls overwrite the
 * tombstone values but produce no error).
 */
export async function tombstoneUser(userId: string): Promise<void> {
  const suffix = randomBytes(8).toString("hex");
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
  ]);
}
