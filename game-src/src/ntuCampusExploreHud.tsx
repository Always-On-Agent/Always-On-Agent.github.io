import { useMemo, useState } from 'react'
import { searchCampusPlaces } from './ntuPlaceSearch'
import type { SingaporeSceneOptions } from './singaporeHud'
import './ntuHallPrototypeHud.css'

export default function NtuCampusExploreHud ({ language, stops, busy, error, onShuttle, onGlasses, onDemo, observerMode, onObserver }: {
  language: 'en' | 'zh'; stops: SingaporeSceneOptions['tourStops']; busy: boolean; error?: string
  onShuttle: (id: string) => void; onGlasses: () => void; onDemo: () => void
  observerMode: 'walk' | 'fly' | 'overhead'; onObserver: (mode: 'walk' | 'fly' | 'overhead') => void
}) {
  const [expanded, setExpanded] = useState(true)
  const [destination, setDestination] = useState('')
  const [query, setQuery] = useState('')
  const matches = useMemo(() => searchCampusPlaces(stops ?? [], query), [stops, query])
  const zh = language === 'zh'
  return <section className='ntu-prototype-card ntu-campus-card ao-interactive' aria-label={zh ? '校园探索' : 'Campus exploration'} onPointerDown={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()}>
    <button className='ntu-prototype-heading' onClick={() => setExpanded(!expanded)} aria-expanded={expanded}><span><small>{zh ? 'NTU · MINECRAFT 校园' : 'NTU · MINECRAFT CAMPUS'}</small><strong>{zh ? '走进校园。' : 'A campus to explore.'}</strong></span><span aria-hidden='true'>{expanded ? '−' : '+'}</span></button>
    {expanded && <div className='ntu-prototype-content'>
      <p>{observerMode === 'walk' ? (zh ? '自由行走，或选择一处校园地标。Tab 释放鼠标。' : 'Walk or visit a landmark. Tab releases the cursor.') : (zh ? '当前世界中的观察视角。返回步行后，恢复进入前的位置。' : 'Observe this world. Returning restores your walking position.')}</p>
      <div className='ntu-prototype-toggle' aria-label={zh ? '视角模式' : 'Camera mode'}>
        <button disabled={busy} aria-pressed={observerMode === 'walk'} onClick={() => onObserver('walk')}>{zh ? '步行' : 'Walk'}</button>
        <button disabled={busy} aria-pressed={observerMode === 'fly'} onClick={() => onObserver('fly')}>{zh ? '自由飞行' : 'Free flight'}</button>
        <button disabled={busy} aria-pressed={observerMode === 'overhead'} onClick={() => onObserver('overhead')}>{zh ? '俯瞰' : 'Overhead'}</button>
      </div>
      {observerMode !== 'walk' && <div className='ntu-flight-help'><strong>{zh ? '观察模式 · 步行位置已保留' : 'OBSERVER · WALKING POSITION SAVED'}</strong><span>{zh ? '点击场景后：WASD 平移，空格上升，Shift 下降，鼠标转动。Tab 操作面板。' : 'Click scene: WASD to move, Space up, Shift down, mouse to look. Tab for panels.'}</span><button disabled={busy} onClick={() => onObserver('walk')}>{zh ? '返回原位置步行' : 'Return to walking position'} ↩</button></div>}
      <input className='ntu-campus-search' type='search' onKeyDown={event => event.stopPropagation()} value={query} onChange={event => { setQuery(event.target.value); setDestination('') }} aria-label={zh ? '查找校园地点' : 'Find campus places'} placeholder={zh ? '搜索 Maple、Hall 1…' : 'Search Maple, Hall 1…'} />
      <div className='ntu-campus-destination'><select onKeyDown={event => event.stopPropagation()} aria-label={zh ? '探索地点' : 'Explore a place'} value={destination} onChange={event => setDestination(event.target.value)}>
        <option value=''>{zh ? `选择地点（${matches.length}）…` : `Choose a place (${matches.length})…`}</option>
        {matches.slice(0, 80).map(stop => <option key={stop.id} value={stop.id}>{stop.name[language]}</option>)}
      </select><button disabled={!destination || busy || observerMode !== 'walk'} onClick={() => onShuttle(destination)}>{zh ? '前往' : 'Go'} ↗</button></div>
      <div className='ntu-prototype-stops'><button onClick={onDemo} disabled={busy || observerMode !== 'walk'}>{zh ? '自动演示 · S-Lab 午后' : 'S-Lab afternoon · Demo'}<span>▶</span></button><button onClick={onGlasses}>{zh ? 'Always-On 眼镜' : 'Always-On glasses'}<span>↗</span></button></div>
      {error && <p role='alert'>{error}</p>}
      <small>{zh ? '校园几何参考' : 'Campus geometry reference'} · <a href='https://ntumap.app/' target='_blank' rel='noopener noreferrer'>NTUMap / Finute</a></small>
    </div>}
  </section>
}
