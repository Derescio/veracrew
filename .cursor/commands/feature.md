---
name: feature
description: Feature workflow router — see sub-commands below
argument-hint: (use a sub-command instead)
---

## Feature Workflow Commands

> **This command does nothing by itself.** Use one of the sub-commands below.
> Each sub-command loads only the instructions for that stage — do not combine stages in a single session.

| Command | Stage | What happens |
|---|---|---|
| `/feature-load <spec>` | Plan | Reads spec, writes plan to `current-feature.md`. **Stops here.** |
| `/feature-load plan` | Re-plan | Rewrites plan only. **Stops here.** |
| `/feature-start` | Implement | Creates branch, implements plan steps. **Stops here.** |
| `/feature-start fix` | Fix | Targeted bug fix on current branch. **Stops here.** |
| `/feature-finish review` | Review | Quality check against goals. |
| `/feature-finish test` | Test | Write and run Vitest tests. |
| `/feature-finish explain` | Explain | Summarise all changed files. |
| `/feature-finish complete` | Ship | Lint, build, commit, push, open PR. |
| `/feature-finish cleanup` | Cleanup | Post-merge: sync main, delete branch. |

## Correct workflow order

```
Session 1 → /feature-load <spec>
Session 2 → /feature-start
Session 3 → /feature-finish complete
           → /feature-finish cleanup  (after PR is merged)
```

**Each stage must run in its own new session.** Never plan and implement in the same session.
