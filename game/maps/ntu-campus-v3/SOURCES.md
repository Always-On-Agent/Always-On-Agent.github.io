# Local NTU campus reconstruction — sources

- **Compiled exterior model:** NTUMap / Finute Pte. Ltd., https://ntumap.app/ . Dataset generation timestamp `2026-09-16T13:20:36.006Z`.
- **Provenance:** https://ntumap.app/about/ . **Terms:** https://ntumap.app/terms/ . Public delivery is not an open licence for all original graphics or service content. This local prototype is not an official NTU or Finute product.
- **Map geometry:** © OpenStreetMap contributors, Open Database Licence, https://www.openstreetmap.org/copyright .
- **Elevation:** Mapzen / AWS Terrain Tiles, as attributed by the source project; 6 metre source grid interpolated for block placement.
- **Road markings:** source project attributes LTA Lane Marking via data.gov.sg under the Singapore Open Data Licence: https://data.gov.sg/datasets/d_fa71cc0c433275f4d2b0133358cc4fbf/view .
- **Other source modelling references:** source manifest identifies satellite-reference landscaping, Esri/Google imagery reference, and illustrative parking details. These are visual reconstructions, not independent surveys.

The conversion rebuilds the downloaded exterior geometry as Minecraft blocks at one metre per block. Thin features can become thicker or disappear at block scale. Source approximations remain. Indoor room plans, live buses, actual class schedules, parking occupancy and real attendance are not reproduced as live services here.

Demo tasks, people, traffic and signal timing are fictional simulations. Minecraft blocks and the existing open-source client have their own credits in ../credits.html.

## Surface fidelity correction — 17 September 2026

The converter now preserves the source-authored paving overlay where ground grass previously overwrote it, and treats ADM's identified curved turf roof as grass rather than tree leaves. The paving correction follows the existing NTUMap yards, edits and exclusions; it does not infer new concrete areas from photographs. Other tree/planter colors, roads, water, building coordinates and occupancy are unchanged.

Primary visual references used to check material interpretation:

- [NTU Museum Campus Art Trail](https://www.ntu.edu.sg/life-at-ntu/museum/campus-art-trail): describes ADM's sloping grass roofs and The Hive's ribbed concrete cladding.
- [Official NTU South Spine / Hive photograph](https://www.ntu.edu.sg/media/images/librariesprovider150/alumni-stories/south-spine.jpg?sfvrsn=559e9aa1_3).
- [Official NTU North Spine photograph](https://www.ntu.edu.sg/media/images/librariesprovider150/alumni-stories/north-spine.jpg?sfvrsn=54f05bed_3).

This is a one-metre voxel reconstruction, not a full 1:1 photoreal model or an as-built survey. Materials approximate source colors and shaders using a limited Minecraft palette. Coverage and simplification inherit the source author's model; the broad terrain rectangle includes large grass-filled surroundings. Photos support material interpretation but do not establish complete current geometry, interiors or survey accuracy. The local technical-use and attribution limitations above remain in effect.
