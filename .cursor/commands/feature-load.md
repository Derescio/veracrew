---
name: feature-load
description: Load a feature spec and generate a lean implementation plan
argument-hint: <spec-filename> | <feature description>
---

## Context

@context/features/current-feature.md

## Task

Execute action: **load $ARGUMENTS**

Branch naming: `feature/<slug>` — slug derived from H1 title (lowercase, hyphenated, no special chars).

---

## If action is `load`

1. Evaluate `$ARGUMENTS`:
   - Single word → treat as spec filename, read `context/features/{name}.md`.
   - Multiple words → treat as feature description, generate goals from it.
   - Empty → error: `"load requires a spec filename or feature description"`
2. Update `current-feature.md`:
   - Set H1 to `# Current Feature: <Feature Name>`
   - Populate `## Goals`
   - Add relevant `## Notes`
   - Clear `## Plan`
   - Set status to `Not Started`
3. Generate `## Plan` with:
   - **Architecture** — database changes (or "No database changes"), server actions, UI components, utilities
   - **Files to Create or Modify** — table with `File | Action | Why`
   - **Implementation Steps** — ordered checklist `- [ ] N. description`
   - **Edge Cases** — validation/failure conditions
   - **Key Patterns** — pointer-based only, max 40 lines total (see rules below)
4. Set status to `Planned`.
5. Output the full plan.
6. Tell the user: open a **new session** before `/feature-start`.

### Key Patterns rules (strictly enforced)

Key Patterns must be **pointer-based**. Do NOT paste full JSX, CSS blocks, or function bodies.

**Allowed:**
- New component prop interface (no file exists yet — interface must be defined here)
- Import paths for shared utilities: `import { auth } from "@/lib/auth"`
- Exact edit locations for existing files: `new-item-dialog.tsx ~line 216: replace <Textarea> with <MarkdownEditor value={content} onChange={setContent} disabled={isPending} />`
- Function signatures for new DB helpers or server actions (signature only, no body)
- Response shape for server actions: `{ data: T } | { error: string }`

**Never allowed in Key Patterns:**
- Full JSX component bodies
- Full CSS blocks
- Copied existing code from files that `/feature-start` can read with a targeted partial read

---

## If action is `plan`

Standalone re-plan — use when requirements have changed.

1. Read `current-feature.md`.
2. Ensure goals exist; if empty, error: `Run /feature-load first`
3. Rewrite `## Plan` following the same rules as `load` above (pointer-based Key Patterns, max 40 lines).
4. Set status to `Planned`.
5. Output the full revised plan.
6. Tell the user: open a **new session** before `/feature-start`.

---

## No action / help

```
/feature-load <spec>   — load spec + generate plan
/feature-load plan     — re-plan without reloading the feature
```
