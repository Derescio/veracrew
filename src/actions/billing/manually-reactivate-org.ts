"use server";

/**
 * SUPERUSER-only stub for manually reactivating a cancelled/suspended org.
 *
 * INVARIANT: Implementation MUST call the Stripe API to reactivate the
 * subscription BEFORE updating the DB. Flipping the DB status without Stripe
 * alignment will be immediately overwritten by the next webhook event.
 *
 * This stub intentionally throws to prevent accidental partial implementations.
 * Full implementation is scheduled for Phase 8.
 */
export async function manuallyReactivateOrg(
  _organizationId: string,
  _reason: string
): Promise<void> {
  throw new Error(
    "Not implemented — manuallyReactivateOrg must call the Stripe API before any DB update. " +
      "See Phase 8 spec for the full implementation."
  );
}
