# Handoff verification — 2026-09-17

Verified from the new `game-src/` directory, rather than the previous standalone working copy:

- Fresh `pnpm install --frozen-lockfile` with the pinned pnpm 10.32.1 and Node 24.
- Production `pnpm build:always-on` and complete `tsc --noEmit` pass.
- `pnpm test:always-on`: 66 tests plus four map/HUD/action integration scripts pass. The physical route test reads the checked-in v3 Anvil world.
- Website research/glass projection tests: 6 pass. Glass panel switching, drag, cell/list/detail, filters and all 36 works were checked in a browser.
- `pnpm dev:always-on --port 3000` compiles and serves the app, scene metadata, regions and Anvil files.
- `pnpm stage:website` produces a static game that runs under the project's ordinary Python HTTP server. No Downloads path, separate mesh server or external episode-module URL is needed.
- Browser NTU episode completes with about 35.1 m of actual movement, 6 trace entries and all five channels in a 42-second report. Visible pickup/delivery precedes the associated receipts. ECCV also loads directly and retains the five-poster workflow.
- A first-load race discovered during the browser check was fixed: preparation now awaits finite real ground at every route point. Five tests cover partial loading, timeout, pause and cancellation; a fresh browser visit reaches the start without requiring Retry.

The isolated original-mesh renderer and the Applications 3D/map/table views have been removed. Minecraft free flight and overhead are still available in the current world.

This verifies local browser behavior and the checked-in production build; it does not establish performance on low-end phones or a live-AI capability claim. Dependency copyright notices and unmodified upstream patches may contain their original whitespace.
