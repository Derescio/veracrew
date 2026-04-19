import { requireOrgContext } from "@/lib/auth/context";
import { requireOrgActive } from "@/lib/auth/org-status";
import { OrgInactiveError } from "@/lib/errors";
import { redirect } from "next/navigation";
import { Sidebar } from "./_components/Sidebar";
import { Header } from "./_components/Header";

interface DashboardLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function DashboardLayout({ children, params }: DashboardLayoutProps) {
  const { locale } = await params;

  const ctx = await requireOrgContext();

  try {
    await requireOrgActive(ctx);
  } catch (error) {
    if (error instanceof OrgInactiveError) {
      redirect(`/${locale}/billing-expired`);
    }
    throw error;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar locale={locale} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header ctx={ctx} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
