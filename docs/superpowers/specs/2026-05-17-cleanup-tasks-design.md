# Design Spec: Post-Merge Cleanup Tasks

## Date: 2026-05-17

---

## 1. Fix GitHub Pages Jekyll Build

**Problem:** Jekyll build fails on Pages deployment because `docs/superpowers/plans/2026-05-17-remaining-features.md` contains JSX template literals like ``{{ left: `${15 + i * 14}` }}`` which Liquid interprets as template variables.

**Solution:** Rename both files in `docs/superpowers/` from `.md` to `.md.txt`. Jekyll only processes `.md` files, so this excludes them from the build. The files remain readable as markdown text.

**Files to rename:**
- `docs/superpowers/plans/2026-05-17-remaining-features.md` → `2026-05-17-remaining-features.md.txt`
- `docs/superpowers/specs/2026-05-17-remaining-features-design.md` → `2026-05-17-remaining-features-design.md.txt`

---

## 2. Clean Up Stale Remote Branch

**Problem:** `origin/feat/remaining-nice-to-haves` exists on remote but was already merged to main.

**Solution:** Delete the remote branch via `git push origin --delete feat/remaining-nice-to-haves`.

---

## 3. Clean Up Temp Directories

**Problem:** `.tmp-agent-browser/` contains old agent-browser artifacts (todo-map.md, screenshot). `web-react/test-results/` contains local Playwright test artifacts.

**Solution:** Remove both directories. `test-results/` is already gitignored (commit `9fe3fd9`), so only local cleanup needed.

---

## Verification

- [ ] Jekyll build succeeds on next push
- [ ] `origin/feat/remaining-nice-to-haves` no longer appears in `git branch -r`
- [ ] `.tmp-agent-browser/` and `web-react/test-results/` are removed
