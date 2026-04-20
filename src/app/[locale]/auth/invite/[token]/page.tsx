import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import { InviteAcceptForm } from "./_components/InviteAcceptForm";

interface InvitePageProps {
  params: Promise<{ locale: string; token: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { locale, token } = await params;

  const invite = await prisma.invite.findUnique({
    where: { token },
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      organization: { select: { name: true } },
    },
  });

  if (!invite) notFound();

  if (invite.revokedAt) {
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <h1 className="text-xl font-semibold">Invite revoked</h1>
        <p className="text-sm text-muted-foreground">
          This invitation has been revoked. Please contact your organization admin for a new invite.
        </p>
      </div>
    );
  }

  if (invite.acceptedAt) {
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <h1 className="text-xl font-semibold">Already accepted</h1>
        <p className="text-sm text-muted-foreground">
          This invitation has already been used. Please sign in to access your account.
        </p>
      </div>
    );
  }

  if (invite.expiresAt < new Date()) {
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <h1 className="text-xl font-semibold">Invite expired</h1>
        <p className="text-sm text-muted-foreground">
          This invitation has expired. Please contact your organization admin for a new one.
        </p>
      </div>
    );
  }

  return (
    <InviteAcceptForm
      locale={locale}
      token={token}
      email={invite.email}
      role={invite.role}
      orgName={invite.organization.name}
    />
  );
}
