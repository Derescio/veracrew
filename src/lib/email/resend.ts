import { Resend } from "resend";
import { env } from "@/lib/env";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    // Fix #9: use validated env singleton instead of raw process.env
    _resend = new Resend(env.RESEND_API_KEY ?? "");
  }
  return _resend;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

/**
 * Sends a transactional email via Resend.
 * Throws on API error — callers (billing crons) must wrap in try/catch.
 */
export async function sendEmail({
  to,
  subject,
  html,
  from,
}: SendEmailOptions): Promise<void> {
  // Fix #11: use validated env; throw explicitly rather than silently using an unverified fallback
  const fromAddress = from ?? env.EMAIL_FROM;
  if (!fromAddress) {
    throw new Error("EMAIL_FROM is not configured");
  }

  const { error } = await getResend().emails.send({
    from: fromAddress,
    to,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
