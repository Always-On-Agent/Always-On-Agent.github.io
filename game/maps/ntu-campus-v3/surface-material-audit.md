# NTU surface/material audit and correction

Activated locally: 2026-09-16T18:47:27.878Z. Backup: `/Users/bytedance/Downloads/NTUMap-Assets/backups/before-surface-materials-2026-09-16T18-47-27-429Z`.

## Cause

The vector paving mask was present and loaded. NTUMap's source renderer draws authored paving at terrain + 0.12 m after the ground. The local exporter first placed its terrain mask and then stamped all mesh voxels; grass ground decals could overwrite the paving. The overview mesh used the same order. The 159,351-column authored paving mask had 13,175 final exposed grass conflicts (8.27%).

A separate generic green-building-color rule classified ADM's turf roof as oak leaves. The source permits a narrow exception: building layer, material parameter -33, exact RGB (117, 151, 84). Other green -33 materials are trees or planting and remain unchanged. [NTU's official Campus Art Trail](https://www.ntu.edu.sg/life-at-ntu/museum/campus-art-trail) explicitly identifies the sloping grass roofs.

## Bounded changes

- Paving: 17,352 grass blocks in 15,740 columns become smooth stone, only inside the unchanged authored mask and at terrain Y or Y+1. Buried soil and elevated roof turf are excluded.
- ADM: 8,459 leaf blocks become grass, only from the identified roof material. Other tree and planter colors are unchanged.
- All 5,144,638 voxel XYZ records, occupancy, roads, water and all other material records are unchanged. Catalogue, scene, story markers, routes, regions and level.dat were preserved byte-for-byte; SOURCES.md received an explanatory note.
- World and overview were regenerated together. Active viewer: 2,800,914 merged quads, 28,009,140 bytes. Its exposed unit-face area remains 15,047,256.

## Validation

Compared every block from Y -64 through 319 in all 288 changed chunks plus 25 untouched campus/fringe chunks: 30,769,152 comparisons. Exactly the expected 25,811 block material changes occurred. All 1,561 distinct arrival position/yaw combinations pass 3×3 solid support, three air blocks of headroom and three metres of forward eye clearance.

The overview passed record/layout validation, matching total exposed area, 75,000 sampled face materials and 75,000 adjacent-air checks. Detailed reports: `generated/surface-repair-validation.json`, `generated/viewer/verification.json`, and `generated/surface-material-activation.json`.

## Limits and visual references

The full exported terrain rectangle was 83.1% exposed grass before this bounded correction; the occupied-building envelope was 61.5%, and the 400 m Hive neighbourhood was 36.1%. Large surrounding areas have only the grass terrain base. Roads and hardscape already exist. This fix resolves a real ordering error but does not justify replacing all green surroundings with concrete. First-person texture saturation is a separate rendering concern.

This is not a full 1:1 photoreal model. It has one-metre voxels, approximate source shaders/materials, a six-metre terrain source grid, and the source author's modelling coverage. No interiors or unmodelled paving were invented.

Official photo checks: [South Spine / Hive](https://www.ntu.edu.sg/media/images/librariesprovider150/alumni-stories/south-spine.jpg?sfvrsn=559e9aa1_3), [North Spine](https://www.ntu.edu.sg/media/images/librariesprovider150/alumni-stories/north-spine.jpg?sfvrsn=54f05bed_3). Source-authored polygon boundaries, not image guesses, determine the repair extent.

## Reproduction

The ADM exception is in `tools/voxelize-world.cpp`. Run its fresh build into an isolated root with the unchanged decoded source. Then run `tools/fix-paving-priority.cjs STAGE_ROOT ADM_GENERATED_DIR BASELINE_GENERATED_DIR`, where the baseline is the backup above. Export Anvil with `tools/export-anvil.cjs`, regenerate the viewer with `tools/mesh-viewer`, and run `tools/validate-surface-repair.cjs STAGE_GENERATED_DIR BASELINE_GENERATED_DIR` plus `tools/finalize-surface-viewer.cjs STAGE_GENERATED_DIR BASELINE_GENERATED_DIR`.

The full staged result remains at `staging/surface-materials-v2/generated`. Rollback assets are complete in the timestamped backup; replace world, viewer, voxels.bin and voxel-metadata.json together to preserve consistency.
