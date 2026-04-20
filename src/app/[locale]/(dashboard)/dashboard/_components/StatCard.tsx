import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  note?: string;
}

export function StatCard({ title, value, icon: Icon, iconColor, iconBg, note }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
          {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
        </div>
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", iconBg)}>
          <Icon className={cn("size-5", iconColor)} />
        </div>
      </CardContent>
    </Card>
  );
}
