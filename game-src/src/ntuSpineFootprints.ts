/**
 * Compact OpenStreetMap-derived footprints (© OpenStreetMap contributors, ODbL 1.0).
 * Source: assets/maps/ntu/ntu-core-osm.json; snapshot 2026-09-16T12:19:19Z.
 * Projection: original Arnis core grid, x=trunc((lon-103.6765)/.011*1222),
 * z=trunc((1-(lat-1.3385)/.011)*1223). No network access is needed at runtime.
 * floorY values were inspected against the published Anvil slabs / terrain.
 * North Spine's five storeys are OSM tagged. Other floor counts and facade
 * spacing are deliberately approximate interpretations of NTU's official photos,
 * not a measured model, room layout or surveyed elevation.
 * Official visual references:
 * https://www.ntu.edu.sg/alumni/alumni-stories-news/detail/ntu-then-and-now
 * https://www.ntu.edu.sg/life-at-ntu/museum/campus-art-trail
 * https://www.ntu.edu.sg/images/default-source/default-album/buildings/hive.jpg
 */
export type SpineFootprint = {
  osmWayId: number
  name: string
  kind: 'north' | 'south' | 'wing' | 'link'
  floorY: number
  levels: number
  clearTop: number
  bounds: { minX: number, maxX: number, minZ: number, maxZ: number }
  polygon: ReadonlyArray<readonly [number, number]>
}

export const NTU_SPINE_FOOTPRINTS: readonly SpineFootprint[] = [
  {
    "osmWayId": 49967705,
    "name": "North Spine",
    "kind": "north",
    "floorY": -16,
    "levels": 5,
    "clearTop": 10,
    "bounds": {
      "minX": 450,
      "maxX": 524,
      "minZ": 185,
      "maxZ": 494
    },
    "polygon": [
      [
        455,
        494
      ],
      [
        450,
        494
      ],
      [
        450,
        433
      ],
      [
        450,
        405
      ],
      [
        450,
        389
      ],
      [
        451,
        352
      ],
      [
        450,
        332
      ],
      [
        450,
        309
      ],
      [
        450,
        294
      ],
      [
        450,
        222
      ],
      [
        450,
        219
      ],
      [
        451,
        211
      ],
      [
        454,
        203
      ],
      [
        458,
        196
      ],
      [
        464,
        191
      ],
      [
        472,
        187
      ],
      [
        479,
        185
      ],
      [
        486,
        185
      ],
      [
        494,
        186
      ],
      [
        501,
        189
      ],
      [
        507,
        193
      ],
      [
        512,
        198
      ],
      [
        515,
        203
      ],
      [
        519,
        211
      ],
      [
        520,
        217
      ],
      [
        521,
        254
      ],
      [
        524,
        256
      ],
      [
        524,
        259
      ],
      [
        524,
        282
      ],
      [
        524,
        299
      ],
      [
        524,
        340
      ],
      [
        524,
        357
      ],
      [
        524,
        379
      ],
      [
        523,
        450
      ],
      [
        518,
        451
      ],
      [
        518,
        459
      ],
      [
        511,
        461
      ],
      [
        506,
        461
      ],
      [
        505,
        449
      ],
      [
        491,
        449
      ],
      [
        491,
        461
      ],
      [
        491,
        487
      ],
      [
        491,
        494
      ],
      [
        479,
        494
      ],
      [
        467,
        494
      ]
    ]
  },
  {
    "osmWayId": 533741380,
    "name": "North Spine",
    "kind": "link",
    "floorY": -18,
    "levels": 2,
    "clearTop": -4,
    "bounds": {
      "minX": 445,
      "maxX": 482,
      "minZ": 494,
      "maxZ": 576
    },
    "polygon": [
      [
        467,
        494
      ],
      [
        469,
        494
      ],
      [
        470,
        495
      ],
      [
        470,
        496
      ],
      [
        470,
        499
      ],
      [
        470,
        501
      ],
      [
        468,
        502
      ],
      [
        467,
        502
      ],
      [
        464,
        502
      ],
      [
        464,
        546
      ],
      [
        468,
        544
      ],
      [
        482,
        557
      ],
      [
        471,
        569
      ],
      [
        463,
        562
      ],
      [
        463,
        565
      ],
      [
        448,
        576
      ],
      [
        445,
        573
      ],
      [
        459,
        563
      ],
      [
        459,
        554
      ],
      [
        460,
        502
      ],
      [
        455,
        502
      ],
      [
        455,
        494
      ]
    ]
  },
  {
    "osmWayId": 49967706,
    "name": "South Spine",
    "kind": "south",
    "floorY": -18,
    "levels": 4,
    "clearTop": 1,
    "bounds": {
      "minX": 428,
      "maxX": 668,
      "minZ": 582,
      "maxZ": 802
    },
    "polygon": [
      [
        466,
        637
      ],
      [
        483,
        653
      ],
      [
        478,
        658
      ],
      [
        531,
        713
      ],
      [
        532,
        714
      ],
      [
        547,
        728
      ],
      [
        595,
        777
      ],
      [
        610,
        792
      ],
      [
        615,
        797
      ],
      [
        620,
        799
      ],
      [
        625,
        801
      ],
      [
        632,
        802
      ],
      [
        637,
        802
      ],
      [
        644,
        801
      ],
      [
        652,
        797
      ],
      [
        659,
        791
      ],
      [
        664,
        784
      ],
      [
        667,
        778
      ],
      [
        668,
        772
      ],
      [
        668,
        764
      ],
      [
        667,
        757
      ],
      [
        664,
        750
      ],
      [
        659,
        743
      ],
      [
        639,
        723
      ],
      [
        628,
        712
      ],
      [
        616,
        700
      ],
      [
        560,
        644
      ],
      [
        546,
        634
      ],
      [
        540,
        628
      ],
      [
        537,
        631
      ],
      [
        531,
        625
      ],
      [
        528,
        622
      ],
      [
        523,
        627
      ],
      [
        513,
        611
      ],
      [
        506,
        604
      ],
      [
        486,
        624
      ],
      [
        457,
        594
      ],
      [
        442,
        582
      ],
      [
        428,
        599
      ]
    ]
  },
  {
    "osmWayId": 49967805,
    "name": "Nanyang Business School (S3)",
    "kind": "wing",
    "floorY": -26,
    "levels": 5,
    "clearTop": -3,
    "bounds": {
      "minX": 615,
      "maxX": 767,
      "minZ": 559,
      "maxZ": 712
    },
    "polygon": [
      [
        749,
        561
      ],
      [
        751,
        562
      ],
      [
        754,
        559
      ],
      [
        757,
        561
      ],
      [
        753,
        565
      ],
      [
        760,
        572
      ],
      [
        764,
        568
      ],
      [
        767,
        571
      ],
      [
        763,
        575
      ],
      [
        765,
        577
      ],
      [
        693,
        650
      ],
      [
        644,
        700
      ],
      [
        638,
        705
      ],
      [
        635,
        708
      ],
      [
        631,
        712
      ],
      [
        630,
        711
      ],
      [
        628,
        712
      ],
      [
        616,
        700
      ],
      [
        618,
        699
      ],
      [
        615,
        696
      ],
      [
        619,
        692
      ],
      [
        623,
        689
      ],
      [
        677,
        634
      ]
    ]
  },
  {
    "osmWayId": 49967806,
    "name": "S. Rajaratnam School of International Studies (S4)",
    "kind": "wing",
    "floorY": -26,
    "levels": 5,
    "clearTop": -3,
    "bounds": {
      "minX": 546,
      "maxX": 701,
      "minZ": 491,
      "maxZ": 644
    },
    "polygon": [
      [
        698,
        508
      ],
      [
        572,
        635
      ],
      [
        569,
        638
      ],
      [
        567,
        640
      ],
      [
        564,
        643
      ],
      [
        562,
        642
      ],
      [
        560,
        644
      ],
      [
        546,
        634
      ],
      [
        551,
        630
      ],
      [
        548,
        627
      ],
      [
        552,
        623
      ],
      [
        554,
        621
      ],
      [
        556,
        619
      ],
      [
        683,
        492
      ],
      [
        686,
        495
      ],
      [
        690,
        491
      ],
      [
        694,
        495
      ],
      [
        701,
        501
      ],
      [
        696,
        506
      ]
    ]
  },
  {
    "osmWayId": 49967820,
    "name": "School of Electrical and Electronic Engineering (S2)",
    "kind": "wing",
    "floorY": -26,
    "levels": 5,
    "clearTop": -3,
    "bounds": {
      "minX": 397,
      "maxX": 547,
      "minZ": 713,
      "maxZ": 865
    },
    "polygon": [
      [
        397,
        848
      ],
      [
        413,
        865
      ],
      [
        427,
        851
      ],
      [
        473,
        803
      ],
      [
        486,
        790
      ],
      [
        547,
        728
      ],
      [
        532,
        714
      ],
      [
        531,
        713
      ],
      [
        468,
        775
      ],
      [
        457,
        787
      ]
    ]
  },
  {
    "osmWayId": 49967822,
    "name": "School of Electrical and Electronic Engineering (S1)",
    "kind": "wing",
    "floorY": -20,
    "levels": 5,
    "clearTop": 3,
    "bounds": {
      "minX": 331,
      "maxX": 483,
      "minZ": 637,
      "maxZ": 794
    },
    "polygon": [
      [
        331,
        776
      ],
      [
        333,
        778
      ],
      [
        331,
        780
      ],
      [
        334,
        783
      ],
      [
        336,
        781
      ],
      [
        344,
        788
      ],
      [
        340,
        791
      ],
      [
        343,
        794
      ],
      [
        404,
        735
      ],
      [
        478,
        658
      ],
      [
        483,
        653
      ],
      [
        466,
        637
      ]
    ]
  },
  {
    "osmWayId": 49967875,
    "name": "School of Mechnical and Aerospace Engineering",
    "kind": "wing",
    "floorY": -17,
    "levels": 5,
    "clearTop": 6,
    "bounds": {
      "minX": 524,
      "maxX": 716,
      "minZ": 258,
      "maxZ": 282
    },
    "polygon": [
      [
        702,
        258
      ],
      [
        696,
        258
      ],
      [
        646,
        259
      ],
      [
        590,
        259
      ],
      [
        524,
        259
      ],
      [
        524,
        282
      ],
      [
        588,
        281
      ],
      [
        647,
        282
      ],
      [
        704,
        282
      ],
      [
        712,
        282
      ],
      [
        713,
        278
      ],
      [
        716,
        278
      ],
      [
        716,
        270
      ],
      [
        716,
        261
      ],
      [
        712,
        261
      ],
      [
        712,
        258
      ]
    ]
  },
  {
    "osmWayId": 49967883,
    "name": "College of Computing and Data Science",
    "kind": "wing",
    "floorY": -16,
    "levels": 5,
    "clearTop": 7,
    "bounds": {
      "minX": 524,
      "maxX": 718,
      "minZ": 356,
      "maxZ": 379
    },
    "polygon": [
      [
        718,
        357
      ],
      [
        718,
        377
      ],
      [
        718,
        379
      ],
      [
        524,
        379
      ],
      [
        524,
        357
      ],
      [
        590,
        356
      ],
      [
        647,
        357
      ],
      [
        704,
        357
      ]
    ]
  }
]
