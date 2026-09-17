import { useEffect, useRef } from 'react'
import { proxy, subscribe, useSnapshot } from 'valtio'
import type { Bot } from 'mineflayer'
import { Vec3 } from 'vec3'
import { activeModalStack, hideModal, isGameActive, miscUiState, showModal } from './globalState'
import { useIsModalActive } from './react/utilsApp'
import { pointerLock } from './utils'
import './alwaysOnHud.css'

type Position = { x: number; y: number; z: number }
type Language = 'en' | 'zh'
type LogCode = 'borrowed' | 'recalled' | 'notice' | 'suggested' | 'returned' | 'quiet' | 'resumed'
type Channel = 'S' | 'M' | 'A' | 'S → M' | 'M → A' | 'A → M'
type JournalEntry = { code: LogCode; channel: Channel; time: number; visit: number; receipt?: string }
export type AlwaysOnSceneOptions = {
  notice: Position
  returnPoint: Position
  transferBook: () => Promise<{ ok: boolean; receiptId?: string; reason?: string }>
  /** Checks the actual scenario-tagged item, rather than any ordinary book. */
  hasBorrowedBook?: () => boolean
}

const MEMORY_KEY = 'always-on-village-memory-v1'
const MODAL = 'always-on-glasses'
const words = {
  en: {
    label: 'ALWAYS ON', connected: 'GLASSES CONNECTED', visit: 'Visit', quiet: 'Quiet mode',
    title: 'A book to bring back.', titleNext: 'Plans changed.', titleDone: 'One less thing to remember.',
    objective: 'Return your borrowed book to the library. Take your own route through the village.',
    next: 'The library notice directs returns to the café. Find the return chest outside.',
    done: 'The return point accepted the book from your inventory. Your receipt is saved.',
    recalled: 'I remember your last visit. Let’s check today’s notice before relying on the old return point.',
    notice: 'Read the library notice', return: 'Return borrowed book', interact: 'E', panel: 'Open glasses',
    pause: 'Pause hints', resume: 'Resume hints', explore: 'Back to exploring',
    controls: 'WASD move · R walk / stop · drag / mouse to look · E interact · H glasses',
    walk: 'Walk', stop: 'Stop',
    mobile: 'Use the on-screen controls to explore. Tap a nearby prompt to interact.',
    tabNow: 'Right now', tabMemory: 'Memory', tabTrace: 'Framework',
    context: 'YOUR CONTEXT', carry: 'Borrowed library book', carryDetail: 'A commitment from before this visit.',
    confirmed: 'Return confirmed', verified: 'Verified by the item transfer, not by reaching the destination.',
    noticeTitle: 'Library closed today', noticeText: 'Please leave returns in the chest outside the café.',
    note: 'Seen on the library notice just now.', remembered: 'Remembered from a previous visit; not yet checked today.',
    sensor: 'LOOKING, NOT ALL-KNOWING', sensorText: 'The notice becomes evidence only when you are close enough, facing it, with a clear line of sight.',
    traceTitle: 'What happened, and why', traceText: 'These are the events from your own playthrough. Reveal more by exploring.',
    episode: 'SCRIPTED SIMULATION', episodeText: 'A local, scripted scenario. No camera, microphone, or live AI model is used.',
    local: 'Memory stays in this browser. Reload to revisit the village with this memory.',
    preference: 'Interruption preference', preferenceText: 'Keep suggestions quiet while I explore.',
    noObservations: 'No new scene evidence yet. Explore the village and look at its signs.',
    transferring: 'Returning…', failed: 'The transfer could not be verified. Keep the book and try again by the return chest.',
    moveCloser: 'Move closer and look at the return chest first.', missing: 'The borrowed book is not in your inventory.',
    receipt: 'Receipt', signal: 'Visible evidence', memorySignal: 'Context retained', actionSignal: 'You choose',
    logs: {
      borrowed: 'A borrowed book and a promise to return it provide the starting context.',
      recalled: 'Previous context was recalled; the old return location still needs checking.',
      notice: 'You read the visible notice. The library is closed; returns go to the café.',
      suggested: 'The new notice and your borrowed-book commitment support a café return suggestion.',
      returned: 'The item transfer was confirmed. This outcome is saved as a receipt.',
      quiet: 'You asked for fewer interruptions. Optional hints were paused.',
      resumed: 'You allowed optional hints again.'
    }
  },
  zh: {
    label: 'ALWAYS ON', connected: '眼镜已连接', visit: '第', quiet: '安静模式',
    title: '把借来的书带回去。', titleNext: '计划有了变化。', titleDone: '又一件事，可以放心了。',
    objective: '把借来的书还到图书馆。你可以自由选择穿过村庄的路线。',
    next: '图书馆告示说，今天可以在咖啡馆外的归还箱还书。',
    done: '归还点已收下你背包里的书，归还凭证也已保存。',
    recalled: '我记得你上次来过。先确认今天的告示，再沿用之前的归还地点。',
    notice: '阅读图书馆告示', return: '归还借来的书', interact: 'E', panel: '打开眼镜面板',
    pause: '暂停提示', resume: '恢复提示', explore: '继续探索',
    controls: 'WASD 移动 · R 行走 / 停止 · 拖动 / 鼠标转头 · E 交互 · H 眼镜',
    walk: '行走', stop: '停止',
    mobile: '通过屏幕上的控制探索村庄，靠近后点击提示即可交互。',
    tabNow: '此刻', tabMemory: '记忆', tabTrace: 'Framework',
    context: '你的上下文', carry: '借来的图书馆书籍', carryDetail: '一件延续到这次访问的待办。',
    confirmed: '已确认归还', verified: '以实际物品转移确认结果，而非仅仅到达目的地。',
    noticeTitle: '图书馆今日关闭', noticeText: '请将归还的书放入咖啡馆外的归还箱。',
    note: '刚刚从图书馆告示上看到。', remembered: '来自上次访问的记忆，今天尚未重新确认。',
    sensor: '只知道真正看到的', sensorText: '只有走近、面向告示，且视线未被遮挡时，告示内容才会成为新的证据。',
    traceTitle: '刚才发生了什么，为什么', traceText: '这里记录你亲自触发的事件，继续探索就能看到新的对应关系。',
    episode: '脚本仿真', episodeText: '这是在本地运行的脚本场景，不使用摄像头、麦克风或实时 AI 模型。',
    local: '记忆保留在此浏览器。刷新后可以带着这些记忆再次进入村庄。',
    preference: '打扰偏好', preferenceText: '我探索时，请少打扰一些。',
    noObservations: '还没有新的场景证据。可以在村庄走走，看看沿途的告示。',
    transferring: '正在归还…', failed: '未能确认物品转移，请在归还箱旁重试。',
    moveCloser: '先靠近并看向归还箱。', missing: '背包里没有这本借来的书。',
    receipt: '凭证', signal: '可见证据', memorySignal: '持续记忆', actionSignal: '由你决定',
    logs: {
      borrowed: '借来的书和归还承诺构成初始上下文。',
      recalled: '调取之前的上下文；原来的归还地点仍需重新确认。',
      notice: '你读到了可见的告示：图书馆关闭，今天去咖啡馆还书。',
      suggested: '把新告示与还书承诺结合起来，形成去咖啡馆归还的建议。',
      returned: '实际物品转移已确认，结果以凭证形式保存。',
      quiet: '你希望减少打扰，已暂停可选提示。',
      resumed: '你重新开启了可选提示。'
    }
  }
}

type SavedMemory = { visits: number; quiet: boolean; knewNotice: boolean; journal: JournalEntry[] }
function readMemory (): SavedMemory {
  try {
    const value = JSON.parse(localStorage.getItem(MEMORY_KEY) ?? 'null')
    if (!value || !Array.isArray(value.journal)) throw new Error('No memory')
    const journal = value.journal.filter(entry => entry && Object.prototype.hasOwnProperty.call(words.en.logs, entry.code) && Number.isFinite(entry.time)).slice(-35)
    return { visits: Number(value.visits) || 0, quiet: value.quiet === true, knewNotice: value.knewNotice === true, journal }
  } catch { return { visits: 0, quiet: false, knewNotice: false, journal: [] } }
}

function initialLanguage (): Language {
  const query = new URLSearchParams(location.search).get('lang')
  if (query === 'zh' || query === 'en') return query
  try {
    const saved = localStorage.getItem('always-on-village-language')
    if (saved === 'zh' || saved === 'en') return saved
  } catch {}
  return navigator.language.startsWith('zh') ? 'zh' : 'en'
}

export const alwaysOnHudState = proxy({
  ready: false, language: initialLanguage(), visit: 1, quiet: false, walking: false,
  rememberedNotice: false, noticeObserved: false, complete: false, receipt: '',
  target: '' as '' | 'notice' | 'return', busy: false, error: '' as '' | 'failed' | 'moveCloser' | 'missing',
  tab: 'now' as 'now' | 'memory' | 'trace', journal: [] as JournalEntry[]
})
let activeBot: Bot | undefined
let sceneOptions: AlwaysOnSceneOptions | undefined
let cleanupPrevious: (() => void) | undefined

function persist () {
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify({ visits: alwaysOnHudState.visit, quiet: alwaysOnHudState.quiet, knewNotice: alwaysOnHudState.rememberedNotice || alwaysOnHudState.noticeObserved, journal: alwaysOnHudState.journal.slice(-35) }))
  } catch { /* The playthrough still works when browser storage is unavailable. */ }
}

function addEntry (code: LogCode, channel: Channel, receipt?: string) {
  alwaysOnHudState.journal.push({ code, channel, time: Date.now(), visit: alwaysOnHudState.visit, ...(receipt ? { receipt } : {}) })
  alwaysOnHudState.journal = alwaysOnHudState.journal.slice(-35)
  persist()
}

/** A simulated glasses observation: near, inside the view cone, and not through walls. */
export function isAlwaysOnTargetVisible (player: Pick<Bot, 'entity' | 'controlState' | 'blockAt'> & { world?: unknown }, target: Position, maxDistance = 5.5): boolean {
  if (!player.entity?.position || !player.world) return false
  const eye = player.entity.position.offset(0, player.controlState.sneak ? 1.27 : 1.62, 0)
  // Aim at the block's center; its corner can put the sight ray inside an adjacent wall.
  const destination = new Vec3(target.x + 0.5, target.y + 0.5, target.z + 0.5)
  const offset = destination.minus(eye)
  const distance = offset.norm()
  if (distance > maxDistance || distance < 0.05) return false
  const { yaw, pitch } = player.entity
  const facing = new Vec3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch))
  if (facing.dot(offset.scaled(1 / distance)) < 0.78) return false
  const targetBlock = destination.floored()
  for (let t = 0.2; t < distance - 0.12; t += 0.16) {
    const point = eye.plus(offset.scaled(t / distance)).floored()
    if (point.equals(targetBlock)) continue
    const block = player.blockAt(point)
    if (!block) return false
    if (block.boundingBox === 'block' && !/glass|leaves|water|ice/.test(block.name)) return false
  }
  return true
}

function stopMovement () {
  alwaysOnHudState.walking = false
  activeBot?.clearControlStates()
  activeBot?.mouse?.buttons?.fill(false)
}

function toggleWalking () {
  if (alwaysOnHudState.walking) {
    stopMovement()
    return
  }
  if (!activeBot || !alwaysOnHudState.ready || !isGameActive(true) || document.hidden) return
  stopMovement()
  alwaysOnHudState.walking = true
  activeBot.setControlState('forward', true)
}

export function openAlwaysOnPanel (tab: 'now' | 'memory' | 'trace' = 'now') {
  if (!alwaysOnHudState.ready) return
  alwaysOnHudState.tab = tab
  stopMovement()
  showModal({ reactType: MODAL })
  document.exitPointerLock?.()
}

function closePanel (resume = true) {
  const modal = activeModalStack.find(entry => entry.reactType === MODAL)
  if (modal) hideModal(modal)
  stopMovement()
  if (resume) void pointerLock.requestPointerLock()
}

function observeNotice () {
  if (!activeBot || !sceneOptions || !isAlwaysOnTargetVisible(activeBot, sceneOptions.notice)) return
  if (!alwaysOnHudState.noticeObserved) {
    alwaysOnHudState.noticeObserved = true
    addEntry('notice', 'S → M')
    if (!alwaysOnHudState.quiet && !alwaysOnHudState.complete) addEntry('suggested', 'M → A')
  }
  openAlwaysOnPanel('now')
}

async function returnBook () {
  if (!activeBot || !sceneOptions || alwaysOnHudState.busy || alwaysOnHudState.complete) return
  alwaysOnHudState.error = ''
  if (!isAlwaysOnTargetVisible(activeBot, sceneOptions.returnPoint, 4.5)) {
    alwaysOnHudState.error = 'moveCloser'
    return
  }
  if (sceneOptions.hasBorrowedBook && !sceneOptions.hasBorrowedBook()) {
    alwaysOnHudState.error = 'missing'
    return
  }
  alwaysOnHudState.busy = true
  stopMovement()
  const returningPlayer = activeBot
  const returningScene = sceneOptions
  try {
    const result = await returningScene.transferBook()
    if (activeBot !== returningPlayer || sceneOptions !== returningScene) return
    if (!result.ok || !result.receiptId) {
      alwaysOnHudState.error = 'failed'
      return
    }
    alwaysOnHudState.complete = true
    alwaysOnHudState.receipt = result.receiptId
    alwaysOnHudState.target = ''
    addEntry('returned', 'A → M', result.receiptId)
    openAlwaysOnPanel('now')
  } catch {
    if (activeBot === returningPlayer) alwaysOnHudState.error = 'failed'
  } finally {
    if (activeBot === returningPlayer) alwaysOnHudState.busy = false
  }
}

function interact () {
  if (alwaysOnHudState.target === 'notice') { observeNotice() } else if (alwaysOnHudState.target === 'return') {
    openAlwaysOnPanel('now')
  }
}

/** Call once the scenario world and its borrowed item are ready. Returns an idempotent cleanup. */
export function setupAlwaysOnDemo (player: Bot, options: AlwaysOnSceneOptions) {
  cleanupPrevious?.()
  activeBot = player
  sceneOptions = options
  const memory = readMemory()
  Object.assign(alwaysOnHudState, { ready: true, visit: memory.visits + 1, quiet: memory.quiet, walking: false, rememberedNotice: memory.knewNotice, noticeObserved: false, complete: false, receipt: '', target: '', busy: false, error: '', journal: memory.journal })
  addEntry(memory.visits ? 'recalled' : 'borrowed', 'M')
  const abort = new AbortController()
  const observer = setInterval(() => {
    if (!isGameActive(true) || document.hidden || alwaysOnHudState.complete) return
    if (isAlwaysOnTargetVisible(player, options.returnPoint, 4.5)) alwaysOnHudState.target = 'return'
    else if (isAlwaysOnTargetVisible(player, options.notice)) alwaysOnHudState.target = 'notice'
    else alwaysOnHudState.target = ''
  }, 180)
  document.addEventListener('keydown', event => {
    const element = event.target as HTMLElement
    if (element?.closest('input, textarea, [contenteditable="true"]') || event.repeat) return
    if (alwaysOnHudState.walking && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyE', 'KeyH', 'Escape'].includes(event.code)) stopMovement()
    if (event.code === 'KeyR' && isGameActive(true)) {
      event.preventDefault()
      event.stopImmediatePropagation()
      toggleWalking()
    } else if (event.code === 'KeyH' && (isGameActive(true) || activeModalStack.at(-1)?.reactType === MODAL)) {
      event.preventDefault()
      event.stopImmediatePropagation()
      if (activeModalStack.at(-1)?.reactType === MODAL) closePanel()
      else openAlwaysOnPanel()
    } else if (event.code === 'KeyE' && isGameActive(true) && alwaysOnHudState.target) {
      event.preventDefault()
      event.stopImmediatePropagation()
      interact()
    }
  }, { capture: true, signal: abort.signal })
  window.addEventListener('blur', stopMovement, { signal: abort.signal })
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopMovement()
  }, { signal: abort.signal })
  const unsubscribeModal = subscribe(activeModalStack, () => {
    if (activeModalStack.length) stopMovement()
  })
  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    clearInterval(observer)
    abort.abort()
    unsubscribeModal()
    stopMovement()
    player.removeListener('end', cleanup)
    alwaysOnHudState.ready = false
    closePanel(false)
    activeBot = undefined
    sceneOptions = undefined
  }
  player.once('end', cleanup)
  cleanupPrevious = cleanup
  return cleanup
}

export default function AlwaysOnHud () {
  const state = useSnapshot(alwaysOnHudState)
  const { currentTouch } = useSnapshot(miscUiState)
  const panelOpen = useIsModalActive(MODAL)
  const pauseOpen = useIsModalActive('pause-screen')
  const panelRef = useRef<HTMLDivElement>(null)
  const text = words[state.language]
  useEffect(() => {
    if (!state.ready || !pauseOpen) return
    const pause = activeModalStack.find(entry => entry.reactType === 'pause-screen')
    if (pause) hideModal(pause)
    openAlwaysOnPanel()
  }, [state.ready, pauseOpen])
  useEffect(() => {
    if (!panelOpen) return
    panelRef.current?.focus()
  }, [panelOpen])
  if (!state.ready) return null
  const title = state.complete ? text.titleDone : state.noticeObserved ? text.titleNext : text.title
  const description = state.complete ? text.done : state.noticeObserved ? text.next : state.rememberedNotice ? text.recalled : text.objective
  const toggleQuiet = () => {
    alwaysOnHudState.quiet = !alwaysOnHudState.quiet
    addEntry(alwaysOnHudState.quiet ? 'quiet' : 'resumed', 'A → M')
  }
  const setLanguage = (language: Language) => {
    alwaysOnHudState.language = language
    try { localStorage.setItem('always-on-village-language', language) } catch {}
    const url = new URL(location.href)
    url.searchParams.set('lang', language)
    history.replaceState(null, '', url)
  }
  return <div className='ao-glasses' lang={state.language === 'zh' ? 'zh-CN' : 'en'}>
    <div className='ao-glasses-rim' aria-hidden='true' />
    <header className='ao-hud-top'>
      <button className='ao-brand ao-interactive' onClick={() => openAlwaysOnPanel()} aria-label={text.panel}>
        <svg viewBox='0 0 34 18' aria-hidden='true'><path d='M2 6h3m24 0h3M5 5h9l1 7H7L5 5Zm15 0h9l-2 7h-8l1-7ZM15 7h4' /></svg>
        <span>{text.label}<small><i />{state.quiet ? text.quiet : text.connected}</small></span>
      </button>
      <div className='ao-hud-tools ao-interactive'>
        <button className='ao-panel-button ao-walk-button' aria-pressed={state.walking} disabled={panelOpen} onClick={toggleWalking}>{state.walking ? text.stop : text.walk}<kbd>R</kbd></button>
        <div className='ao-language' aria-label='Language'>
          <button aria-pressed={state.language === 'en'} onClick={() => setLanguage('en')}>EN</button>
          <button aria-pressed={state.language === 'zh'} onClick={() => setLanguage('zh')}>中</button>
        </div>
        <button className='ao-panel-button' aria-label={text.panel} onClick={() => openAlwaysOnPanel()}><span className='ao-grid-icon' aria-hidden='true'>▦</span><span>{text.panel}</span><kbd>H</kbd></button>
      </div>
    </header>
    {!panelOpen && (!state.quiet || state.complete) && <button className='ao-mission ao-interactive' onClick={() => openAlwaysOnPanel()}>
      <span className='ao-eyebrow'>{state.language === 'zh' ? `第 ${state.visit} 次访问` : `VISIT ${String(state.visit).padStart(2, '0')}`} <span>·</span> {state.complete ? 'A → M' : state.noticeObserved ? 'S → M → A' : 'M → A'}</span>
      <strong>{title}</strong><span>{description}</span>
      <span className='ao-mission-progress'><i className='is-active' /><i className={state.noticeObserved || state.complete ? 'is-active' : ''} /><i className={state.complete ? 'is-active' : ''} /></span>
    </button>}
    {!panelOpen && state.target && !state.complete && <button className='ao-interact ao-interactive' onClick={interact}><kbd>{currentTouch ? '↗' : 'E'}</kbd>{state.target === 'notice' ? text.notice : text.return}<span>↗</span></button>}
    {!panelOpen && <div className='ao-bottom-note'><span>{text.episode}</span><span>{currentTouch ? text.mobile : text.controls}</span></div>}
    {panelOpen && <div className='ao-panel-layer ao-interactive' onPointerDown={event => event.stopPropagation()}>
      <div
        className='ao-panel' ref={panelRef} role='dialog' aria-modal='true' aria-label={text.panel} tabIndex={-1} onKeyDown={event => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closePanel(false) }
          if (event.key === 'Tab') {
            const focusable = [...(panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], [tabindex="0"]') ?? [])]
            const first = focusable[0]
            const last = focusable.at(-1)
            if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
              event.preventDefault()
              last?.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault()
              first?.focus()
            }
          }
        }}>
        <div className='ao-panel-heading'><div><span className='ao-eyebrow'>{text.label} / {text.context}</span><h2>{title}</h2></div><button className='ao-close' aria-label={text.explore} onClick={() => closePanel()}>×</button></div>
        <div className='ao-tabs' role='tablist'>{(['now', 'memory', 'trace'] as const).map((tab, index) => <button key={tab} role='tab' aria-selected={state.tab === tab} onClick={() => { alwaysOnHudState.tab = tab }}>{[text.tabNow, text.tabMemory, text.tabTrace][index]}</button>)}</div>
        <div className='ao-panel-content' role='tabpanel'>
          {state.tab === 'now' && <>
            <p className='ao-lead'>{description}</p>
            <div className='ao-context-card'><span className={`ao-module ${state.complete ? 'ao-a' : 'ao-m'}`}>{state.complete ? 'A' : 'M'}</span><div><strong>{state.complete ? text.confirmed : text.carry}</strong><p>{state.complete ? text.verified : text.carryDetail}</p></div></div>
            {state.noticeObserved && <div className='ao-notice'><span className='ao-eyebrow'>S → M</span><strong>{text.noticeTitle}</strong><p>{text.noticeText}</p><small>{text.note}</small></div>}
            {state.target === 'notice' && !state.noticeObserved && <button className='ao-primary' onClick={observeNotice}>{text.notice}<span>↗</span></button>}
            {state.target === 'return' && !state.complete && <button className='ao-primary' disabled={state.busy} onClick={() => { void returnBook() }}>{state.busy ? text.transferring : text.return}<span>→</span></button>}
            {state.error && <p className='ao-error' role='alert'>{text[state.error]}</p>}
            {state.receipt && <div className='ao-receipt'><span>{text.receipt}</span><code>{state.receipt}</code></div>}
            <div className='ao-observation-note'><span>{text.sensor}</span><p>{text.sensorText}</p></div>
          </>}
          {state.tab === 'memory' && <>
            <div className='ao-context-card'><span className='ao-module ao-m'>M</span><div><strong>{text.carry}</strong><p>{state.complete ? text.verified : text.carryDetail}</p></div></div>
            {(state.noticeObserved || state.rememberedNotice) && <div className='ao-notice'><strong>{text.noticeTitle}</strong><p>{text.noticeText}</p><small>{state.noticeObserved ? text.note : text.remembered}</small></div>}
            <div className='ao-preference'><div><strong>{text.preference}</strong><p>{text.preferenceText}</p></div><button className={`ao-toggle ${state.quiet ? 'is-on' : ''}`} role='switch' aria-checked={state.quiet} aria-label={text.preference} onClick={toggleQuiet}><i /></button></div>
            <p className='ao-footnote'>{text.local}</p>
          </>}
          {state.tab === 'trace' && <>
            <h3>{text.traceTitle}</h3><p className='ao-footnote'>{text.traceText}</p>
            <div className='ao-module-legend'><span><i className='ao-s'>S</i>{text.signal}</span><span><i className='ao-m'>M</i>{text.memorySignal}</span><span><i className='ao-a'>A</i>{text.actionSignal}</span></div>
            <ol className='ao-timeline'>{[...state.journal].reverse().slice(0, 16).map((entry, index) => <li key={`${entry.time}-${index}`}><div><span>{entry.channel}</span><time>{new Date(entry.time).toLocaleTimeString(state.language === 'zh' ? 'zh-CN' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}</time></div><p>{text.logs[entry.code]}</p>{entry.receipt && <code>{entry.receipt}</code>}</li>)}</ol>
          </>}
        </div>
        <footer className='ao-panel-footer'><p><span>{text.episode}</span>{text.episodeText}</p><button className='ao-continue' onClick={() => closePanel()}>{text.explore}<span>↗</span></button></footer>
      </div>
    </div>}
  </div>
}
