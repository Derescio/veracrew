import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Clock, FileWarning, MapPin } from "lucide-react";

const PLACEHOLDER_ALERTS = [
  { icon: FileWarning, label: "3 Documents Expiring", color: "text-amber-500" },
  { icon: Clock, label: "2 Late Clock-Ins", color: "text-red-500" },
  { icon: MapPin, label: "1 Out of Location", color: "text-orange-500" },
];

export function AlertsPanel() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="size-4 text-amber-500" />
          Alerts &amp; Tasks
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pb-4">
        {PLACEHOLDER_ALERTS.map((a) => (
          <div
            key={a.label}
            className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
          >
            <a.icon className={`size-4 shrink-0 ${a.color}`} />
            <span className="text-muted-foreground">{a.label}</span>
          </div>
        ))}
        <p className="pt-1 text-center text-xs text-muted-foreground">
          Live alerts wired in Phase 5
        </p>
      </CardContent>
    </Card>
  );
}
