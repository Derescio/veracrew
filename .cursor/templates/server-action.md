# Template: Server Action

Copy this template when creating a new server action in `src/actions/<feature>.ts`.

```ts
"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireOrgContext, requireRole } from "@/lib/auth/context";

// --- Zod Schema -----------------------------------------------------------
const ActionSchema = z.object({
  // Replace with actual fields
  name: z.string().min(1, "Name is required").max(200),
});

type ActionInput = z.infer<typeof ActionSchema>;

// --- Return type ----------------------------------------------------------
type ActionResult<T> =
  | { data: T; error?: never }
  | { error: string; data?: never };

// --- Action ---------------------------------------------------------------
export async function doSomething(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  // 1. Auth + org context
  const context = await requireOrgContext();
  requireRole(context.role, "MANAGER");

  // 2. Validate
  const parsed = ActionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  // 3. Mutate
  try {
    const result = await prisma.location.create({
      data: {
        ...parsed.data,
        organizationId: context.organizationId,
      },
      select: { id: true },
    });
    revalidatePath("/locations");
    return { data: result };
  } catch (error) {
    console.error("doSomething failed", { error });
    return { error: "Failed to complete action" };
  }
}
```

## Checklist

- [ ] `"use server"` at top
- [ ] Zod schema covers all inputs
- [ ] org context resolved from trusted server helper
- [ ] role checked when required
- [ ] `organizationId` comes from context, not user input
- [ ] DB call in `try/catch`
- [ ] Returns `{ data }` or `{ error: string }`
- [ ] `revalidatePath()` called if needed
- [ ] No full record returns — use `select`
