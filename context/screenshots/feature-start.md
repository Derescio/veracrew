---
name: feature-start
description: Create branch and implement the planned feature
argument-hint: (no argument needed)
---

## Context

@context/features/current-feature.md

## Task

Execute action: **start**

---

## If action is `start`

> **Token budget: STRICT.** No GitHub calls, no repo scans, no speculative reads.

**Never read these — the plan already contains what you need:**
- `.cursor/context/architecture.md`
- `.cursor/context/database-schema.md`
- `.cursor/context/api-patterns.md`
- `.cursor/agents/builder.md`
- Any spec file under `context/features/`
- Any file not listed in the plan's "Files to Create or Modify" table

**File read rules (all must be true before reading):**
1. You are about to edit or create it right now.
2. It is listed in "Files to Create or Modify".
3. The needed information is NOT already in Key Patterns.

**Partial read rule:**
- Use `offset` + `limit` to read only the relevant section (±20 lines around the change point).
- Only read a full file if you need to understand overall structure before creating a *new* file.

**Build verification rule:**
- If the plan says "No database changes" AND only UI/component files are modified → run `pnpm tsc --noEmit` on changed files only. Skip `pnpm build`.
- If schema, server actions, or API routes are changed → run `pnpm build`.

### Steps

1. Read `current-feature.md` — nothing else until needed.
2. Ensure status is `Planned`; if not, error: `Run /feature-load first`
3. Set status to `In Progress`.
4. Create and checkout a new branch: `git checkout -b feature/<slug>`
5. Implement each plan step sequentially:
   - Read a file immediately before editing it using a partial read.
   - Mark each step `[x]` in `current-feature.md` after completing it.
   - Only touch files in the plan. No additional reads.
6. Run verification per the build verification rule above.
7. Tell the user: open a **new session** before `/feature-finish complete`.

---

## If action is `fix`

> **Token budget: STRICT.** Targeted fix only — no scans, no unrelated file reads.

1. Read `current-feature.md` to confirm the active feature and branch.
2. Use the error/symptom from context or ask the user if unclear.
3. Identify the minimum set of files involved — read only those (partial reads where possible).
4. Apply the fix:
   - Do not refactor surrounding code.
   - Do not touch unrelated files.
5. Run `pnpm tsc --noEmit` on the changed file(s) to verify.
6. Append a short fix note to `## Notes` in `current-feature.md`.

---

## No action / help

```
/feature-start   — create branch and implement
/feature-start fix — targeted bug fix on current branch
```
