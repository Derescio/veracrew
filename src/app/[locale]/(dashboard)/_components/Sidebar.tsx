import { SidebarNavItem } from "./SidebarNavItem";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "⊞" },
  { href: "/team", label: "Team", icon: "👥" },
  { href: "/schedule", label: "Schedule", icon: "📅" },
  { href: "/clock-in", label: "Clock In/Out", icon: "⏱" },
  { href: "/documents", label: "Documents", icon: "📄" },
  { href: "/compliance", label: "Compliance", icon: "✅" },
  { href: "/payroll", label: "Payroll", icon: "💰" },
  { href: "/reports", label: "Reports", icon: "📊" },
  { href: "/settings", label: "Settings", icon: "⚙" },
] as const;

interface SidebarProps {
  locale: string;
}

export function Sidebar({ locale }: SidebarProps) {
  void locale;

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-background">
      <div className="flex h-14 items-center border-b px-4">
        <span className="text-lg font-semibold tracking-tight">Veracrew</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => (
          <SidebarNavItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
          />
        ))}
      </nav>
    </aside>
  );
}
