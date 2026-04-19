# Current Feature

**Status:** Not Started

**Branch:** `main`

---

## Goals



---

## Notes



---

## Plan



---

## History

- **2026-04-18**: `feature/phase-0-00-setup` completed. Environment & Provisioning — Zod env validation, Prisma v7 singleton with PrismaPg adapter, schema + config, `.env.example` rewrite, `.gitignore` update, Vitest env tests (8/8 pass), build clean.
- **2026-04-18**: `feature/phase-0-01-database` completed. Full schema (50 models), migrations, RLS on 25 tables, `withOrgRLS`, `scopedPrisma`, CI lint (50/50 relations pass).
- **2026-04-19**: `feature/phase-0-02-auth` completed. NextAuth v5 (Credentials + Google), Argon2id passwords, AES-256-GCM TOTP secret encryption, TOTP 2FA + backup codes, requireOrgContext/requireRole/assertOrgMembership, requireOrgActive, requires2FASetup, tombstoneUser (GDPR), proxy route protection. Next.js 16 breaking change: `src/middleware.ts` renamed to `src/proxy.ts`. 52/52 tests pass, build clean.
