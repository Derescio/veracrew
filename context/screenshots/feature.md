---
name: feature
description: Feature workflow router — see sub-commands below
argument-hint: (use a sub-command instead)
---

## Feature Workflow Commands

Use the dedicated sub-commands below. Each loads only the instructions for that stage, keeping token usage low.

| Command | Use when |
|---|---|
| `/feature-load <spec>` | Load a spec file or description and generate the plan |
| `/feature-load plan` | Re-plan without reloading (requirements changed) |
| `/feature-start` | Create branch and implement |
| `/feature-start fix` | Targeted bug fix on the current branch |
| `/feature-finish review` | Quality check against goals |
| `/feature-finish test` | Write and run Vitest tests |
| `/feature-finish explain` | Summarise all changed files |
| `/feature-finish complete` | Lint, build, commit, push, open PR |
| `/feature-finish cleanup` | Post-merge: sync main and delete branch |

## Workflow order

```
/feature-load <spec>       ← new session
/feature-start             ← new session
/feature-finish complete   ← new session, then /feature-finish cleanup after merge
```
