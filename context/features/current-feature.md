# Current Feature

## Status

Not Started

## Goals

## Plan

## Notes

## History

- 2026-04-14: `feature/collections-crud` completed. Full collections CRUD: create/edit/delete/favorite actions, `/collections` and `/collections/[id]` pages, collection assignment in item dialogs, free-plan 3-collection cap.
- 2026-03-13: Completed dashboard phase 1 with `/dashboard` scaffold, dark mode default, and improved mobile responsiveness.
- 2026-03-14: Completed Dashboard UI Phase 2 with collapsible sidebar, item-type nav links, favorites/recent collections, and user footer.
- 2026-03-15: `DB-Update-Seed` merged into `main`. Updated Prisma schema/migrations and added seed/test database scripts.
- 2026-03-15: `feature/dashboard-collections` merged into `main`. Replaced all dashboard mock data with live Neon DB queries; added `src/lib/db/collections.ts` and `src/lib/db/dashboard.ts`; removed `src/lib/mock-data.ts`; added Neon cold-start handler and pg SSL warning fix.
- 2026-03-15: `feature/add-pro-badge-to-sidebar` merged into `main`. Added shadcn/ui Badge component; rendered a compact "PRO" badge next to the Files and Images sidebar item-type nav links, hidden in collapsed mode.
- 2026-03-16: `feature/auth-setup-nextauth-github` merged into `main`. Added NextAuth v5 GitHub OAuth with edge-compatible split config pattern; proxy protects `/dashboard/*`; Session type extended with `user.id`.
- 2026-03-16: `feature/auth-credentials-email-password` merged into `main`. Added Credentials email/password provider with bcrypt-based authorize logic, Zod validation schemas, shared types, and POST /api/auth/register route.
- 2026-03-16: `feature/auth-ui-sign-in-register-sign-out` merged into `main`. Added custom `/sign-in` and `/register` pages, reusable `UserAvatar` component (GitHub image + initials fallback), replaced hardcoded demo user with real `auth()` session on dashboard, and upgraded `SidebarUserFooter` with avatar dropdown (sign-out + profile link).
- 2026-03-17: `feature/email-verification-on-register` merged into `main`. Added Resend-powered email verification flow: `src/lib/email.ts`, `src/lib/tokens.ts`, `/api/auth/verify-email` GET endpoint, `/verify-email` page, and updated register route, auth.ts, register form, and sign-in form to enforce and surface email verification state.
- 2026-03-18: `feature/password-reset-link-with-token` merged into `main`. Added full password reset flow: `PasswordResetToken` Prisma model, `generatePasswordResetToken`/`getPasswordResetToken`/`deletePasswordResetToken` utilities, `sendPasswordResetEmail` via Resend, POST `/api/auth/forgot-password` and `/api/auth/reset-password` routes, `/forgot-password` and `/reset-password` pages, and "Forgot password?" link on sign-in form. Token expires in 1 hour and is invalidated immediately after use.
- 2026-03-18: `feature/profile-page` completed. Added `/profile` route with user info (avatar, name, email, joined date), usage stats (total items/collections + per-type breakdown), change-password form (credentials users only), and delete-account dialog with confirmation. Added `ProfileUser`/`ProfileStats` types, `src/lib/db/profile.ts`, `src/actions/profile.ts`, and shadcn/ui `Dialog` component.
- 2026-03-18: `feature/rate-limiting-for-auth` completed. Added Upstash Redis rate limiting to all auth endpoints (register, forgot-password, reset-password, credentials login) with fail-open behavior, 429 responses with Retry-After headers, and countdown timer UX on sign-in form.
- 2026-03-19: `feature/items-list-view` completed. Added `/items/[type]` dynamic route listing all items of a given type for the authenticated user. Includes `getItemsByType` DB query, `ItemCard` server component with type-colored left border, two-column responsive grid, empty state, 404 for unknown types, and Neon cold-start guard. Added `ItemListItem` type to `src/types/index.ts`.
- 2026-03-19: `feature/item-create` — PR opened. New item dialog with type-specific fields, `createItem` server action + DB helper, edit/delete item flows (`updateItem`, `deleteItem`), `ItemCard` actions menu, shadcn `Textarea`, Vitest for items actions/DB. Fixed edit dialog form reset via remount session key to satisfy `react-hooks/set-state-in-effect` lint.
- 2026-03-19: `feature/new-item-dialog-pro-ux` — New item type `Select` UX, scrollable tall dialogs, PRO-only types hidden from non‑PRO users in the create flow, disabled PRO sidebar links on dashboard; spec consolidated to `item-edit-spec.md`.
- 2026-03-29: `feature/monaco-code-editor-component` — Added shared `CodeEditor` (Monaco, vs-dark, window chrome, copy), wired snippet/command fields in new/edit dialogs and readonly drawer; dependency `@monaco-editor/react`; menu/drawer interaction fixes.
- 2026-04-13: `feature/markdown-editor-component` — Added shared `MarkdownEditor` component (Write/Preview tabs, macOS chrome, copy, readonly mode via `react-markdown` + `remark-gfm`); wired note/prompt content fields in new/edit dialogs and readonly drawer; added `.markdown-preview` CSS to `globals.css`.
- 2026-04-13: `feature/file-upload-r2` — Added Cloudflare R2 file/image upload: `POST /api/upload` (MIME + size validation, Pro gate), `GET /api/download/[...key]` (auth-gated proxy), `FileUpload` component (drag-and-drop, XHR progress, image preview), R2 cleanup on delete/replace in `deleteItem`/`updateItem`, image preview + download button in `ItemDrawer`. Switched `MarkdownEditor` preview to `@tailwindcss/typography`.
- 2026-04-14: `feature/dashboard-ui-phase-3` — Added dashboard stats cards, item created-at metadata, file thumbnails, and image/file-specific item grids.
- 2026-04-14: `feature/homepage-marketing-mockup` — Added static marketing homepage prototype (`prototypes/homepage/`): animated chaos-to-order hero with physics-based floating icons, features grid, AI section, pricing toggle, CTA, and footer. Plain HTML/CSS/JS, no build step.
