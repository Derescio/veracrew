"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface SidebarNavItemProps {
  href: string;
  label: string;
  icon: React.ReactNode;
}

export function SidebarNavItem({ href, label, icon }: SidebarNavItemProps) {
  const pathname = usePathname();

  // Strip the first two path segments (leading slash + locale) before matching.
  // e.g. "/en/dashboard" → "/dashboard"
  const withoutLocale = "/" + pathname.split("/").slice(2).join("/");
  const isActive = withoutLocale === href || withoutLocale.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      <span className="size-4 shrink-0">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
