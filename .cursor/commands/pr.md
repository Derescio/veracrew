---
name: pr
description: Prepare a pull request summary and testing notes for the current Veracrew branch
argument-hint: <optional-title>
---

## Task

Prepare a PR-ready summary for the current branch.

## Steps

1. Review the branch diff against `main`.
2. Summarize the work in Veracrew terms, not generic code-only language.
3. Call out schema, auth/org-scope, UI, and testing impact separately when relevant.
4. Produce:
   - a PR title
   - 2-4 summary bullets
   - a short test plan
   - any open risks or follow-ups

## Output Format

```md
## PR Title
feat: short summary

## Summary
- ...
- ...

## Test Plan
- ...
- ...

## Risks / Follow-ups
- ...
```

## Rules

- Be specific about org-scoping, permissions, and multi-tenant risk when those areas changed.
- Mention checklist phase impact if the change advances a Veracrew implementation phase.
- Do not create the PR automatically unless explicitly asked.
- `check` (or empty): report findings only; no file changes.
- `run`/`fix`:
  1) report all findings with numbered items,
  2) ask: `Which items would you like me to fix? (1,3,5 | all | none)`,
  3) wait for response,
  4) fix only selected items,
  5) report what changed