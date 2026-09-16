# Campus loop demo

An interactive, scripted first-person campus simulation based on the latest manuscript (16 September 2026), especially Section 2 (functional modules, five channels, state versus policy) and Section 6.2 (cumulative closure requirements). It is embedded in the survey homepage.

Three visits carry a loan commitment, notice a changed return point, check a matching receipt, and optionally validate and accept a bounded controller update. Personal records and control policy are stored separately. Campus entry and proximity supply request-free decision opportunities while the demo is open; closing the tab does not run any background service. Only fictional game state is saved locally. No sensors, accounts or real services are accessed.

The event trace records source → delivered signal → decision/state effect. The demo does not assign a research-system score or certify L5. Rule validation uses actual deterministic decisions on five separate synthetic contexts; passing these checks does not establish real-world usefulness. Receipt-based completion is distinguished from causal credit to the reminder.

Three.js r180 is vendored under `vendor/` with its MIT license. The 3D world is a small original game level assembled from geometry. `core.mjs` holds state transitions and the policy comparison; `world.mjs` renders the navigable level; `app.mjs` connects input, glasses HUD, persistence and framework trace.

Run `node --test tests/*.test.mjs` from the site root. Core tests cover causal links, matching receipts, forgetting, validation gates and durable policy behavior; route tests check every landmark pair and free exploration starting positions.

## Illustrated edition and languages

The updated campus keeps navigable 3D geometry, with two-storey buildings, visible interiors, landscaping, courtyard objects and a first-person book. Repeated scenery uses instanced geometry; the static shadow map only refreshes when the visit changes. Camera bob and ambient movement respect reduced-motion preferences. The generated sky and paving maps, their prompts, and provenance are in `assets/art-provenance.md`.

The demo supports English and Simplified Chinese. Language is a display preference saved separately from fictional story state; switching language preserves the visit, current interaction and player position. Event records remain canonical, so translating a trace cannot create or change evidence. The paper website outside this demo remains in English.
