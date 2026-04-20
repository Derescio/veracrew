import type { z } from "zod";
import { envSchema } from "./env.schema";

export { envSchema } from "./env.schema";

type Env = z.infer<typeof envSchema>;

// During the Next.js production build phase, runtime secrets are not injected
// by Vercel. Skip validation at build time; full validation runs at server
// startup when the first request arrives.
// Fix #19: cast narrowed to Partial<Env> then widened — intentional; any build-time
// read of a missing var returns undefined rather than crashing the build step.
export const env: Env =
  process.env.NEXT_PHASE === "phase-production-build"
    ? (process.env as Partial<Env> as unknown as Env)
    : envSchema.parse(process.env);
