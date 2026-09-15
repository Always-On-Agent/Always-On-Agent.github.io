# Campus loop demo

An interactive, scripted first-person campus simulation based on the latest manuscript (16 September 2026), especially Section 2 (functional modules, five channels, state versus policy) and Section 6.2 (cumulative closure requirements). It is embedded in the survey homepage.

Three visits carry a loan commitment, notice a changed return point, check a matching receipt, and optionally validate and accept a bounded controller update. Personal records and control policy are stored separately. Campus entry and proximity supply request-free decision opportunities while the demo is open; closing the tab does not run any background service. Only fictional game state is saved locally. No sensors, accounts or real services are accessed.

The event trace records source → delivered signal → decision/state effect. The demo does not assign a research-system score or certify L5. Rule validation uses actual deterministic decisions on five separate synthetic contexts; passing these checks does not establish real-world usefulness. Receipt-based completion is distinguished from causal credit to the reminder.

Three.js r180 is vendored under `vendor/` with its MIT license. The 3D world is a small original game level assembled from geometry. `core.mjs` holds state transitions and the policy comparison; `world.mjs` renders the navigable level; `app.mjs` connects input, glasses HUD, persistence and framework trace.

Run `node --test tests/*.test.mjs` from the site root. Core tests cover causal links, matching receipts, forgetting, validation gates and durable policy behavior; route tests check every landmark pair and free exploration starting positions.
