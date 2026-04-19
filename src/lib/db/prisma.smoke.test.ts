import { describe, it, expect } from "vitest";

const hasDb =
  typeof process.env.DATABASE_URL === "string" &&
  process.env.DATABASE_URL.startsWith("postgresql");

describe.skipIf(!hasDb)("DB connectivity smoke test", () => {
  it("executes SELECT 1 against Neon without error", async () => {
    const { prisma } = await import("./prisma");
    const result = await prisma.$queryRaw<{ val: number }[]>`SELECT 1 AS val`;
    expect(result[0].val).toBe(1);
  });
});
