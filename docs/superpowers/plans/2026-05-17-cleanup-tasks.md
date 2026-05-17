# Cleanup Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the GitHub Pages Jekyll build failure, delete the stale merged remote branch, and remove temporary artifact directories.

**Architecture:** Three independent cleanup tasks with no dependencies between them. The Jekyll fix is highest priority since it blocks deployment.

**Tech Stack:** Git, GitHub CLI, Jekyll (GitHub Pages)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `docs/superpowers/plans/2026-05-17-remaining-features.md` | Existing plan — rename to avoid Jekyll Liquid parse errors |
| `docs/superpowers/specs/2026-05-17-remaining-features-design.md` | Existing spec — rename to avoid Jekyll Liquid parse errors |
| `.tmp-agent-browser/` | Temporary agent-browser artifacts — delete |
| `web-react/test-results/` | Playwright local test artifacts — delete |
| `origin/feat/remaining-nice-to-haves` | Stale merged remote branch — delete |

---

## Task 1: Rename Plan/Spec Files to Avoid Jekyll Build Failure

**Files:**
- Rename: `docs/superpowers/plans/2026-05-17-remaining-features.md`
- Rename: `docs/superpowers/specs/2026-05-17-remaining-features-design.md`

- [ ] **Step 1: Rename the plan file**

```bash
cd /home/gfunk/github/turnbased-cards-demo
git mv docs/superpowers/plans/2026-05-17-remaining-features.md docs/superpowers/plans/2026-05-17-remaining-features.md.txt
```

- [ ] **Step 2: Rename the spec file**

```bash
git mv docs/superpowers/specs/2026-05-17-remaining-features-design.md docs/superpowers/specs/2026-05-17-remaining-features-design.md.txt
```

- [ ] **Step 3: Verify git status shows two renames**

Run: `git status`
Expected: Two `renamed:` entries, no untracked files.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/
git commit -m "docs: rename plan/spec files to .md.txt to avoid Jekyll Liquid errors"
```

---

## Task 2: Delete Stale Remote Branch

**Files:** None (remote-only operation)

- [ ] **Step 1: Delete the remote branch**

```bash
git push origin --delete feat/remaining-nice-to-haves
```

- [ ] **Step 2: Verify branch is gone**

Run: `git branch -r | grep feat/remaining-nice-to-haves`
Expected: No output (branch deleted).

---

## Task 3: Remove Temporary Artifact Directories

**Files:**
- Delete: `.tmp-agent-browser/`
- Delete: `web-react/test-results/`

- [ ] **Step 1: Remove .tmp-agent-browser**

```bash
rm -rf /home/gfunk/github/turnbased-cards-demo/.tmp-agent-browser
```

- [ ] **Step 2: Remove Playwright test-results**

```bash
rm -rf /home/gfunk/github/turnbased-cards-demo/web-react/test-results
```

- [ ] **Step 3: Verify directories are gone**

Run:
```bash
ls -d /home/gfunk/github/turnbased-cards-demo/.tmp-agent-browser 2>&1
ls -d /home/gfunk/github/turnbased-cards-demo/web-react/test-results 2>&1
```

Expected: Both commands return `No such file or directory`.

---

## Final Verification

- [ ] **Step 1: Confirm working tree is clean except for rename commit**

Run: `git status`
Expected: `nothing to commit, working tree clean` (the rename commit was already made; temp dirs are untracked/gitignored so won't show).

- [ ] **Step 2: Confirm no remaining Jekyll-breaking files**

Run:
```bash
grep -r '{{' docs/superpowers/ --include="*.md" | head -5
```

Expected: No output (no `.md` files with Liquid-conflicting syntax remain in docs/superpowers).

- [ ] **Step 3: Push rename commit**

```bash
git push origin main
```

---

## Spec Coverage Checklist

| Spec Section | Task | Status |
|-------------|------|--------|
| Rename plan/spec files | Task 1 | ✓ |
| Delete stale remote branch | Task 2 | ✓ |
| Remove temp directories | Task 3 | ✓ |

## Placeholder Scan

- No TBD/TODO/"implement later" found.
- All file paths are exact.
- All commands have expected outputs.
