export type NtuRegion = {
  id: string
  name: { en: string; zh: string }
  x: number
  z: number
  radius: number
  priority?: number
}

type Position = { x: number; z: number }
export type NtuRegionTracker = {
  currentId?: string
  candidateId?: string
  candidateSince: number
  pendingId?: string
  lastAnnouncement: number
  announcedAt: Map<string, number>
}

export const NTU_REGION_DWELL_MS = 1800
export const NTU_REGION_COOLDOWN_MS = 120_000
export const NTU_REGION_GLOBAL_COOLDOWN_MS = 12_000

export function createNtuRegionTracker (): NtuRegionTracker {
  return { candidateSince: 0, lastAnnouncement: -Infinity, announcedAt: new Map() }
}

/** A player object identifies a session; unmounting a HUD does not start a visit. */
export function createNtuRegionTrackerRegistry () {
  const trackers = new WeakMap<object, NtuRegionTracker>()
  return (player: object) => {
    let tracker = trackers.get(player)
    if (!tracker) {
      tracker = createNtuRegionTracker()
      trackers.set(player, tracker)
    }
    return tracker
  }
}

/** Pause dwell, retaining the occupied region and its announcement history. */
export function pauseNtuRegionTracker (tracker: NtuRegionTracker) {
  tracker.candidateId = undefined
  tracker.pendingId = undefined
}

const distance = (region: NtuRegion, position: Position) => Math.hypot(region.x - position.x, region.z - position.z)

/** Deterministic region transitions; the caller supplies active-game time samples. */
export function updateNtuRegionTracker (tracker: NtuRegionTracker, regions: readonly NtuRegion[], position: Position, now: number): NtuRegion | undefined {
  if (![position.x, position.z, now].every(Number.isFinite)) {
    pauseNtuRegionTracker(tracker)
    return
  }
  const current = regions.find(region => region.id === tracker.currentId)
  const containing = regions.filter(region => distance(region, position) <= region.radius)
  containing.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)
    || distance(a, position) / a.radius - distance(b, position) / b.radius
    || a.id.localeCompare(b.id))
  let next = containing[0]
  // Equal-priority overlap never steals a region until its expanded edge is left.
  const withinExit = current && distance(current, position) <= current.radius + Math.max(15, current.radius * 0.25)
  if (withinExit && (!next || (next.priority ?? 0) <= (current.priority ?? 0))) next = current

  if (!next) {
    tracker.currentId = undefined
    pauseNtuRegionTracker(tracker)
    return
  }
  if (next.id === tracker.currentId) {
    tracker.candidateId = undefined
  } else {
    if (next.id !== tracker.candidateId) {
      tracker.candidateId = next.id
      tracker.candidateSince = now
      return
    }
    if (now - tracker.candidateSince < NTU_REGION_DWELL_MS) return
    tracker.currentId = next.id
    tracker.candidateId = undefined
    // A return within the same-region cooldown is suppressed for this entire visit.
    tracker.pendingId = now - (tracker.announcedAt.get(next.id) ?? -Infinity) >= NTU_REGION_COOLDOWN_MS ? next.id : undefined
  }
  // A different region can wait for the global spacing, while the player remains.
  if (tracker.pendingId === next.id && now - tracker.lastAnnouncement >= NTU_REGION_GLOBAL_COOLDOWN_MS) {
    tracker.pendingId = undefined
    tracker.lastAnnouncement = now
    tracker.announcedAt.set(next.id, now)
    return next
  }
}
