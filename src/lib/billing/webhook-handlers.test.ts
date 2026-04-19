import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuditAction, OrgStatus, PlanKey } from "@/generated/prisma/client";
import type Stripe from "stripe";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    stripeWebhookEvent: {
      create: vi.fn(),
      update: vi.fn(),
    },
    orgSubscription: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
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

vi.mock("@/lib/billing/plan-mapping", () => ({
  resolvePlanKey: vi.fn().mockReturnValue(PlanKey.GROWTH),
}));

import { prisma } from "@/lib/db/prisma";
import { handleStripeWebhook } from "@/lib/billing/webhook-handlers";

const mockWebhookEvent = prisma.stripeWebhookEvent as {
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};
const mockOrgSub = prisma.orgSubscription as {
  findUnique: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
};
const mockOrg = prisma.organization as {
  findUnique: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};
const mockAudit = prisma.auditEvent as { create: ReturnType<typeof vi.fn> };
const mockActivity = prisma.activityEvent as { create: ReturnType<typeof vi.fn> };
const mockTx = prisma.$transaction as ReturnType<typeof vi.fn>;

function makeStripeEvent(
  type: string,
  data: Record<string, unknown>,
  id = "evt_test_001"
): Stripe.Event {
  return { id, type, data: { object: data } } as unknown as Stripe.Event;
}

function makeSub(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "sub_test_001",
    customer: "cus_test_001",
    status: "trialing",
    items: { data: [{ price: { id: "price_test_growth" }, quantity: 5 }] },
    trial_end: Math.floor(Date.now() / 1000) + 86400 * 14,
    current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
    cancel_at_period_end: false,
    default_payment_method: null,
    latest_invoice: null,
    ...overrides,
  };
}

function makeInvoice(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "in_test_001",
    subscription: "sub_test_001",
    parent: {
      type: "subscription_details",
      subscription_details: { subscription: "sub_test_001" },
    },
    ...overrides,
  };
}

describe("handleStripeWebhook — idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(prisma)
    );
  });

  it("processes event once and returns cleanly on duplicate (P2002)", async () => {
    const p2002 = Object.assign(new Error("Unique constraint"), { code: "P2002" });
    mockWebhookEvent.create.mockRejectedValueOnce(p2002);

    const event = makeStripeEvent("customer.subscription.created", makeSub());
    await expect(handleStripeWebhook(event)).resolves.toBeUndefined();

    // Handler should not run after idempotency guard short-circuits
    expect(mockOrg.findUnique).not.toHaveBeenCalled();
  });

  it("rethrows non-P2002 errors from stripeWebhookEvent.create", async () => {
    mockWebhookEvent.create.mockRejectedValueOnce(new Error("DB connection failed"));

    const event = makeStripeEvent("customer.subscription.created", makeSub());
    await expect(handleStripeWebhook(event)).rejects.toThrow("DB connection failed");
  });
});

describe("handleStripeWebhook — subscription.updated (trialing → active)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWebhookEvent.create.mockResolvedValue({});
    mockWebhookEvent.update.mockResolvedValue({});
    mockTx.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(prisma)
    );
    mockOrgSub.update.mockResolvedValue({});
    mockOrg.update.mockResolvedValue({});
    mockAudit.create.mockResolvedValue({});
    mockActivity.create.mockResolvedValue({});
  });

  it("transitions org status to ACTIVE and emits audit + activity events", async () => {
    mockOrgSub.findUnique.mockResolvedValue({
      organizationId: "org-1",
      status: "trialing",
      hasPaymentMethod: false,
      organization: { status: OrgStatus.TRIALING },
    });

    const sub = makeSub({ status: "active", default_payment_method: "pm_123" });
    const event = makeStripeEvent("customer.subscription.updated", sub);
    await handleStripeWebhook(event);

    expect(mockOrg.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: OrgStatus.ACTIVE },
      })
    );

    const auditCalls = mockAudit.create.mock.calls.map(
      (c: [{ data: { action: string } }]) => c[0].data.action
    );
    expect(auditCalls).toContain(AuditAction.SUBSCRIPTION_ACTIVATED);
    expect(auditCalls).toContain(AuditAction.SUBSCRIPTION_PAYMENT_METHOD_ADDED);
  });
});

describe("handleStripeWebhook — invoice.payment_failed (active → past_due)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWebhookEvent.create.mockResolvedValue({});
    mockWebhookEvent.update.mockResolvedValue({});
    mockTx.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(prisma)
    );
    mockOrgSub.update.mockResolvedValue({});
    mockOrg.update.mockResolvedValue({});
    mockAudit.create.mockResolvedValue({});
    mockActivity.create.mockResolvedValue({});
  });

  it("transitions org to PAST_DUE and emits audit event (no activity event)", async () => {
    mockOrgSub.findUnique.mockResolvedValue({
      organizationId: "org-1",
      organization: { status: OrgStatus.ACTIVE },
    });

    const invoice = makeInvoice();
    const event = makeStripeEvent("invoice.payment_failed", invoice);
    await handleStripeWebhook(event);

    expect(mockOrg.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: OrgStatus.PAST_DUE },
      })
    );

    const auditActions = mockAudit.create.mock.calls.map(
      (c: [{ data: { action: string } }]) => c[0].data.action
    );
    expect(auditActions).toContain(AuditAction.SUBSCRIPTION_PAYMENT_FAILED);
    expect(mockActivity.create).not.toHaveBeenCalled();
  });
});

describe("handleStripeWebhook — invoice.payment_succeeded (TRIAL_EXPIRED → ACTIVE)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWebhookEvent.create.mockResolvedValue({});
    mockWebhookEvent.update.mockResolvedValue({});
    mockTx.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(prisma)
    );
    mockOrgSub.update.mockResolvedValue({});
    mockOrg.update.mockResolvedValue({});
    mockAudit.create.mockResolvedValue({});
    mockActivity.create.mockResolvedValue({});
  });

  it("reactivates org and emits SUBSCRIPTION_ACTIVATED audit + activity", async () => {
    mockOrgSub.findUnique.mockResolvedValue({
      organizationId: "org-1",
      organization: { status: OrgStatus.TRIAL_EXPIRED },
    });

    const invoice = makeInvoice();
    const event = makeStripeEvent("invoice.payment_succeeded", invoice);
    await handleStripeWebhook(event);

    expect(mockOrg.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: OrgStatus.ACTIVE },
      })
    );

    const auditActions = mockAudit.create.mock.calls.map(
      (c: [{ data: { action: string } }]) => c[0].data.action
    );
    expect(auditActions).toContain(AuditAction.SUBSCRIPTION_ACTIVATED);
    const activityVerbs = mockActivity.create.mock.calls.map(
      (c: [{ data: { verb: string } }]) => c[0].data.verb
    );
    expect(activityVerbs).toContain("SUBSCRIPTION_ACTIVATED");
  });

  it("does nothing when org is already ACTIVE", async () => {
    mockOrgSub.findUnique.mockResolvedValue({
      organizationId: "org-1",
      organization: { status: OrgStatus.ACTIVE },
    });

    const invoice = makeInvoice();
    const event = makeStripeEvent("invoice.payment_succeeded", invoice);
    await handleStripeWebhook(event);

    expect(mockOrg.update).not.toHaveBeenCalled();
    expect(mockAudit.create).not.toHaveBeenCalled();
  });
});

describe("handleStripeWebhook — trial_will_end", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWebhookEvent.create.mockResolvedValue({});
    mockWebhookEvent.update.mockResolvedValue({});
    mockAudit.create.mockResolvedValue({});
    mockActivity.create.mockResolvedValue({});
  });

  it("does not emit audit or activity when payment method exists", async () => {
    mockOrgSub.findUnique.mockResolvedValue({
      organizationId: "org-1",
      hasPaymentMethod: true,
      organization: { status: OrgStatus.TRIALING },
    });

    const sub = makeSub({ default_payment_method: "pm_123" });
    const event = makeStripeEvent("customer.subscription.trial_will_end", sub);
    await handleStripeWebhook(event);

    expect(mockAudit.create).not.toHaveBeenCalled();
    expect(mockActivity.create).not.toHaveBeenCalled();
  });

  it("does not emit audit or activity even when no payment method (email suppressed in handler)", async () => {
    mockOrgSub.findUnique.mockResolvedValue({
      organizationId: "org-1",
      hasPaymentMethod: false,
      organization: { status: OrgStatus.TRIALING },
    });

    const sub = makeSub({ default_payment_method: null });
    const event = makeStripeEvent("customer.subscription.trial_will_end", sub);
    await handleStripeWebhook(event);

    expect(mockAudit.create).not.toHaveBeenCalled();
    expect(mockActivity.create).not.toHaveBeenCalled();
  });
});
