import { describe, it, expect } from "vitest";
import { envSchema } from "./env.schema";

const VALID_ENV = {
  DATABASE_URL: "postgresql://user:pass@host/db?sslmode=require",
  DATABASE_URL_UNPOOLED: "postgresql://user:pass@host/db?sslmode=require",
  NEXTAUTH_URL: "http://localhost:3000",
  NEXTAUTH_SECRET: "a".repeat(32),
  GOOGLE_CLIENT_ID: "client-id",
  GOOGLE_CLIENT_SECRET: "client-secret",
  STRIPE_SECRET_KEY: "sk_test_abc",
  STRIPE_WEBHOOK_SECRET: "whsec_abc",
  STRIPE_PRICE_ID_GROWTH: "price_abc",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_abc",
  R2_ACCOUNT_ID: "account-id",
  R2_ACCESS_KEY_ID: "access-key",
  R2_SECRET_ACCESS_KEY: "secret-key",
  R2_BUCKET_DOCS: "veracrew-docs-dev",
  R2_BUCKET_IMAGES: "veracrew-images-dev",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "turnstile-site-key",
  TURNSTILE_SECRET_KEY: "turnstile-secret",
  UPSTASH_REDIS_REST_URL: "https://redis.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "token",
  RESEND_API_KEY: "re_abc123",
  EMAIL_FROM: "noreply@example.com",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NODE_ENV: "development",
};

describe("envSchema", () => {
  it("parses a fully valid environment", () => {
    const result = envSchema.safeParse(VALID_ENV);
    expect(result.success).toBe(true);
  });

  it("throws when DATABASE_URL is missing", () => {
    const { DATABASE_URL: _, ...rest } = VALID_ENV;
    const result = envSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("throws when NEXTAUTH_SECRET is too short", () => {
    const result = envSchema.safeParse({
      ...VALID_ENV,
      NEXTAUTH_SECRET: "tooshort",
    });
    expect(result.success).toBe(false);
  });

  it("throws when STRIPE_SECRET_KEY lacks sk_ prefix", () => {
    const result = envSchema.safeParse({
      ...VALID_ENV,
      STRIPE_SECRET_KEY: "rk_test_abc",
    });
    expect(result.success).toBe(false);
  });

  it("throws when RESEND_API_KEY lacks re_ prefix", () => {
    const result = envSchema.safeParse({
      ...VALID_ENV,
      RESEND_API_KEY: "invalid_key",
    });
    expect(result.success).toBe(false);
  });

  it("throws when EMAIL_FROM is not a valid email", () => {
    const result = envSchema.safeParse({
      ...VALID_ENV,
      EMAIL_FROM: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("defaults NODE_ENV to development when omitted", () => {
    const { NODE_ENV: _, ...rest } = VALID_ENV;
    const result = envSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NODE_ENV).toBe("development");
    }
  });

  it("accepts optional R2_PUBLIC_URL when provided as valid URL", () => {
    const result = envSchema.safeParse({
      ...VALID_ENV,
      R2_PUBLIC_URL: "https://pub-xxx.r2.dev",
    });
    expect(result.success).toBe(true);
  });
});
