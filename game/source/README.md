# Always-On Experiences: source and deployment

The source archive contains the complete modified client tree, including the pinned dependency lockfile and build configuration.

- Upstream: https://github.com/zardoy/minecraft-web-client
- Upstream base: `637b62f9086d8d33844e7562d1e23a4b5ca408bb`
- Modified client commit: `f9ad6f0`
- Source archive: [always-on-experiences.zip](always-on-experiences.zip)
- Changes only: [always-on.patch](always-on.patch)
- GPL runtime dependency source: [gpl-dependency-source.zip](gpl-dependency-source.zip)
- License inventory: [THIRD_PARTY_NOTICES.txt](../THIRD_PARTY_NOTICES.txt)

## Build

Verified with Node.js 24.20.0 and pnpm 10.32.1. Unpack the source archive and run from its `always-on-experiences` directory:

```sh
CYPRESS_INSTALL_BINARY=0 npm exec --yes --package=pnpm@10.32.1 -- pnpm install --frozen-lockfile
DISABLE_SERVICE_WORKER=true CONFIG_JSON_SOURCE=BUNDLED LOCAL_CONFIG_FILE=config.always-on.json npm exec --yes --package=pnpm@10.32.1 -- pnpm build
python3 -m http.server 8876 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:8876/?scene=singapore&lang=zh` for the NTU prototype, or `http://127.0.0.1:8876/?scene=eccv&lang=zh` for ECCV. Use `lang=en` for English. The published build is in `/game/` and the homepage embeds it through `/demo/minecraft-embed.mjs`. Static HTTPS hosting is sufficient; no backend or Minecraft account is required for this prescribed local scenario.

For the patch-only route, check out the upstream base commit and run `git apply always-on.patch` before installing and building.

## Main customization points

- `src/singaporeMap.ts`: real NTU map loading and bounded read-only region caching.
- `src/singaporeHud.tsx` / `.css` / `src/singaporeStory.ts`: bilingual glasses, three fictional activity loops, memory freshness, explicit user choices and framework trace.
- `src/singaporeActions.ts`: tagged inventory transactions and safe simulated shuttle stops.
- `src/singaporeMarkers.ts`: in-world bilingual demo station signs.
- `assets/maps/ntu/`: Anvil region files, geographic metadata, safe approaches, source data and provenance.
- `src/alwaysOnHud.css`: shared glass interface styling and paper module colors.
- `src/eccvWorld.ts`: condensed exhibition hall, five poster stations, Booth 44 and report station.
- `src/eccvHud.tsx` / `.css`: poster dwell, cumulative cards, carried context, inspection, feedback and local journey export.
- `src/alwaysOnScene.ts`: scene selection via `scene=singapore` or `scene=eccv`. Old `scene=village` links open NTU.
- `config.always-on.json`: fixed demo settings.
- `src/index.ts`: direct startup and scene/HUD integration.

The demo is scripted. It illustrates context retention, evidence admission, memory-informed suggestions, user-authorized action, and receipt retention. It does not demonstrate a live learned policy or validated self-evolution. Each page load creates a new local world and visit; the two scenes retain separate memories in browser storage. NTU retains accepted plans and receipts; unfinished actions require current evidence on a new visit. ECCV preserves cards and preferences, but marks earlier observations as historical until the relevant poster is seen again.

Desktop controls: WASD move, mouse/drag look, E interact, H glasses, R walk/stop, Space jump. Touch devices use the client's touch movement/look controls; nearby interaction prompts and the glasses button can be tapped.

## Verification

```sh
node scripts/testSingaporeMap.cjs
node scripts/testSingaporeActions.cjs
node scripts/testSingaporeHud.cjs
node scripts/testEccvHud.cjs
npm exec --yes --package=pnpm@10.32.1 -- pnpm exec tsx scripts/testEccvWorld.ts
```

The NTU tests cover real HTTP/Anvil map loading, safe stops, modern inventory items and three-loop HUD behavior. The ECCV HUD test runs the real HUD and visibility logic with isolated UI boundaries. It covers stationary gaze, occlusion, card progression, close inspection, five channels, history, and report gating. The second checks actual generated geometry and every interaction route. These checks complement browser interaction testing.

## NTU scenario basis

The 1.5 km² geographic sample uses OpenStreetMap and Mapterhorn through Arnis at one block per metre. Building exteriors and vegetation are procedural approximations; interiors are not reconstructed. It does not contain MazeMap or NTUniverse assets. See `assets/maps/ntu/README.md` for source attribution, licenses and reconstruction instructions. All activities and stations are fictional. NTU is a preview; it is not a whole-Singapore model or a representation of live NTU services.

## ECCV scenario basis

Based on the EgoPoster workflow and its five-poster demonstration: GaGA, OmniMapBench, CFG-Bench, LaGen, and 360CityArena. The hall, abstract boards, and booth are original condensed geometry, not an exact venue replica. The client contains no private operational data, live camera/audio, model inference, or email workflow. Research prompts are scripted. Public paper links and the scene boundary are listed in [source and credits](../credits.html).

Desktop interaction: pause while facing a poster to retain its identity, then press E to open its card. Cards accumulate a question, context and suggested next stop. Requesting detail inspection requires a changed viewpoint and a close, unobstructed view. Return to Booth 44 to preview the observed posters and explicitly download an HTML report. H opens the glasses memory and actual-event trace.

## Licenses and assets

Keep the upstream license and dependency notices when distributing the client. Dependencies have their own licenses, including GPL-3.0 components whose installed sources accompany this build. The archive preserves upstream source notices.

The included game art, models, and font come from the upstream client and Minecraft-derived resources. Do not treat all of them as MIT-licensed merely because the application or mc-assets code is MIT. See [source and credits](../credits.html) and the resource provenance in the third-party notices. This research demo is not affiliated with Mojang or Microsoft.
