type Point = { x: number; y: number; z: number }

type TerrainReadyOptions = {
  points: readonly Point[]
  getGroundHeight: (point: Point) => number | undefined
  signal: AbortSignal
  isPaused?: () => boolean
  timeoutMs?: number
  pollMs?: number
}

/** Wait for real streamed terrain. Paused time does not consume the loading budget. */
export async function waitForNtuTerrain ({ points, getGroundHeight, signal, isPaused = () => false, timeoutMs = 15_000, pollMs = 100 }: TerrainReadyOptions): Promise<boolean> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let settled = false
    let activeMs = 0
    let previousTime = performance.now()
    let previouslyPaused = isPaused()
    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
      signal.removeEventListener('abort', cancel)
    }
    const finish = (ready: boolean) => {
      settled = true
      cleanup()
      resolve(ready)
    }
    const cancel = () => {
      if (settled) return
      settled = true
      cleanup()
      reject(new DOMException('Cancelled', 'AbortError'))
    }
    const tick = () => {
      if (signal.aborted) { cancel(); return }
      try {
        const now = performance.now()
        const paused = isPaused()
        if (!paused && !previouslyPaused) activeMs += Math.max(0, now - previousTime)
        previousTime = now
        previouslyPaused = paused
        if (!paused) {
          if (points.every(point => Number.isFinite(getGroundHeight(point)))) { finish(true); return }
          if (activeMs >= timeoutMs) { finish(false); return }
        }
        timer = setTimeout(tick, paused ? pollMs : Math.min(pollMs, Math.max(1, timeoutMs - activeMs)))
      } catch (error) {
        settled = true
        cleanup()
        reject(error)
      }
    }
    signal.addEventListener('abort', cancel, { once: true })
    tick()
  })
}
