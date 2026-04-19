---
name: inspect
description: Inspect components, server actions, API routes, Prisma models, or data flow
argument-hint: components|server-actions|api|prisma|data-flow
---

## Task

Run inspection for `$ARGUMENTS`.

Valid options:
- `components`
- `server-actions`
- `api`
- `prisma`
- `data-flow`

## Behavior by option

### `components`
- List React component files in `components/`
- Extensions: `.tsx`, `.jsx`, `.ts`, `.js`
- Output: numbered list, relative paths, one-line inferred description
- Include total count

### `server-actions`
- Scan for Next.js server actions:
  - `"use server"`
  - action functions in `actions/` folders
  - exported async functions used as actions
- Output: file path, function name, one-line purpose
- Include total count

### `api`
- Scan `app/api` and `pages/api`
- Output: route path, HTTP methods (if identifiable), short description

### `prisma`
- Inspect `prisma/schema.prisma`
- List all models and key relationships (if identifiable)
- Include total model count

### `data-flow`
- Summarize flow among Prisma models, server actions, and components
- Identify:
  - components calling actions
  - actions interacting with DB
- Output a simplified architecture summary

## Missing/invalid argument

Show usage:
- `/inspect components`
- `/inspect server-actions`
- `/inspect api`
- `/inspect prisma`
- `/inspect data-flow`
