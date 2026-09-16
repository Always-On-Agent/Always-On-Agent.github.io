import { useEffect, useRef, type CSSProperties } from 'react'
import { proxy, subscribe, useSnapshot } from 'valtio'
import type { Bot } from 'mineflayer'
import { activeModalStack, hideModal, isGameActive, miscUiState, showModal } from './globalState'
import { useIsModalActive } from './react/utilsApp'
import { pointerLock } from './utils'
import { isAlwaysOnTargetVisible } from './alwaysOnHud'
import './alwaysOnHud.css'
import './eccvHud.css'

type Position = { x: number; y: number; z: number }
type Language = 'en' | 'zh'
export type EccvPosterId = 'gaga' | 'omnimap' | 'cfg' | 'lagen' | 'city'
export type EccvSceneOptions = { posters: ReadonlyArray<{ id: EccvPosterId; position: Position; detailPosition?: Position }>; reportPoint: Position }
type Channel = 'S' | 'M' | 'A' | 'S → M' | 'M → S' | 'M → A' | 'A → S' | 'A → M'
type EventCode = 'arrived' | 'recalled' | 'observed' | 'focus' | 'opened' | 'question' | 'connected' | 'recommended' | 'inspect' | 'detail' | 'useful' | 'later' | 'interest' | 'quiet' | 'resumed' | 'report' | 'download'
type Entry = { code: EventCode; channel: Channel; time: number; visit: number; poster?: EccvPosterId; next?: EccvPosterId }
type Card = { seenVisit: number; firstSeen: number; lastSeen: number; stage: number; detailVisit: number; questionVisit: number; feedback: '' | 'useful' | 'later' }
type Tab = 'card' | 'memory' | 'trace' | 'report'
const IDS: EccvPosterId[] = ['gaga', 'omnimap', 'cfg', 'lagen', 'city']
const MEMORY_KEY = 'always-on-eccv-memory-v1'
const MODAL = 'eccv-glasses'
const papers = {
  gaga: { name: 'GaGA', title: 'Towards Interactive Global Geolocation Assistant', url: 'https://arxiv.org/abs/2412.08907',
    en: { insight: 'An interactive geolocation assistant can refine a location estimate using visual clues and user corrections.', question: 'When should the assistant ask for another clue before committing to a location?', detail: 'Interactive correction is part of the geolocation process, rather than a separate note after the prediction.', connection: 'Your next stop can test whether a model actually uses the visual evidence it is shown.' },
    zh: { insight: '交互式地理定位助手结合图像线索和用户纠正，逐步修正地点判断。', question: '助手应在什么时候先询问另一条线索，而不是直接确定地点？', detail: '用户的交互纠正属于定位推理过程，而不只是预测完成后附加的一条备注。', connection: '下一站可以继续关注：模型是否真正使用了眼前的视觉证据。' } },
  omnimap: { name: 'OmniMapBench', title: 'Benchmarking Visual-Centric Reasoning on Diverse Map Documents', url: 'https://arxiv.org/abs/2607.09068',
    en: { insight: 'This benchmark examines visual reasoning across varied map documents, including whether answers depend on the map itself.', question: 'Which questions reveal a shortcut that uses text without reading the map?', detail: 'The Visual Dependency Index examines reliance on visual map evidence instead of text-only shortcuts.', connection: 'GaGA asks for useful clues; OmniMapBench asks whether the model actually relies on visual evidence.' },
    zh: { insight: '这一基准评估多类地图文档中的视觉推理，关注答案是否真正依赖地图本身。', question: '哪些问题能揭示模型没有读图、只靠文字走捷径？', detail: 'Visual Dependency Index 用来考察对地图视觉证据的依赖，而不只是文字捷径。', connection: 'GaGA 关注如何获得有效线索；OmniMapBench 关注模型是否真的使用视觉证据。' } },
  cfg: { name: 'CFG-Bench', title: 'Beyond Description: Cognitively Benchmarking Fine-Grained Action for Embodied Agents', url: 'https://arxiv.org/abs/2511.18685',
    en: { insight: 'CFG-Bench examines fine-grained physical interactions, temporal relations, intentions, and judgments in action videos.', question: 'Which reasoning failure would turn a plausible description into a wrong physical action?', detail: 'The benchmark goes beyond naming an action to examining the physical and cognitive knowledge behind it.', connection: 'Move from checking visual evidence to asking whether it supports the right action.' },
    zh: { insight: 'CFG-Bench 从细粒度动作视频中考察物理交互、时间关系、意图理解与评价判断。', question: '哪种推理失误会让看似合理的描述变成错误的物理动作？', detail: '基准不仅要求说出动作名称，还考察动作背后的物理知识与认知理解。', connection: '从核查视觉证据，进一步追问这些证据是否支持正确行动。' } },
  lagen: { name: 'LaGen', title: 'Towards Autoregressive LiDAR Scene Generation', url: 'https://arxiv.org/abs/2511.21256',
    en: { insight: 'LaGen generates LiDAR scenes over time, using object-level conditioning to support interactive simulation.', question: 'How does control remain consistent as the generated sequence grows longer?', detail: 'Bounding-box conditioning and scene decoupling help control generated objects and reduce accumulated error.', connection: 'Action reasoning needs a world that responds; long-horizon generation exposes the cost of accumulated errors.' },
    zh: { insight: 'LaGen 随时间生成 LiDAR 场景，通过物体级条件支持交互式仿真。', question: '生成序列越来越长时，控制如何保持一致？', detail: '边界框条件与场景解耦帮助控制生成物体，并减轻误差累积。', connection: '行动推理需要会响应的世界；长程生成让累积误差的影响更加具体。' } },
  city: { name: '360CityArena', title: 'A Realistic Virtual Urban Navigation Benchmark for Embodied Agents', url: 'https://arxiv.org/abs/2608.08814',
    en: { insight: '360CityArena evaluates embodied navigation and spatial reasoning in realistic panoramic urban environments.', question: 'How can an agent recognize when its remembered route no longer matches the current view?', detail: 'Localization, landmark search, path planning, and spatial reasoning are evaluated within panoramic city environments.', connection: 'The full chain connects observing clues, retaining context, and choosing actions as the surroundings change.' },
    zh: { insight: '360CityArena 在真实感的全景城市环境中评估具身导航与空间推理。', question: '当记忆中的路线与当前视野不再一致，智能体如何发现？', detail: '定位、地标搜索、路径规划和空间推理在全景城市环境中得到评估。', connection: '这一整条线索把观察证据、保留上下文和随环境变化选择行动连接起来。' } }
}
const words = {
  en: { connected: 'ECCV · GLASSES CONNECTED', quiet: 'Quiet mode', panel: 'Glasses', walk: 'Walk', stop: 'Stop', explore: 'Back to exploring',
    title: 'A conference that stays with you.', objective: 'Start at Booth 44. Explore five posters in any order. Pause and look to let your glasses notice a paper.',
    inspecting: 'Inspect the poster detail', inspectHint: 'Close in on the highlighted poster and adjust your view. A new observation needs a real change in viewpoint.',
    visit: 'VISIT', seen: 'seen this visit', card: 'Poster', memory: 'Memory', trace: 'Framework', report: 'Journey',
    noCard: 'No poster observed yet.', noCardText: 'Walk toward a poster, face it, and pause for a moment. Passing by or looking through a wall does not create evidence.',
    authored: 'Scripted research aid · questions are authored prompts, not quotations or live ASR.', source: 'Paper source', observed: 'Observed this visit', historical: 'From an earlier visit · not checked this visit',
    insight: 'Key insight', question: 'A question to take with you', carriedQuestion: 'Question retained from an earlier visit.', connection: 'Across your visit', next: 'Next poster',
    revealQuestion: 'Prepare a question', revealConnection: 'Connect this visit', revealNext: 'Suggest a next stop',
    inspect: 'Inspect a detail', inspected: 'Detail observed at close range', inspectPending: 'Inspection requested. Approach and look at the poster.',
    useful: 'Useful', later: 'Later', feedback: 'Your choice is remembered.', savedUseful: 'Marked useful', savedLater: 'Saved for later',
    showCard: 'Review poster', showReport: 'Review your journey at Booth 44', dwell: 'Hold your view',
    more: 'Keep exploring or return to Booth 44 for your journey report.', route: 'A suggestion based on this visit. You choose where to go.',
    focus: 'Carry forward your question about evidence and uncertainty.', focusEmbodied: 'Look for how observations change a later action.',
    interests: 'What should your glasses focus on?', evidence: 'Evidence & uncertainty', embodied: 'Embodied action',
    quietLabel: 'Fewer interruptions', quietText: 'Keep optional suggestions quiet while I explore.',
    local: 'Saved only in this browser. Previous observations remain marked as historical until you look again.',
    traceTitle: 'Your actual playthrough', traceText: 'Five channels link observation, memory, and action. This trace records your choices; it does not claim model training or validated self-evolution.',
    sensing: 'Visible evidence', remembering: 'Context retained', acting: 'You choose',
    reportTitle: 'Your conference journey', reportText: 'Review only the posters you actually observed and the choices you made. Export creates a local HTML file.',
    reportEmpty: 'Explore at least one poster before making a report.', reportAtBooth: 'Return to Booth 44 and look at the report station to preview your report.',
    download: 'Save this report as HTML', downloaded: 'Report download started.', noEmail: 'Nothing is emailed or uploaded.',
    controls: 'WASD move · R walk / stop · drag / mouse to look · E interact · H glasses', mobile: 'Use the movement controls; tap a nearby prompt to interact.',
    simulation: 'SCRIPTED SIMULATION', boundary: 'Based on the EgoPoster workflow. Condensed exhibition layout; no camera, microphone, or live AI model.',
    logs: { arrived: 'Entered the ECCV experience. Posters must be observed before they become evidence.', recalled: 'Recalled prior visits and choices. Historical poster observations are not treated as checked today.', observed: 'A visible poster remained in view long enough to retain its identity.', focus: 'Retained interests and earlier questions guide what to look for at this poster.', opened: 'Opened a research aid for a poster you observed.', question: 'Prepared an authored question from the stored poster context.', connected: 'Connected this paper with context already retained in the visit.', recommended: 'Suggested an unvisited poster using the current visit context.', inspect: 'Requested a closer look to acquire additional scene evidence.', detail: 'A changed viewpoint and close, unobstructed view confirmed the requested detail.', useful: 'You marked this poster useful; the feedback was saved.', later: 'You saved this poster for later; the feedback was saved.', interest: 'You explicitly changed the focus for subsequent observations.', quiet: 'You paused optional hints; the preference was saved.', resumed: 'You resumed optional hints; the preference was saved.', report: 'Previewed a journey built from your observed posters and recorded choices.', download: 'You confirmed a local HTML report download.' } },
  zh: { connected: 'ECCV · 眼镜已连接', quiet: '安静模式', panel: '眼镜面板', walk: '行走', stop: '停止', explore: '继续探索',
    title: '参会结束，线索还在。', objective: '从 44 号展位出发，自由探索五张海报。停下来注视，眼镜才会把论文加入这次经历。',
    inspecting: '再看清海报中的细节', inspectHint: '靠近这张海报并调整视角。新的观察需要你真正改变观看位置或方向。',
    visit: '访问', seen: '张 · 本次已观察', card: '海报', memory: '记忆', trace: 'Framework', report: '旅程',
    noCard: '还没有观察到海报。', noCardText: '走近一张海报、面向它并稍作停留。仅仅路过或隔墙观看不会产生证据。',
    authored: '脚本化研究辅助 · 问题为编排提示，不是作者原话或实时语音转写。', source: '论文来源', observed: '本次已观察', historical: '来自之前的访问 · 本次尚未核查',
    insight: '关键观点', question: '带着一个问题继续看', carriedQuestion: '这个问题保留自之前的访问。', connection: '这次探索中的关联', next: '下一张海报',
    revealQuestion: '准备一个问题', revealConnection: '联系已有上下文', revealNext: '建议下一站',
    inspect: '近看一个细节', inspected: '已近距离观察细节', inspectPending: '已请求补充观察。请靠近并看向海报。',
    useful: '有帮助', later: '稍后再看', feedback: '已记住你的选择。', savedUseful: '已标记有帮助', savedLater: '已保存稍后再看',
    showCard: '查看海报卡片', showReport: '在 44 号展位回顾旅程', dwell: '保持注视',
    more: '你可以继续自由探索，也可以回到 44 号展位生成旅程报告。', route: '这是根据本次经历给出的建议，下一步仍由你决定。',
    focus: '带着之前关于证据与不确定性的问题继续观察。', focusEmbodied: '关注当前观察如何影响之后的行动。',
    interests: '希望眼镜重点关注什么？', evidence: '证据与不确定性', embodied: '具身行动',
    quietLabel: '少打扰一些', quietText: '自由探索时，减少可选建议。',
    local: '只保存在此浏览器。上次的观察会标记为历史记忆，直到你重新看见。',
    traceTitle: '你实际触发的事件', traceText: '五条通道连接观察、记忆与行动。这里只记录你的操作，不代表模型训练或已验证的自我进化。',
    sensing: '可见证据', remembering: '持续上下文', acting: '由你决定',
    reportTitle: '你的参会旅程', reportText: '只整理你实际观察过的海报和真实做出的选择，导出后是本地 HTML 文件。',
    reportEmpty: '先探索至少一张海报，再来生成报告。', reportAtBooth: '回到 44 号展位并看向报告台，即可预览这次旅程。',
    download: '确认保存 HTML 报告', downloaded: '已发起报告下载。', noEmail: '不会发送邮件或上传。',
    controls: 'WASD 移动 · R 行走 / 停止 · 拖动 / 鼠标转头 · E 交互 · H 眼镜', mobile: '用屏幕控制探索，靠近后点击提示即可交互。',
    simulation: '脚本仿真', boundary: '参考 EgoPoster 工作流程，展厅经过缩编；不使用摄像头、麦克风或实时 AI 模型。',
    logs: { arrived: '进入 ECCV 体验，海报只有经过实际观察才能成为证据。', recalled: '调取以前的访问与选择，历史海报观察不会被视为今天已经核查。', observed: '一张可见海报在视野中稳定停留，身份被保存下来。', focus: '已保留的兴趣与之前的问题引导这张海报的观察重点。', opened: '为已经观察到的海报打开研究辅助卡片。', question: '根据已有海报上下文准备一个编排的研究问题。', connected: '把这篇论文与访问中已有的上下文联系起来。', recommended: '结合当前参观上下文，建议尚未观察的下一张海报。', inspect: '请求近距离查看，主动获得额外的场景证据。', detail: '改变视角后，在无遮挡的近距离视野中确认了请求的细节。', useful: '你将这张海报标记为有帮助，反馈已保存。', later: '你选择稍后再看这张海报，反馈已保存。', interest: '你主动修改了后续观察的重点。', quiet: '你暂停了可选提示，偏好已保存。', resumed: '你恢复了可选提示，偏好已保存。', report: '根据实际观察的海报与已记录的选择预览旅程。', download: '你确认将 HTML 报告下载到本地。' } }
}

function language (): Language { return new URLSearchParams(location.search).get('lang') === 'zh' ? 'zh' : 'en' }
const emptyCard = (): Card => ({ seenVisit: 0, firstSeen: 0, lastSeen: 0, stage: 0, detailVisit: 0, questionVisit: 0, feedback: '' })
function readMemory () {
  const fallback = { visits: 0, quiet: false, interest: '' as '' | 'evidence' | 'embodied', cards: {} as Partial<Record<EccvPosterId, Card>>, journal: [] as Entry[] }
  try {
    const saved = JSON.parse(localStorage.getItem(MEMORY_KEY) ?? 'null')
    if (!saved || !Array.isArray(saved.journal)) return fallback
    const cards: Partial<Record<EccvPosterId, Card>> = {}
    for (const id of IDS) {
      const value = saved.cards?.[id]
      if (!value || !Number.isFinite(value.firstSeen)) continue
      cards[id] = { ...emptyCard(), firstSeen: value.firstSeen, lastSeen: Number(value.lastSeen) || value.firstSeen, seenVisit: Number(value.seenVisit) || 0, stage: Math.max(0, Math.min(4, Number(value.stage) || 0)), detailVisit: Number(value.detailVisit) || 0, questionVisit: Number(value.questionVisit) || (Number(value.stage) >= 2 ? Number(value.seenVisit) || 0 : 0), feedback: ['useful', 'later'].includes(value.feedback) ? value.feedback : '' }
    }
    return { visits: Number(saved.visits) || 0, quiet: saved.quiet === true, interest: ['evidence', 'embodied'].includes(saved.interest) ? saved.interest as 'evidence' | 'embodied' : '', cards, journal: saved.journal.filter((entry: Entry) => entry && Object.prototype.hasOwnProperty.call(words.en.logs, entry.code) && Number.isFinite(entry.time) && Number.isFinite(entry.visit) && (!entry.poster || IDS.includes(entry.poster))).slice(-100) as Entry[] }
  } catch { return fallback }
}
export const eccvHudState = proxy({ ready: false, language: language(), visit: 1, quiet: false, walking: false, interest: '' as '' | 'evidence' | 'embodied', target: '' as '' | 'report' | EccvPosterId, lookingAt: '' as '' | EccvPosterId, dwell: 0, selected: '' as '' | EccvPosterId, pendingInspect: '' as '' | EccvPosterId, next: '' as '' | EccvPosterId, focusPoster: '' as '' | EccvPosterId, tab: 'card' as Tab, cards: {} as Partial<Record<EccvPosterId, Card>>, journal: [] as Entry[], reportVisit: 0, downloaded: false })
let activeBot: Bot | undefined
let scene: EccvSceneOptions | undefined
let cleanupPrevious: (() => void) | undefined
let inspectStart: { position: Position; yaw: number; pitch: number } | undefined
function persist () { try { localStorage.setItem(MEMORY_KEY, JSON.stringify({ visits: eccvHudState.visit, quiet: eccvHudState.quiet, interest: eccvHudState.interest, cards: eccvHudState.cards, journal: eccvHudState.journal.slice(-100) })) } catch {} }
function log (code: EventCode, channel: Channel, poster?: EccvPosterId, next?: EccvPosterId) {
  eccvHudState.journal.push({ code, channel, time: Date.now(), visit: eccvHudState.visit, ...(poster ? { poster } : {}), ...(next ? { next } : {}) })
  eccvHudState.journal = eccvHudState.journal.slice(-100)
  persist()
}
function stopMovement () { eccvHudState.walking = false; activeBot?.clearControlStates(); activeBot?.mouse?.buttons?.fill(false) }
function toggleWalking () {
  if (eccvHudState.walking) { stopMovement(); return }
  if (!activeBot || !eccvHudState.ready || !isGameActive(true) || document.hidden) return
  stopMovement(); eccvHudState.walking = true; activeBot.setControlState('forward', true)
}
function revealSelectedInsight () {
  const selected = eccvHudState.selected
  const card = selected ? eccvHudState.cards[selected] : undefined
  if (selected && card?.seenVisit === eccvHudState.visit && card.stage === 0) { card.stage = 1; log('opened', 'M → A', selected) }
}
export function openEccvPanel (tab: Tab = 'card') {
  if (!eccvHudState.ready) return
  if (tab === 'card') revealSelectedInsight()
  stopMovement(); eccvHudState.tab = tab; showModal({ reactType: MODAL }); document.exitPointerLock?.()
}
function closePanel (resume = true) {
  const modal = activeModalStack.find(entry => entry.reactType === MODAL)
  if (modal) hideModal(modal)
  stopMovement()
  if (resume) void pointerLock.requestPointerLock()
}
function visible (position: Position, distance = 7) { return !!activeBot && isAlwaysOnTargetVisible(activeBot, position, distance) }
function observe (id: EccvPosterId) {
  const existing = eccvHudState.cards[id]
  if (existing?.seenVisit === eccvHudState.visit) return
  const hadContext = Object.values(eccvHudState.cards).some(card => (card?.stage ?? 0) >= 2) || !!eccvHudState.interest
  eccvHudState.cards[id] = { ...(existing ?? emptyCard()), seenVisit: eccvHudState.visit, firstSeen: existing?.firstSeen || Date.now(), lastSeen: Date.now() }
  if (!eccvHudState.selected) eccvHudState.selected = id
  log('observed', 'S → M', id)
  if (hadContext) { eccvHudState.focusPoster = id; log('focus', 'M → S', id) }
}
function openCard (id: EccvPosterId) {
  const card = eccvHudState.cards[id]
  if (!card) return
  eccvHudState.selected = id
  if (card.seenVisit === eccvHudState.visit && card.stage < 1) { card.stage = 1; log('opened', 'M → A', id) }
  openEccvPanel('card')
}
function nextSuggestion (current: EccvPosterId): EccvPosterId | undefined {
  const offset = IDS.indexOf(current)
  return [...IDS.slice(offset + 1), ...IDS.slice(0, offset)].find(id => eccvHudState.cards[id]?.seenVisit !== eccvHudState.visit && eccvHudState.cards[id]?.feedback !== 'later')
}
function reveal () {
  const id = eccvHudState.selected
  if (!id) return
  const card = eccvHudState.cards[id]
  if (!card || card.seenVisit !== eccvHudState.visit || card.stage >= 4) return
  card.stage++
  if (card.stage === 1) log('opened', 'M → A', id)
  else if (card.stage === 2) { card.questionVisit = eccvHudState.visit; log('question', 'M → A', id) }
  else if (card.stage === 3) log('connected', 'M → A', id)
  else { const next = nextSuggestion(id); eccvHudState.next = next ?? ''; if (next) log('recommended', 'M → A', id, next); else persist() }
}
function requestInspection () {
  const id = eccvHudState.selected
  const entity = activeBot?.entity
  if (!id || !entity || eccvHudState.cards[id]?.seenVisit !== eccvHudState.visit) return
  inspectStart = { position: { x: entity.position.x, y: entity.position.y, z: entity.position.z }, yaw: entity.yaw, pitch: entity.pitch }
  eccvHudState.pendingInspect = id
  log('inspect', 'A → S', id)
  closePanel()
}
function feedback (id: EccvPosterId, choice: 'useful' | 'later') {
  const card = eccvHudState.cards[id]
  if (!card || card.feedback === choice) return
  card.feedback = choice
  log(choice, 'A → M', id)
}
function interact () {
  const target = eccvHudState.target
  if (!target) return
  if (target === 'report') {
    if (!scene || !visible(scene.reportPoint, 5)) return
    eccvHudState.reportVisit = eccvHudState.visit
    log('report', 'M → A')
    openEccvPanel('report')
  } else openCard(target)
}
function escapeHtml (value: string) { return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!) }
function downloadReport () {
  const state = eccvHudState
  if (state.reportVisit !== state.visit) return
  const observed = IDS.filter(id => state.cards[id]?.seenVisit === state.visit)
  if (!observed.length) return
  const text = words[state.language]
  log('download', 'A → M')
  const journal = state.journal.filter(entry => entry.visit === state.visit)
  const html = `<!doctype html><html lang="${state.language}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${text.reportTitle}</title><style>body{font:17px/1.7 system-ui,sans-serif;color:#213a39;background:#f6f8f4;max-width:850px;margin:50px auto;padding:0 26px}h1{font-size:38px;line-height:1.15}section{padding:22px;border:1px solid #d5e2da;border-radius:20px;background:white;margin:20px 0}small{color:#68766d}a{color:#405066}li{margin:12px 0}code{color:#764d46}</style><h1>${text.reportTitle}</h1><p>ECCV · EgoPoster · ${text.visit} ${state.visit}</p><small>${escapeHtml(text.boundary)}</small>${observed.map(id => { const paper = papers[id]; const copy = paper[state.language]; const card = state.cards[id]!; return `<section><h2>${paper.name}</h2><p>${escapeHtml(paper.title)}</p><p>${escapeHtml(copy.insight)}</p>${card.stage >= 2 ? `<p><strong>${text.question}:</strong> ${escapeHtml(copy.question)}</p>${card.questionVisit !== state.visit ? `<small>${text.carriedQuestion}</small>` : ''}` : ''}${card.detailVisit === state.visit ? `<p><strong>${text.inspected}:</strong> ${escapeHtml(copy.detail)}</p>` : ''}${card.feedback ? `<p>${card.feedback === 'useful' ? text.savedUseful : text.savedLater}</p>` : ''}<small>${text.authored}</small><p><a href="${paper.url}">${text.source}</a></p></section>` }).join('')}<h2>${text.traceTitle}</h2><p>${text.traceText}</p><ol>${journal.map(entry => `<li><code>${entry.channel}</code> ${escapeHtml(text.logs[entry.code])}${entry.poster ? ` <strong>${papers[entry.poster].name}</strong>` : ''}${entry.next ? ` → ${papers[entry.next].name}` : ''}</li>`).join('')}</ol><p>${text.noEmail}</p></html>`
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `always-on-eccv-visit-${state.visit}.html`; document.body.appendChild(anchor); anchor.click(); anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  state.downloaded = true
}

/** Attach to the player's real pose and world after the local server finishes loading. */
export function setupEccvDemo (player: Bot, options: EccvSceneOptions) {
  cleanupPrevious?.(); activeBot = player; scene = options
  const memory = readMemory()
  Object.assign(eccvHudState, { ready: true, language: language(), visit: memory.visits + 1, quiet: memory.quiet, interest: memory.interest, walking: false, cards: memory.cards, journal: memory.journal, selected: '', target: '', lookingAt: '', dwell: 0, pendingInspect: '', next: '', focusPoster: '', reportVisit: 0, downloaded: false, tab: 'card' })
  inspectStart = undefined
  log(memory.visits ? 'recalled' : 'arrived', 'M')
  let candidate: EccvPosterId | '' = ''; let since = 0; let detailSince = 0
  const abort = new AbortController()
  const observer = setInterval(() => {
    if (!isGameActive(true) || document.hidden) { candidate = ''; since = 0; detailSince = 0; eccvHudState.dwell = 0; return }
    const poster = options.posters.find(item => IDS.includes(item.id) && visible(item.position))
    eccvHudState.lookingAt = poster?.id ?? ''
    const moving = Math.hypot(player.entity?.velocity?.x ?? 0, player.entity?.velocity?.z ?? 0) > 0.04
    if (poster && !moving) {
      if (candidate !== poster.id) { candidate = poster.id; since = Date.now() }
      const alreadySeen = eccvHudState.cards[poster.id]?.seenVisit === eccvHudState.visit
      eccvHudState.dwell = alreadySeen ? 1 : Math.min(1, (Date.now() - since) / 1500)
      if (!alreadySeen && Date.now() - since >= 1500) observe(poster.id)
      eccvHudState.target = eccvHudState.cards[poster.id]?.seenVisit === eccvHudState.visit ? poster.id : ''
    } else { candidate = ''; since = 0; eccvHudState.dwell = 0; eccvHudState.target = visible(options.reportPoint, 5) ? 'report' : '' }
    const inspecting = options.posters.find(item => item.id === eccvHudState.pendingInspect)
    const entity = player.entity
    if (inspecting && inspectStart && entity) {
      const moved = Math.hypot(entity.position.x - inspectStart.position.x, entity.position.z - inspectStart.position.z) > 0.45
      const turned = Math.abs(entity.yaw - inspectStart.yaw) > 0.12 || Math.abs(entity.pitch - inspectStart.pitch) > 0.12
      if ((moved || turned) && visible(inspecting.detailPosition ?? inspecting.position, 3.8)) {
        if (!detailSince) detailSince = Date.now()
        if (Date.now() - detailSince >= 850) {
          const card = eccvHudState.cards[inspecting.id]
          if (card) { card.detailVisit = eccvHudState.visit; log('detail', 'S → M', inspecting.id) }
          eccvHudState.pendingInspect = ''; inspectStart = undefined; detailSince = 0
        }
      } else detailSince = 0
    }
  }, 120)
  document.addEventListener('keydown', event => {
    const element = event.target as HTMLElement
    if (element?.closest('input,textarea,[contenteditable="true"]') || event.repeat) return
    if (eccvHudState.walking && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyE', 'KeyH', 'Escape'].includes(event.code)) stopMovement()
    if (event.code === 'KeyR' && isGameActive(true)) { event.preventDefault(); event.stopImmediatePropagation(); toggleWalking() }
    else if (event.code === 'KeyH' && (isGameActive(true) || activeModalStack.at(-1)?.reactType === MODAL)) { event.preventDefault(); event.stopImmediatePropagation(); if (activeModalStack.at(-1)?.reactType === MODAL) closePanel(); else openEccvPanel() }
    else if (event.code === 'KeyE' && isGameActive(true) && eccvHudState.target) { event.preventDefault(); event.stopImmediatePropagation(); interact() }
  }, { capture: true, signal: abort.signal })
  window.addEventListener('blur', stopMovement, { signal: abort.signal })
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopMovement() }, { signal: abort.signal })
  const unsubscribeModal = subscribe(activeModalStack, () => { if (activeModalStack.length) stopMovement() })
  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true; clearInterval(observer); abort.abort(); unsubscribeModal(); stopMovement(); player.removeListener('end', cleanup); eccvHudState.ready = false; closePanel(false); activeBot = undefined; scene = undefined
  }
  player.once('end', cleanup); cleanupPrevious = cleanup
  return cleanup
}

export default function EccvHud () {
  const state = useSnapshot(eccvHudState)
  const { currentTouch } = useSnapshot(miscUiState)
  const panelOpen = useIsModalActive(MODAL)
  const pauseOpen = useIsModalActive('pause-screen')
  const panelRef = useRef<HTMLDivElement>(null)
  const text = words[state.language]
  useEffect(() => {
    if (!state.ready || !pauseOpen) return
    const modal = activeModalStack.find(entry => entry.reactType === 'pause-screen')
    if (modal) hideModal(modal)
    openEccvPanel()
  }, [state.ready, pauseOpen])
  useEffect(() => { if (panelOpen) panelRef.current?.focus() }, [panelOpen])
  if (!state.ready) return null
  const today = IDS.filter(id => state.cards[id]?.seenVisit === state.visit)
  const selected = state.selected
  const card = selected ? state.cards[selected] : undefined
  const paper = selected ? papers[selected] : undefined
  const copy = paper?.[state.language]
  const verified = card?.seenVisit === state.visit
  const suggested = selected ? nextSuggestion(selected) : undefined
  const toggleQuiet = () => { eccvHudState.quiet = !state.quiet; log(eccvHudState.quiet ? 'quiet' : 'resumed', 'A → M') }
  const setLanguage = (value: Language) => { eccvHudState.language = value; const url = new URL(location.href); url.searchParams.set('lang', value); history.replaceState(null, '', url) }
  const heading = state.tab === 'report' ? text.reportTitle : state.tab === 'trace' ? text.traceTitle : state.tab === 'memory' ? text.memory : paper?.name ?? text.title
  return <div className='ao-glasses eccv-glasses' lang={state.language === 'zh' ? 'zh-CN' : 'en'}>
    <div className='ao-glasses-rim' aria-hidden='true' />
    <header className='ao-hud-top'>
      <button className='ao-brand ao-interactive' onClick={() => openEccvPanel()} aria-label={text.panel}><svg viewBox='0 0 34 18' aria-hidden='true'><path d='M2 6h3m24 0h3M5 5h9l1 7H7L5 5Zm15 0h9l-2 7h-8l1-7ZM15 7h4' /></svg><span>ALWAYS ON<small><i />{state.quiet ? text.quiet : text.connected}</small></span></button>
      <div className='ao-hud-tools ao-interactive'><button className='ao-panel-button ao-walk-button' aria-pressed={state.walking} disabled={panelOpen} onClick={toggleWalking}>{state.walking ? text.stop : text.walk}<kbd>R</kbd></button><div className='ao-language' aria-label='Language'><button aria-pressed={state.language === 'en'} onClick={() => setLanguage('en')}>EN</button><button aria-pressed={state.language === 'zh'} onClick={() => setLanguage('zh')}>中</button></div><button className='ao-panel-button' aria-label={text.panel} onClick={() => openEccvPanel()}><span className='ao-grid-icon' aria-hidden='true'>▦</span><span>{text.panel}</span><kbd>H</kbd></button></div>
    </header>
    {!panelOpen && !state.quiet && <button className='ao-mission eccv-mission ao-interactive' onClick={() => openEccvPanel()}><span className='ao-eyebrow'>ECCV / BOOTH 44 <span>·</span> {today.length}/5 {text.seen}</span><strong>{state.pendingInspect ? text.inspecting : text.title}</strong><span>{state.pendingInspect ? `${papers[state.pendingInspect].name}: ${text.inspectHint}` : today.length ? text.more : text.objective}</span><span className='ao-mission-progress'>{IDS.map(id => <i key={id} className={state.cards[id]?.seenVisit === state.visit ? 'is-active' : ''} />)}</span></button>}
    {!panelOpen && state.lookingAt && <div className='eccv-station'><span>{papers[state.lookingAt].name}</span><small>{state.dwell < 1 ? text.dwell : text.observed}</small><i style={{ '--eccv-dwell': `${state.dwell * 100}%` } as CSSProperties} /></div>}
    {!panelOpen && !!state.focusPoster && state.focusPoster === state.lookingAt && !state.quiet && <div className='eccv-focus'><b>M → S</b>{state.interest === 'embodied' ? text.focusEmbodied : text.focus}</div>}
    {!panelOpen && state.target && <button className='ao-interact ao-interactive' onClick={interact}><kbd>{currentTouch ? '↗' : 'E'}</kbd>{state.target === 'report' ? text.showReport : `${papers[state.target].name} · ${text.showCard}`}<span>↗</span></button>}
    {!panelOpen && <div className='ao-bottom-note'><span>{text.simulation}</span><span>{currentTouch ? text.mobile : text.controls}</span></div>}
    {panelOpen && <div className='ao-panel-layer ao-interactive' onPointerDown={event => event.stopPropagation()}><div className='ao-panel eccv-panel' ref={panelRef} role='dialog' aria-modal='true' aria-label={text.panel} tabIndex={-1} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closePanel(false) }
      if (event.key === 'Tab') {
        const focusable = [...(panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),[href],[tabindex="0"]') ?? [])]; const first = focusable[0]; const last = focusable.at(-1)
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) { event.preventDefault(); last?.focus() } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }}>
      <div className='ao-panel-heading'><div><span className='ao-eyebrow'>ECCV / EGOPOSTER · {text.visit} {state.visit}</span><h2>{heading}</h2></div><button className='ao-close' aria-label={text.explore} onClick={() => closePanel()}>×</button></div>
      <div className='ao-tabs' role='tablist'>{(['card', 'memory', 'trace', 'report'] as Tab[]).map(tab => <button key={tab} role='tab' aria-selected={state.tab === tab} onClick={() => { eccvHudState.tab = tab; if (tab === 'card') revealSelectedInsight() }}>{text[tab]}</button>)}</div>
      <div className='ao-panel-content' role='tabpanel'>
        {state.tab === 'card' && (!paper || !card || !copy || !selected ? <><h3>{text.noCard}</h3><p className='ao-lead'>{text.noCardText}</p></> : <>
          <span className={`eccv-status ${verified ? 'is-verified' : ''}`}>{verified ? text.observed : text.historical}</span><p className='eccv-paper-title'>{paper.title}</p>
          {state.focusPoster === selected && <p className='eccv-context-focus'><b>M → S</b> {state.interest === 'embodied' ? text.focusEmbodied : text.focus}</p>}
          {card.stage >= 1 && <section className='eccv-card-section'><span className='ao-module ao-s'>S</span><div><h3>{text.insight}</h3><p>{copy.insight}</p></div></section>}
          {card.stage >= 2 && <section className='eccv-card-section'><span className='ao-module ao-a'>A</span><div><h3>{text.question}</h3><p>{copy.question}</p>{card.questionVisit !== state.visit && <small className='eccv-carried'>{text.carriedQuestion}</small>}</div></section>}
          {card.stage >= 3 && <section className='eccv-card-section'><span className='ao-module ao-m'>M</span><div><h3>{text.connection}</h3><p>{selected === 'omnimap' && !state.cards.gaga ? (state.language === 'zh' ? '把地图中的可见证据与文字线索比较，可以继续检验推理依据。' : 'Comparing visible map evidence with text clues helps examine what supports an answer.') : copy.connection}</p></div></section>}
          {card.stage >= 4 && <section className='eccv-next'><span className='ao-eyebrow'>M → A / {text.next}</span><strong>{suggested ? papers[suggested].name : 'Booth 44'}</strong><p>{suggested ? text.route : text.more}</p></section>}
          {card.detailVisit > 0 && <section className='ao-notice'><span className='ao-eyebrow'>{card.detailVisit === state.visit ? text.inspected : text.historical}</span><p>{copy.detail}</p></section>}
          {verified && card.stage < 4 && <button className='ao-primary' onClick={reveal}>{card.stage < 2 ? text.revealQuestion : card.stage === 2 ? text.revealConnection : text.revealNext}<span>→</span></button>}
          {verified && card.detailVisit !== state.visit && <button className='eccv-outline' onClick={requestInspection}>{state.pendingInspect === selected ? text.inspectPending : text.inspect} <span>A → S</span></button>}
          <div className='eccv-feedback'><button aria-pressed={card.feedback === 'useful'} onClick={() => feedback(selected, 'useful')}>{text.useful}</button><button aria-pressed={card.feedback === 'later'} onClick={() => feedback(selected, 'later')}>{text.later}</button>{card.feedback && <small>{text.feedback}</small>}</div>
          <p className='eccv-disclosure'>{text.authored} <a href={paper.url} target='_blank' rel='noreferrer'>{text.source} ↗</a></p>
        </>)}
        {state.tab === 'memory' && <><h3>{text.interests}</h3><div className='eccv-interest'>{(['evidence', 'embodied'] as const).map(interest => <button key={interest} aria-pressed={state.interest === interest} onClick={() => { if (state.interest !== interest) { eccvHudState.interest = interest; log('interest', 'A → M') } }}>{text[interest]}</button>)}</div><div className='eccv-memory-list'>{IDS.filter(id => state.cards[id]).map(id => <button key={id} onClick={() => openCard(id)}><strong>{papers[id].name}</strong><span>{state.cards[id]?.seenVisit === state.visit ? text.observed : text.historical}</span>{state.cards[id]?.feedback && <small>{state.cards[id]?.feedback === 'useful' ? text.savedUseful : text.savedLater}</small>}</button>)}</div><div className='ao-preference'><div><strong>{text.quietLabel}</strong><p>{text.quietText}</p></div><button className={`ao-toggle ${state.quiet ? 'is-on' : ''}`} role='switch' aria-checked={state.quiet} aria-label={text.quietLabel} onClick={toggleQuiet}><i /></button></div><p className='ao-footnote'>{text.local}</p></>}
        {state.tab === 'trace' && <><p className='ao-footnote'>{text.traceText}</p><div className='ao-module-legend'><span><i className='ao-s'>S</i>{text.sensing}</span><span><i className='ao-m'>M</i>{text.remembering}</span><span><i className='ao-a'>A</i>{text.acting}</span></div><ol className='ao-timeline'>{[...state.journal].reverse().slice(0, 40).map((entry, index) => <li key={`${entry.time}-${index}`}><div><span>{entry.channel}</span><time>{text.visit} {entry.visit} · {new Date(entry.time).toLocaleTimeString(state.language === 'zh' ? 'zh-CN' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}</time></div><p>{text.logs[entry.code]} {entry.poster && <strong>{papers[entry.poster].name}</strong>}{entry.next && ` → ${papers[entry.next].name}`}</p></li>)}</ol></>}
        {state.tab === 'report' && <>{state.reportVisit !== state.visit ? <p className='ao-lead'>{text.reportAtBooth}</p> : <><p className='ao-lead'>{today.length ? text.reportText : text.reportEmpty}</p><div className='eccv-report-list'>{today.map(id => <section key={id}><span className='eccv-status is-verified'>{text.observed}</span><h3>{papers[id].name}</h3><p>{papers[id][state.language].insight}</p>{(state.cards[id]?.stage ?? 0) >= 2 && <p><strong>{text.question}: </strong>{papers[id][state.language].question}{state.cards[id]?.questionVisit !== state.visit && <small className='eccv-carried'>{text.carriedQuestion}</small>}</p>}{state.cards[id]?.feedback && <small>{state.cards[id]?.feedback === 'useful' ? text.savedUseful : text.savedLater}</small>}</section>)}</div>{today.length > 0 && <button className='ao-primary' onClick={downloadReport}>{text.download}<span>↓</span></button>}{state.downloaded && <p className='eccv-status is-verified' role='status'>{text.downloaded}</p>}<p className='ao-footnote'>{text.noEmail}</p></>}</>}
      </div><footer className='ao-panel-footer'><p><span>{text.simulation}</span>{text.boundary}</p><button className='ao-continue' onClick={() => closePanel()}>{text.explore}<span>↗</span></button></footer>
    </div></div>}
  </div>
}
