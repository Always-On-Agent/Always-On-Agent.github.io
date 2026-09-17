import { useEffect, useMemo, useRef, useState } from 'react'
import {
  advanceDay, createDayState, DAY_CHAPTERS, DAY_PRESETS, DAY_STEP_COUNT, DAY_STORAGE_KEY,
  exportDayReport, getDayPresetChoice, getDayReport, getDayStep, restoreDayState
} from './ntuDayDemoEngine'
import type { DayChannel, DayLanguage, DayState, DayStep, DayText, DayTrace } from './ntuDayDemoEngine'
import { alwaysOnMenuInput } from './alwaysOnMenuInput'
import './ntuDayDemo.css'

type Props = { language: DayLanguage, onExit: () => void, onTravel: (id: string, signal: AbortSignal) => Promise<boolean> }
type Screen = 'setup' | 'live' | 'report'
type ReportTab = 'trajectory' | 'evidence' | 'memory' | 'actions'
type Transition = 'idle' | 'fade-out' | 'card' | 'fade-in'
type PresetId = (typeof DAY_PRESETS)[number]['id']
const PRESET_STORAGE_KEY = `${DAY_STORAGE_KEY}:preset`
const copy = {
  en: {
    eyebrow: 'NTU · A SCRIPTED AFTERNOON', title: 'An afternoon with S-Lab', intro: 'Choose a scenario, then watch it unfold automatically. Your companion carries context between observations and actions; pause whenever you want to look closer.',
    prior: 'What Memory already holds', priorNote: 'These are the demo’s starting assumptions. Remembered context is not a fresh observation.', start: 'Start this scenario', resume: 'Resume saved day', fresh: 'Start afresh', previous: 'A previous run is saved in this browser.',
    boundary: 'Local, scripted simulation. Observations and receipts are authored fixtures; the game camera is not interpreted. The same rules run each day—no model training or autonomous capability is claimed.',
    exit: 'Leave day mode', close: 'Close', collapse: 'Minimize', expand: 'Open day panel', pause: 'Pause', play: 'Resume', next: 'Next step', waiting: 'Waiting for you', moving: 'Moving to the next scene…', travelFailed: 'The scene could not be reached. This step has not been committed.', retry: 'Retry travel',
    chapter: 'Chapter', day: 'Day', step: 'Step', pending: 'Pending preview', committed: 'Latest committed', noS: 'No observation committed yet.', noM: 'Starting context is retained; no update yet.', noA: 'No action committed yet.',
    transfer: 'Inspect this transfer', source: 'Source', payload: 'Payload', receiver: 'Receiver', decision: 'Decision', limit: 'Boundary', choice: 'Your branch', choose: 'Choose what happens next', choiceNote: 'A choice changes this run’s context and outcome. It does not change the engine’s rules.',
    auto: 'Auto-choose after 12s', wait: 'Wait for me', autoIn: 'Default choice in', seconds: 's', hidden: 'Paused while this tab is hidden.', previewNote: 'The displayed step enters the trace only when it advances.', memoryWrite: 'Last committed memory update',
    trace: 'Day trace', report: 'Your afternoon, made inspectable.', interim: 'The day so far.', reportLead: 'This report records this run’s path, evidence labels, memory changes and simulated outcomes.',
    trajectory: 'Trajectory', evidence: 'Evidence', memory: 'Memory changes', actions: 'Action results', events: 'Committed events', updates: 'Memory updates', receipts: 'Demo receipts', empty: 'Nothing committed here yet.',
    before: 'Before', after: 'After', newMemory: 'Not present', scope: 'Scope', completed: 'Completed commitments', unfinished: 'Still pending', noPending: 'No pending commitments.', noComplete: 'No completed commitments yet.',
    download: 'Download report', restart: 'Replay with fictional priors', continue: 'Back to this day', chooseLabel: 'Scripted response', receipt: 'Simulated receipt', observation: 'Scripted observation', priorLabel: 'Starting prior', internal: 'Internal demo step', choiceEvidence: 'Scripted response',
    storage: 'Browser storage is unavailable. This run will remain only while this panel is open.', outcome: 'Ending', policy: 'What carries forward', future: 'Retained after this scenario',
    companion: 'Your campus companion', scripted: 'SCRIPTED EVENT', attended: 'Attending to', proposed: 'Proposed action', menu: 'Day paused', menuNote: 'The day waits here. Inspect the panel, continue playback, or return to campus exploration.', showPanel: 'Inspect current step',
    currentDecision: 'Current decision', sceneInput: 'Observation', memoryCount: 'retained records', transition: 'Scene transition', timeCut: 'A simulated time cut to the next scene.',
    preset: 'Scenario', scriptedResponse: 'PREDEFINED RESPONSE', automatic: 'Automatic playback · fixed scenario', later: 'A little later…', replay: 'Replay', details: 'Framework details', retained: 'Retained now', alert: 'Companion prompt', noAlert: 'No prompt at this moment.', presetNote: 'All responses are part of the selected script, not decisions made by you during playback.', savedPreset: 'Saved scenario', setup: 'Choose another scenario', observationShort: 'Observation', memoryShort: 'Retained memory', actionShort: 'Action prompt', transitionNote: 'A scene cut, not a simulated walking route.', active: 'Active', retired: 'Retired', completedStatus: 'Completed',
    channel: { 'S → M': 'Observation becomes retained context.', 'M → A': 'Retained context shapes an action proposal.', 'A → S': 'An action asks for a fresh check.', 'M → S': 'Memory focuses what to inspect next.', 'A → M': 'An action outcome updates memory.' }
  },
  zh: {
    eyebrow: 'NTU · 午后脚本模拟', title: 'S-Lab 的一个午后', intro: '选定一个情景，之后自动播放。随行助手连接眼前的观察、保留的记忆与行动；想看清细节时，随时暂停。',
    prior: 'Memory 已有的上下文', priorNote: '这是模拟开始时的设定。记住的内容，不等于刚刚观察到的证据。', start: '开始这个情景', resume: '继续上次的情景', fresh: '重新开始', previous: '此浏览器保留着上一次模拟。',
    boundary: '本地脚本模拟：观察与凭证均为预设内容，不解析游戏摄像机。每天运行同一套规则，不代表模型训练或自主能力已经得到验证。',
    exit: '退出演示模式', close: '关闭', collapse: '收起', expand: '打开一天面板', pause: '暂停', play: '继续', next: '下一步', waiting: '等待你的选择', moving: '正在前往下一处场景…', travelFailed: '暂时未能到达场景，这一步尚未写入记录。', retry: '重新前往',
    chapter: '阶段', day: '第', step: '步骤', pending: '待推进的预览', committed: '最近已写入', noS: '还没有写入新的观察。', noM: '保留初始上下文，尚无更新。', noA: '还没有写入行动结果。',
    transfer: '检查这次传递', source: '来源', payload: '传递内容', receiver: '接收方', decision: '决策', limit: '边界', choice: '由你选择分支', choose: '接下来怎么做', choiceNote: '选择会改变这次经历的上下文与结果，但不会改变模拟引擎的规则。',
    auto: '12 秒后自动选择', wait: '等我选择', autoIn: '默认分支将在', seconds: '秒后继续', hidden: '标签页隐藏时暂停推进。', previewNote: '只有推进后，眼前这一步才会写入经历记录。', memoryWrite: '最近一次实际记忆更新',
    trace: '查看记录', report: '这段午后，可以逐步检查。', interim: '这段午后，走到了这里。', reportLead: '记录本次路线、证据类型、记忆变化，以及模拟行动的结果。',
    trajectory: '经历路线', evidence: '证据', memory: '记忆变化', actions: '行动结果', events: '已写入事件', updates: '记忆更新', receipts: '模拟凭证', empty: '这里还没有已写入的记录。',
    before: '更新前', after: '更新后', newMemory: '尚不存在', scope: '适用范围', completed: '已完成的安排', unfinished: '仍待处理', noPending: '没有待处理的安排。', noComplete: '尚无已完成的安排。',
    download: '下载记录', restart: '从虚构初始设定重播', continue: '回到这一天', chooseLabel: '预设回应', receipt: '模拟凭证', observation: '脚本观察', priorLabel: '初始上下文', internal: '模拟内部步骤', choiceEvidence: '预设回应',
    storage: '浏览器存储不可用，关闭面板后将无法恢复这次经历。', outcome: '这次的结果', policy: '什么会延续', future: '情景结束后保留什么',
    companion: '校园里的随行助手', scripted: '预设事件', attended: '正在关注', proposed: '行动建议', menu: '情景已暂停', menuNote: '进度会留在这里。你可以检查当前步骤、继续播放，或返回校园自由探索。', showPanel: '检查当前步骤',
    currentDecision: '当前决策', sceneInput: '观察', memoryCount: '条保留记录', transition: '场景切换', timeCut: '通过模拟时间跳转，进入下一处场景。',
    preset: '情景', scriptedResponse: '预设回应', automatic: '自动播放 · 固定情景', later: '片刻后…', replay: '重播', details: '框架细节', retained: '当前实际保留', alert: '随行助手提示', noAlert: '此刻没有新的行动提示。', presetNote: '所有回应均来自所选脚本，不代表你在播放中作出的决定。', savedPreset: '已保存的情景', setup: '选择其他情景', observationShort: '观察', memoryShort: '保留记忆', actionShort: '行动提示', transitionNote: '以转场连接场景，不模拟自动行走路线。', active: '有效', retired: '已退役', completedStatus: '已完成',
    channel: { 'S → M': '把观察写入持续的上下文。', 'M → A': '用保留的上下文形成行动建议。', 'A → S': '行动提出一次新的检查。', 'M → S': '记忆引导下一次观察的重点。', 'A → M': '把行动结果反馈给记忆。' }
  }
}

const initial = () => {
  let saved: DayState | undefined
  let preset: PresetId = DAY_PRESETS[0].id
  try {
    const storedPreset = DAY_PRESETS.find(item => item.id === localStorage.getItem(PRESET_STORAGE_KEY))
    if (storedPreset) {
      preset = storedPreset.id
      const candidate = restoreDayState(localStorage.getItem(DAY_STORAGE_KEY))
      // Older interactive runs must not be described as a predefined scenario.
      if (candidate && Object.entries(candidate.choices).every(([id, value]) => (storedPreset.choices as Record<string, string>)[id] === value)) saved = candidate
    }
  } catch {}
  return { state: saved ?? createDayState(), saved, preset }
}

/** Count only visible, unpaused time, and release every timer on cancellation. */
const playbackDelay = async (duration: number, signal: AbortSignal, blocked: () => boolean) => new Promise<void>((resolve, reject) => {
  let remaining = duration
  let previous = performance.now()
  const cancel = () => { clearInterval(timer); signal.removeEventListener('abort', cancel); reject(new DOMException('Cancelled', 'AbortError')) }
  const timer = setInterval(() => {
    const now = performance.now()
    if (!blocked()) {
      remaining -= now - previous
      if (remaining <= 0) { clearInterval(timer); signal.removeEventListener('abort', cancel); resolve() }
    }
    previous = now
  }, 25)
  signal.addEventListener('abort', cancel, { once: true })
  if (signal.aborted) cancel()
})

const paintCover = async (signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  let frame = 0
  const cancel = () => { cancelAnimationFrame(frame); signal.removeEventListener('abort', cancel); reject(new DOMException('Cancelled', 'AbortError')) }
  const done = () => { signal.removeEventListener('abort', cancel); resolve() }
  signal.addEventListener('abort', cancel, { once: true })
  frame = requestAnimationFrame(() => { frame = requestAnimationFrame(done) })
  if (signal.aborted) cancel()
})

export default function NtuDayDemo ({ language: incomingLanguage, onExit, onTravel }: Props) {
  const [language, setLanguage] = useState(incomingLanguage)
  const text = copy[language]
  const local = (value: DayText | undefined) => value?.[language] ?? ''
  const [seed] = useState(initial)
  const [state, setState] = useState(seed.state)
  const [presetId, setPresetId] = useState<PresetId>(seed.preset)
  const [screen, setScreen] = useState<Screen>('setup')
  const [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [hidden, setHidden] = useState(document.hidden)
  const [arrived, setArrived] = useState('')
  const [travelStatus, setTravelStatus] = useState<'idle' | 'moving' | 'ready' | 'failed'>('idle')
  const [transition, setTransition] = useState<Transition>('idle')
  const [travelAttempt, setTravelAttempt] = useState(0)
  const [run, setRun] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [storageWarning, setStorageWarning] = useState(false)
  const [reportTab, setReportTab] = useState<ReportTab>('trajectory')
  const [menuOpen, setMenuOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const closed = useRef(false)
  const committing = useRef(false)
  const travelAbort = useRef<AbortController>()
  const timing = useRef({ id: '', remaining: 0 })
  const commitRef = useRef<() => void>(() => {})
  const callbacks = useRef({ onExit, onTravel })
  callbacks.current = { onExit, onTravel }
  const currentState = useRef(state)
  currentState.current = state
  const blocked = useRef(false)
  blocked.current = paused || hidden || menuOpen
  const step = getDayStep(state)
  const ready = Boolean(step && arrived === step.placeId && travelStatus === 'ready')
  const preset = DAY_PRESETS.find(item => item.id === presetId) ?? DAY_PRESETS[0]
  const scriptedChoice = step?.choices?.find(item => item.id === getDayPresetChoice(state, presetId))
  const report = useMemo(() => getDayReport(state), [state])
  const changes = useMemo(() => state.trace.flatMap(entry => entry.changes.map(change => ({ ...change, time: entry.time, sequence: entry.sequence }))), [state.trace])
  const latestChange = changes.at(-1)
  const retained = state.memory.filter(item => item.status !== 'retired')
  const action = step?.module === 'A' ? step : [...state.trace].reverse().find(entry => entry.module === 'A')
  const alert = step?.module === 'A' && ready ? step : undefined

  useEffect(() => { setLanguage(incomingLanguage) }, [incomingLanguage])
  useEffect(() => {
    closed.current = false
    alwaysOnMenuInput.suppressPause(); document.exitPointerLock?.()
    const update = () => { setHidden(document.hidden) }
    const pause = () => { blocked.current = true; setPaused(true) }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault(); event.stopImmediatePropagation()
      if (!alwaysOnMenuInput.noteKeyboardEscape(event.repeat)) return
      blocked.current = true; setPaused(true); setMenuOpen(value => !value)
      alwaysOnMenuInput.suppressPause(); document.exitPointerLock?.()
    }
    document.addEventListener('visibilitychange', update)
    document.addEventListener('keydown', escape, true)
    window.addEventListener('always-on-demo-pause', pause)
    return () => {
      closed.current = true; travelAbort.current?.abort()
      document.removeEventListener('visibilitychange', update); document.removeEventListener('keydown', escape, true)
      window.removeEventListener('always-on-demo-pause', pause)
    }
  }, [])

  const persist = (value: DayState, selected: PresetId) => {
    try {
      localStorage.setItem(PRESET_STORAGE_KEY, selected)
      localStorage.setItem(DAY_STORAGE_KEY, JSON.stringify(value))
      setStorageWarning(false)
    } catch { setStorageWarning(true) }
  }
  useEffect(() => { if (screen !== 'setup') persist(state, presetId) }, [state, screen, presetId])
  useEffect(() => {
    committing.current = false
    if (screen === 'live' && state.status === 'complete') setScreen('report')
  }, [state.index, state.status, screen])

  useEffect(() => {
    if (screen !== 'live' || !step) return
    if (arrived === step.placeId) { setTravelStatus('ready'); setTransition('idle'); return }
    const controller = new AbortController()
    travelAbort.current?.abort()
    travelAbort.current = controller
    const cancelled = () => closed.current || controller.signal.aborted
    const delay = async (ms: number) => playbackDelay(ms, controller.signal, () => blocked.current || document.hidden)
    setTravelStatus('moving'); setTransition('fade-out')
    void (async () => {
      // The opaque cover is fully painted before any world position changes.
      await delay(750)
      if (cancelled()) return
      setTransition('card')
      await paintCover(controller.signal)
      if (cancelled()) return
      const minimumCard = delay(1600)
      const [ok] = await Promise.all([Promise.resolve().then(async () => callbacks.current.onTravel(step.placeId, controller.signal)), minimumCard])
      if (cancelled()) return
      if (!ok) { setTravelStatus('failed'); return }
      await delay(0)
      setTransition('fade-in')
      await delay(950)
      if (cancelled()) return
      setArrived(step.placeId); setTransition('idle'); setTravelStatus('ready')
    })().catch(() => { if (!cancelled()) { setTransition('card'); setTravelStatus('failed') } })
    return () => { controller.abort() }
  }, [screen, step?.placeId, travelAttempt, run])

  commitRef.current = () => {
    if (closed.current || committing.current || screen !== 'live' || !ready || blocked.current || document.hidden) return
    const { current } = currentState
    const pending = getDayStep(current)
    if (!pending) return
    committing.current = true
    const next = advanceDay(current, getDayPresetChoice(current, presetId))
    if (next === current) { committing.current = false; return }
    currentState.current = next; setState(next)
  }
  useEffect(() => {
    if (!step) return
    if (timing.current.id !== step.id) timing.current = { id: step.id, remaining: step.choices?.length ? 3000 : step.durationMs }
    setRemaining(Math.ceil(timing.current.remaining / 1000))
    if (screen !== 'live' || paused || hidden || menuOpen || !ready) return
    let tickTime = performance.now()
    // Scripted answers remain readable for at least two seconds at every speed.
    const multiplier = step.choices?.length ? Math.min(speed, 1.5) : speed
    const consume = () => {
      const now = performance.now()
      if (!blocked.current && !document.hidden) timing.current.remaining = Math.max(0, timing.current.remaining - (now - tickTime) * multiplier)
      tickTime = now
    }
    const timer = setInterval(() => {
      if (closed.current) return
      consume(); setRemaining(Math.ceil(timing.current.remaining / 1000))
      if (!timing.current.remaining) { clearInterval(timer); commitRef.current() }
    }, 100)
    return () => { clearInterval(timer); consume() }
  }, [screen, step?.id, paused, speed, hidden, menuOpen, ready, run])

  const leave = () => {
    alwaysOnMenuInput.suppressPause()
    closed.current = true; travelAbort.current?.abort()
    if (screen !== 'setup') persist(currentState.current, presetId)
    callbacks.current.onExit()
  }
  const begin = (next: DayState, selected: PresetId = presetId) => {
    travelAbort.current?.abort(); committing.current = false
    timing.current = { id: '', remaining: 0 }; currentState.current = next
    persist(next, selected)
    setPresetId(selected); setState(next); setPaused(false); setDetailsOpen(false); setMenuOpen(false)
    setArrived(''); setTransition('idle'); setTravelStatus('idle'); setRun(value => value + 1)
    setScreen(next.status === 'complete' ? 'report' : 'live')
  }
  const openReport = () => { travelAbort.current?.abort(); setMenuOpen(false); setScreen('report') }
  const chooseScenario = () => { travelAbort.current?.abort(); setMenuOpen(false); setScreen('setup'); setState(createDayState()) }
  const download = () => {
    const context = `${text.preset}: ${local(preset.title)}

${text.presetNote}

`
    const blob = new Blob([context, exportDayReport(state, language)], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url; link.download = `ntu-day-${presetId}-${language}.md`
    document.body.appendChild(link); link.click(); link.remove()
    setTimeout(() => { URL.revokeObjectURL(url) }, 0)
  }
  const evidenceLabel = (evidence: DayStep['evidence']) => ({ 'scripted-observation': text.observation, 'simulated-receipt': text.receipt, 'user-choice': text.choiceEvidence, prior: text.priorLabel, internal: text.internal })[evidence]
  const memoryStatus = (status: 'active' | 'completed' | 'retired') => ({ active: text.active, completed: text.completedStatus, retired: text.retired })[status]
  const languageControls = <div className='day-language' aria-label='Language / 语言'>{(['en', 'zh'] as DayLanguage[]).map(value => <button key={value} aria-pressed={language === value} onClick={() => setLanguage(value)}>{value === 'en' ? 'EN' : '中文'}</button>)}</div>
  const channelLabel = (channel: DayChannel | undefined) => (channel ? text.channel[channel] : '')
  const transferDetails = (entry: DayStep) => <details className='day-transfer-details'><summary>{text.transfer}</summary><dl>
    {([[text.source, entry.source], [text.payload, entry.payload], [text.receiver, entry.receiver], [text.decision, entry.decision], [text.limit, entry.boundary]] as Array<[string, DayText]>).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{local(value)}</dd></div>)}
  </dl></details>
  const traceRow = (entry: DayTrace) => <article className='day-report-row' key={entry.sequence}>
    <div className='day-report-time'>{entry.time}<small>{entry.module}</small></div><div>
      <strong>{local(entry.title)}</strong><p>{local(entry.placeName)} · {evidenceLabel(entry.evidence)}</p>
      <p>{local(entry.headline)}</p>
      {entry.choice && <p>{text.chooseLabel}: {local(entry.choices?.find(choice => choice.id === entry.choice)?.label)}</p>}
      {entry.channel && <code>{entry.channel} · {channelLabel(entry.channel)}</code>}
      {transferDetails(entry)}
    </div>
  </article>

  return <div
    className='ntu-day' onMouseDownCapture={event => event.stopPropagation()} onPointerDownCapture={event => event.stopPropagation()}
    onWheelCapture={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
    {screen === 'setup' && <div className='day-backdrop'><section className='day-intro day-glass' role='dialog' aria-modal='true' aria-labelledby='day-intro-title'>
      <header className='day-dialog-head'><div><span className='day-eyebrow'>{text.eyebrow}</span><h2 id='day-intro-title'>{text.title}</h2></div><div>{languageControls}<button aria-label={text.exit} onClick={leave}>×</button></div></header>
      <p className='day-lead'>{text.intro}</p>
      <div className='day-presets' role='group' aria-label={text.preset}>{DAY_PRESETS.map(item => <button key={item.id} aria-pressed={presetId === item.id} onClick={() => setPresetId(item.id)}><span>{presetId === item.id ? '●' : '○'}</span><strong>{local(item.title)}</strong><p>{local(item.summary)}</p></button>)}</div>
      <p className='day-preset-note'>{text.presetNote}</p>
      <details className='day-prior'><summary>M · {text.prior}</summary><ul>{createDayState().memory.map(item => <li key={item.id}><strong>{local(item.label)}</strong> · {local(item.value)}<small>{local(item.source)}</small></li>)}</ul><p>{text.priorNote}</p></details>
      <p className='day-boundary'>{text.boundary}</p>
      {seed.saved && <p className='day-saved-note'>{text.savedPreset}: {local(DAY_PRESETS.find(item => item.id === seed.preset)?.title)} · {seed.saved.trace.length}/{DAY_STEP_COUNT}</p>}
      <div className='day-dialog-actions'>{seed.saved && <button onClick={() => begin(seed.saved!, seed.preset)}>{text.resume}</button>}<button className='day-primary' onClick={() => begin(createDayState())}>{text.start} →</button></div>
    </section></div>}

    {screen === 'live' && step && <>
      <div className={`day-transition phase-${transition}`} aria-hidden={transition === 'idle'}><div className='day-transition-card'><span>{text.transition} · {step.time}</span><p>{text.later}</p><strong>{local(step.placeName)}</strong><small>{text.transitionNote}</small>{travelStatus === 'failed' && <div className='day-transition-error'><p>{text.travelFailed}</p><button onClick={() => setTravelAttempt(value => value + 1)}>{text.retry}</button><button onClick={leave}>{text.exit}</button></div>}</div></div>
      <div className='day-controls day-glass'><div className='day-controls-title'><span className='day-scripted'>{text.scripted}</span><strong>{step.time}</strong><span>{local(step.placeName)}</span></div><div className='day-control-actions'><button onClick={() => setPaused(value => !value)}>{paused ? `▶ ${text.play}` : `Ⅱ ${text.pause}`}</button><div className='day-speed'>{[1, 2, 4].map(value => <button key={value} aria-pressed={speed === value} onClick={() => setSpeed(value)}>{value}×</button>)}</div><button onClick={() => begin(createDayState())}>{text.replay}</button><button onClick={openReport}>{text.trace}</button>{languageControls}<button aria-label={text.exit} onClick={leave}>×</button></div><div className='day-progress'><i style={{ width: `${state.trace.length / DAY_STEP_COUNT * 100}%` }} /></div></div>
      <section className={`day-live day-glass${detailsOpen ? ' is-detailed' : ''}`} aria-label={text.details}>
        <header className='day-ledger-head'><span>{local(preset.title)}</span><button aria-expanded={detailsOpen} onClick={() => setDetailsOpen(value => !value)}>{text.details} {detailsOpen ? '−' : '+'}</button></header>
        <div className='day-modules'>
          <div className={`day-module${step.module === 'S' ? ' is-active' : ''}`} data-module='S'><span className='day-module-letter'>S</span><div><strong>{text.observationShort} <small>{text.scripted}</small></strong><p>{local(step.observation)}</p></div></div>
          <div className={`day-module${step.module === 'M' ? ' is-active' : ''}`} data-module='M'><span className='day-module-letter'>M</span><div><strong>{text.memoryShort} <small>{retained.length} {text.memoryCount}</small></strong><p>{latestChange ? `${local(latestChange.after.label)} · ${memoryStatus(latestChange.after.status)}: ${local(latestChange.after.value)}` : local(retained.find(item => item.kind === 'commitment')?.value) || text.noM}</p></div></div>
          <div className={`day-module${step.module === 'A' ? ' is-active' : ''}`} data-module='A'><span className='day-module-letter'>A</span><div><strong>{text.actionShort} <small>{step.module === 'A' ? text.pending : text.committed}</small></strong><p>{action ? local(action.decision) : text.noAlert}</p></div></div>
        </div>
        {step.channel && <div className='day-channel'><code>{step.channel}</code><span>{channelLabel(step.channel)}</span></div>}
        {detailsOpen && <div className='day-expert'><p className='day-preview-label'>{text.pending} · {state.index + 1}/{DAY_STEP_COUNT} · {local(DAY_CHAPTERS[step.chapter]?.title)}</p><h3>{local(step.headline)}</h3><p>{text.previewNote}</p>{transferDetails(step)}<details className='day-transfer-details'><summary>{text.retained} ({retained.length})</summary><ul className='day-memory-records'>{retained.map(item => <li key={item.id}><strong>{local(item.label)} · {memoryStatus(item.status)}</strong><p>{local(item.value)}</p></li>)}</ul></details><p className='day-boundary'>{text.boundary}</p></div>}
      </section>
      {alert && transition === 'idle' && <aside className='day-alert day-glass' key={alert.id} role='status'><span>A · {text.alert}</span><p>{local(alert.headline)}</p></aside>}
      <section className={`day-subtitle day-glass${transition === 'idle' ? '' : ' is-covered'}`} aria-label={text.companion}>
        <header><span>◈ {text.companion}</span><small>{paused ? `Ⅱ ${text.pause}` : hidden ? text.hidden : text.automatic}</small></header>
        <h3>{local(step.headline)}</h3><p>{local(step.observation)}</p>
        {scriptedChoice && <div className='day-scripted-response'><span>{text.scriptedResponse} · {local(preset.title)}</span><strong>{local(scriptedChoice.label)}</strong><small>{local(scriptedChoice.consequence)}</small></div>}
        <footer><span>{state.index + 1}/{DAY_STEP_COUNT} · {evidenceLabel(step.evidence)}</span><span>{ready ? `${remaining}s` : text.moving}</span></footer>
      </section>
      {storageWarning && <p className='day-storage-warning day-glass'>{text.storage}</p>}
    </>}
    {screen === 'report' && <div className='day-backdrop'><section className='day-report day-glass' role='dialog' aria-modal='true' aria-labelledby='day-report-title'>
      <header className='day-dialog-head'><div><span className='day-eyebrow'>{text.eyebrow} · {state.day}</span><h2 id='day-report-title'>{state.status === 'complete' ? text.report : text.interim}</h2></div><div>{languageControls}<button aria-label={text.exit} onClick={leave}>×</button></div></header>
      <p className='day-lead'>{state.status === 'complete' ? local(report.summary) : text.reportLead}</p><p className='day-preset-note'>{text.preset}: {local(preset.title)} · {text.presetNote}</p>
      <div className='day-report-summary'><div><strong>{state.trace.length}</strong><span>{text.events}</span></div><div><strong>{changes.length}</strong><span>{text.updates}</span></div><div><strong>{state.receipts.length}</strong><span>{text.receipts}</span></div></div>
      <nav className='day-report-tabs' role='tablist' aria-label={text.trace}>{(['trajectory', 'evidence', 'memory', 'actions'] as ReportTab[]).map(tab => <button key={tab} role='tab' aria-selected={reportTab === tab} onClick={() => setReportTab(tab)}>{text[tab]}</button>)}</nav>
      <div className='day-report-body' role='tabpanel' aria-label={text[reportTab]}>
        {reportTab === 'trajectory' && (state.trace.length ? state.trace.map(traceRow) : <p className='day-report-empty'>{text.empty}</p>)}
        {reportTab === 'evidence' && (state.trace.some(entry => ['scripted-observation', 'simulated-receipt'].includes(entry.evidence)) ? state.trace.filter(entry => ['scripted-observation', 'simulated-receipt'].includes(entry.evidence)).map(traceRow) : <p className='day-report-empty'>{text.empty}</p>)}
        {reportTab === 'memory' && (changes.length ? changes.map(change => <article className='day-report-row' key={`${change.sequence}-${change.id}`}><div className='day-report-time'>{change.time}</div><div><strong>{local(change.after.label)} · {memoryStatus(change.after.status)}</strong><p>{text.before}: {local(change.before) || text.newMemory}</p><p>{text.after}: {local(change.after.value)}</p><p>{text.source}: {local(change.after.source)}</p><p>{text.scope}: {local(change.after.scope)}</p></div></article>) : <p className='day-report-empty'>{text.empty}</p>)}
        {reportTab === 'actions' && <><h3 className='day-result-heading'>{text.completed}</h3>{report.completed.length ? report.completed.map(item => <article className='day-result-item' key={item.id}><strong>{local(item.label)}</strong><p>{local(item.value)}</p></article>) : <p className='day-report-empty'>{text.noComplete}</p>}<h3 className='day-result-heading'>{text.unfinished}</h3>{report.pending.length ? report.pending.map(item => <article className='day-result-item' key={item.id}><strong>{local(item.label)}</strong><p>{local(item.value)}</p></article>) : <p className='day-report-empty'>{text.noPending}</p>}{state.trace.filter(entry => entry.module === 'A').map(traceRow)}</>}
      </div>
      {state.status === 'complete' && <div className='day-next-context'><strong>{text.future}</strong><p>{local(report.nextDay)}</p><small>{local(report.policy)}</small></div>}
      <p className='day-boundary'>{text.boundary}</p>
      {storageWarning && <p className='day-error'>{text.storage}</p>}
      <div className='day-dialog-actions'><button onClick={download}>{text.download} ↓</button>{state.status === 'complete' ? <button className='day-primary' onClick={() => begin(createDayState())}>{text.restart} →</button> : <button className='day-primary' onClick={() => setScreen('live')}>{text.continue} →</button>}</div>
    </section></div>}
    {menuOpen && <div className='day-backdrop day-menu-backdrop'><section className='day-menu day-glass' role='dialog' aria-modal='true' aria-labelledby='day-menu-title'><span className='day-eyebrow'>Ⅱ {text.eyebrow}</span><h2 id='day-menu-title'>{text.menu}</h2><p>{text.menuNote}</p>{languageControls}<div className='day-menu-buttons'><button className='day-primary' onClick={() => { setMenuOpen(false); setPaused(false) }}>{text.play} →</button><button onClick={openReport}>{text.trace}</button><button onClick={chooseScenario}>{text.setup}</button><button onClick={leave}>{text.exit}</button></div></section></div>}
  </div>
}
