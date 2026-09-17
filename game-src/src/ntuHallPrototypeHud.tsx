import { useState } from 'react'
import { getLoadedHallPrototype } from './ntuHallPrototype'
import './ntuHallPrototypeHud.css'

export default function NtuHallPrototypeHud ({ language, busy, onShuttle, error }: {
  language: 'en' | 'zh'; busy: boolean; onShuttle: (id: string) => void; error?: string
}) {
  const [expanded, setExpanded] = useState(true)
  const prototype = getLoadedHallPrototype()
  if (!prototype) return null
  const zh = language === 'zh'
  const baseline = new URLSearchParams(location.search).get('prototypeView') === 'baseline'
  const stops = baseline && prototype.placement.baselineTourStops ? prototype.placement.baselineTourStops
    : [prototype.placement.tourStop, ...(prototype.placement.tourStops ?? [])].filter((stop): stop is NonNullable<typeof stop> => !!stop && (!baseline || !stop.prototypeOnly))
  const switchView = (next: boolean) => {
    if (baseline === next) return
    const url = new URL(location.href)
    if (next) url.searchParams.set('prototypeView', 'baseline')
    else url.searchParams.delete('prototypeView')
    location.assign(url.href)
  }
  return <section className='ntu-prototype-card ao-interactive' aria-label={zh ? '宿舍模型样板' : 'Hall reconstruction prototype'} onPointerDown={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()}>
    <button className='ntu-prototype-heading' onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
      <span><small>{zh ? '历史模型 · 本地试建' : 'HISTORICAL MODEL · LOCAL'}</small><strong>Hall 3 / 16</strong></span><span aria-hidden='true'>{expanded ? '−' : '+'}</span>
    </button>
    {expanded && <div className='ntu-prototype-content'>
      <p>{baseline
        ? (zh ? '查看原地图；切换重建版进入庭院。' : 'Explore the original map; switch to the rebuilt courtyard.')
        : (zh ? '沿着楼群行走，穿过架空连廊。' : 'Walk around the halls and beneath the raised bridges.')}</p>
      <div className='ntu-prototype-toggle' role='group' aria-label={zh ? '对比版本' : 'Compare versions'}>
        <button aria-pressed={!baseline} onClick={() => switchView(false)}>{zh ? '模型重建' : 'Reconstruction'}</button>
        <button aria-pressed={baseline} onClick={() => switchView(true)}>{zh ? '原版对照' : 'Original map'}</button>
      </div>
      <div className='ntu-prototype-stops'>{stops.map(stop => <button key={stop.id} disabled={busy} onClick={() => onShuttle(stop.id)}>{stop.name[language]}<span aria-hidden='true'>↗</span></button>)}</div>
      {error && <p role='alert'>{error}</p>}
      <small>{zh ? '外部结构样板 · 室内未复原' : 'Exterior prototype · Interiors not reconstructed'} · <a href='https://www3.ntu.edu.sg/home/assourin/VirCampus.html' target='_blank' rel='noopener noreferrer'>{zh ? '模型来源' : 'Model source'}</a></small>
    </div>}
  </section>
}
