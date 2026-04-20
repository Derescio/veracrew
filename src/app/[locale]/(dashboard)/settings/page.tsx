import Link from "next/link";
import { requireOrgContext } from "@/lib/auth/context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, Briefcase, Shield, Bell } from "lucide-react";

const SETTING_SECTIONS = [
  {
    href: "settings/billing",
    title: "Billing",
    description: "Manage your subscription, payment method, and plan.",
    icon: CreditCard,
    adminOnly: true,
  },
  {
    href: "settings/job-roles",
    title: "Trades",
    description: "Define worker trades and their default hourly rates.",
    icon: Briefcase,
    adminOnly: true,
  },
  {
    href: "settings/security",
    title: "Security",
    description: "Two-factor authentication and account security.",
    icon: Shield,
    adminOnly: false,
  },
  {
    href: "settings/notifications",
    title: "Notifications",
    description: "Configure email and push notification preferences.",
    icon: Bell,
    adminOnly: false,
  },
] as const;

interface SettingsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { locale } = await params;
  const ctx = await requireOrgContext();
  const isAdmin = ctx.role === "OWNER" || ctx.role === "ADMIN";

  const sections = SETTING_SECTIONS.filter((s) => !s.adminOnly || isAdmin);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your organization and account settings</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((section) => (
          <Link key={section.href} href={`/${locale}/${section.href}`}>
            <Card className="transition-colors hover:bg-accent">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                    <section.icon className="size-4 text-primary" />
                  </div>
                  <CardTitle className="text-base">{section.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{section.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
