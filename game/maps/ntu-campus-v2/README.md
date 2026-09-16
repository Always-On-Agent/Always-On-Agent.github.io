# NTU campus Minecraft map

Public geographic-data prototype for the Always-On Agent demo, generated on 16 September 2026 with [Arnis v3.2.0](https://github.com/louis-e/arnis/releases/tag/v3.2.0).

**Coverage:** the public geographic snapshot spans the NTU campus, NIE, residences and sports facilities, plus surrounding land inside a **7.453 km² bounding rectangle**. This number is the generated rectangle, **not NTU's official campus land area**. Its 2,548 × 2,927 block extent contains the complete mapped NTU boundary, Halls 1–16, Pioneer/Crescent, Binjai/Tanjong/Banyan, Tamarind/Saraca, Graduate Halls 1/2, NIE and the Sports and Recreation Centre. `coverage.json` preserves the checked source features.

The horizontal scale is one block per metre. Public photographs and the [official campus map](https://maps.ntu.edu.sg/) informed independently hand-authored, approximate voxel landmark exteriors at runtime. Other façades, inferred building heights and vegetation remain procedural; interiors are disabled. No NTU photographs, proprietary map tiles, CAD/BIM or official 3D models are bundled. A one-metre block grid does not imply one-metre source survey accuracy.

## Files and coordinates

- `region/*.mca`: 30 Java Anvil region files (145,735,680 bytes; about 139 MiB), including padded edge chunks.
- `level.dat`: declares Minecraft **1.21.4 / DataVersion 4189**. The generator's chunk writer uses DataVersion 3955; actual chunks were successfully read with the client's 1.21.4 Anvil reader. Do not use a 1.19.4 block registry.
- `ntu-core-osm.json`: retained **full-campus and surroundings** OSM source extract, 33,327 elements, base timestamp `2026-09-16T13:23:36Z`. The historical filename is retained for client compatibility.
- `landmarks.json`: source OSM feature links and projected coordinates. Polygon centers are not verified entrances.
- `scene.json`: client scenario configuration; its four story kiosks and four separately checked exploration landing spots, notices, meetings, return tasks and transport are fictional demo activities, not real campus service information.
- `SOURCES.md`, `LICENSE.md`, `provenance.json`: sources, licensing and exact generator settings.

Bounding box in **west, south, east, north** order: `[103.66958674304419, 1.337, 103.6925, 1.3633152085036795]`. Northwest origin is `(latitude 1.3633152085036795, longitude 103.66958674304419)`; +X east, +Z south. Generated bounds are `x=0..2547`, `z=0..2926` inclusive, without rotation.

`architectureOffset = {x:768, y:10, z:1536}` transfers the previously authored core architecture to the expanded map. It is chunk-aligned; exact newly projected geographic points can differ by one or two blocks. Ground comparisons showed the core rising mostly ten blocks after the wider terrain range changed its elevation baseline. The spawn, all four story approaches and four tour approaches were independently checked against the newly generated Anvil blocks for a level 3×3 floor, body/head clearance and clear sightline; `scenario-kiosks.json`, `tour-kiosks.json` and `ground-comparison.json` retain those checks. Runtime architectural decorators require their own integration checks.

## Reproduce the geographic world

Download the official [Arnis v3.2.0 macOS universal archive](https://github.com/louis-e/arnis/releases/download/v3.2.0/arnis-mac-universal.tar.gz), extract `arnis-mac-universal`, and verify the archive SHA-256 against `provenance.json`. From this directory, choose a fresh output directory and run:

```bash
./arnis-mac-universal \
  --bbox=1.337,103.66958674304419,1.3633152085036795,103.6925 \
  --file=ntu-core-osm.json --output-dir=ntu-rebuild \
  --scale=1 --mode=geo-terrain --overture=false --canopy-height=false \
  --no-3d --legacy-trees --mapillary-facades=false --signage=none \
  --map-item=false --interior=false --spawn-lat=1.3434 --spawn-lng=103.68305 \
  --bake-lighting --map-preview
```

Arnis's `--bbox` order is **south, west, north, east**, unlike `scene.json`. There is no target Minecraft-version switch in this release. Elevation and land-cover data may still be downloaded; procedural choices or upstream changes can produce different bytes. The runtime scenario and its adjusted safe spawn are separate from map generation.

Display **© OpenStreetMap contributors · ODbL** with the interactive map and retain the source/license links below. The public source extract, generated regions and generator instructions accompany this download.
