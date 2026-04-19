import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrgStatus, AuditAction } from "@/generated/prisma/client";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    orgSubscription: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    organization: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    auditEvent: {
      create: vi.fn(),
    },
    activityEvent: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/db/prisma";
import { checkTrialExpiry, checkPastDueExpiry } from "@/jobs/billing-crons";

const mockOrgSub = prisma.orgSubscription as {
  findMany: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};
const mockOrg = prisma.organization as {
  findMany: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};
const mockAudit = prisma.auditEvent as { create: ReturnType<typeof vi.fn> };
const mockActivity = prisma.activityEvent as { create: ReturnType<typeof vi.fn> };
const mockTx = prisma.$transaction as ReturnType<typeof vi.fn>;

describe("checkTrialExpiry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(prisma)
    );
    mockAudit.create.mockResolvedValue({});
    mockActivity.create.mockResolvedValue({});
  });

  it("transitions TRIALING orgs with expired trials to TRIAL_EXPIRED", async () => {
    mockOrgSub.findMany.mockResolvedValue([
      {
        organizationId: "org-1",
        stripeSubscriptionId: "sub_001",
        organization: { status: OrgStatus.TRIALING },
      },
    ]);
    mockOrg.update = vi.fn().mockResolvedValue({});
    mockOrgSub.update = vi.fn().mockResolvedValue({});

    await checkTrialExpiry();

    expect(mockOrg.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: OrgStatus.TRIAL_EXPIRED },
        where: { id: "org-1" },
      })
    );
  });

  it("emits SUBSCRIPTION_TRIAL_EXPIRED audit event", async () => {
    mockOrgSub.findMany.mockResolvedValue([
      {
        organizationId: "org-1",
        stripeSubscriptionId: "sub_001",
        organization: { status: OrgStatus.TRIALING },
      },
    ]);
    mockOrg.update = vi.fn().mockResolvedValue({});
    mockOrgSub.update = vi.fn().mockResolvedValue({});

    await checkTrialExpiry();

    const auditActions = mockAudit.create.mock.calls.map(
      (c: [{ data: { action: string } }]) => c[0].data.action
    );
    expect(auditActions).toContain(AuditAction.SUBSCRIPTION_TRIAL_EXPIRED);
  });

  it("skips orgs that are already TRIAL_EXPIRED (idempotent)", async () => {
    mockOrgSub.findMany.mockResolvedValue([
      {
        organizationId: "org-1",
        stripeSubscriptionId: "sub_001",
        organization: { status: OrgStatus.TRIAL_EXPIRED },
      },
    ]);

    await checkTrialExpiry();

    expect(mockTx).not.toHaveBeenCalled();
    expect(mockAudit.create).not.toHaveBeenCalled();
  });

  it("does nothing when no orgs have expired trials", async () => {
    mockOrgSub.findMany.mockResolvedValue([]);

    await checkTrialExpiry();

    expect(mockTx).not.toHaveBeenCalled();
    expect(mockAudit.create).not.toHaveBeenCalled();
  });
});

describe("checkPastDueExpiry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAudit.create.mockResolvedValue({});
    mockActivity.create.mockResolvedValue({});
    mockOrg.update = vi.fn().mockResolvedValue({});
  });

  it("cancels PAST_DUE orgs that exceeded the grace period", async () => {
    mockOrg.findMany.mockResolvedValue([
      {
        id: "org-1",
        status: OrgStatus.PAST_DUE,
        subscription: { stripeSubscriptionId: "sub_001" },
      },
    ]);

    await checkPastDueExpiry();

    expect(mockOrg.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: OrgStatus.CANCELLED },
        where: { id: "org-1" },
      })
    );
  });

  it("emits SUBSCRIPTION_CANCELLED audit and activity events", async () => {
    mockOrg.findMany.mockResolvedValue([
      {
        id: "org-1",
        status: OrgStatus.PAST_DUE,
        subscription: { stripeSubscriptionId: "sub_001" },
      },
    ]);

    await checkPastDueExpiry();

    const auditActions = mockAudit.create.mock.calls.map(
      (c: [{ data: { action: string } }]) => c[0].data.action
    );
    expect(auditActions).toContain(AuditAction.SUBSCRIPTION_CANCELLED);

    const activityVerbs = mockActivity.create.mock.calls.map(
      (c: [{ data: { verb: string } }]) => c[0].data.verb
    );
    expect(activityVerbs).toContain("SUBSCRIPTION_CANCELLED");
  });

  it("skips orgs with no subscription record", async () => {
    mockOrg.findMany.mockResolvedValue([
      {
        id: "org-2",
        status: OrgStatus.PAST_DUE,
        subscription: null,
      },
    ]);

    await checkPastDueExpiry();

    expect(mockOrg.update).not.toHaveBeenCalled();
  });

  it("does nothing when no orgs exceed the grace period", async () => {
    mockOrg.findMany.mockResolvedValue([]);

    await checkPastDueExpiry();

    expect(mockOrg.update).not.toHaveBeenCalled();
    expect(mockAudit.create).not.toHaveBeenCalled();
  });
});
