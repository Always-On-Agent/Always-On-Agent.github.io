import { expect, test } from 'vitest'
import { createNtuRegionTracker, createNtuRegionTrackerRegistry, NtuRegion, pauseNtuRegionTracker, updateNtuRegionTracker } from './ntuRegionTracker'

const a: NtuRegion = { id: 'a', name: { en: 'Campus A', zh: '甲区' }, x: 0, z: 0, radius: 30 }
const b: NtuRegion = { id: 'b', name: { en: 'Campus B', zh: '乙区' }, x: 100, z: 0, radius: 30 }
const elsewhere = { x: 300, z: 0 }

test('entering requires a continuous dwell and crossing out restarts it', () => {
  const tracker = createNtuRegionTracker()
  expect(updateNtuRegionTracker(tracker, [a], a, 0)).toBeUndefined()
  expect(updateNtuRegionTracker(tracker, [a], a, 1799)).toBeUndefined()
  expect(updateNtuRegionTracker(tracker, [a], elsewhere, 1800)).toBeUndefined()
  expect(updateNtuRegionTracker(tracker, [a], a, 1900)).toBeUndefined()
  expect(updateNtuRegionTracker(tracker, [a], a, 3699)).toBeUndefined()
  expect(updateNtuRegionTracker(tracker, [a], a, 3700)?.id).toBe('a')
})

test('expanded exit radius prevents overlap and boundary jitter from changing a visit', () => {
  const tracker = createNtuRegionTracker()
  const adjacent = { ...b, x: 55 }
  updateNtuRegionTracker(tracker, [a, adjacent], a, 0)
  expect(updateNtuRegionTracker(tracker, [a, adjacent], a, 1800)?.id).toBe('a')
  for (const [now, x] of [[2000, 31], [4000, 44], [6000, 29], [140_000, 44]]) {
    expect(updateNtuRegionTracker(tracker, [a, adjacent], { x, z: 0 }, now)).toBeUndefined()
    expect(tracker.currentId).toBe('a')
  }
  updateNtuRegionTracker(tracker, [a, adjacent], { x: 46, z: 0 }, 140_100)
  expect(updateNtuRegionTracker(tracker, [a, adjacent], { x: 46, z: 0 }, 141_900)?.id).toBe('b')
})

test('same-region cooldown suppresses rapid returns for the entire visit', () => {
  const tracker = createNtuRegionTracker()
  updateNtuRegionTracker(tracker, [a], a, 0)
  updateNtuRegionTracker(tracker, [a], a, 1800)
  updateNtuRegionTracker(tracker, [a], elsewhere, 3000)
  updateNtuRegionTracker(tracker, [a], a, 4000)
  expect(updateNtuRegionTracker(tracker, [a], a, 5800)).toBeUndefined()
  // Waiting in the same visit never re-announces, even after the cooldown ends.
  expect(updateNtuRegionTracker(tracker, [a], a, 130_000)).toBeUndefined()
  updateNtuRegionTracker(tracker, [a], elsewhere, 131_000)
  updateNtuRegionTracker(tracker, [a], a, 132_000)
  expect(updateNtuRegionTracker(tracker, [a], a, 133_800)?.id).toBe('a')
})

test('teleporting requires dwell at the destination and respects global spacing', () => {
  const tracker = createNtuRegionTracker()
  updateNtuRegionTracker(tracker, [a, b], a, 0)
  updateNtuRegionTracker(tracker, [a, b], a, 1800)
  expect(updateNtuRegionTracker(tracker, [a, b], b, 2000)).toBeUndefined()
  expect(updateNtuRegionTracker(tracker, [a, b], b, 3799)).toBeUndefined()
  expect(updateNtuRegionTracker(tracker, [a, b], b, 3800)).toBeUndefined()
  expect(tracker.currentId).toBe('b')
  expect(updateNtuRegionTracker(tracker, [a, b], b, 13_799)).toBeUndefined()
  expect(updateNtuRegionTracker(tracker, [a, b], b, 13_800)?.id).toBe('b')
  expect(updateNtuRegionTracker(tracker, [a, b], b, 200_000)).toBeUndefined()
})

test('a higher-priority contained landmark can replace a broad region after dwell', () => {
  const tracker = createNtuRegionTracker()
  const campus = { ...a, radius: 200 }
  const landmark = { ...b, priority: 2 }
  updateNtuRegionTracker(tracker, [campus, landmark], a, 0)
  updateNtuRegionTracker(tracker, [campus, landmark], a, 1800)
  updateNtuRegionTracker(tracker, [campus, landmark], landmark, 20_000)
  expect(updateNtuRegionTracker(tracker, [campus, landmark], landmark, 21_800)?.id).toBe('b')
})

test('pausing cannot complete an interrupted dwell and cancels pending announcements', () => {
  const tracker = createNtuRegionTracker()
  updateNtuRegionTracker(tracker, [a, b], a, 0)
  pauseNtuRegionTracker(tracker)
  expect(updateNtuRegionTracker(tracker, [a, b], a, 10_000)).toBeUndefined()
  expect(updateNtuRegionTracker(tracker, [a, b], a, 11_800)?.id).toBe('a')
  updateNtuRegionTracker(tracker, [a, b], b, 12_000)
  updateNtuRegionTracker(tracker, [a, b], b, 13_800)
  pauseNtuRegionTracker(tracker)
  expect(updateNtuRegionTracker(tracker, [a, b], b, 40_000)).toBeUndefined()
})

test('HUD remount reuses player history; a new player starts a new visit', () => {
  const trackerFor = createNtuRegionTrackerRegistry()
  const firstPlayer = {}
  const tracker = trackerFor(firstPlayer)
  updateNtuRegionTracker(tracker, [a], a, 0)
  expect(updateNtuRegionTracker(tracker, [a], a, 1800)?.id).toBe('a')
  pauseNtuRegionTracker(tracker)
  expect(trackerFor(firstPlayer)).toBe(tracker)
  expect(updateNtuRegionTracker(trackerFor(firstPlayer), [a], a, 200_000)).toBeUndefined()
  const newTracker = trackerFor({})
  expect(newTracker).not.toBe(tracker)
  updateNtuRegionTracker(newTracker, [a], a, 200_000)
  expect(updateNtuRegionTracker(newTracker, [a], a, 201_800)?.id).toBe('a')
})

test('invalid or missing region observations never produce a stale title', () => {
  const tracker = createNtuRegionTracker()
  updateNtuRegionTracker(tracker, [a], a, 0)
  expect(updateNtuRegionTracker(tracker, [a], { x: NaN, z: 0 }, 1800)).toBeUndefined()
  expect(updateNtuRegionTracker(tracker, [], a, 2000)).toBeUndefined()
  expect(tracker.currentId).toBeUndefined()
})
