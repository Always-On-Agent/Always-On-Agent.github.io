import { useEffect, useState } from 'react'
import { subscribe } from 'valtio'
import { activeModalStack, isGameActive, miscUiState } from './globalState'
import { createNtuRegionTrackerRegistry, NtuRegion, pauseNtuRegionTracker, updateNtuRegionTracker } from './ntuRegionTracker'
import './ntuRegionBanner.css'
import { ntuMapAsset } from './ntuMapLocal'

type RegionPlayer = { entity?: { position: { x: number; y: number; z: number } } }
const trackerForPlayer = createNtuRegionTrackerRegistry()
const BANNER_DURATION_MS = 4900
let cachedRegions: NtuRegion[] | undefined

function parseRegions (data: unknown): NtuRegion[] {
  const regions = (data as { regions?: unknown[] } | null)?.regions
  if (!Array.isArray(regions)) return []
  const seen = new Set<string>()
  return regions.filter((value): value is NtuRegion => {
    const region = value as Partial<NtuRegion> | null
    if (!region || typeof region.id !== 'string' || seen.has(region.id)
      || typeof region.name?.en !== 'string' || typeof region.name?.zh !== 'string'
      || ![region.x, region.z, region.radius].every(value => typeof value === 'number' && Number.isFinite(value))
      || region.radius! <= 0 || (region.priority !== undefined && !Number.isFinite(region.priority))) return false
    seen.add(region.id)
    return true
  })
}

export default function NtuRegionBanner ({ player, language }: { player: RegionPlayer; language: 'en' | 'zh' }) {
  const [regions, setRegions] = useState<NtuRegion[]>(cachedRegions ?? [])
  const [banner, setBanner] = useState<{ region: NtuRegion; serial: number }>()

  useEffect(() => {
    if (cachedRegions) return
    const controller = new AbortController()
    let disposed = false
    void fetch(ntuMapAsset('regions.json'), { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(`Region metadata HTTP ${response.status}`)
        return response.json()
      })
      .then(data => {
        if (disposed) return
        cachedRegions = parseRegions(data)
        setRegions(cachedRegions)
      })
      .catch(error => {
        if (!disposed && error.name !== 'AbortError') console.warn('NTU region titles unavailable', error)
      })
    return () => { disposed = true; controller.abort() }
  }, [])

  useEffect(() => {
    const tracker = trackerForPlayer(player)
    let interval: ReturnType<typeof setInterval> | undefined
    let expiry: ReturnType<typeof setTimeout> | undefined
    let serial = 0
    setBanner(undefined)
    const hide = () => {
      if (expiry !== undefined) clearTimeout(expiry)
      expiry = undefined
      setBanner(undefined)
    }
    const tick = () => {
      if (!isGameActive(true) || document.hidden) return
      const position = player.entity?.position
      if (!position) { pauseNtuRegionTracker(tracker); return }
      const region = updateNtuRegionTracker(tracker, regions, position, performance.now())
      if (!region) return
      if (expiry !== undefined) clearTimeout(expiry)
      setBanner({ region, serial: ++serial })
      expiry = setTimeout(hide, BANNER_DURATION_MS)
    }
    const syncPolling = () => {
      if (regions.length && isGameActive(true) && !document.hidden) {
        if (interval === undefined) { tick(); interval = setInterval(tick, 250) }
      } else {
        if (interval !== undefined) clearInterval(interval)
        interval = undefined
        pauseNtuRegionTracker(tracker)
        hide()
      }
    }
    const stopModalSubscription = subscribe(activeModalStack, syncPolling)
    const stopGameSubscription = subscribe(miscUiState, syncPolling)
    document.addEventListener('visibilitychange', syncPolling)
    syncPolling()
    return () => {
      if (interval !== undefined) clearInterval(interval)
      if (expiry !== undefined) clearTimeout(expiry)
      stopModalSubscription()
      stopGameSubscription()
      document.removeEventListener('visibilitychange', syncPolling)
      pauseNtuRegionTracker(tracker)
    }
  }, [player, regions])

  return banner ? <div key={banner.serial} className='ntu-region-banner' role='status' aria-live='polite' aria-atomic='true'>
    <div className='ntu-region-banner-title'>{banner.region.name[language]}</div>
    <div className='ntu-region-banner-rule' aria-hidden='true' />
  </div> : null
}
