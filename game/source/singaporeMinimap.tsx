import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { SingaporeLanguage, SingaporeStation, SingaporeText } from './singaporeStory'
import { campusMapViewport, minimapHeading, minimapPin, minimapPixel, minimapViewport, type MinimapPoint, type MinimapView } from './singaporeMinimapGeometry'
import { activeModalStack, hideModal, showModal } from './globalState'
import { useIsModalActive } from './react/utilsApp'
import './singaporeMinimap.css'

type MapData = { minX: number; minZ: number; width: number; depth: number; features: Array<['building' | 'road' | 'path' | 'green' | 'water', number[]]> }
type MapPlayer = { entity?: { position: MinimapPoint; yaw: number } }
type Station = { id: SingaporeStation; name: SingaporeText; position: MinimapPoint }
type TourStop = { id: string; name: SingaporeText; position: MinimapPoint }
type Props = { player: MapPlayer; stations: readonly Station[]; tourStops?: readonly TourStop[]; language: SingaporeLanguage; focus: SingaporeStation; touch: boolean }
const CAMPUS_MAP_MODAL = 'singapore-campus-map'
const tourSymbols: Record<string, string> = { 'tour-nie': 'N', 'tour-residences': 'R', 'tour-sports': 'S', 'tour-adm': 'A' }
const stationSymbols: Record<SingaporeStation, string> = { plaza: 'H', library: 'L', return: 'Q', meetup: 'Y' }
const stationLabels: Record<SingaporeStation, SingaporeText> = {
  plaza: { en: 'The Hive', zh: 'The Hive' }, library: { en: 'Library', zh: '图书馆' }, return: { en: 'The Quad', zh: 'The Quad' }, meetup: { en: 'Yunnan Garden', zh: '云南园' }
}
let mapRequest: Promise<MapData> | undefined
function loadMap () {
  mapRequest ??= fetch('./maps/ntu-campus-v2/minimap.json').then(async response => {
    if (!response.ok) throw new Error('NTU minimap is unavailable')
    return response.json() as Promise<MapData>
  }).catch(error => { mapRequest = undefined; throw error })
  return mapRequest
}

/** Draw fixed map geometry once; walking and turning only redraw a small crop. */
function rasterize (map: MapData) {
  const canvas = document.createElement('canvas')
  const resolution = Math.min(2, 3072 / Math.max(map.width, map.depth))
  canvas.width = Math.round(map.width * resolution); canvas.height = Math.round(map.depth * resolution)
  const context = canvas.getContext('2d')!
  context.scale(canvas.width / map.width, canvas.height / map.depth)
  context.fillStyle = '#dce2d7'; context.fillRect(0, 0, map.width, map.depth)
  context.translate(-map.minX, -map.minZ)
  context.lineCap = 'round'; context.lineJoin = 'round'
  const trace = (points: number[]) => {
    context.beginPath(); context.moveTo(points[0], points[1])
    for (let index = 2; index < points.length; index += 2) context.lineTo(points[index], points[index + 1])
  }
  for (const kind of ['green', 'water', 'building', 'road', 'path']) {
    for (const [type, points] of map.features) {
      if (type !== kind) continue
      trace(points)
      if (kind === 'road' || kind === 'path') {
        context.strokeStyle = kind === 'road' ? '#b7c1b7' : '#cbd2c5'; context.lineWidth = kind === 'road' ? 10 : 3.5; context.stroke()
        context.strokeStyle = kind === 'road' ? '#fcfcf3' : '#f1f2e8'; context.lineWidth = kind === 'road' ? 6.5 : 1.8; context.stroke()
      } else {
        context.closePath()
        context.fillStyle = kind === 'green' ? '#bed2b4' : kind === 'water' ? '#a9cbd2' : '#a7b1a6'; context.fill()
        if (kind === 'building') { context.strokeStyle = '#eef0e5'; context.lineWidth = 1.3; context.stroke() }
      }
    }
  }
  return canvas
}

type CampusMapProps = Pick<Props, 'player' | 'stations' | 'tourStops' | 'language' | 'focus'> & {
  map?: MapData; raster?: HTMLCanvasElement; unavailable: boolean; onClose: () => void
}

function CampusMapDialog ({ player, stations, tourStops = [], language, focus, map, raster, unavailable, onClose }: CampusMapProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef<MinimapView>()
  const dragRef = useRef<{ x: number; y: number; pointer: number }>()
  const [camera, setCamera] = useState<{ zoom: number; center?: MinimapPoint }>({ zoom: 1 })
  const zh = language === 'zh'
  const places = [...stations, ...tourStops]
  const symbol = (id: string) => stationSymbols[id as SingaporeStation] ?? tourSymbols[id] ?? '·'
  const name = (station: TourStop) => stationLabels[station.id as SingaporeStation]?.[language] ?? station.name[language]
  const focusPoint = (position?: MinimapPoint) => {
    if (position) setCamera({ zoom: 3, center: { x: position.x, z: position.z } })
  }
  useEffect(() => { dialogRef.current?.focus() }, [])
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (activeModalStack.at(-1)?.reactType !== CAMPUS_MAP_MODAL) return
      if (event.code === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); onClose(); return }
      if (event.code !== 'Tab') return
      const elements = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]') ?? [])]
      const first = elements[0]; const last = elements.at(-1)
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', keydown, true)
    return () => document.removeEventListener('keydown', keydown, true)
  }, [onClose])
  useEffect(() => {
    const canvas = canvasRef.current; const context = canvas?.getContext('2d')
    if (!canvas || !context || !map || !raster) return
    let width = 1; let height = 1; let frame = 0; let previous = 0
    const resize = () => {
      const bounds = canvas.getBoundingClientRect(); width = bounds.width; height = bounds.height
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio)
    }
    const observer = new ResizeObserver(resize); observer.observe(canvas); resize()
    const draw = (time: number) => {
      frame = requestAnimationFrame(draw)
      if (document.hidden || time - previous < 70 || width < 1 || height < 1) return
      previous = time
      const view = campusMapViewport(map, width, height, camera.zoom, camera.center); viewRef.current = view
      context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0)
      context.fillStyle = '#dfe7da'; context.fillRect(0, 0, width, height)
      context.drawImage(raster, (map.minX - view.left) / view.width * width, (map.minZ - view.top) / view.height * height, map.width / view.width * width, map.depth / view.height * height)
      for (const station of places) {
        const point = minimapPixel(station.position, view, width, height)
        if (point.x < -15 || point.y < -15 || point.x > width + 15 || point.y > height + 15) continue
        const story = station.id in stationSymbols; const selected = station.id === focus
        context.beginPath(); context.arc(point.x, point.y, selected ? 11 : 9.5, 0, Math.PI * 2)
        context.fillStyle = selected ? '#edc975' : story ? '#fffae9' : '#f6fbff'; context.fill()
        context.strokeStyle = selected ? '#89703d' : story ? '#8b886a' : '#637f92'; context.lineWidth = 1.5; context.stroke()
        context.fillStyle = '#304940'; context.font = '700 10px system-ui'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(symbol(station.id), point.x, point.y + .3)
      }
      if (player.entity) {
        const point = minimapPixel(player.entity.position, view, width, height)
        context.save(); context.translate(point.x, point.y); context.rotate(minimapHeading(player.entity.yaw))
        context.beginPath(); context.moveTo(0, 0); context.arc(0, 0, 31, -Math.PI * .72, -Math.PI * .28); context.closePath(); context.fillStyle = 'rgba(20,119,122,.16)'; context.fill()
        context.beginPath(); context.moveTo(0, -12); context.lineTo(8, 8); context.lineTo(0, 4); context.lineTo(-8, 8); context.closePath(); context.fillStyle = '#14777a'; context.strokeStyle = '#fff'; context.lineWidth = 3; context.stroke(); context.fill(); context.restore()
      }
      const metres = camera.zoom > 2 ? 200 : 500; const length = metres / view.width * width
      context.fillStyle = 'rgba(255,255,249,.85)'; context.fillRect(14, height - 41, length + 20, 28)
      context.strokeStyle = '#466351'; context.lineWidth = 1.5; context.beginPath(); context.moveTo(24, height - 23); context.lineTo(24 + length, height - 23); context.stroke()
      context.fillStyle = '#344e45'; context.font = '10px system-ui'; context.textAlign = 'left'; context.fillText(`${metres} m`, 24, height - 32)
    }
    frame = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(frame); observer.disconnect() }
  }, [map, raster, player, stations, tourStops, camera, focus])
  return <div className='sg-campus-map-layer' onPointerDown={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) onClose() }}>
    <section ref={dialogRef} className='sg-campus-map-dialog' role='dialog' aria-modal='true' aria-label={zh ? 'NTU 全校园地图' : 'NTU full campus map'} tabIndex={-1}>
      <header className='sg-campus-map-header'><div><span>NTU / SINGAPORE</span><h2>{zh ? '全校园地图' : 'Full campus map'}</h2><p>{zh ? '教学区、NIE、宿舍与体育区 · 北朝上' : 'Academic areas, NIE, residences and sports · North up'}</p></div><button className='sg-campus-map-close' onClick={onClose} aria-label={zh ? '关闭地图' : 'Close map'}>×</button></header>
      <div className='sg-campus-map-tools'>
        <div><button onClick={() => setCamera({ zoom: 1 })}>{zh ? '全图' : 'Fit campus'}</button><button onClick={() => focusPoint(player.entity?.position)}>{zh ? '我的位置' : 'My position'}</button></div>
        <div><button aria-label={zh ? '缩小地图' : 'Zoom out'} disabled={camera.zoom <= 1} onClick={() => setCamera(value => ({ ...value, zoom: Math.max(1, value.zoom / 1.5) }))}>−</button><span>{camera.zoom.toFixed(1)}×</span><button aria-label={zh ? '放大地图' : 'Zoom in'} disabled={camera.zoom >= 6} onClick={() => setCamera(value => ({ ...value, zoom: Math.min(6, value.zoom * 1.5) }))}>+</button></div>
      </div>
      <div className='sg-campus-map-surface'>
        <canvas ref={canvasRef} role='img' aria-label={zh ? 'NTU 全校园地理底图，显示实时位置与八个探索和剧情地点' : 'Full NTU geographic map with live position and story and exploration places'} onPointerDown={event => {
          if (event.button !== 0) return
          event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId)
          dragRef.current = { x: event.clientX, y: event.clientY, pointer: event.pointerId }
        }} onPointerMove={event => {
          const drag = dragRef.current; const view = viewRef.current
          if (!drag || drag.pointer !== event.pointerId || !view || !map || camera.zoom <= 1) return
          const bounds = event.currentTarget.getBoundingClientRect(); const dx = event.clientX - drag.x; const dy = event.clientY - drag.y
          dragRef.current = { x: event.clientX, y: event.clientY, pointer: event.pointerId }
          setCamera(value => {
            const current = campusMapViewport(map, bounds.width, bounds.height, value.zoom, value.center)
            return { ...value, center: { x: current.left + current.width / 2 - dx / bounds.width * current.width, z: current.top + current.height / 2 - dy / bounds.height * current.height } }
          })
        }} onPointerUp={() => { dragRef.current = undefined }} onPointerCancel={() => { dragRef.current = undefined }} />
        <span className='sg-campus-map-north' aria-hidden='true'>↑<b>N</b></span>
        {!map && <p className='sg-campus-map-status'>{unavailable ? (zh ? '地图暂不可用，请稍后重试' : 'Map unavailable. Please try again later.') : (zh ? '正在加载校园地图…' : 'Loading campus map…')}</p>}
        <span className='sg-campus-map-hint'>{camera.zoom > 1 ? (zh ? '拖动地图查看周边' : 'Drag to explore') : (zh ? '点击地点或放大查看' : 'Choose a place or zoom in')}</span>
      </div>
      <nav className='sg-campus-map-places' aria-label={zh ? '地图地点' : 'Map places'}>{places.map(station => <button key={station.id} onClick={() => focusPoint(station.position)}><i className={station.id === focus ? 'is-focus' : station.id in stationSymbols ? 'is-story' : 'is-tour'}>{symbol(station.id)}</i><span>{name(station)}</span></button>)}</nav>
      <footer><span>{zh ? '地理底图含校园周边；地点按钮仅定位地图。' : 'Map includes campus surroundings. Place buttons focus the map.'}</span><a href='https://www.openstreetmap.org/copyright' target='_blank' rel='noreferrer'>© OpenStreetMap contributors · ODbL</a></footer>
    </section>
  </div>
}

export default function SingaporeMinimap ({ player, stations, tourStops = [], language, focus, touch }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const openButtonRef = useRef<HTMLButtonElement>(null)
  const expanded = useIsModalActive(CAMPUS_MAP_MODAL)
  const [mapData, setMapData] = useState<MapData>()
  const rasterRef = useRef<HTMLCanvasElement>()
  const [unavailable, setUnavailable] = useState(false)
  const [distance, setDistance] = useState(0)
  const destination = stations.find(station => station.id === focus)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    let disposed = false
    let frame = 0
    let lastDraw = 0
    let previousDistance = -1
    let cachedMap: HTMLCanvasElement | undefined
    let map: MapData | undefined
    let dimensions = { width: 224, height: 130 }
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      dimensions = { width: rect.width, height: rect.height }
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas); resize()
    void loadMap().then(data => { if (!disposed) { map = data; cachedMap = rasterize(data); rasterRef.current = cachedMap; setMapData(data); setUnavailable(false) } }).catch(() => { if (!disposed) setUnavailable(true) })
    const draw = (time: number) => {
      frame = requestAnimationFrame(draw)
      if (document.hidden || time - lastDraw < 60 || !map || !cachedMap || !player.entity) return
      lastDraw = time
      const { width, height } = dimensions
      if (width <= 0 || height <= 0) return
      const position = player.entity.position
      const view = minimapViewport(position, width, height, map)
      context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0)
      context.clearRect(0, 0, width, height)
      const scaleX = cachedMap.width / map.width; const scaleZ = cachedMap.height / map.depth
      context.drawImage(cachedMap, (view.left - map.minX) * scaleX, (view.top - map.minZ) * scaleZ, view.width * scaleX, view.height * scaleZ, 0, 0, width, height)
      // Destination dots remain at the edge when outside the local map.
      for (const station of stations) {
        const projected = minimapPixel(station.position, view, width, height)
        const pin = minimapPin(projected, width, height)
        const selected = station.id === focus
        context.globalAlpha = pin.offscreen ? .8 : 1
        context.beginPath(); context.arc(pin.x, pin.y, selected ? 8 : 6.5, 0, Math.PI * 2)
        context.fillStyle = selected ? '#eec873' : '#fbfdf5'; context.fill()
        context.strokeStyle = selected ? '#66532a' : '#627464'; context.lineWidth = 1.2; context.stroke()
        context.fillStyle = '#273c35'; context.textAlign = 'center'; context.textBaseline = 'middle'
        context.font = '700 9px system-ui'; context.fillText(stationSymbols[station.id], pin.x, pin.y + .3)
      }
      context.globalAlpha = 1
      const point = minimapPixel(position, view, width, height)
      context.save(); context.translate(point.x, point.y); context.rotate(minimapHeading(player.entity.yaw))
      context.beginPath(); context.moveTo(0, 0); context.arc(0, 0, 25, -Math.PI * .72, -Math.PI * .28); context.closePath()
      context.fillStyle = 'rgba(24,103,105,.16)'; context.fill()
      context.beginPath(); context.moveTo(0, -9); context.lineTo(6.5, 6); context.lineTo(0, 3); context.lineTo(-6.5, 6); context.closePath()
      context.fillStyle = '#14777a'; context.strokeStyle = '#ffffff'; context.lineWidth = 2.4; context.lineJoin = 'round'; context.stroke(); context.fill(); context.restore()
      // North remains up; the player arrow carries heading instead of spinning labels.
      context.fillStyle = 'rgba(250,252,242,.9)'; context.fillRect(6, 5, 16, 18)
      context.fillStyle = '#344e45'; context.font = '700 10px system-ui'; context.textAlign = 'center'; context.fillText('N', 14, 14)
      const scaleWidth = 50 / view.width * width
      context.strokeStyle = '#526b59'; context.lineWidth = 1.5; context.beginPath(); context.moveTo(9, height - 14); context.lineTo(9, height - 10); context.lineTo(9 + scaleWidth, height - 10); context.lineTo(9 + scaleWidth, height - 14); context.stroke()
      context.fillStyle = '#344e45'; context.font = '9px system-ui'; context.textAlign = 'left'; context.fillText('50 m', 9, height - 20)
      if (destination) {
        const value = Math.round(Math.hypot(destination.position.x - position.x, destination.position.z - position.z))
        if (value !== previousDistance) { previousDistance = value; setDistance(value) }
      }
    }
    frame = requestAnimationFrame(draw)
    return () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); cachedMap = undefined }
  }, [player, stations, focus])
  useEffect(() => () => {
    const modal = activeModalStack.find(value => value.reactType === CAMPUS_MAP_MODAL)
    if (modal) hideModal(modal)
  }, [])
  const closeMap = () => {
    const modal = activeModalStack.find(value => value.reactType === CAMPUS_MAP_MODAL)
    if (modal) hideModal(modal)
    openButtonRef.current?.focus()
  }
  return <><figure className={`sg-minimap${touch ? ' sg-minimap-touch' : ''}`} aria-label={language === 'zh' ? 'NTU 实时小地图，北朝上；箭头表示当前位置与朝向' : 'Live NTU minimap, north up; arrow shows your position and heading'}>
    <div className='sg-minimap-heading'><strong>NTU</strong><span>{language === 'zh' ? '校园地图' : 'CAMPUS'}</span><i aria-hidden='true' /></div>
    <canvas ref={canvasRef} aria-hidden='true' />
    {unavailable && <span className='sg-minimap-unavailable'>{language === 'zh' ? '地图暂不可用' : 'Map unavailable'}</span>}
    <figcaption><span><i aria-hidden='true' />{stationLabels[focus][language]}</span><span>{distance} m</span></figcaption>
    <button ref={openButtonRef} className='sg-minimap-expand' aria-haspopup='dialog' aria-expanded={expanded} aria-label={language === 'zh' ? '展开全校园地图' : 'Open full campus map'} title={language === 'zh' ? '展开全校园地图' : 'Open full campus map'} onPointerDown={event => event.stopPropagation()} onClick={event => {
      event.stopPropagation()
      showModal({ reactType: CAMPUS_MAP_MODAL })
      document.exitPointerLock?.()
    }}><span aria-hidden='true'>⤢</span></button>
  </figure>
  {expanded && createPortal(<CampusMapDialog player={player} stations={stations} tourStops={tourStops} language={language} focus={focus} map={mapData} raster={rasterRef.current} unavailable={unavailable} onClose={closeMap} />, document.body)}
  </>
}
