import type { z } from "zod";
import { envSchema } from "./env.schema";

export { envSchema } from "./env.schema";

type Env = z.infer<typeof envSchema>;

// During the Next.js production build phase, runtime secrets are not injected
// by Vercel. Skip validation at build time; full validation runs at server
// startup when the first request arrives.
export const env: Env =
  process.env.NEXT_PHASE === "phase-production-build"
    ? (process.env as unknown as Env)
    : envSchema.parse(process.env);
