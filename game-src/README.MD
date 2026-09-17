# Always-On Agent · Minecraft experiences

两个可直接运行的浏览器场景：**NTU 校园**和 **ECCV / EgoPoster 展台**。无需登录，也无需独立 Minecraft 服务端。此目录包含完整客户端、眼镜 HUD、人物交互和自动演示源码。

- [体验网页](https://always-on-agent.github.io/?lang=zh&scene=singapore#live-demo)
- [直接打开游戏](https://always-on-agent.github.io/game/?lang=zh&scene=singapore)
- [资源与依赖说明](https://always-on-agent.github.io/game/credits.html)

## Quick start / 本地开发

Requirements: **Node.js 22 or 24**, **pnpm 10.32.1**, Git. Clone the whole repository; map assets live next to this source directory.

```sh
git clone https://github.com/Always-On-Agent/Always-On-Agent.github.io.git
cd Always-On-Agent.github.io/game-src
corepack enable
CYPRESS_INSTALL_BINARY=0 pnpm install --frozen-lockfile
pnpm prepare:always-on
pnpm dev:always-on --port 3000
```

Open `http://localhost:3000/?scene=singapore&lang=zh` for NTU or `?scene=eccv&lang=en` for the exhibition. The default with no scene parameter is ECCV. `lang=en` / `lang=zh` selects English / Chinese. The first dependency installation and compilation take longer than subsequent runs. If Corepack is unavailable, install the pinned pnpm version with `npm install --global pnpm@10.32.1`.

For the built project page, no Node installation is needed:

```sh
# From the repository root
python3 -m http.server 8888 --bind 127.0.0.1
```

Open `http://localhost:8888/?scene=singapore&lang=zh#live-demo`.

## Where to develop / 修改入口

| Area | Entry points |
| --- | --- |
| 连续自动演示 / Continuous episode | `src/ntuLiveEpisodeStory.js` (events, bilingual story, S/M/A trace and report), `ntuLiveEpisode.tsx` (UI/lifecycle) |
| 人物、道具交接 / Actors and parcel | `src/ntuLiveEpisodeActors.js` |
| 实际行走与碰撞 / Physical movement | `src/ntuLiveEpisodeRuntime.ts`, `ntuLiveRoute.ts` |
| NTU 眼镜面板与交互 | `src/singaporeHud.tsx`, `singaporeActions.ts`, `ntuCompanionHud.tsx` |
| 地图、地点、区域标题 | `src/singaporeMap.ts`, `singaporeMinimap.tsx`, `ntuPlaceSearch.ts`, `ntuRegionBanner.tsx` |
| 校园纹理与环境人物/交通 | `src/ntuCampusTextures.ts`, `singaporeLife.ts` |
| 第一人称、自由飞行、俯瞰 | `src/ntuObserverView.ts`, `ntuCampusExploreHud.tsx` |
| ECCV 场景与交互 | `src/eccvWorld.ts`, `eccvSigns.ts`, `eccvHud.tsx` |
| Esc / 鼠标 / 菜单 | `src/alwaysOnMenuInput.ts`, `controls.ts`, `react/PauseScreen.tsx` |
| 页面嵌入与游戏模式 | `../demo/minecraft-embed.mjs`, `../demo/minecraft-embed.css` |
| 画质、帧率等默认值 | `config.always-on.json`, `src/singaporeMap.ts` |

The story/actors are bundled into Minecraft; there is no separate mesh renderer and no dependency on `demo/campus/` or a machine-specific Downloads directory.

### Maps

- `../game/maps/ntu-campus-v3/`: active converted Minecraft world, `scene.json`, `places.json`, `regions.json`, `routes.json`, `minimap.json`, and Anvil `region/*.mca` files. Treat this as the canonical checked-in map input.
- `../game/maps/ntu-campus-v2/`: legacy Arnis world retained for tests and a local hall comparison. It is not a second public renderer.
- `pnpm prepare:always-on` copies these into ignored local `game-assets/` and `assets/maps/ntu/`. Do not edit those generated copies if you want the change committed.
- `ALWAYS_ON_MAPS_DIR=/path/to/maps` supports a standalone client checkout; no absolute personal paths are built into the source.
- ECCV is generated in code; it needs no external world download.

The active world is about 141 MiB on disk, including metadata. Regions and nearby chunks load on demand; this is not the browser's total memory budget. NTU starts at a short render distance, one mesher and 30 FPS. Lower-end devices still need testing; the renderer, in-browser server, loaded world and browser all consume additional memory. Free flight temporarily increases the visible radius.

### Controls

- `WASD`: move; mouse: look; `Space`: jump. Touch controls are supplied by the client.
- `Tab`: release/capture the cursor; `M`: campus map; `E`: nearby interaction; `H`: glasses panel.
- `Esc`: one game-menu action. The project page's **Enter game mode** fills the page without native browser fullscreen; **Exit game** returns to the project page.
- Campus view tools enable free flight/overhead in the current world. These are Minecraft cameras, not a separate 3D page.
- **Auto demo** starts the continuous S-Lab episode. It uses actual movement/collision, visible NPC/parcel interactions, pause/resume and a final report.

## Framework boundary

This is a **scripted research illustration**, not a model benchmark. Observations and decisions are authored. The five channels are S→M, M→A, A→S, M→S and A→M. Preserve these distinctions when adding a case:

1. Sensing shows an observable cue and its uncertainty.
2. Memory admits scoped information separately from merely seeing it.
3. Action selects an intervention, including checking or waiting.
4. Verification observes an outcome before storing a completion receipt.
5. Priors, current evidence, decisions and receipts remain distinguishable in the trace/report.

Do not replace movement with a camera teleport to make a step pass. Do not write a success receipt before the item handoff finishes. A scripted fixed policy is not self-learning. No camera, microphone or external language model runs in this demo; browser storage contains only this fictional experience's state.

## Test, build, publish

```sh
pnpm build:always-on
pnpm exec tsc --noEmit
pnpm test:always-on
pnpm stage:website
```

Run the build first on a fresh checkout: it also generates the Minecraft data/type artifacts needed by TypeScript. The tests include real Anvil-world movement/collision, pause and cancellation, controls, region cooldowns, HUD interactions and map storage. The stage command copies the tested build into `../game/`; it does not commit or push. Preview the complete project page with Python, check both scenes and a complete automatic episode, then commit `game-src/`, `game/`, and any embedding changes together. Push to `main` to update the existing GitHub Pages site.

For a standalone source checkout, set `ALWAYS_ON_WEBSITE_DIR` to the project website before staging. Build commands force the research configuration and disable the service worker. Dependency versions are locked in `pnpm-lock.yaml`; keep it and `patches/` in sync.

## Upstream and rights

Based on [zardoy/minecraft-web-client](https://github.com/zardoy/minecraft-web-client), upstream baseline `637b62f`, with previous project work through `c39e726` and the current changes in this repository. The original README is retained as `README.UPSTREAM.MD`, alongside its `LICENSE`, `TECH.md`, patches and pinned dependencies. Upstream CI/deployment workflows are not activated here.

Client code, dependencies, Minecraft artwork and third-party campus data have different licenses. See `THIRD_PARTY_NOTICES.txt`, `gpl-dependency-source.zip`, `credits.html`, and each map's `SOURCES.md`. The converted campus is an approximate exterior reconstruction from NTUMap; the original downloaded mesh archive is not included or used at runtime. NPCs, activities, timetables and traffic are fictional. This project is not affiliated with Mojang/Microsoft, NTUMap or Finute.
