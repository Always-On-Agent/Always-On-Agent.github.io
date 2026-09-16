# NTU academic-core Minecraft map

Public geographic-data prototype for the Always-On Agent demo, generated on 16 September 2026 with [Arnis v3.2.0](https://github.com/louis-e/arnis/releases/tag/v3.2.0).

**Coverage:** approximately 1.5 km² of NTU's academic core, including The Hive, North/South Spine and Yunnan Garden. This is a campus sample, not the whole NTU campus or Singapore. Its horizontal scale is one block per metre; façades, inferred building heights and vegetation are procedural approximations, and interiors are disabled. A one-metre block grid does not imply one-metre source survey accuracy.

## Files and coordinates

- `region/*.mca`: nine Java Anvil region files (~44 MB), including padded edge chunks.
- `level.dat`: declares Minecraft **1.21.4 / DataVersion 4189**. The generator's chunk writer uses DataVersion 3955; actual chunks were successfully read with the client's 1.21.4 Anvil reader. Do not use a 1.19.4 block registry.
- `ntu-core-osm.json`: retained public OSM source extract, 15,382 elements, base timestamp `2026-09-16T12:19:19Z`.
- `landmarks.json`: source OSM feature links and projected coordinates. Polygon centers are not verified entrances.
- `scene.json`: client scenario configuration; its kiosk notices, meetings, return tasks and transport are fictional demo activities, not real campus service information.
- `SOURCES.md`, `LICENSE.md`, `provenance.json`: sources, licensing and exact generator settings.

Bounding box in **west, south, east, north** order: `[103.6765, 1.3385, 103.6875, 1.3495]`. Northwest origin is `(latitude 1.3495, longitude 103.6765)`; +X east, +Z south. Generated bounds are `x=0..1222`, `z=0..1223` inclusive, without rotation.

## Reproduce the geographic world

Download the official [Arnis v3.2.0 macOS universal archive](https://github.com/louis-e/arnis/releases/download/v3.2.0/arnis-mac-universal.tar.gz), extract `arnis-mac-universal`, and verify the archive SHA-256 against `provenance.json`. From this directory, choose a fresh output directory and run:

```bash
./arnis-mac-universal \
  --bbox=1.3385,103.6765,1.3495,103.6875 \
  --file=ntu-core-osm.json --output-dir=ntu-rebuild \
  --scale=1 --mode=geo-terrain --overture=false --canopy-height=false \
  --no-3d --legacy-trees --mapillary-facades=false --signage=none \
  --map-item=false --interior=false --spawn-lat=1.3434 --spawn-lng=103.68305 \
  --bake-lighting --map-preview
```

Arnis's `--bbox` order is **south, west, north, east**, unlike `scene.json`. There is no target Minecraft-version switch in this release. Elevation and land-cover data may still be downloaded; procedural choices or upstream changes can produce different bytes. The runtime scenario and its adjusted safe spawn are separate from map generation.

Display **© OpenStreetMap contributors · ODbL** with the interactive map and retain the source/license links below. The public source extract, generated regions and generator instructions accompany this download.
