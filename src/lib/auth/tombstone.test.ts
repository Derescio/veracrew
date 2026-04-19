import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    user: { update: vi.fn() },
    session: { deleteMany: vi.fn() },
    account: { deleteMany: vi.fn() },
  },
}));

import { tombstoneUser } from "./tombstone";
import { prisma } from "@/lib/db/prisma";

describe("tombstoneUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])
    );
    (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.session.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
    (prisma.account.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
  });

  it("calls prisma.$transaction with three operations", async () => {
    await tombstoneUser("user-123");
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    const ops = (prisma.$transaction as ReturnType<typeof vi.fn>).mock.calls[0]![0] as unknown[];
    expect(ops).toHaveLength(3);
  });

  it("erases PII fields on the user", async () => {
    await tombstoneUser("user-123");
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-123" },
        data: expect.objectContaining({
          image: null,
          twoFactorSecret: null,
          twoFactorEnabled: false,
          twoFactorBackupCodes: [],
          deletedAt: expect.any(Date),
        }),
      })
    );
  });

  it("uses a unique opaque email ending with @tombstone.invalid", async () => {
    await tombstoneUser("user-123");
    const data = (prisma.user.update as ReturnType<typeof vi.fn>).mock.calls[0]![0].data as Record<string, unknown>;
    expect((data.email as string).endsWith("@tombstone.invalid")).toBe(true);
  });

  it("deletes sessions for the user", async () => {
    await tombstoneUser("user-123");
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-123" } });
  });

  it("deletes accounts for the user", async () => {
    await tombstoneUser("user-123");
    expect(prisma.account.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-123" } });
  });

  it("is idempotent (can be called multiple times without error)", async () => {
    await tombstoneUser("user-123");
    await tombstoneUser("user-123");
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });
});
