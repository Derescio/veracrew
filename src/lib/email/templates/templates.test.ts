import { describe, it, expect } from "vitest";
import { trialWillEndTemplate } from "./trial-will-end";
import { trialExpiredTemplate } from "./trial-expired";
import { welcomeToPaidTemplate } from "./welcome-to-paid";
import { paymentFailedTemplate } from "./payment-failed";

const BASE_URL = "https://app.veracrew.com/billing";

describe("trialWillEndTemplate", () => {
  it("returns EN subject containing days remaining", () => {
    const { subject } = trialWillEndTemplate({ orgName: "Acme", daysRemaining: 3, billingUrl: BASE_URL });
    expect(subject).toContain("3 day(s)");
  });

  it("returns FR subject in French", () => {
    const { subject } = trialWillEndTemplate({ orgName: "Acme", daysRemaining: 3, billingUrl: BASE_URL }, "fr");
    expect(subject).toContain("jour(s)");
  });

  it("includes billing URL in body", () => {
    const { html } = trialWillEndTemplate({ orgName: "Acme", daysRemaining: 3, billingUrl: BASE_URL });
    expect(html).toContain(BASE_URL);
  });
});

describe("trialExpiredTemplate", () => {
  it("returns EN subject with org name", () => {
    const { subject } = trialExpiredTemplate({ orgName: "Acme", billingUrl: BASE_URL });
    expect(subject).toContain("Acme");
  });

  it("returns FR subject in French", () => {
    const { subject } = trialExpiredTemplate({ orgName: "Acme", billingUrl: BASE_URL }, "fr");
    expect(subject).toMatch(/essai|Veracrew/i);
  });
});

describe("welcomeToPaidTemplate", () => {
  it("includes plan name in EN subject", () => {
    const { subject } = welcomeToPaidTemplate({ orgName: "Acme", planName: "Growth", dashboardUrl: BASE_URL });
    expect(subject).toContain("Growth");
  });

  it("includes dashboard URL in body", () => {
    const { html } = welcomeToPaidTemplate({ orgName: "Acme", planName: "Growth", dashboardUrl: BASE_URL });
    expect(html).toContain(BASE_URL);
  });
});

describe("paymentFailedTemplate", () => {
  it("includes org name in EN subject", () => {
    const { subject } = paymentFailedTemplate({ orgName: "Acme", billingUrl: BASE_URL });
    expect(subject).toContain("Acme");
  });

  it("includes optional retryDate when provided", () => {
    const { html } = paymentFailedTemplate({ orgName: "Acme", billingUrl: BASE_URL, retryDate: "May 1" });
    expect(html).toContain("May 1");
  });

  it("omits retry section when retryDate is not provided", () => {
    const { html } = paymentFailedTemplate({ orgName: "Acme", billingUrl: BASE_URL });
    expect(html).not.toContain("retry");
  });
});
