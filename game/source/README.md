# Always-On Village: source and deployment

The source archive contains the complete modified client tree, including the pinned dependency lockfile and build configuration.

- Upstream: https://github.com/zardoy/minecraft-web-client
- Upstream base: `637b62f9086d8d33844e7562d1e23a4b5ca408bb`
- Modified client commit: `a055381`
- Source archive: [always-on-village.zip](always-on-village.zip)
- Changes only: [always-on.patch](always-on.patch)
- GPL runtime dependency source: [gpl-dependency-source.zip](gpl-dependency-source.zip)
- License inventory: [THIRD_PARTY_NOTICES.txt](../THIRD_PARTY_NOTICES.txt)

## Build

Verified with Node.js 24.20.0 and pnpm 10.32.1. Unpack the source archive and run from its `always-on-village` directory:

```sh
CYPRESS_INSTALL_BINARY=0 npm exec --yes --package=pnpm@10.32.1 -- pnpm install --frozen-lockfile
DISABLE_SERVICE_WORKER=true CONFIG_JSON_SOURCE=BUNDLED LOCAL_CONFIG_FILE=config.always-on.json npm exec --yes --package=pnpm@10.32.1 -- pnpm build
python3 -m http.server 8876 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:8876/?lang=en` or `?lang=zh`. The published build is in `/game/` and the homepage embeds it through `/demo/minecraft-embed.mjs`. Static HTTPS hosting is sufficient; no backend or Minecraft account is required for this prescribed local scenario.

For the patch-only route, check out the upstream base commit and run `git apply always-on.patch` before installing and building.

## Main customization points

- `src/alwaysOnWorld.ts`: deterministic village geometry, spawn and landmarks, tagged book inventory, verified return transaction.
- `src/alwaysOnHud.tsx`: bilingual copy, visibility checks, interaction handlers, persistent journal, framework trace.
- `src/alwaysOnHud.css`: glass interface, mobile layout, paper module colors.
- `config.always-on.json`: fixed demo settings.
- `src/index.ts`: direct startup and scene/HUD integration.

The demo is scripted. It illustrates context retention, evidence admission, memory-informed suggestions, user-authorized action, and receipt retention. It does not demonstrate a live learned policy or validated self-evolution. Each page load creates a new local world and book-return episode; only the journal and preferences survive reloads in browser storage.

Desktop controls: WASD move, mouse/drag look, E interact, H glasses, R walk/stop, Space jump. Touch devices use the client's touch movement/look controls; nearby interaction prompts and the glasses button can be tapped.

## Licenses and assets

Keep the upstream license and dependency notices when distributing the client. Dependencies have their own licenses, including GPL-3.0 components whose installed sources accompany this build. The archive preserves upstream source notices.

The included game art, models, and font come from the upstream client and Minecraft-derived resources. Do not treat all of them as MIT-licensed merely because the application or mc-assets code is MIT. See [source and credits](../credits.html) and the resource provenance in the third-party notices. This research demo is not affiliated with Mojang or Microsoft.
