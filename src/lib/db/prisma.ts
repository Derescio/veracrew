import { env } from "@/lib/env";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Validate env at module load — throws if any required variable is missing.
void env;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  return new PrismaClient({ adapter, log: ["error"] });
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
