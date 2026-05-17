# Design Spec: Security Audit Fix

## Date: 2026-05-17

---

## Problem

`npm audit` reports security vulnerabilities in both client and server dependencies:

**Client (web-react) — 10 vulnerabilities:**
- Vite 7.0.0–7.3.1: Path traversal in optimized deps `.map` handling, `server.fs.deny` bypass, arbitrary file read via dev server WebSocket (HIGH)
- PostCSS <8.5.10: XSS via unescaped `</style>` in CSS stringify output (MODERATE)
- picomatch 4.0.0–4.0.3: Method injection in POSIX character classes, ReDoS via extglob quantifiers (HIGH)

**Server — 8 vulnerabilities:**
- lodash ≤4.17.23: Code injection via `_.template`, prototype pollution via array path bypass in `_.unset`/`_.omit` (HIGH)
- path-to-regexp <0.1.13: ReDoS via multiple route parameters (HIGH)

## Solution

Run `npm audit fix` in both `web-react/` and `server/` directories. The audit tool reports fixes are available without `--force`, meaning these are non-breaking patch/minor updates.

After updating, verify:
1. Client build still succeeds (`npm run build`)
2. Client lint still passes (`npm run lint`)
3. Server tests still pass (`npm test`)
4. No high-severity vulnerabilities remain (`npm audit --audit-level=high`)

## Files

- `web-react/package-lock.json` — updated dependency versions
- `server/package-lock.json` — updated dependency versions

## Testing Plan

- [ ] Run `npm audit fix` in web-react
- [ ] Run `npm audit fix` in server
- [ ] Verify client build: `cd web-react && npm run build`
- [ ] Verify client lint: `cd web-react && npm run lint`
- [ ] Verify server tests: `cd server && npm test`
- [ ] Verify no high-severity vulnerabilities remain in either directory
