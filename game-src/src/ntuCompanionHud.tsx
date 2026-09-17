import { useEffect, useRef, useState } from 'react'
import { activeModalStack } from './globalState'
import type { SingaporeStation } from './singaporeStory'
import './ntuCompanionHud.css'

type Props = {
  language: 'en' | 'zh'; player: { entity?: { position: { x: number; z: number } } }
  target: SingaporeStation | ''; focus: string; quiet: boolean; onOpen: () => void
}
const places = { plaza: ['The Hive', 'The Hive'], library: ['Library notice', '图书馆告示'], return: ['Return point', '归还点'], meetup: ['Yunnan Garden', '云南园'] }

/** Game-state sensing is real; no microphone or camera recognition is implied. */
export default function NtuCompanionHud ({ language, player, target, focus, quiet, onOpen }: Props) {
  const zh = language === 'zh'
  const [locked, setLocked] = useState(Boolean(document.pointerLockElement))
  const [moving, setMoving] = useState(false)
  const [alert, setAlert] = useState('')
  const lastPrompt = useRef(new Map<string, number>())
  useEffect(() => {
    const sync = () => setLocked(Boolean(document.pointerLockElement))
    document.addEventListener('pointerlockchange', sync)
    let previous = player.entity?.position && { ...player.entity.position }
    const timer = setInterval(() => {
      const position = player.entity?.position
      if (position && previous) setMoving(Math.hypot(position.x - previous.x, position.z - previous.z) > .2)
      if (position) previous = { ...position }
    }, 750)
    return () => { clearInterval(timer); document.removeEventListener('pointerlockchange', sync) }
  }, [player])
  useEffect(() => {
    if (!target || quiet || activeModalStack.length) { setAlert(''); return }
    const now = performance.now()
    if (now - (lastPrompt.current.get(target) ?? -Infinity) < 60_000) return
    lastPrompt.current.set(target, now)
    setAlert(target)
    const timer = setTimeout(() => setAlert(''), 6500)
    return () => clearTimeout(timer)
  }, [target, quiet])
  return <aside className='ntu-companion ao-interactive' aria-label={zh ? 'AI 眼镜状态' : 'AI glasses status'} onPointerDown={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()}>
    <header><span><i />{zh ? '陪你探索' : 'WITH YOU'}</span><small>{zh ? '游戏状态感知' : 'GAME-STATE SENSING'}</small></header>
    <div className='ntu-companion-line'><b className='is-s'>S</b><span>{target ? `${zh ? '视线内' : 'In view'} · ${places[target][zh ? 1 : 0]}` : moving ? (zh ? '位置变化中 · 定时检查视线内标记' : 'Moving · checking visible markers') : (zh ? '当前位置已知 · 等待相关事件' : 'Location available · awaiting an event')}</span></div>
    <div className='ntu-companion-line'><b className='is-m'>M</b><span>{zh ? '关注' : 'Following'} · {focus}</span></div>
    <div className='ntu-companion-line'><b className='is-a'>A</b><span>{quiet ? (zh ? '保持安静，已保存任务继续保留' : 'Staying quiet; saved tasks remain') : alert ? (zh ? '相关地点进入视线，可查看当前证据' : 'A relevant place is in view; inspect its evidence') : (zh ? '暂不打扰 · 有相关事件时提示' : 'No interruption · waiting for relevance')}</span></div>
    {alert && <button className='ntu-companion-alert' onClick={onOpen}>{zh ? '查看眼镜提示' : 'Inspect glasses prompt'} ↗</button>}
    <footer>{locked ? (zh ? 'Tab 释放鼠标 · Esc 面板 · M 地图' : 'Tab cursor · Esc panel · M map') : (zh ? '鼠标可点面板 · 点击场景控制视角' : 'Cursor for panels · click scene to look around')}</footer>
  </aside>
}
