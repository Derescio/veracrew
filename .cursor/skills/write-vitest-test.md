# Skill: write-vitest-test

Write Vitest unit tests for Veracrew server actions and utility functions.

## What to Test

- ✅ Server actions (`src/actions/*.ts`)
- ✅ Data-fetching functions (`src/lib/db/*.ts`)
- ✅ Utility functions (`src/lib/utils.ts`)
- ✅ Zod schema validation edge cases
- ❌ Next.js routing internals
- ❌ Prisma internals
- ❌ Implementation details (test behavior, not how)

## File Placement

Co-locate: `src/actions/locations.test.ts` lives next to `src/actions/locations.ts`

## Structure

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// 1. Mock BEFORE imports that use the mock
vi.mock("@/lib/prisma", () => ({
  prisma: {
    location: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/context", () => ({
  requireOrgContext: vi.fn(),
  requireRole: vi.fn(),
}));

// 2. Import after mocks
import { createLocation } from "@/actions/locations";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/auth/context";

describe("createLocation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when org context is missing", async () => {
    vi.mocked(requireOrgContext).mockRejectedValue(new Error("Unauthorized"));
    const form = new FormData();
    form.append("name", "Warehouse");
    await expect(createLocation(form)).rejects.toThrow("Unauthorized");
    expect(prisma.location.create).not.toHaveBeenCalled();
  });

  it("returns validation error when address is missing", async () => {
    vi.mocked(requireOrgContext).mockResolvedValue({
      userId: "user-1",
      organizationId: "org-1",
      role: "MANAGER",
    } as never);
    const result = await createLocation(new FormData());
    expect(result.error).toBeDefined();
    expect(prisma.location.create).not.toHaveBeenCalled();
  });

  it("returns created location on valid input", async () => {
    vi.mocked(requireOrgContext).mockResolvedValue({
      userId: "user-1",
      organizationId: "org-1",
      role: "MANAGER",
    } as never);
    vi.mocked(prisma.location.create).mockResolvedValue({
      id: "location-1",
      name: "Main Site",
    } as never);

    const form = new FormData();
    form.append("name", "Main Site");
    form.append("address", "1 Main Street");

    const result = await createLocation(form);
    expect(result.data?.id).toBe("location-1");
    expect(result.error).toBeUndefined();
  });

  it("returns error when database throws", async () => {
    vi.mocked(requireOrgContext).mockResolvedValue({
      userId: "user-1",
      organizationId: "org-1",
      role: "MANAGER",
    } as never);
    vi.mocked(prisma.location.create).mockRejectedValue(new Error("DB error"));

    const form = new FormData();
    form.append("name", "Main Site");
    form.append("address", "1 Main Street");

    const result = await createLocation(form);
    expect(result.error).toBeDefined();
  });
});
```

## Naming Convention

Use `it("returns X when Y")` — always describe input → expected output:
- `it("returns created location on valid input")`
- `it("returns error when address is missing")`
- `it("returns Unauthorized when org context is missing")`

Avoid vague names like `it("works")` or `it("handles error")`.

## Checklist

- [ ] `vi.mock()` called before any imports that use the mock
- [ ] org context mocked — never test with real sessions
- [ ] Prisma mocked — never hit real DB in unit tests
- [ ] `beforeEach(() => vi.clearAllMocks())` present
- [ ] Happy path covered
- [ ] Auth failure case covered
- [ ] Validation failure case covered
- [ ] DB error case covered
