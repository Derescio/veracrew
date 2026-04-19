import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/billing/stripe";
import { handleStripeWebhook } from "@/lib/billing/webhook-handlers";
import { env } from "@/lib/env";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let rawBody: Buffer;
  try {
    const bytes = await req.arrayBuffer();
    rawBody = Buffer.from(bytes);
  } catch {
    return NextResponse.json({ error: "Failed to read request body" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signature verification failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    await handleStripeWebhook(event);
  } catch (err) {
    console.error("[webhook/stripe] handler failed", { eventId: event.id, eventType: event.type, err });
    // Return 500 so Stripe retries the event
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
