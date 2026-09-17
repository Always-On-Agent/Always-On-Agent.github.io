/**
 * Shared fictional outdoor episode beside the ABN / S-Lab exterior arrival.
 * Coordinates align with the reconstructed Minecraft campus.
 * Nominal 36 m out-and-back; path[0/1/2] and [38/39/40] share the trimmed
 * endpoint so existing interaction indices 6, 20, and 34 remain stable.
 *
 * Minecraft feet Y=52 is verified against the active Anvil world with actual
 * Botcraft physics.
 * Initial shuttle remains (-18.5,52,132.5); walk the final 2 m to this start.
 * This is a fictional road-edge scene, not a verified pedestrian route,
 * lab doorway, or reconstructed interior. No world geometry is changed.
 */
export const LIVE_ROUTE = {
  'start': {
    'x': -16.5,
    'y': 52,
    'z': 132.5
  },
  'colleague': {
    'x': -12.5,
    'y': 52,
    'z': 131.5
  },
  'steward': {
    'x': 1.5,
    'y': 52,
    'z': 127.5
  },
  'pickup': {
    'x': -0.5,
    'y': 52,
    'z': 128.5
  },
  'path': [
    {
      'x': -16.5,
      'y': 52,
      'z': 132.5
    },
    {
      'x': -16.5,
      'y': 52,
      'z': 132.5
    },
    {
      'x': -16.5,
      'y': 52,
      'z': 132.5
    },
    {
      'x': -15.5,
      'y': 52,
      'z': 132.5
    },
    {
      'x': -14.5,
      'y': 52,
      'z': 132.5
    },
    {
      'x': -13.5,
      'y': 52,
      'z': 132.5
    },
    {
      'x': -12.5,
      'y': 52,
      'z': 132.5
    },
    {
      'x': -11.5,
      'y': 52,
      'z': 132.5
    },
    {
      'x': -10.5,
      'y': 52,
      'z': 132.5
    },
    {
      'x': -9.5,
      'y': 52,
      'z': 132.5
    },
    {
      'x': -9.5,
      'y': 52,
      'z': 131.5
    },
    {
      'x': -8.5,
      'y': 52,
      'z': 131.5
    },
    {
      'x': -7.5,
      'y': 52,
      'z': 131.5
    },
    {
      'x': -7.5,
      'y': 52,
      'z': 130.5
    },
    {
      'x': -6.5,
      'y': 52,
      'z': 130.5
    },
    {
      'x': -5.5,
      'y': 52,
      'z': 130.5
    },
    {
      'x': -5.5,
      'y': 52,
      'z': 129.5
    },
    {
      'x': -4.5,
      'y': 52,
      'z': 129.5
    },
    {
      'x': -3.5,
      'y': 52,
      'z': 129.5
    },
    {
      'x': -2.5,
      'y': 52,
      'z': 129.5
    },
    {
      'x': -2.5,
      'y': 52,
      'z': 128.5
    },
    {
      'x': -2.5,
      'y': 52,
      'z': 129.5
    },
    {
      'x': -3.5,
      'y': 52,
      'z': 129.5
    },
    {
      'x': -4.5,
      'y': 52,
      'z': 129.5
    },
    {
      'x': -5.5,
      'y': 52,
      'z': 129.5
    },
    {
      'x': -5.5,
      'y': 52,
      'z': 130.5
    },
    {
      'x': -6.5,
      'y': 52,
      'z': 130.5
    },
    {
      'x': -7.5,
      'y': 52,
      'z': 130.5
    },
    {
      'x': -7.5,
      'y': 52,
      'z': 131.5
    },
    {
      'x': -8.5,
      'y': 52,
      'z': 131.5
    },
    {
      'x': -9.5,
      'y': 52,
      'z': 131.5
    },
    {
      'x': -9.5,
      'y': 52,
      'z': 132.5
    },
    {
      'x': -10.5,
      'y': 52,
      'z': 132.5
    },
    {
      'x': -11.5,
      'y': 52,
      'z': 132.5
    },
    {
      'x': -12.5,
      'y': 52,
      'z': 132.5
    },
    {
      'x': -13.5,
      'y': 52,
      'z': 132.5
    },
    {
      'x': -14.5,
      'y': 52,
      'z': 132.5
    },
    {
      'x': -15.5,
      'y': 52,
      'z': 132.5
    },
    {
      'x': -16.5,
      'y': 52,
      'z': 132.5
    },
    {
      'x': -16.5,
      'y': 52,
      'z': 132.5
    },
    {
      'x': -16.5,
      'y': 52,
      'z': 132.5
    }
  ]
} as const
