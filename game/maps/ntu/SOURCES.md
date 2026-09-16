# NTU map sources

## OpenStreetMap

**© OpenStreetMap contributors**, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/); [copyright and attribution](https://www.openstreetmap.org/copyright).

Roads, paths, building footprints, place names and tagged attributes came from the supplied [`ntu-core-osm.json`](ntu-core-osm.json). Arnis fetched this public extract from `https://lz4.overpass-api.de/api/interpreter`; the snapshot's OSM base timestamp is `2026-09-16T12:19:19Z`. OSM locations and attributes were projected, rasterized and converted to blocks; unspecified building details were inferred. [`landmarks.json`](landmarks.json) preserves individual feature links. The original extract and the OSM-derived geographic database are available under ODbL, with the method of transformation in [README.md](README.md) and [provenance.json](provenance.json).

## Terrain: Mapterhorn / Copernicus GLO-30

Elevation came through [Mapterhorn](https://mapterhorn.com/data-access/). The run requested nine z16 tiles, fell back through absent higher-resolution tiles and used **`https://tiles.mapterhorn.com/12/3227/2032.webp`**. Its cached SHA-256 is recorded in `provenance.json`.

The pinned [Arnis provider](https://github.com/louis-e/arnis/blob/v3.2.0/src/elevation/providers/mapterhorn.rs) identifies z12 and below as the global GLO-30 layer. Mapterhorn's [attribution catalog](https://download.mapterhorn.com/attribution.json) identifies **Copernicus GLO-30**, approximately 30 m source resolution, under the **Copernicus full, free and open license**. [Dataset description](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM), [license record](https://github.com/mapterhorn/mapterhorn/blob/main/source-catalog/glo30/LICENSE.pdf).

Terrain data attribution: DLR e.V. (2010–2014) and Airbus Defence and Space GmbH (2014–2018), provided under Copernicus by the European Union and ESA; all rights reserved. Mapterhorn lists OpenTopography and AWS Open Data as access sources.

Terrain was resampled, smoothed in built-up areas and adjusted around mapped water before block conversion. The run's 51.1 m height range fit without vertical compression. This is not a 1 m LiDAR reconstruction.

## Land cover: ESA WorldCover 2021 v200

**© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium.**

[Data/license](https://esa-worldcover.org/en/data-access), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), [dataset DOI](https://doi.org/10.5281/zenodo.7254221). Arnis used the approximately 10 m classification raster and converted its classes into surfaces and procedural vegetation. Source tile: `ESA_WorldCover_10m_2021_v200_N00E102_Map.tif`, served from the public ESA WorldCover AWS bucket. OSM water/bridge information further adjusted classified surfaces.

## Generator and exclusions

[Arnis v3.2.0](https://github.com/louis-e/arnis/releases/tag/v3.2.0), source commit `338a1d28fc09eec91c73ef14f28c9882bdb852f5`, [Apache-2.0](https://github.com/louis-e/arnis/blob/v3.2.0/LICENSE). No generator binary is included here.

Overture buildings, external 3D models/props, canopy-height data, Mapillary photos, photographed façades and interiors were disabled. No NTU proprietary CAD/BIM files, private campus information or BuildTheEarth builds were used. Real place names identify geographic landmarks; the demo does not claim institutional endorsement.
