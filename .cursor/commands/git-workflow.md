---
description: Git workflow with feature branches and pull requests
globs: **
alwaysApply: false
---

# Git Workflow Command

Usage: `/git-workflow` or `/git-workflow <BRANCH-NAME>`

## Branch Name

If a `<BRANCH-NAME>` is supplied after the command, use it verbatim as the branch name (e.g. `git checkout -b <BRANCH-NAME>`).

If no name is supplied, derive the branch name from the current feature title using these conventions:

- `feature/<feature-name>`
- `fix/<issue-name>`
- `chore/<task>`

## Workflow

### 1. Check for uncommitted changes

Run `git status`. If there are staged or unstaged changes, list them and ask the user for a commit message before proceeding. Do not silently discard work.

### 2. Create Branch

```
git checkout -b <branch-name>
```

### 3. Stage & Commit

- Run `git status` and `git diff` to review all changes.
- Ask the user for permission before committing.
- Use conventional commit messages, one logical change per commit, no AI attribution.

Examples:
```
feat: add user profile page
fix: resolve checkout calculation bug
chore: update prisma schema
```

### 4. Push Branch

```
git push -u origin <branch-name>
```

### 5. Create Pull Request

Create a PR targeting `main` using `gh pr create`. Include:

- Clear title
- Summary of changes (bullet points)
- Testing steps

### 6. Merge

After the PR is created, merge it into `main`:

```
gh pr merge --merge --delete-branch
```

This merges the PR and deletes the remote branch in one step.

### 7. Clean up local branch

```
git checkout main
git pull origin main
git branch -d <branch-name>
```

### 8. Update Feature Document

Append an entry to the `## History` section in `@context/features/current-feature.md`:

```
## History

- <DATE> — <branch-name> merged into main. <one-line summary of changes>
```

If the `## History` section doesn't exist yet, create it at the bottom of the file. If a task section in the document corresponds to this branch, mark it as completed.

## Safety Rules

Never run destructive git commands without explicit confirmation:

- `git reset --hard`
- `git push --force`
- `git clean -fd`

Never commit directly to `main`. Always use a feature branch and Pull Request.