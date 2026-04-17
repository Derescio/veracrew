# Skill: generate-server-action

Create a Next.js Server Action for Veracrew.

## File Placement

`src/actions/<feature>.ts` — group by domain (team-members, locations, documents, time-tracking, jobs, settings)

## Required Shape

```ts
"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireOrgContext, requireRole } from "@/lib/auth/context";

// 1. Zod schema — validates all inputs
const CreateLocationSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  address: z.string().min(1, "Address is required"),
});

// 2. Typed return — always { data } or { error }
type ActionResult<T> =
  | { data: T; error?: never }
  | { error: string; data?: never };

export async function createLocation(
  formData: FormData
): Promise<ActionResult<{ id: string; name: string }>> {
  // 3. Org context — user/org/role always from trusted server state
  const context = await requireOrgContext();
  requireRole(context.role, "MANAGER");

  // 4. Validate
  const parsed = CreateLocationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // 5. Mutate — always in try/catch
  try {
    const location = await prisma.location.create({
      data: {
        ...parsed.data,
        organizationId: context.organizationId,
      },
      select: { id: true, name: true },
    });
    revalidatePath("/locations");
    return { data: location };
  } catch (error) {
    console.error("createLocation failed", { error });
    return { error: "Failed to create location" };
  }
}
```

## Rules

- `"use server"` at the top — always
- Validate with Zod before any DB call
- Resolve `userId`, `organizationId`, and role from trusted org context helpers
- Never trust form input for org ownership or role decisions
- Return `{ data }` or `{ error: string }` — never throw from an action
- Wrap all Prisma calls in `try/catch`
- Call `revalidatePath()` or `revalidateTag()` after mutations that affect cached UI
- Select only the fields the caller needs — never return full records

## Checklist

- [ ] `"use server"` present
- [ ] Zod schema defined and used
- [ ] org context checked first
- [ ] role enforced when needed
- [ ] `organizationId` sourced from context
- [ ] DB call in `try/catch`
- [ ] Returns `{ data }` or `{ error }`
- [ ] `revalidatePath` called if UI cache needs updating
