# Card Demo Correctness Goal

Make the turn-based cards demo fully correct, robust, and working across all currently present and intended gameplay/UI functionality.

Use the pasted context as the functional baseline and audit the app end-to-end. Do not treat current behavior as correct unless verified.

Known issues:
- `GameScene.tsx:134` logs `THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.`
- Face-down cards need proper backs. They currently render as the red 4 card.
- Cards in my hand, and possibly the center pile, appear mirrored/flipped incorrectly.

Expected outcome:
- All present and intended game functionality works correctly.
- Face-down cards consistently show card backs, never leaked face art.
- Player hand and center pile cards render with correct orientation.
- The Three.js deprecation warning is removed using the recommended API.
- No relevant runtime console errors or warnings remain.
- Add or update tests where practical to prevent regressions.
- Verify with formatting, type checks/tests, and a browser smoke test.

Report:
- Files changed.
- Verification commands run.
- Any remaining risks or follow-up items.
