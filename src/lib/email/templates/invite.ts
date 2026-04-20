import { sendEmail } from "@/lib/email/resend";
import type { Role } from "@/generated/prisma/client";

const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MANAGER: "Manager",
  WORKER: "Worker",
};

interface SendInviteEmailParams {
  to: string;
  orgName: string;
  inviteUrl: string;
  role: Role;
}

export async function sendInviteEmail({
  to,
  orgName,
  inviteUrl,
  role,
}: SendInviteEmailParams): Promise<void> {
  const roleLabel = ROLE_LABELS[role];

  await sendEmail({
    to,
    subject: `You've been invited to join ${orgName} on Veracrew`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #111;">
  <div style="margin-bottom: 24px;">
    <strong style="font-size: 20px;">Veracrew</strong>
  </div>

  <h1 style="font-size: 22px; font-weight: 600; margin-bottom: 8px;">
    You&apos;re invited to join ${orgName}
  </h1>

  <p style="color: #555; margin-bottom: 24px;">
    You&apos;ve been invited to join <strong>${orgName}</strong> as a <strong>${roleLabel}</strong> on Veracrew.
    Click the button below to accept your invitation and set up your account.
  </p>

  <a href="${inviteUrl}"
     style="display: inline-block; background: #111; color: #fff; padding: 12px 24px;
            border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 14px;">
    Accept invitation
  </a>

  <p style="color: #888; font-size: 12px; margin-top: 32px;">
    This invitation expires in 7 days. If you didn&apos;t expect this email, you can safely ignore it.
  </p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
  <p style="color: #aaa; font-size: 11px;">
    Veracrew — Workforce operations for field crews.<br>
    <a href="${inviteUrl}" style="color: #888;">${inviteUrl}</a>
  </p>
</body>
</html>
    `,
  });
}
