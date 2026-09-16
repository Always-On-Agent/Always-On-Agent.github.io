import { useEffect, useRef } from 'react'
import { proxy, subscribe, useSnapshot } from 'valtio'
import type { Bot } from 'mineflayer'
import { Vec3 } from 'vec3'
import { activeModalStack, hideModal, isGameActive, miscUiState, showModal } from './globalState'
import { useIsModalActive } from './react/utilsApp'
import { pointerLock } from './utils'
import { SINGAPORE_LOOPS, SINGAPORE_STORY, type SingaporeLanguage, type SingaporeStation, type SingaporeText } from './singaporeStory'
import './alwaysOnHud.css'
import './singaporeHud.css'

type Position = { x: number; y: number; z: number }
type ScenePlayer = Pick<Bot, 'entity' | 'controlState' | 'blockAt' | 'clearControlStates' | 'setControlState' | 'once' | 'removeListener' | 'mouse'> & { world?: unknown }
type Result = { ok: boolean; receiptId?: string; reason?: string }
type Channel = 'M' | 'S → M' | 'M → A' | 'A → S' | 'M → S' | 'A → M'
type LogCode = 'accepted' | 'restored' | 'focus' | 'notice' | 'suggested' | 'recheck' | 'returned' | 'met' | 'pickupNotice' | 'pickupAccepted' | 'kit' | 'quiet' | 'resumed' | 'shuttle'
type Entry = { code: LogCode; channel: Channel; time: number; visit: number; receipt?: string }
type Tab = 'now' | 'memory' | 'travel' | 'trace'
export type SingaporeSceneOptions = {
  stations: ReadonlyArray<{ id: SingaporeStation; name: SingaporeText; position: Position; approach: Position & { yaw: number } }>
  acceptLoan: () => Promise<Result>
  returnLoan: () => Promise<Result>
  collectKit: () => Promise<Result>
  shuttle: (id: SingaporeStation) => Promise<Result>
}
export type SingaporeMemory = {
  visits: number; accepted: boolean; quiet: boolean; bookReceipt: string; meetupReceipt: string; kitReceipt: string
  pickupAccepted: boolean; knewNotice: boolean; knewPickup: boolean; journal: Entry[]
}
const MODAL = 'singapore-glasses'
const words = {
  en: {
    title: 'A day on campus.', planTitle: 'Two things, one campus.', nextTitle: 'Your own way through NTU.', doneTitle: 'All taken care of.',
    panel: 'Glasses', connected: 'NTU PROTOTYPE · GLASSES', quiet: 'Quiet mode', walk: 'Walk', stop: 'Stop',
    tabs: ['Right now', 'Memory', 'Travel', 'Framework'], explore: 'Keep exploring',
    start: 'Stop at the demo plaza kiosk to accept your plans. You can explore anywhere first.',
    plans: 'Return a borrowed demo book and join fictional study group G-07. Your plans stay with you when you return.',
    accept: 'Accept both plans & take the book', pending: 'Pending', complete: 'Done', book: 'Return SG-B17', group: 'Meet group G-07', kit: 'Collect kit K-07',
    libraryHint: 'You have two plans. Check the demo library board for current directions.',
    route: 'The board gives a book return box and a meeting point. Choose either first.',
    returnHint: 'The book is still in your bag. The current notice points to the demo return box.',
    meetHint: 'Your book return is recorded. Meet your group at the point on the current notice.',
    kitHint: 'You accepted a kit pickup. The plaza supply box is the next place to check.',
    newFollowup: 'Your check-in is saved. Read the pickup card at the demo group point when you are ready.',
    recheckPickup: 'Your pickup plan is saved. Recheck the card at the group point before heading to the plaza.',
    acceptPickupHint: 'You have read the pickup card. Accept this follow-up at the group point if you want to collect the kit.',
    acceptPickup: 'Remember this pickup', read: 'Read the demo notice', reread: 'Recheck the visible notice',
    readPickup: 'Read the pickup card', checkIn: 'Confirm my arrival', checkInText: 'Record that you are here for demo group G-07? This is your confirmation, not a real attendance record.',
    observeFirst: 'Read the current campus notice before acting on the remembered destination.',
    pickupFirst: 'Read the pickup card at the group point and accept the follow-up first.',
    busy: 'Confirming…', failed: 'That action could not be verified. Nothing is marked complete; you can try again.',
    closer: 'Move closer and face the marked kiosk with a clear view.', restoring: 'Restoring your pending loan…',
    restoreFailed: 'The pending book could not be restored. Use Retry before continuing.', retry: 'Retry restoring the book',
    fresh: 'Observed during this visit', old: 'Remembered · not checked this visit', receipt: 'Receipt',
    memoryNote: 'Plans and receipts stay in this browser. A new visit does not undo completed tasks. Scene notices must be checked again.',
    quietTitle: 'Fewer interruptions', quietText: 'Hide optional hints while I explore.',
    travelTitle: 'Campus shuttle · simulation', travelText: 'Jump to a safe approach near a demo station. This is a simulated shortcut, not a real NTU shuttle route. Arrival does not read a notice or complete a task.',
    travelButton: 'Shuttle here', travelDone: 'Arrived. Look at the kiosk and interact when you are ready.',
    traceTitle: 'Your actual playthrough', traceText: 'These entries record what you observed, chose, or verified. They do not certify learning or autonomous capability.',
    visible: 'Visible evidence', retained: 'Retained context', confirmed: 'You confirm',
    mapSources: 'Map sources',
    controls: 'WASD move · R walk / stop · E interact · H glasses', mobile: 'Use the touch controls; tap the nearby kiosk prompt.',
    interact: 'Open this demo station', focus: 'Check this next', noEvidence: 'No current evidence yet. Walk to a marked station and look at its notice.',
    logs: {
      accepted: 'You accepted two plans and the tracked book was added to your inventory.',
      restored: 'Pending plans and past receipts were recalled. This visit starts with notices unverified.',
      focus: 'Your unfinished plans focused attention on the next relevant notice; its contents remain unknown until read.',
      notice: 'You read the visible campus board. Its demo return and group destinations were retained with this visit.',
      suggested: 'The observed directions were matched to your accepted book return and group plans.',
      recheck: 'You explicitly asked to inspect the notice again; a new visible observation followed.',
      returned: 'The tagged book left your inventory through the return transaction; its receipt was retained.',
      met: 'At the visible group kiosk, you explicitly confirmed arrival. A local demo check-in receipt was saved.',
      pickupNotice: 'You read the visible pickup card at the group point. It identifies kit K-07 and the plaza supply box.',
      pickupAccepted: 'You accepted the new pickup commitment, linking it to the retained check-in receipt.',
      kit: 'The one-time kit transfer into your inventory was verified and its receipt saved.',
      quiet: 'Your request for fewer interruptions was saved; optional hints are hidden.',
      resumed: 'You enabled optional hints again.',
      shuttle: 'You requested the simulated shuttle. Reaching its stop did not count as an observation or task completion.'
    }
  },
  zh: {
    title: '校园里的一天。', planTitle: '两件事，一座校园。', nextTitle: '按自己的路线逛 NTU。', doneTitle: '都安排妥当了。',
    panel: '眼镜面板', connected: 'NTU 原型预览 · 模拟眼镜', quiet: '安静模式', walk: '行走', stop: '停止',
    tabs: ['此刻', '记忆', '接驳', 'Framework'], explore: '继续探索',
    start: '到试玩广场的信息站接受今天的安排。也可以先自由逛逛。',
    plans: '归还一本试玩借书，再参加虚构学习小组 G-07。下次回来时，这些安排仍会保留。',
    accept: '接受两项安排，并领取借书', pending: '待办', complete: '完成', book: '归还 SG-B17', group: '和 G-07 小组碰面', kit: '领取 K-07 材料',
    libraryHint: '你有两项安排，先看看试玩图书馆告示上的最新指引。',
    route: '告示提供了还书箱和集合点。先去哪一个，由你决定。',
    returnHint: '借书还在背包里，可以按本次告示的指引去试玩还书箱。',
    meetHint: '归还记录已经保存，接下来可以按本次告示去和小组碰面。',
    kitHint: '你接受了领取材料的安排，下一站可以去广场材料箱。',
    newFollowup: '签到记录已经保存，准备好时可以去试玩小组集合点阅读领取卡。',
    recheckPickup: '领取安排已经保存，去广场前请先在小组集合点重新确认领取卡。',
    acceptPickupHint: '你已读到领取卡；如果想领取材料，可以在小组集合点接受这项后续安排。',
    acceptPickup: '记住这项领取安排', read: '阅读试玩告示', reread: '重新确认眼前的告示',
    readPickup: '阅读材料领取卡', checkIn: '确认我已到达', checkInText: '记录你已到达试玩学习小组 G-07？这是你的自主确认，不是实际考勤。',
    observeFirst: '沿用记忆里的地点前，请先阅读本次访问的校园告示。',
    pickupFirst: '先在小组集合点阅读领取卡，并接受这项后续安排。',
    busy: '正在确认…', failed: '未能核实这次操作，待办尚未标记完成，可以重试。',
    closer: '请靠近并面向指定信息站，确保视线清晰。', restoring: '正在恢复上次待还的书…',
    restoreFailed: '未能恢复待还书籍，请先点击重试。', retry: '重试恢复借书',
    fresh: '来自本次访问的观察', old: '来自记忆 · 本次尚未确认', receipt: '凭证',
    memoryNote: '安排与凭证保留在此浏览器。再次访问不会撤销已完成的任务，场景告示仍需重新确认。',
    quietTitle: '少打扰一些', quietText: '我探索时，隐藏可选提示。',
    travelTitle: '校园接驳 · 模拟', travelText: '移动到试玩站点附近的安全位置。这是模拟快捷移动，不是真实 NTU 巴士路线。到达不代表读过告示，也不会完成任务。',
    travelButton: '接驳到这里', travelDone: '已到达。看向信息站，准备好时再交互。',
    traceTitle: '你实际经历的过程', traceText: '这里只记录你观察、选择或核实的事件，不代表已验证学习或自主能力。',
    visible: '可见证据', retained: '持续上下文', confirmed: '由你确认',
    mapSources: '地图来源',
    controls: 'WASD 移动 · R 行走 / 停止 · E 交互 · H 眼镜', mobile: '使用触控移动，靠近后点击信息站提示。',
    interact: '打开此试玩站点', focus: '下一条相关线索', noEvidence: '还没有本次访问的证据，可以走近指定站点，看看告示。',
    logs: {
      accepted: '你接受了两项安排，带标记的借书已加入背包。',
      restored: '调取待办与历史凭证，本次访问的告示仍需重新确认。',
      focus: '未完成的安排引导关注下一条相关告示；阅读前还不知道告示内容。',
      notice: '你读到了眼前的校园告示，保留试玩还书与集合地点，以及本次访问记录。',
      suggested: '将观察到的指引与你已接受的还书、碰面安排结合，形成建议。',
      recheck: '你明确要求重新查看告示，随后取得新的可见观察。',
      returned: '带标记的书通过归还操作离开背包，归还凭证已保留。',
      met: '你在可见的小组信息站明确确认到达，保存了一条本地试玩签到凭证。',
      pickupNotice: '你在小组集合点读到了领取卡，得知 K-07 材料与广场领取地点。',
      pickupAccepted: '你接受了新的领取安排，并与保留的签到凭证关联。',
      kit: '已核实一次性的材料入包操作，领取凭证已保存。',
      quiet: '已保存少打扰的偏好，隐藏可选提示。',
      resumed: '你重新开启了可选提示。',
      shuttle: '你主动使用模拟接驳，到达站点没有被算作观察或任务完成。'
    }
  }
}

function initialLanguage (): SingaporeLanguage {
  const lang = new URLSearchParams(location.search).get('lang')
  if (lang === 'zh' || lang === 'en') return lang
  try { const saved = localStorage.getItem('always-on-singapore-language'); if (saved === 'en' || saved === 'zh') return saved } catch {}
  return navigator.language.startsWith('zh') ? 'zh' : 'en'
}
export function getSingaporeMemory (): SingaporeMemory {
  const blank: SingaporeMemory = { visits: 0, accepted: false, quiet: false, bookReceipt: '', meetupReceipt: '', kitReceipt: '', pickupAccepted: false, knewNotice: false, knewPickup: false, journal: [] }
  try {
    const data = JSON.parse(localStorage.getItem(SINGAPORE_STORY.memoryKey) ?? 'null')
    if (!data || typeof data !== 'object') return blank
    const receipt = (key: string) => (typeof data[key] === 'string' ? data[key].slice(0, 100) : '')
    return { visits: Math.max(0, Math.floor(Number(data.visits) || 0)), accepted: data.accepted === true, quiet: data.quiet === true, bookReceipt: receipt('bookReceipt'), meetupReceipt: receipt('meetupReceipt'), kitReceipt: receipt('kitReceipt'), pickupAccepted: data.pickupAccepted === true, knewNotice: data.knewNotice === true, knewPickup: data.knewPickup === true, journal: Array.isArray(data.journal) ? data.journal.filter((entry: Entry) => entry && Object.hasOwn(words.en.logs, entry.code) && Number.isFinite(entry.time) && ['M', 'S → M', 'M → A', 'A → S', 'M → S', 'A → M'].includes(entry.channel)).slice(-60) : [] }
  } catch { return blank }
}
export const singaporeHudState = proxy({
  ready: false, language: initialLanguage(), visit: 1, accepted: false, quiet: false, walking: false,
  bookReceipt: '', meetupReceipt: '', kitReceipt: '', pickupAccepted: false,
  noticeObserved: false, pickupObserved: false, knewNotice: false, knewPickup: false,
  target: '' as SingaporeStation | '', focus: 'plaza' as SingaporeStation,
  busy: false, restoring: false, restoreFailed: false, error: '' as '' | 'failed' | 'closer' | 'observeFirst' | 'pickupFirst',
  tab: 'now' as Tab, journal: [] as Entry[], travelDone: false
})
let activeBot: ScenePlayer | undefined
let scene: SingaporeSceneOptions | undefined
let previousCleanup: (() => void) | undefined

function persist () {
  const state = singaporeHudState
  try { localStorage.setItem(SINGAPORE_STORY.memoryKey, JSON.stringify({ visits: state.visit, accepted: state.accepted, quiet: state.quiet, bookReceipt: state.bookReceipt, meetupReceipt: state.meetupReceipt, kitReceipt: state.kitReceipt, pickupAccepted: state.pickupAccepted, knewNotice: state.knewNotice || state.noticeObserved, knewPickup: state.knewPickup || state.pickupObserved, journal: state.journal.slice(-60) })) } catch {}
}
function log (code: LogCode, channel: Channel, receipt?: string) {
  singaporeHudState.journal.push({ code, channel, time: Date.now(), visit: singaporeHudState.visit, ...(receipt ? { receipt } : {}) })
  singaporeHudState.journal = singaporeHudState.journal.slice(-60)
  persist()
}
function stopWalking () {
  singaporeHudState.walking = false
  activeBot?.clearControlStates()
  activeBot?.mouse?.buttons?.fill(false)
}
function toggleWalking () {
  if (singaporeHudState.walking) { stopWalking(); return }
  if (!activeBot || !singaporeHudState.ready || !isGameActive(true) || document.hidden || singaporeHudState.busy) return
  stopWalking()
  singaporeHudState.walking = true
  activeBot.setControlState('forward', true)
}
/** Near, in the view cone, and not through solid geometry. Kiosk data alone is not evidence. */
export function isSingaporeTargetVisible (player: ScenePlayer, target: Position, range = 6): boolean {
  if (!player.entity?.position || !player.world) return false
  const eye = player.entity.position.offset(0, player.controlState.sneak ? 1.27 : 1.62, 0)
  const destination = new Vec3(target.x + 0.5, target.y + 0.5, target.z + 0.5)
  const offset = destination.minus(eye)
  const distance = offset.norm()
  if (distance > range || distance < 0.05) return false
  const { yaw, pitch } = player.entity
  const facing = new Vec3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch))
  if (facing.dot(offset.scaled(1 / distance)) < 0.65) return false
  const blockTarget = destination.floored()
  for (let t = 0.2; t < distance - 0.12; t += 0.16) {
    const point = eye.plus(offset.scaled(t / distance)).floored()
    if (point.equals(blockTarget)) continue
    const block = player.blockAt(point)
    if (!block || (block.boundingBox === 'block' && !/glass|leaves|water|ice/.test(block.name))) return false
  }
  return true
}
function visible (id: SingaporeStation) {
  const station = scene?.stations.find(value => value.id === id)
  return Boolean(activeBot && station && isSingaporeTargetVisible(activeBot, station.position))
}
function requireVisible (id: SingaporeStation) {
  if (visible(id)) return true
  singaporeHudState.error = 'closer'
  return false
}
function focusNext () {
  const state = singaporeHudState
  if (state.bookReceipt && state.meetupReceipt && state.kitReceipt) return
  let next: SingaporeStation = 'plaza'
  if (state.accepted) {
    if ((!state.bookReceipt || !state.meetupReceipt) && !state.noticeObserved) next = 'library'
    else if (!state.bookReceipt) next = 'return'
    else if (!state.meetupReceipt || !state.pickupAccepted || !state.pickupObserved) next = 'meetup'
  }
  if (state.focus !== next) { state.focus = next; log('focus', 'M → S') }
}
function nextDescription (state: Pick<typeof singaporeHudState, 'language' | 'accepted' | 'bookReceipt' | 'meetupReceipt' | 'kitReceipt' | 'noticeObserved' | 'pickupObserved' | 'pickupAccepted' | 'knewNotice' | 'knewPickup'>) {
  const text = words[state.language]
  if (state.bookReceipt && state.meetupReceipt && state.kitReceipt) return SINGAPORE_STORY.done[state.language]
  if (!state.accepted) return text.start
  if ((!state.bookReceipt || !state.meetupReceipt) && !state.noticeObserved) return state.knewNotice ? SINGAPORE_STORY.staleEvidence[state.language] : text.libraryHint
  if (!state.bookReceipt && !state.meetupReceipt) return text.route
  if (!state.bookReceipt) return text.returnHint
  if (!state.meetupReceipt) return text.meetHint
  if (!state.pickupObserved) return state.knewPickup ? text.recheckPickup : text.newFollowup
  return state.pickupAccepted ? text.kitHint : text.acceptPickupHint
}
export function openSingaporePanel (tab: Tab = 'now') {
  if (!singaporeHudState.ready) return
  singaporeHudState.tab = tab
  stopWalking()
  showModal({ reactType: MODAL })
  document.exitPointerLock?.()
}
function closePanel (resume = true) {
  const modal = activeModalStack.find(value => value.reactType === MODAL)
  if (modal) hideModal(modal)
  stopWalking()
  if (resume) void pointerLock.requestPointerLock()
}
function readNotice (recheck = false) {
  if (!requireVisible('library')) return
  singaporeHudState.error = ''
  if (recheck) log('recheck', 'A → S')
  singaporeHudState.noticeObserved = true
  log('notice', 'S → M')
  if (singaporeHudState.accepted && (!singaporeHudState.bookReceipt || !singaporeHudState.meetupReceipt)) log('suggested', 'M → A')
  focusNext()
}
function readPickup (recheck = false) {
  if (!requireVisible('meetup') || !singaporeHudState.meetupReceipt) return
  singaporeHudState.error = ''
  if (recheck) log('recheck', 'A → S')
  singaporeHudState.pickupObserved = true
  log('pickupNotice', 'S → M')
  focusNext()
}
async function transaction (run: () => Promise<Result>, after: (result: Result) => void) {
  if (!activeBot || !scene || singaporeHudState.busy) return
  const player = activeBot
  const currentScene = scene
  singaporeHudState.busy = true
  singaporeHudState.error = ''
  stopWalking()
  try {
    const result = await run()
    if (activeBot !== player || scene !== currentScene) return
    if (!result.ok) { singaporeHudState.error = 'failed'; return }
    after(result)
    focusNext()
    persist()
  } catch { if (activeBot === player && scene === currentScene) singaporeHudState.error = 'failed' } finally {
    if (activeBot === player && scene === currentScene) singaporeHudState.busy = false
  }
}
function acceptPlans () {
  if (!scene || singaporeHudState.accepted || !requireVisible('plaza')) return
  void transaction(scene.acceptLoan, () => { singaporeHudState.accepted = true; log('accepted', 'A → M') })
}
async function restoreLoan () {
  if (!scene || !singaporeHudState.accepted || singaporeHudState.bookReceipt || singaporeHudState.busy) return
  singaporeHudState.restoring = true
  singaporeHudState.restoreFailed = false
  const currentScene = scene
  await transaction(scene.acceptLoan, () => { singaporeHudState.restoreFailed = false })
  if (scene !== currentScene) return
  singaporeHudState.restoring = false
  singaporeHudState.restoreFailed = singaporeHudState.error === 'failed'
}
function returnBook () {
  if (!scene || !singaporeHudState.accepted || singaporeHudState.bookReceipt || !requireVisible('return')) return
  if (!singaporeHudState.noticeObserved) { singaporeHudState.error = 'observeFirst'; return }
  if (singaporeHudState.restoreFailed) return
  void transaction(scene.returnLoan, result => {
    if (!result.receiptId) { singaporeHudState.error = 'failed'; return }
    singaporeHudState.bookReceipt = result.receiptId
    log('returned', 'A → M', result.receiptId)
  })
}
function checkIn () {
  if (!singaporeHudState.accepted || singaporeHudState.meetupReceipt || singaporeHudState.busy || !requireVisible('meetup')) return
  if (!singaporeHudState.noticeObserved) { singaporeHudState.error = 'observeFirst'; return }
  singaporeHudState.error = ''
  const receipt = `SG-MEET-${Date.now().toString(36)}`
  singaporeHudState.meetupReceipt = receipt
  log('met', 'A → M', receipt)
  focusNext()
}
function acceptPickup () {
  if (!singaporeHudState.meetupReceipt || !singaporeHudState.pickupObserved || singaporeHudState.pickupAccepted || !requireVisible('meetup')) return
  singaporeHudState.pickupAccepted = true
  log('pickupAccepted', 'A → M')
  focusNext()
}
function collectKit () {
  if (!scene || singaporeHudState.kitReceipt || !requireVisible('plaza')) return
  if (!singaporeHudState.pickupAccepted || !singaporeHudState.pickupObserved || !singaporeHudState.meetupReceipt) { singaporeHudState.error = 'pickupFirst'; return }
  void transaction(scene.collectKit, result => {
    if (!result.receiptId) { singaporeHudState.error = 'failed'; return }
    singaporeHudState.kitReceipt = result.receiptId
    log('kit', 'A → M', result.receiptId)
  })
}
function takeShuttle (id: SingaporeStation) {
  if (!scene) return
  const currentScene = scene
  void transaction(async () => currentScene.shuttle(id), () => {
    singaporeHudState.target = ''
    singaporeHudState.travelDone = true
    log('shuttle', 'A → M')
    closePanel()
  })
}
function interact () {
  if (!singaporeHudState.target || !requireVisible(singaporeHudState.target)) return
  openSingaporePanel()
}

/** Scenes remain unread until an explicit station action passes the visibility check. */
export function setupSingaporeDemo (player: ScenePlayer, options: SingaporeSceneOptions) {
  previousCleanup?.()
  activeBot = player
  scene = options
  const memory = getSingaporeMemory()
  Object.assign(singaporeHudState, { ready: true, visit: memory.visits + 1, accepted: memory.accepted, quiet: memory.quiet, bookReceipt: memory.bookReceipt, meetupReceipt: memory.meetupReceipt, kitReceipt: memory.kitReceipt, pickupAccepted: memory.pickupAccepted, knewNotice: memory.knewNotice, knewPickup: memory.knewPickup, journal: memory.journal, walking: false, target: '', focus: 'plaza', busy: false, restoring: false, restoreFailed: false, error: '', tab: 'now', noticeObserved: false, pickupObserved: false, travelDone: false })
  if (memory.accepted) log('restored', 'M')
  focusNext()
  persist()
  const abort = new AbortController()
  const observer = setInterval(() => {
    if (!isGameActive(true) || document.hidden) return
    singaporeHudState.target = options.stations.find(station => isSingaporeTargetVisible(player, station.position))?.id ?? ''
  }, 180)
  document.addEventListener('keydown', event => {
    if ((event.target as HTMLElement)?.closest('input, textarea, [contenteditable="true"]') || event.repeat) return
    if (singaporeHudState.walking && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyE', 'KeyH', 'Escape'].includes(event.code)) stopWalking()
    if (event.code === 'KeyR' && isGameActive(true)) { event.preventDefault(); event.stopImmediatePropagation(); toggleWalking() } else if (event.code === 'KeyH' && (isGameActive(true) || activeModalStack.at(-1)?.reactType === MODAL)) {
      event.preventDefault(); event.stopImmediatePropagation()
      if (activeModalStack.at(-1)?.reactType === MODAL) closePanel(); else openSingaporePanel()
    } else if (event.code === 'KeyE' && isGameActive(true) && singaporeHudState.target) { event.preventDefault(); event.stopImmediatePropagation(); interact() }
  }, { capture: true, signal: abort.signal })
  window.addEventListener('blur', stopWalking, { signal: abort.signal })
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopWalking() }, { signal: abort.signal })
  const unsubscribe = subscribe(activeModalStack, () => { if (activeModalStack.length) stopWalking() })
  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    clearInterval(observer); abort.abort(); unsubscribe(); stopWalking()
    player.removeListener('end', cleanup)
    singaporeHudState.ready = false
    closePanel(false)
    activeBot = undefined; scene = undefined
  }
  player.once('end', cleanup)
  previousCleanup = cleanup
  if (memory.accepted && !memory.bookReceipt) void restoreLoan()
  return cleanup
}

export default function SingaporeHud () {
  const state = useSnapshot(singaporeHudState)
  const { currentTouch } = useSnapshot(miscUiState)
  const panelOpen = useIsModalActive(MODAL)
  const pauseOpen = useIsModalActive('pause-screen')
  const panelRef = useRef<HTMLDivElement>(null)
  const text = words[state.language]
  const localized = (value: SingaporeText) => value[state.language]
  useEffect(() => {
    if (!state.ready || !pauseOpen) return
    const pause = activeModalStack.find(value => value.reactType === 'pause-screen')
    if (pause) hideModal(pause)
    openSingaporePanel()
  }, [state.ready, pauseOpen])
  useEffect(() => { if (panelOpen) panelRef.current?.focus() }, [panelOpen])
  if (!state.ready) return null
  const allDone = Boolean(state.bookReceipt && state.meetupReceipt && state.kitReceipt)
  const title = allDone ? text.doneTitle : state.accepted ? text.nextTitle : text.planTitle
  const description = nextDescription(state)
  const receipts = [state.bookReceipt, state.meetupReceipt, state.kitReceipt]
  const stationName = (id: SingaporeStation) => localized(scene?.stations.find(station => station.id === id)?.name ?? SINGAPORE_STORY.stations[id])
  const setLanguage = (language: SingaporeLanguage) => {
    singaporeHudState.language = language
    try { localStorage.setItem('always-on-singapore-language', language) } catch {}
    const url = new URL(location.href); url.searchParams.set('lang', language); history.replaceState(null, '', url)
  }
  const toggleQuiet = () => { singaporeHudState.quiet = !singaporeHudState.quiet; log(singaporeHudState.quiet ? 'quiet' : 'resumed', 'A → M') }
  const mapCredits = <span className='sg-map-credits ao-interactive' onPointerDown={event => event.stopPropagation()} onClick={stopWalking}><a href='https://www.openstreetmap.org/copyright' target='_blank' rel='noopener noreferrer'>© OpenStreetMap contributors · ODbL</a><a href='./maps/ntu/SOURCES.md' target='_blank' rel='noopener noreferrer'>{text.mapSources} ↗</a></span>
  const planCards = <div className='sg-plan-list'>{[text.book, text.group, ...(state.pickupAccepted || state.kitReceipt ? [text.kit] : [])].map((label, index) => <div className='ao-context-card' key={label}><span className={`ao-module ${receipts[index] ? 'ao-a' : 'ao-m'}`}>{receipts[index] ? '✓' : String(index + 1).padStart(2, '0')}</span><div><strong>{label}</strong><p>{receipts[index] ? text.complete : text.pending}</p></div></div>)}</div>
  return <div className='ao-glasses sg-glasses' lang={state.language === 'zh' ? 'zh-CN' : 'en'}>
    <div className='ao-glasses-rim' aria-hidden='true' />
    <header className='ao-hud-top'>
      <button className='ao-brand ao-interactive' onClick={() => openSingaporePanel()} aria-label={text.panel}><svg viewBox='0 0 34 18' aria-hidden='true'><path d='M2 6h3m24 0h3M5 5h9l1 7H7L5 5Zm15 0h9l-2 7h-8l1-7ZM15 7h4' /></svg><span>ALWAYS ON<small><i />{state.quiet ? text.quiet : text.connected}</small></span></button>
      <div className='ao-hud-tools ao-interactive'>
        <button className='ao-panel-button ao-walk-button' aria-pressed={state.walking} disabled={panelOpen || state.busy} onClick={toggleWalking}>{state.walking ? text.stop : text.walk}<kbd>R</kbd></button>
        <div className='ao-language' aria-label='Language'><button aria-pressed={state.language === 'en'} onClick={() => setLanguage('en')}>EN</button><button aria-pressed={state.language === 'zh'} onClick={() => setLanguage('zh')}>中</button></div>
        <button className='ao-panel-button' aria-label={text.panel} onClick={() => openSingaporePanel()}><span className='ao-grid-icon' aria-hidden='true'>▦</span><span>{text.panel}</span><kbd>H</kbd></button>
      </div>
    </header>
    {!panelOpen && !state.quiet && <button className='ao-mission ao-interactive' onClick={() => openSingaporePanel()}><span className='ao-eyebrow'>NTU · {state.language === 'zh' ? `第 ${state.visit} 次访问` : `VISIT ${state.visit}`}</span><strong>{title}</strong><span>{description}</span><span className='ao-mission-progress'>{receipts.map((receipt, index) => <i key={index} className={receipt ? 'is-active' : ''} />)}</span>{!allDone && <small className='sg-focus'>{text.focus} · {stationName(state.focus)}</small>}</button>}
    {!panelOpen && state.target && <button className='ao-interact ao-interactive' onClick={interact}><kbd>{currentTouch ? '↗' : 'E'}</kbd>{stationName(state.target)}<span>↗</span></button>}
    {!panelOpen && <div className='ao-bottom-note'><span className='sg-map-boundary'>{localized(SINGAPORE_STORY.geographyNote)}{mapCredits}</span><span>{currentTouch ? text.mobile : text.controls}</span></div>}
    {panelOpen && <div className='ao-panel-layer ao-interactive' onPointerDown={event => event.stopPropagation()}><div
      className='ao-panel' ref={panelRef} role='dialog' aria-modal='true' aria-label={text.panel} tabIndex={-1} onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closePanel(false) }
        if (event.key === 'Tab') {
          const elements = [...(panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], [tabindex="0"]') ?? [])]
          if (event.shiftKey && (document.activeElement === elements[0] || document.activeElement === panelRef.current)) {
            event.preventDefault()
            elements.at(-1)?.focus()
          } else if (!event.shiftKey && document.activeElement === elements.at(-1)) {
            event.preventDefault()
            elements[0]?.focus()
          }
        }
      }}>
      <div className='ao-panel-heading'><div><span className='ao-eyebrow'>ALWAYS ON / NTU</span><h2>{title}</h2></div><button className='ao-close' aria-label={text.explore} onClick={() => closePanel()}>×</button></div>
      <div className='ao-tabs' role='tablist'>{(['now', 'memory', 'travel', 'trace'] as Tab[]).map((tab, index) => <button key={tab} role='tab' aria-selected={state.tab === tab} onClick={() => { singaporeHudState.tab = tab }}>{text.tabs[index]}</button>)}</div>
      <div className='ao-panel-content' role='tabpanel'>
        {state.tab === 'now' && <>
          <p className='ao-lead'>{description}</p>
          {state.accepted ? planCards : <><div className='ao-notice'><p>{text.plans}</p></div>{state.target === 'plaza' && <button className='ao-primary' disabled={state.busy} onClick={acceptPlans}>{state.busy ? text.busy : text.accept}<span>→</span></button>}</>}
          {state.restoring && <p className='ao-footnote' role='status'>{text.restoring}</p>}
          {state.restoreFailed && <><p className='ao-error'>{text.restoreFailed}</p><button className='ao-primary' disabled={state.busy} onClick={() => { void restoreLoan() }}>{text.retry}</button></>}
          {state.target === 'library' && <button className='ao-primary' disabled={state.busy} onClick={() => readNotice(state.noticeObserved)}>{state.noticeObserved ? text.reread : text.read}<span>↗</span></button>}
          {state.noticeObserved && <div className='ao-notice'><span className='ao-eyebrow'>S → M · {text.fresh}</span><p>{localized(SINGAPORE_LOOPS[0].evidence.text)}</p><p>{localized(SINGAPORE_LOOPS[1].evidence.text)}</p></div>}
          {state.accepted && state.target === 'return' && !state.bookReceipt && <><p className='ao-footnote'>{localized(SINGAPORE_LOOPS[0].action.confirmation)}</p><button className='ao-primary' disabled={state.busy || state.restoreFailed} onClick={returnBook}>{state.busy ? text.busy : text.book}<span>→</span></button></>}
          {state.accepted && state.target === 'meetup' && !state.meetupReceipt && <><p className='ao-footnote'>{text.checkInText}</p><button className='ao-primary' disabled={state.busy} onClick={checkIn}>{text.checkIn}<span>→</span></button></>}
          {state.target === 'meetup' && state.meetupReceipt && <button className='ao-primary' disabled={state.busy} onClick={() => readPickup(state.pickupObserved)}>{state.pickupObserved ? text.reread : text.readPickup}<span>↗</span></button>}
          {state.pickupObserved && <div className='ao-notice'><span className='ao-eyebrow'>S → M · {text.fresh}</span><p>{localized(SINGAPORE_LOOPS[2].evidence.text)}</p></div>}
          {state.target === 'meetup' && state.pickupObserved && !state.pickupAccepted && <button className='ao-primary' disabled={state.busy} onClick={acceptPickup}>{text.acceptPickup}<span>→</span></button>}
          {state.target === 'plaza' && state.pickupAccepted && !state.kitReceipt && <><p className='ao-footnote'>{localized(SINGAPORE_LOOPS[2].action.confirmation)}</p><button className='ao-primary' disabled={state.busy} onClick={collectKit}>{state.busy ? text.busy : text.kit}<span>→</span></button></>}
          {state.error && <p className='ao-error' role='alert'>{text[state.error]}</p>}
          {!state.target && <button className='sg-secondary' onClick={() => { singaporeHudState.tab = 'travel' }}>{text.travelTitle}<span>↗</span></button>}
        </>}
        {state.tab === 'memory' && <>
          {state.accepted ? planCards : <p className='ao-lead'>{text.plans}</p>}
          {(state.knewNotice || state.noticeObserved) && <div className='ao-notice'><strong>{state.noticeObserved ? text.fresh : text.old}</strong><p>{localized(SINGAPORE_LOOPS[0].evidence.text)}</p><p>{localized(SINGAPORE_LOOPS[1].evidence.text)}</p></div>}
          {(state.knewPickup || state.pickupObserved) && <div className='ao-notice'><strong>{state.pickupObserved ? text.fresh : text.old}</strong><p>{localized(SINGAPORE_LOOPS[2].evidence.text)}</p></div>}
          {receipts.filter(Boolean).map(receipt => <div className='ao-receipt' key={receipt}><span>{text.receipt}</span><code>{receipt}</code></div>)}
          <div className='ao-preference'><div><strong>{text.quietTitle}</strong><p>{text.quietText}</p></div><button className={`ao-toggle ${state.quiet ? 'is-on' : ''}`} role='switch' aria-checked={state.quiet} aria-label={text.quietTitle} onClick={toggleQuiet}><i /></button></div><p className='ao-footnote'>{text.memoryNote}</p>
        </>}
        {state.tab === 'travel' && <><h3>{text.travelTitle}</h3><p className='ao-footnote'>{text.travelText}</p><div className='sg-station-list'>{scene?.stations.map(station => <button key={station.id} disabled={state.busy} className='sg-station' onClick={() => takeShuttle(station.id)}><span><strong>{localized(station.name)}</strong><small>{localized(SINGAPORE_STORY.stations[station.id])}</small></span><span>{text.travelButton} ↗</span></button>)}</div>{state.error && <p className='ao-error' role='alert'>{text[state.error]}</p>}</>}
        {state.tab === 'trace' && <><h3>{text.traceTitle}</h3><p className='ao-footnote'>{text.traceText}</p><div className='ao-module-legend'><span><i className='ao-s'>S</i>{text.visible}</span><span><i className='ao-m'>M</i>{text.retained}</span><span><i className='ao-a'>A</i>{text.confirmed}</span></div><ol className='ao-timeline'>{[...state.journal].reverse().map((entry, index) => <li key={`${entry.time}-${index}`}><div><span>{entry.channel}</span><time>{new Date(entry.time).toLocaleTimeString(state.language === 'zh' ? 'zh-CN' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}</time></div><p>{text.logs[entry.code]}</p>{entry.receipt && <code>{entry.receipt}</code>}</li>)}</ol></>}
      </div>
      <footer className='ao-panel-footer'><p><span>{localized(SINGAPORE_STORY.geographyNote)}</span>{localized(SINGAPORE_STORY.simulationNote)}{mapCredits}</p><button className='ao-continue' onClick={() => closePanel()}>{text.explore}<span>↗</span></button></footer>
    </div></div>}
  </div>
}
