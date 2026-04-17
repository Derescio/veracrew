---
name: cleanup
description: Clean up project housekeeping tasks (use run to execute fixes)
argument-hint: check|run
---

## Context

Review codebase cleanup/maintenance issues. Prioritize:
- `src/`
- `components/`
- `app/`
- `context/`
- `prisma/`
- `.env`
- `.env.production`

Mode: `$ARGUMENTS` (default: `check`)

## Checks to perform

1. Ensure `context/features/current-feature.md` history is ordered newest -> oldest.
2. Find unnecessary `console.log` in `src/`, `components/`, `app/` (ignore intentional debug utility logs).
3. Detect unused imports.
4. Detect stale TODO comments.
5. Find orphaned/unused files (components, utilities, server actions).
6. Verify `context/` files match actual project state.
7. Compare env variable names between `.env` and `.env.production`:
   - all names in `.env` must exist in `.env.production`
   - values may differ
8. Find stale `@ts-ignore` comments.

## Mode behavior

### `check` (or no argument)
- Do not modify files
- Report findings and what would be cleaned/fixed
- Output:
  - `### Cleanup Report`
  - 1) Console logs
  - 2) Unused imports
  - 3) Stale TODOs
  - 4) Orphaned files
  - 5) Context inconsistencies
  - 6) Missing env variables
  - 7) Stale `@ts-ignore`
- Include file paths where possible

### `run` / `fix`
1. Generate full numbered cleanup report first.
2. Ask:
   - `Which items would you like me to fix? (1,3,5 | all | none)`
3. Wait for user response.
4. Only fix selected items.
5. Allowed fix types:
   - remove unnecessary `console.log`
   - remove unused imports
   - remove stale TODO
   - remove stale `@ts-ignore`
   - update context history ordering
   - delete orphaned files (only after confirmation)
6. Report:
   - `### Changes Applied`
   - file paths
   - what changed
   - short reason
