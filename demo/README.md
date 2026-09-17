# Embedded Minecraft experiences

`minecraft-embed.mjs` lazily loads `../game/` into the project page and switches between `scene=eccv` and `scene=singapore`. `minecraft-embed.css` supplies the frame and page-level game mode. The active NTU world is `game/maps/ntu-campus-v3/`.

Full editable game source and build/run instructions are in [game-src](../game-src/README.MD). The client bundles all episode and actor code; it does not load a separate mesh prototype. Minecraft current-world free flight and overhead cameras remain available.

The iframe and parent use same-origin, source-checked postMessages for game readiness, game-mode state and exit. Game mode fills the page using CSS so browser-native Escape fullscreen behavior does not compete with the game menu. Switching scenes starts a new visit and preserves each experience's fictional memory in browser storage.

The older `core.mjs`, `world.mjs` and `app.mjs` files are archived first-demo implementations, not the active embedded game. No independent original-mesh renderer is shipped.
