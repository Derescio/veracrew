---
name: feature-finish
description: Review, test, explain, complete, or cleanup a feature
argument-hint: review|test|explain|complete|cleanup
---

## Context

@context/features/current-feature.md

## Task

Execute action: **$ARGUMENTS**

---

## If action is `review`

1. Read goals + plan from `current-feature.md`.
2. Ensure status is `In Progress`; if not, warn the user.
3. Run `git diff main --name-only` to see changed files; read only those relevant to the feature.
4. Check:
   - ✅ goals implemented
   - ❌ missing functionality
   - ⚠️ code quality concerns
   - 🚫 scope creep
   - 🧪 test adequacy
5. Output verdict:
   - `Ready to complete` → set status to `Reviewed`
   - or `Changes required` with specific items to fix

---

## If action is `test`

1. Read `current-feature.md`.
2. Ensure status is `In Progress`; if not, warn the user.
3. Identify server actions, utilities, and business logic added by this feature.
4. Check existing tests to avoid duplication.
5. Add missing **Vitest** unit tests covering: happy path, edge cases, error conditions.
   - Only test logic that is actually testable in isolation (server actions, utilities).
   - Do not write tests just to reach coverage numbers.
6. Run `pnpm test` and report results.

---

## If action is `explain`

1. Read `current-feature.md`.
2. Run `git diff main --name-only`.
3. For each changed file output:
   - Path + `new` or `modified`
   - 1–2 sentence explanation
   - Key functions/logic added
4. Close with `## How It All Connects` describing the data/logic flow end to end.

---

## If action is `complete`

> Commits, pushes, and opens a PR. Run `/feature-finish cleanup` after the PR is merged.
> Only `git` and `gh` CLI — no GitHub MCP calls.

1. Read `current-feature.md`; check status:
   - `Not Started` or `Planned` → error: `Run /feature-start first`
   - `Reviewed` → skip review step.
   - `In Progress` → run the `review` action inline; continue only if `Ready to complete`.
2. Run `git branch --show-current` — confirm on `feature/<slug>`, not `main`.
3. Run final verification:
   - `pnpm run lint` (skip if not defined)
   - `pnpm run build`
   - Fix any errors before continuing.
4. Run `git status --short` — stage only feature files; skip unrelated changes.
5. Reset `current-feature.md` on the feature branch:
   - H1 → `# Current Feature`
   - Clear `Goals`, `Plan`, `Notes`
   - Status → `Not Started`
   - Append one-line completion summary to `## History`
6. Commit with a conventional commit message (no `--amend`). Always append the trailer:
   `--trailer "Made-with: Cursor + OpsedSolutions"`
7. `git push -u origin HEAD`
8. `gh pr create` with title + body using this template:
   ```
   ## Summary
   - <bullet: what changed>
   - <bullet: why / user impact>

   ## Test Plan
   - <bullet: how to verify>

   ## Notes
   - Built with [Cursor](https://cursor.com) · [OpsedSolutions](https://opsedsolutions.com)
   ```
9. Remind user: run `/feature-finish cleanup` after the PR is merged.

---

## If action is `cleanup`

Run after the PR has been merged to `main`.

1. `git checkout main`
2. `git pull --ff-only origin main`
3. `git branch -d <branch-name>`
4. `git push origin --delete <branch-name>`
5. Confirm cleanup complete.

---

## No action / help

```
/feature-finish review   — quality check against goals
/feature-finish test     — write and run Vitest tests
/feature-finish explain  — summarise all changed files
/feature-finish complete — lint, build, commit, push, open PR
/feature-finish cleanup  — post-merge: sync main, delete branch
```
