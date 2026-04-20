import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, MapPin, Upload } from "lucide-react";

interface QuickActionsProps {
  locale: string;
}

const ACTIONS = [
  { label: "Add Crew Member", icon: UserPlus, href: "/team" },
  { label: "Create Location", icon: MapPin, href: "/locations" },
  { label: "Upload Document", icon: Upload, href: "/documents" },
] as const;

export function QuickActions({ locale }: QuickActionsProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pb-4">
        {ACTIONS.map((action) => (
          <Button
            key={action.label}
            asChild
            variant="outline"
            className="w-full justify-start gap-2"
          >
            <Link href={`/${locale}${action.href}`}>
              <action.icon className="size-4" />
              {action.label}
            </Link>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
