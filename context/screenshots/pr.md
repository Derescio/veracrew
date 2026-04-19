---
name: cleanup
description: Clean up project housekeeping tasks (use run to execute fixes)
argument-hint: check|run
---

Review cleanup targets:
1. History order in `@context/current-feature.md` (oldest -> newest)
2. Unnecessary `console.log` in `src/`
3. Unused imports
4. Stale TODO comments
5. Orphaned/unused files
6. Context files mismatching actual project state
7. Missing env variable names in `.env.production` vs `.env` (values may differ)
8. Potentially stale `@ts-ignore`

Mode: `$ARGUMENTS`

- `check` (or empty): report findings only; no file changes.
- `run`/`fix`:
  1) report all findings with numbered items,
  2) ask: `Which items would you like me to fix? (1,3,5 | all | none)`,
  3) wait for response,
  4) fix only selected items,
  5) report what changed.
