# Template: React Component

## Server Component (default)

```tsx
import { getTeamMembers } from "@/lib/db/team-members";

interface ComponentNameProps {
  organizationId: string;
}

export default async function ComponentName({
  organizationId,
}: ComponentNameProps) {
  const members = await getTeamMembers(organizationId);

  if (members.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No team members found yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      {members.map((member) => (
        <div key={member.id} className="rounded-lg border p-4">
          <p className="font-medium">{member.name}</p>
        </div>
      ))}
    </div>
  );
}
```

## Client Component

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ComponentNameProps {
  initialValue: boolean;
  label: string;
  onToggle?: (value: boolean) => void;
}

export function ComponentName({
  initialValue,
  label,
  onToggle,
}: ComponentNameProps) {
  const [active, setActive] = useState(initialValue);

  function handleClick() {
    const next = !active;
    setActive(next);
    onToggle?.(next);
  }

  return (
    <Button
      variant="ghost"
      className={cn("text-muted-foreground", active && "text-primary")}
      onClick={handleClick}
    >
      {label}
    </Button>
  );
}
```

## Checklist

- [ ] `"use client"` only if truly needed
- [ ] Named `interface <Name>Props`
- [ ] `cn()` used for conditional classes
- [ ] shadcn/ui primitives preferred
- [ ] No data fetching in Client Components
- [ ] File named in kebab-case matching component name
