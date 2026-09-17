import { afterEach, expect, test, vi } from 'vitest'
import { waitForNtuTerrain } from './ntuTerrainReady'

const points = [{ x: 0, y: 52, z: 0 }, { x: 16, y: 52, z: 0 }]
afterEach(() => { vi.useRealTimers() })
const clock = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })

test('arrival alone is insufficient: waits until every route point has streamed real ground', async () => {
  clock()
  const loaded = new Set([0])
  const ready = vi.fn()
  const pending = waitForNtuTerrain({ points, getGroundHeight: point => (loaded.has(point.x) ? 52 : undefined), signal: new AbortController().signal }).then(ready)
  await vi.advanceTimersByTimeAsync(600)
  expect(ready).not.toHaveBeenCalled()
  loaded.add(16)
  await vi.advanceTimersByTimeAsync(100)
  await pending
  expect(ready).toHaveBeenCalledWith(true)
  expect(vi.getTimerCount()).toBe(0)
})

test('missing terrain times out without accepting nominal route heights or NaN', async () => {
  clock()
  const pending = waitForNtuTerrain({ points, getGroundHeight: point => (point.x === 0 ? 52 : NaN), signal: new AbortController().signal, timeoutMs: 500 })
  await vi.advanceTimersByTimeAsync(500)
  expect(await pending).toBe(false)
  expect(vi.getTimerCount()).toBe(0)
})

test('pausing suspends probing and timeout, then resumes readiness from the same scene', async () => {
  clock()
  let paused = false
  let loaded = false
  const probe = vi.fn(() => (loaded ? 52 : undefined))
  const ready = vi.fn()
  const pending = waitForNtuTerrain({ points, getGroundHeight: probe, signal: new AbortController().signal, isPaused: () => paused, timeoutMs: 500 }).then(ready)
  await vi.advanceTimersByTimeAsync(200)
  paused = true
  probe.mockClear()
  loaded = true
  await vi.advanceTimersByTimeAsync(5000)
  expect(probe).not.toHaveBeenCalled()
  expect(ready).not.toHaveBeenCalled()
  paused = false
  await vi.advanceTimersByTimeAsync(100)
  await pending
  expect(ready).toHaveBeenCalledWith(true)
})

test('exit aborts immediately and removes polling even while the preparation is paused', async () => {
  clock()
  const abort = new AbortController()
  const probe = vi.fn(() => undefined)
  const pending = waitForNtuTerrain({ points, getGroundHeight: probe, signal: abort.signal, isPaused: () => true })
  const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  abort.abort()
  await rejected
  await vi.advanceTimersByTimeAsync(20_000)
  expect(probe).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})

test('an already cancelled mount never inspects the disposed runtime', async () => {
  clock()
  const abort = new AbortController(); abort.abort()
  const probe = vi.fn(() => 52)
  await expect(waitForNtuTerrain({ points, getGroundHeight: probe, signal: abort.signal })).rejects.toMatchObject({ name: 'AbortError' })
  expect(probe).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})
