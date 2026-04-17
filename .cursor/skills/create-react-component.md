# Skill: create-react-component

Create a React component for Veracrew following project conventions.

## Decision: Server or Client?

- **Server Component** (default): data fetching, read-only display, no interactivity
- **Client Component** (`"use client"`): event handlers, hooks, browser APIs, controlled inputs

Never fetch data inside a Client Component — pass data as props from a Server Component.

## File Placement

- Shared across routes → `src/components/<name>.tsx`
- Scoped to a route → `src/app/<route>/_components/<name>.tsx`
- One component per file; filename must match exported function name (kebab-case filename)

## Props Interface

Always define a named `interface <ComponentName>Props` — never inline complex types.

```tsx
interface TeamMemberCardProps {
  id: string;
  name: string | null;
  email: string;
  role: string;
}
```

## Styling

- TailwindCSS v4 utility classes only — no inline styles, no CSS Modules
- Use `cn()` from `@/lib/utils` for conditional class merging
- Dark mode first — use `dark:` variant when needed
- Use shadcn/ui primitives (`Button`, `Card`, `Badge`, `Dialog`, etc.) before building custom HTML

## Patterns

### Server Component
```tsx
import { getTeamMembers } from "@/lib/db/team-members";

interface TeamMembersListProps {
  organizationId: string;
}

export default async function TeamMembersList({
  organizationId,
}: TeamMembersListProps) {
  const members = await getTeamMembers(organizationId);

  if (members.length === 0) {
    return <p className="text-muted-foreground">No team members yet.</p>;
  }

  return (
    <ul className="grid gap-3">
      {members.map((member) => (
        <li key={member.id}>{member.email}</li>
      ))}
    </ul>
  );
}
```

### Client Component
```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  initialActive: boolean;
}

export function FavoriteButton({ initialActive }: FavoriteButtonProps) {
  const [active, setActive] = useState(initialActive);

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("text-muted-foreground", active && "text-yellow-400")}
      onClick={() => setActive((prev) => !prev)}
    >
      ★
    </Button>
  );
}
```

## Checklist

- [ ] Correct Server vs Client decision
- [ ] Named `interface <Name>Props`
- [ ] Uses `cn()` for conditional classes
- [ ] Uses shadcn/ui primitives where applicable
- [ ] File placed in correct directory
- [ ] No unused imports
