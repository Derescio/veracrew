import { z } from "zod";

export const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_URL_UNPOOLED: z.string().url(),

  // Auth
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),

  // Stripe
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
  STRIPE_PRICE_ID_GROWTH: z.string().startsWith("price_"),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith("pk_"),

  // Cloudflare R2
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_DOCS: z.string().min(1),
  R2_BUCKET_IMAGES: z.string().min(1),
  R2_PUBLIC_URL: z.string().url().optional(),

  // Cloudflare Turnstile
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1),
  TURNSTILE_SECRET_KEY: z.string().min(1),

  // Upstash Redis
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  // Resend
  RESEND_API_KEY: z.string().startsWith("re_"),
  EMAIL_FROM: z.string().email(),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});
