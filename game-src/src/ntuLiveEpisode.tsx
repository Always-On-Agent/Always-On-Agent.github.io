import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { alwaysOnMenuInput } from './alwaysOnMenuInput'
import { isNtuMapRebuild } from './ntuMapLocal'
import { createNtuLiveEpisodeRuntime } from './ntuLiveEpisodeRuntime'
import { LIVE_ROUTE } from './ntuLiveRoute'
import { waitForNtuTerrain } from './ntuTerrainReady'
import { createEpisode } from './ntuLiveEpisodeStory'
import './ntuLiveEpisode.css'

type Runtime = ReturnType<typeof createNtuLiveEpisodeRuntime>
type RuntimeOptions = Parameters<typeof createNtuLiveEpisodeRuntime>[0]
type Point = { x: number; y: number; z: number }
type Episode = { start: () => void; stop: () => void; update: (dt: number) => void; setPaused: (paused: boolean) => void; setLanguage: (language: string) => void; dispose: () => void }
export type NtuLiveEpisodeProps = {
  language: 'en' | 'zh'
  bot: RuntimeOptions['bot']
  onExit: () => void
  onTravel: (id: string, signal: AbortSignal) => Promise<boolean>
  onScripted: () => void
}

const copy = {
  en: {
    eyebrow: 'NTU · CONTINUOUS WORLD EPISODE', title: 'An errand beside S-Lab.',
    intro: 'Meet a fictional colleague, walk to a handoff desk, check A17, and bring the kit back. Watch the task unfold through continuous Minecraft movement and visible handoffs.',
    preparing: 'Preparing the outdoor scene…', arriving: 'Arriving at S-Lab…', terrain: 'Loading terrain along the walking route…', positioning: 'Walking to the episode start…',
    start: 'Begin the walk', stopped: 'The episode has stopped.', replay: 'Prepare a new walk',
    boundary: 'Authored characters and events · Scripted simulation. No camera or microphone inference. The initial shuttle is a scene setup; subsequent movement uses Minecraft walking physics.',
    badge: 'SCRIPTED EVENTS · MINECRAFT', exit: 'Back to campus', pause: 'Pause', paused: 'Episode paused',
    pauseNote: 'Walking and the episode are paused. Continue when you are ready.', resume: 'Continue',
    failed: 'The episode could not start.', retry: 'Prepare again', scripted: 'Open the scripted afternoon instead',
    unavailable: 'This episode needs the Minecraft campus renderer.', ground: 'The route is still waiting for terrain. Please return and try again.',
    arrivalFailed: 'The initial S-Lab arrival could not be confirmed.', preparationFailed: 'The short walk to the start was blocked. No episode step was completed.',
    laterStart: 'You can keep exploring from here, or prepare the same starting scene for a new walk.',
    errorNote: 'No blocked action has been marked complete.'
  },
  zh: {
    eyebrow: 'NTU · 连续世界经历', title: 'S-Lab 附近的一次委托。',
    intro: '和虚构同事碰面，走到交接桌，核对 A17，再把套件带回来。通过连续行走、人物动作和可见的物品交接，体验任务如何完成。',
    preparing: '正在准备室外场景…', arriving: '正在前往 S-Lab…', terrain: '正在加载整段步行路线的地形…', positioning: '正在步行到演示起点…',
    start: '开始这段行走', stopped: '这段经历已停止。', replay: '重新准备这段行走',
    boundary: '脚本模拟 · 人物与事件均为预设，不进行摄像头或麦克风推理。初次接驳用于准备场景，后续移动全部使用 Minecraft 行走物理。',
    badge: '预设事件 · MINECRAFT', exit: '返回校园', pause: '暂停', paused: '经历已暂停',
    pauseNote: '行走与事件推进均已暂停，准备好后可以继续。', resume: '继续',
    failed: '暂时无法开始这段经历。', retry: '重新准备', scripted: '改看午后脚本模拟',
    unavailable: '演示需要使用 Minecraft 校园渲染器。', ground: '路线地形尚未就绪，请返回后重试。',
    arrivalFailed: '未能确认初次到达 S-Lab。', preparationFailed: '前往起点的短距离行走受阻，尚未完成任何事件。',
    laterStart: '可以从这里继续探索，也可以重新准备相同的起点，再经历这段行走。',
    errorNote: '受阻的行动不会被记为完成。'
  }
}

/** Own the bundled episode and actors for the duration of the Minecraft demo. */
export default function NtuLiveEpisode (props: NtuLiveEpisodeProps) {
  const [language, setLanguage] = useState(props.language)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'playing' | 'stopped' | 'error'>('loading')
  const [progress, setProgress] = useState<'preparing' | 'arriving' | 'terrain' | 'positioning'>('preparing')
  const [error, setError] = useState('')
  const [menu, setMenu] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const episode = useRef<Episode>()
  const runtime = useRef<Runtime>()
  const paused = useRef(false)
  const current = useRef({ ...props, language })
  current.current = { ...props, language }
  const text = copy[language]
  const pause = () => {
    paused.current = true
    episode.current?.setPaused(true)
    runtime.current?.setPaused(true)
    setMenu(true)
  }
  const exit = () => {
    alwaysOnMenuInput.suppressPause()
    runtime.current?.stop()
    episode.current?.setPaused(true)
    current.current.onExit()
  }
  useEffect(() => { episode.current?.setLanguage(language) }, [language])
  useEffect(() => {
    const abort = new AbortController()
    let disposed = false
    let frame = 0
    let ownedEpisode: Episode | undefined
    let ownedRuntime: Runtime | undefined
    let starting = false
    let last = performance.now()
    const t = () => copy[current.current.language]
    const check = () => { if (abort.signal.aborted) throw new DOMException('Cancelled', 'AbortError') }
    const stopForMenu = () => { pause() }
    const escape = (event: KeyboardEvent) => {
      if (event.code !== 'Escape') return
      event.preventDefault(); event.stopImmediatePropagation()
      if (alwaysOnMenuInput.noteKeyboardEscape(event.repeat)) stopForMenu()
    }
    const visibility = () => { if (document.hidden) stopForMenu() }
    document.addEventListener('keydown', escape, { capture: true, signal: abort.signal })
    document.addEventListener('visibilitychange', visibility, { signal: abort.signal })
    window.addEventListener('always-on-demo-pause', stopForMenu, { signal: abort.signal })
    window.addEventListener('blur', stopForMenu, { signal: abort.signal })
    const tick = (now: number) => {
      if (disposed) return
      const dt = Math.min(.1, Math.max(0, (now - last) / 1000)); last = now
      if (!document.hidden) { ownedRuntime?.update(dt); ownedEpisode?.update(dt) }
      frame = requestAnimationFrame(tick)
    }
    setPhase('loading'); setProgress('preparing'); setError(''); setMenu(false); paused.current = false
    void (async () => {
      if (!isNtuMapRebuild()) throw new Error(t().unavailable)
      const renderer = window.world as unknown as RuntimeOptions['renderer']
      if (!renderer?.sceneOrigin) throw new Error(t().unavailable)
      check()
      setProgress('arriving')
      if (!await current.current.onTravel('ntumap-place-8baec8760caf', abort.signal)) { check(); throw new Error(t().arrivalFailed) }
      check()
      const route = LIVE_ROUTE
      ownedRuntime = createNtuLiveEpisodeRuntime({ bot: current.current.bot, renderer })
      runtime.current = ownedRuntime
      frame = requestAnimationFrame(tick)
      const points = [route.start, route.colleague, route.steward, route.pickup, ...route.path]
      setProgress('terrain')
      const terrainReady = await waitForNtuTerrain({
        points, getGroundHeight: point => ownedRuntime!.getGroundHeight(point),
        signal: abort.signal, isPaused: () => paused.current || document.hidden
      })
      check()
      if (!terrainReady) throw new Error(t().ground)
      const start = { ...route.start, y: ownedRuntime.getGroundHeight(route.start)! }
      const feet = ownedRuntime.getState().position
      if (!feet) throw new Error(t().arrivalFailed)
      if (Math.hypot(feet.x - start.x, feet.z - start.z) > .4) {
        setProgress('positioning')
        ownedRuntime.setPaused(paused.current || document.hidden)
        const result = await ownedRuntime.autoWalk([feet, start], undefined, abort.signal, { speed: 1.8 })
        check()
        if (!result.ok) throw new Error(`${t().preparationFailed} (${result.reason})`)
      }
      check()
      ownedEpisode = await createEpisode(THREE, {
        scene: ownedRuntime.scene, camera: ownedRuntime.camera, controls: ownedRuntime,
        campus: { colliders: [] }, root: root.current, language: current.current.language,
        route, getGroundHeight: (point: Point) => ownedRuntime!.getGroundHeight(point),
        getCamera: () => ownedRuntime!.getCamera(),
        onFinish () { if (!disposed && !starting) { setPhase('stopped'); setMenu(false) } }
      })
      check()
      episode.current = {
        ...ownedEpisode,
        start () { starting = true; try { ownedEpisode!.start() } finally { starting = false } }
      }
      setPhase('ready')
      if (paused.current || document.hidden) { ownedEpisode.setPaused(true); setMenu(true) }
    })().catch((failure: unknown) => {
      if (disposed || abort.signal.aborted) { ownedEpisode?.dispose(); return }
      ownedRuntime?.stop()
      setError(failure instanceof Error ? failure.message : String(failure))
      setPhase('error')
    })
    return () => {
      disposed = true; abort.abort(); cancelAnimationFrame(frame)
      ownedEpisode?.dispose(); ownedRuntime?.dispose()
      episode.current = undefined; runtime.current = undefined
      root.current?.replaceChildren()
    }
  }, [attempt])

  const start = () => {
    try { episode.current?.start(); paused.current = false; setPhase('playing'); setMenu(false) } catch (failure) {
      episode.current?.stop()
      setError(failure instanceof Error ? failure.message : String(failure)); setPhase('error')
    }
  }
  const resume = () => { paused.current = false; episode.current?.setPaused(false); runtime.current?.setPaused(false); setMenu(false) }
  const scripted = () => { runtime.current?.stop(); episode.current?.setPaused(true); current.current.onScripted() }
  const changeLanguage = (value: 'en' | 'zh') => {
    setLanguage(value)
    const url = new URL(location.href); url.searchParams.set('lang', value); history.replaceState(null, '', url)
    try { localStorage.setItem('always-on-singapore-language', value) } catch {}
  }
  return <section className='ntu-live-episode' aria-label={text.title} onPointerDownCapture={event => event.stopPropagation()} onMouseDownCapture={event => event.stopPropagation()}>
    <header className='ntu-live-toolbar'><span>{text.badge}</span><div>
      <button disabled={phase === 'playing'} aria-pressed={language === 'en'} onClick={() => changeLanguage('en')}>EN</button><button disabled={phase === 'playing'} aria-pressed={language === 'zh'} onClick={() => changeLanguage('zh')}>中</button>
      {phase === 'playing' && <button onClick={pause}>{text.pause} <kbd>Esc</kbd></button>}<button onClick={exit}>{text.exit} ↗</button>
    </div></header>
    <div className='ntu-live-content' ref={root} hidden />
    {phase !== 'playing' && <div className='ntu-live-backdrop'><div className='ntu-live-card' role='dialog' aria-modal='true' aria-labelledby='ntu-live-title'>
      <span className='ntu-live-eyebrow'>{text.eyebrow}</span><h1 id='ntu-live-title'>{phase === 'stopped' ? text.stopped : phase === 'error' ? text.failed : text.title}</h1>
      <p>{phase === 'stopped' ? text.laterStart : text.intro}</p>
      {phase === 'loading' && <p className='ntu-live-progress' role='status'>{text[progress]}</p>}
      {phase === 'error' && <p className='ntu-live-error' role='alert'>{error}<small>{text.errorNote}</small></p>}
      <div className='ntu-live-actions'>{(phase === 'ready' || phase === 'stopped') && <button className='ntu-live-primary' onClick={phase === 'ready' ? start : () => setAttempt(value => value + 1)}>{phase === 'ready' ? text.start : text.replay} →</button>}
        {phase === 'error' && <button className='ntu-live-primary' onClick={() => setAttempt(value => value + 1)}>{text.retry}</button>}
        <button onClick={exit}>{text.exit}</button></div>
      <small>{text.boundary}</small><button className='ntu-live-scripted' onClick={scripted}>{text.scripted} ↗</button>
    </div></div>}
    {menu && <div className='ntu-live-menu'><div className='ntu-live-card' role='dialog' aria-modal='true' aria-label={text.paused}><h2>{text.paused}</h2><p>{text.pauseNote}</p><div className='ntu-live-actions'><button className='ntu-live-primary' onClick={resume}>{text.resume}</button><button onClick={exit}>{text.exit}</button></div></div></div>}
  </section>
}
