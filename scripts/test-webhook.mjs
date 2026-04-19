/**
 * Webhook smoke test — no Stripe CLI required.
 *
 * Usage (from project root):
 *   node scripts/test-webhook.mjs
 *   node scripts/test-webhook.mjs customer.subscription.updated
 *
 * Reads STRIPE_WEBHOOK_SECRET from .env automatically.
 * Requires the dev server to be running on http://localhost:3000
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";

// ─── Load .env ────────────────────────────────────────────────────────────────

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, "../.env");
const envVars = {};
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
  envVars[key] = val;
}

const WEBHOOK_SECRET = envVars.STRIPE_WEBHOOK_SECRET;
const STRIPE_SECRET = envVars.STRIPE_SECRET_KEY;
const PRICE_ID = envVars.STRIPE_PRICE_ID_GROWTH;
const BASE_URL = "http://localhost:3000";

if (!WEBHOOK_SECRET) {
  console.error("❌  STRIPE_WEBHOOK_SECRET not found in .env");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET, { apiVersion: "2026-03-25.dahlia" });

// ─── Mock payloads ────────────────────────────────────────────────────────────

const now = Math.floor(Date.now() / 1000);
const FAKE_CUSTOMER = "cus_test_smoke001";
const FAKE_SUB_ID = "sub_test_smoke001";

const EVENTS = {
  "customer.subscription.created": {
    id: FAKE_SUB_ID,
    object: "subscription",
    customer: FAKE_CUSTOMER,
    status: "trialing",
    trial_end: now + 86400 * 14,
    current_period_end: now + 86400 * 30,
    cancel_at_period_end: false,
    default_payment_method: null,
    latest_invoice: null,
    items: { data: [{ price: { id: PRICE_ID }, quantity: 3 }] },
  },
  "customer.subscription.updated": {
    id: FAKE_SUB_ID,
    object: "subscription",
    customer: FAKE_CUSTOMER,
    status: "active",
    trial_end: now - 1,
    current_period_end: now + 86400 * 30,
    cancel_at_period_end: false,
    default_payment_method: "pm_test_001",
    latest_invoice: null,
    items: { data: [{ price: { id: PRICE_ID }, quantity: 3 }] },
  },
  "invoice.payment_succeeded": {
    id: "in_test_smoke001",
    object: "invoice",
    subscription: FAKE_SUB_ID,
    customer: FAKE_CUSTOMER,
    status: "paid",
  },
  "invoice.payment_failed": {
    id: "in_test_smoke002",
    object: "invoice",
    subscription: FAKE_SUB_ID,
    customer: FAKE_CUSTOMER,
    status: "open",
  },
  "customer.subscription.trial_will_end": {
    id: FAKE_SUB_ID,
    object: "subscription",
    customer: FAKE_CUSTOMER,
    status: "trialing",
    trial_end: now + 86400 * 3,
    current_period_end: now + 86400 * 14,
    cancel_at_period_end: false,
    default_payment_method: null,
    latest_invoice: null,
    items: { data: [{ price: { id: PRICE_ID }, quantity: 3 }] },
  },
  "customer.subscription.deleted": {
    id: FAKE_SUB_ID,
    object: "subscription",
    customer: FAKE_CUSTOMER,
    status: "canceled",
    trial_end: null,
    current_period_end: now - 1,
    cancel_at_period_end: false,
    default_payment_method: null,
    latest_invoice: null,
    items: { data: [{ price: { id: PRICE_ID }, quantity: 3 }] },
  },
};

// ─── Send one event ───────────────────────────────────────────────────────────

async function sendEvent(eventType) {
  const dataObject = EVENTS[eventType];
  if (!dataObject) {
    console.error(`❌  Unknown event type: ${eventType}`);
    console.error(`    Available: ${Object.keys(EVENTS).join(", ")}`);
    process.exit(1);
  }

  const event = {
    id: `evt_test_${Date.now()}`,
    object: "event",
    type: eventType,
    created: now,
    data: { object: dataObject },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
  };

  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: WEBHOOK_SECRET,
  });

  console.log(`\n→ Sending: ${eventType}`);

  let res;
  try {
    res = await fetch(`${BASE_URL}/api/webhooks/stripe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": header,
      },
      body: payload,
    });
  } catch {
    console.error(`   ❌  Could not reach ${BASE_URL} — is the dev server running?`);
    process.exit(1);
  }

  const body = await res.text();
  const icon = res.ok ? "✅" : res.status >= 500 ? "🔴" : "🟡";
  console.log(`   ${icon} ${res.status} ${res.statusText}`);
  if (body) {
    try {
      console.log("  ", JSON.stringify(JSON.parse(body)));
    } catch {
      console.log("  ", body);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const target = process.argv[2];

if (target) {
  await sendEvent(target);
} else {
  console.log("🧪  Running all webhook smoke tests against", BASE_URL);
  for (const eventType of Object.keys(EVENTS)) {
    await sendEvent(eventType);
  }
  console.log("\nDone. Green ✅ = accepted (200). Yellow 🟡 = bad request (4xx). Red 🔴 = handler error (500 — check dev server logs).");
}
