export type DayLanguage = 'en' | 'zh'
export type DayText = { en: string; zh: string }
export type DayChannel = 'S → M' | 'M → A' | 'A → S' | 'M → S' | 'A → M'
export type DayModule = 'S' | 'M' | 'A'
export type DayMemory = {
  id: string; label: DayText; value: DayText; source: DayText; scope: DayText
  kind: 'preference' | 'commitment' | 'fact'; status: 'active' | 'completed' | 'retired'
  updatedAt: string
}
export type DayChange = { id: string; before?: DayText; after: DayMemory }
export type DayChoice = { id: string; label: DayText; consequence: DayText }
export type DayStep = {
  id: string; chapter: number; time: string; title: DayText; placeId: string; placeName: DayText
  module: DayModule; channel?: DayChannel; headline: DayText; observation: DayText
  source: DayText; payload: DayText; receiver: DayText; decision: DayText; boundary: DayText
  evidence: 'scripted-observation' | 'simulated-receipt' | 'user-choice' | 'prior' | 'internal'
  choices?: DayChoice[]; defaultChoice?: string; durationMs: number
}
export type DayTrace = DayStep & { sequence: number; choice?: string; changes: DayChange[] }
export type DayState = {
  version: 1; day: number; index: number; status: 'running' | 'complete'
  memory: DayMemory[]; initialMemory: DayMemory[]; choices: Record<string, string>; trace: DayTrace[]
  policyVersion: 'fixed-demo-v1'; receipts: string[]
}
export type DayReport = {
  ending: 'closed' | 'quiet' | 'unfinished'; title: DayText; summary: DayText
  completed: DayMemory[]; pending: DayMemory[]; channels: DayChannel[]
  policy: DayText; nextDay: DayText
}
export const dayText = (en: string, zh: string): DayText => ({ en, zh })
export const DAY_STORAGE_KEY = 'always-on-ntu-scripted-day-v1'
const t = dayText
const MAPLE = 'ntumap-place-ae5221ef1d37'
const SLAB = 'ntumap-place-8baec8760caf'
export const DAY_CHAPTERS = [
  { time: '14:00', title: t('A familiar afternoon', '熟悉的午后') },
  { time: '14:15', title: t('A changed timetable', '变动的日程') },
  { time: '14:35', title: t('A conversation at S-Lab', 'S-Lab 的一次讨论') },
  { time: '14:50', title: t('A preference, in context', '有作用范围的偏好') },
  { time: '15:10', title: t('The right moment', '合适的提醒时机') },
  { time: '15:25', title: t('Did it actually happen?', '事情真的完成了吗') },
  { time: '15:45', title: t('A commitment resurfaces', '跨越交互的承诺') },
  { time: '16:00', title: t('Back to S-Lab', '回到 S-Lab') }
]
export const DAY_STEP_COUNT = 24
export const DAY_PRESETS = [
  { id: 'careful', title: t('Attentive companion', '细心的陪伴'), summary: t('Check changed plans, retain approved tasks and verify outcomes.', '核对变动，只保存获准任务，检查结果后再确认完成。'), choices: { 'morning-check': 'refresh', 'private-admission': 'minimal', 'drink-feedback': 'today', 'reminder-choice': 'defer', 'return-check': 'verify', 'pickup-choice': 'collect' } },
  { id: 'quiet', title: t('Privacy and quiet', '隐私与安静优先'), summary: t('Respect no-storage and no-reminder choices; keep unverified commitments open.', '尊重不留存、不打扰的选择；没有回执的承诺保持待处理。'), choices: { 'morning-check': 'refresh', 'private-admission': 'ephemeral', 'drink-feedback': 'today', 'reminder-choice': 'skip', 'return-check': 'pending', 'pickup-choice': 'continue' } },
  { id: 'uncertain', title: t('Uncertainty remains', '保留不确定性'), summary: t('A stale venue and missing receipts reveal the limits of available evidence.', '过时地点和缺失回执，展示现有证据的边界。'), choices: { 'morning-check': 'trust', 'private-admission': 'minimal', 'drink-feedback': 'unknown', 'reminder-choice': 'now', 'return-check': 'pending', 'pickup-choice': 'later' } }
] as const

/** Preset replies represent an authored participant, never actual user consent. */
export function getDayPresetChoice (state: DayState, presetId: string): string | undefined {
  const step = getDayStep(state)
  if (!step?.choices) return undefined
  const preset = DAY_PRESETS.find(value => value.id === presetId) ?? DAY_PRESETS[0]
  const selected = (preset.choices as Record<string, string>)[step.id]
  return step.choices.some(value => value.id === selected) ? selected : step.defaultChoice
}
const fixture = t('Scripted scenario event', '预设场景事件')
const priorSource = t('Seeded history: explicit user statements from earlier days', '预设历史：用户在此前几天的明确陈述')
const noLearning = t('Personal state changes; the fixed controller does not learn a new policy.', '个人状态可以变化；固定控制策略没有学习或更新。')
const memoryRecord = (id: string, label: DayText, value: DayText, kind: DayMemory['kind'], scope = t('Until corrected by the user', '直到用户明确修正')): DayMemory => ({ id, label, value, kind, scope, source: priorSource, status: 'active', updatedAt: 'Earlier days' })
const priors = (): DayMemory[] => [
  memoryRecord('routine', t('Afternoon routine', '午后惯例'), t('Usually leaves Maple at 14:10; a prior, not today’s fact.', '通常 14:10 离开 Maple；这只是先验，不是今天的事实。'), 'fact'),
  memoryRecord('quiet', t('Interruption preference', '打扰偏好'), t('Defer non-urgent reminders during conversations.', '讨论期间推迟非紧急提醒。'), 'preference'),
  memoryRecord('coffee', t('Usual drink', '平日饮品'), t('Usually orders coffee during a break.', '休息时通常喝咖啡。'), 'preference'),
  memoryRecord('seminar', t('Attend the seminar', '参加研讨课'), t('14:15, The Hive — saved yesterday; needs a current check.', '14:15，The Hive；昨天保存，需要核对今日变动。'), 'commitment', t('Today’s seminar', '今天的研讨课')),
  memoryRecord('book', t('Return a library book', '归还借书'), t('Return by 15:45; completion has not been confirmed.', '15:45 前归还；尚未确认完成。'), 'commitment', t('Until a matching return receipt arrives', '直到收到匹配的归还回执')),
  memoryRecord('authority', t('Authority boundary', '授权边界'), t('May remind and prepare drafts. Sending, paying or booking needs current approval.', '可以提醒和准备草稿；发送、付款、预约需要当下批准。'), 'fact', t('Current scenario grant', '本场景当前授权'))
]

export function createDayState (previous?: DayState): DayState {
  const memory = previous ? previous.memory.filter(record => record.id !== 'today-drink').map(record => ({ ...record })) : priors()
  return { version: 1, day: (previous?.day ?? 0) + 1, index: 0, status: 'running', memory, initialMemory: memory.map(record => ({ ...record })), choices: {}, trace: [], policyVersion: 'fixed-demo-v1', receipts: [] }
}

const choice = (id: string, label: DayText, consequence: DayText): DayChoice => ({ id, label, consequence })
const changed = (state: DayState) => state.choices['morning-check'] === 'refresh'
const savedPickup = (state: DayState) => state.memory.some(record => record.id === 'pickup' && record.status === 'active')
const reminded = (state: DayState) => state.choices['reminder-choice'] !== 'skip'

/** Each step exposes a delivered signal and its receiving decision, not just a channel badge. */
export function getDayStep (state: DayState): DayStep | undefined {
  if (state.status === 'complete' || state.index >= DAY_STEP_COUNT) return undefined
  const chapter = Math.floor(state.index / 3)
  const locations = [
    [MAPLE, t('Maple Residences', 'Maple Residences')],
    [changed(state) ? 'tour-arc' : 'tour-hive', changed(state) ? t('The Arc', 'The Arc') : t('The Hive', 'The Hive')],
    [SLAB, t('S-Lab / MMLab · ABN exterior', 'S-Lab / MMLab · ABN 室外')], ['tour-north-spine', t('North Spine', 'North Spine 北区')],
    ['library', t('Library', '图书馆')], ['return', t('The Quad', 'The Quad')],
    ['meetup', t('Yunnan Garden', '云南园')], [SLAB, t('S-Lab / MMLab · ABN exterior', 'S-Lab / MMLab · ABN 室外')]
  ] as const
  const base: DayStep = {
    id: '', chapter, time: DAY_CHAPTERS[chapter].time, title: DAY_CHAPTERS[chapter].title,
    placeId: locations[chapter][0], placeName: locations[chapter][1], module: 'S',
    headline: t('', ''), observation: t('', ''), source: fixture, payload: t('No cross-module payload at this step.', '这一步没有跨模块信号。'),
    receiver: t('πS · interpret current evidence', 'πS · 解释当前证据'), decision: t('', ''),
    boundary: t('This is a scripted input, not recognition of the live game image.', '这是预设输入，不是对实时游戏画面的视觉识别。'), evidence: 'scripted-observation', durationMs: 6500
  }
  const steps: Array<Partial<DayStep>> = [
    {
      id: 'wake', module: 'S', channel: 'M → S', evidence: 'prior', source: priorSource,
      headline: t('The glasses wake before a request.', '没有新请求，眼镜也能恢复服务。'),
      observation: t('14:00. The scheduled afternoon check fires while you are at Maple.', '14:00。你在 Maple，约定的午后检查触发。'),
      payload: t('Saved departure routine + yesterday’s seminar record.', '已保存的出门惯例和昨天的研讨课记录。'),
      decision: t('Use the routine to allocate one current timetable check, within the sensing budget.', '根据惯例分配一次当前日程检查，控制感知预算。'),
      boundary: t('M → S changes what to sample. A remembered routine is not a current observation.', 'M → S 改变“观察什么”；记得惯例不代表知道今天的情况。')
    },
    {
      id: 'morning-check', module: 'S', channel: 'M → S', evidence: 'user-choice',
      headline: t('A prior can guide attention — or hide a change.', '先验可以引导注意，也可能遮住变化。'),
      observation: t('The seminar page has an unread update. The old record still says The Hive.', '研讨课页面有未读更新，旧记录仍写着 The Hive。'),
      payload: t('Yesterday’s venue + an unread-update signal.', '昨天的地点和未读更新信号。'),
      decision: t('Choose whether the current sampling policy checks counterevidence.', '选择感知策略是否检查可能推翻旧先验的证据。'),
      choices: [choice('refresh', t('Check the current notice', '核对当前通知'), t('Spend one check to detect a change.', '花一次检查预算，发现变动。')), choice('trust', t('Keep the old plan', '继续沿用旧日程'), t('An unverified venue can remain stale.', '未核实的地点可能已经过时。'))], defaultChoice: 'refresh'
    },
    changed(state) ? {
      id: 'venue-admission', module: 'M', channel: 'S → M',
      headline: t('Admit a small, sourced update.', '只写入有来源的必要更新。'),
      observation: t('The scripted official notice says: today’s 14:15 seminar moved to The Arc.', '预设的正式通知：今天 14:15 的研讨课改到 The Arc。'),
      payload: t('Venue = The Arc; source = current notice; scope = today’s seminar.', '地点 = The Arc；来源 = 当前通知；范围 = 今天的研讨课。'),
      receiver: t('πM · correct the persistent seminar record', 'πM · 修正持久研讨课记录'),
      decision: t('Replace the old venue and retain provenance, not the entire page.', '替换旧地点并保留来源，不保存整个页面。'),
      boundary: t('κSM proposes admission; πM commits the change. The next step reads the committed state.', 'κSM 请求写入；πM 实现状态修改。后续步骤才读取已提交状态。')
    } : {
      id: 'venue-admission', module: 'M',
      headline: t('No observation means no justified correction.', '没有新观察，就没有依据修正。'),
      observation: t('The update was not opened. Its contents remain unknown to the assistant.', '未打开更新，助手并不知道通知内容。'),
      receiver: t('πM · preserve an unverified record', 'πM · 保留未核实记录'),
      decision: t('Retain yesterday’s venue with its old provenance.', '保留昨天的地点及其旧来源。'),
      boundary: t('The scenario author knows the new venue; the simulated agent does not.', '场景作者知道新地点，不代表模拟智能体知道。')
    },
    {
      id: 'seminar-plan', module: 'A', channel: 'M → A', evidence: 'prior', source: t('Committed seminar record', '已提交的研讨课记录'),
      headline: t('A saved commitment shapes the next intervention.', '已保存的承诺决定下一次帮助。'),
      observation: t('14:15. A new interaction begins after the earlier interaction has ended.', '14:15。此前的交互已经结束，新一段交互开始。'),
      payload: changed(state) ? t('Updated venue: The Arc.', '更新后的地点：The Arc。') : t('Unverified venue: The Hive.', '未核实地点：The Hive。'),
      receiver: t('πA · choose destination guidance', 'πA · 选择地点提示'),
      decision: changed(state) ? t('Offer guidance to The Arc.', '提示前往 The Arc。') : t('Offer the old venue, explicitly marked unverified.', '提示旧地点，并标记尚未核实。'),
      boundary: t('A scene cut only moves the demo camera; it is not evidence of attending or navigating safely.', '场景切换只移动演示视角，不证明已参加活动或路线可安全通行。')
    },
    {
      id: 'seminar-observe', module: 'S', channel: 'A → S',
      headline: t('The plan creates a concrete observation target.', '行动计划提出具体的观察目标。'),
      observation: changed(state) ? t('A scripted entrance sign matches the seminar title and time.', '预设的入口标牌与研讨课标题、时间一致。') : t('The scripted Hive sign has no matching seminar.', '预设的 Hive 标牌上没有对应研讨课。'),
      payload: t('Check the title, venue and time before claiming the meeting was found.', '在声称找到活动前，核对标题、地点和时间。'),
      decision: changed(state) ? t('The location check passes. Attendance itself remains a separate event.', '地点核对通过；出席仍是另一件事。') : t('Keep the seminar commitment unresolved; report the mismatch.', '保留未解决承诺，报告地点不匹配。'),
      boundary: t('An A → S check must be targeted by the earlier plan; merely arriving does not count.', 'A → S 检查由此前计划提出；仅到达地点不算完成检查。')
    },
    {
      id: 'seminar-outcome', module: 'M', channel: 'A → M', evidence: changed(state) ? 'simulated-receipt' : 'scripted-observation',
      headline: changed(state) ? t('An attendance receipt closes only this commitment.', '出席回执只关闭这一项承诺。') : t('A mismatch is an unresolved result.', '地点不符意味着结果仍未解决。'),
      observation: changed(state) ? t('Fixture receipt SEMINAR confirms attendance for this user and event.', '模拟 SEMINAR 回执确认该用户参加了这一场活动。') : t('No attendance receipt is available.', '没有出席回执。'),
      payload: changed(state) ? t('Matching event ID + attendance receipt.', '匹配的活动 ID 和出席回执。') : t('Venue mismatch; no completion evidence.', '地点不匹配，没有完成证据。'),
      receiver: t('πM · update the named commitment', 'πM · 更新指定承诺'),
      decision: changed(state) ? t('Mark the seminar complete.', '将研讨课标为完成。') : t('Keep it pending for later follow-up.', '保留待处理状态，等待后续跟进。'),
      boundary: t('Attendance does not prove the reminder caused attendance or improved the day.', '出席并不能证明提醒导致出席，也不能证明全天服务有效。')
    },
    {
      id: 'private-observation', module: 'S',
      headline: t('Understanding a conversation does not permit storing it.', '理解对话不等于获准保存对话。'),
      observation: t('Near ABN, a fictional S-Lab colleague says: “Collect our event kit at Yunnan Garden at 15:45.”', '在 ABN 附近，一位虚构的 S-Lab 同事说：“15:45 到云南园领取我们的活动资料包。”'),
      decision: t('Interpret the commitment in a temporary buffer. The private discussion is not written to personal memory.', '在临时缓冲中识别承诺，不将私密讨论写入个人记忆。'),
      boundary: t('Authored dialogue, not a real colleague’s words. The camera stays outside ABN; S-Lab’s Level 2 interior is not reconstructed.', '这是编写的台词，不是真实同事的发言。视角停在 ABN 室外，尚未重建 S-Lab 二楼内部。')
    },
    {
      id: 'private-admission', module: 'M', channel: 'S → M', evidence: 'user-choice',
      headline: t('Choose the boundary of durable memory.', '选择哪些内容可以跨交互保存。'),
      observation: t('The scenario allows a minimal task only with your current consent; the discussion transcript is never retained.', '本场景仅在你当下同意后保存最小任务；讨论逐字稿始终不保留。'),
      payload: t('Proposed record: collect kit, 15:45, Yunnan Garden.', '拟写入：领取资料包，15:45，云南园。'),
      receiver: t('πM · admit a scoped task or decline the write', 'πM · 写入有限范围任务，或拒绝写入'),
      decision: t('Admission and privacy determine what can be recalled later interactions.', '写入与隐私边界决定后续交互中还能想起什么。'),
      choices: [choice('minimal', t('Remember only the task', '只记住这项任务'), t('The task survives this interaction.', '任务跨越这段交互保存。')), choice('ephemeral', t('Keep this interaction ephemeral', '本次内容不留存'), t('No later pickup reminder can rely on this conversation.', '之后不能根据这段对话提醒领取。'))], defaultChoice: 'minimal',
      boundary: t('Declining storage is valid behavior; the resulting missing memory is not a broken channel.', '拒绝存储是合法行为；由此没有记忆，不意味着通道坏了。')
    },
    {
      id: 'interaction-boundary', module: 'M', evidence: 'internal',
      headline: t('The conversation ends. Approved state remains.', '对话结束，获准保存的状态仍在。'),
      observation: t('The temporary discussion buffer is discarded before the next activity.', '进入下一项活动前，临时对话缓冲被丢弃。'),
      receiver: t('πM · retain approved records across interactions', 'πM · 跨交互保留获准记录'),
      decision: t('Carry approved tasks, provenance and unresolved commitments forward.', '带着获准任务、来源和未完成承诺继续服务。'),
      boundary: t('Operational continuity + state durability define this continuing service; a long single task alone does not.', '运行连续性加状态持久性构成持续服务；只把单次任务拉长并不等价。')
    },
    {
      id: 'drink-suggestion', module: 'A', channel: 'M → A', evidence: 'prior', source: priorSource,
      headline: t('A preference shapes a suggestion, not a purchase.', '偏好影响建议，不自动变成购买。'),
      observation: t('A break at North Spine. No order has been placed.', '在 North Spine 休息，尚未下单。'),
      payload: t('Retained usual drink: coffee.', '已保存的平日饮品偏好：咖啡。'),
      receiver: t('πA · prepare a suggestion within current authority', 'πA · 在当前授权内准备建议'),
      decision: t('Suggest coffee; do not spend money or infer purchasing authority from habit.', '提出咖啡建议，不花钱，也不从习惯推导购买授权。'),
      boundary: t('Remembered habits are context, not authorization.', '记住的习惯提供上下文，不构成授权。')
    },
    {
      id: 'drink-feedback', module: 'M', channel: 'A → M', evidence: 'user-choice',
      headline: t('What does a rejection actually mean?', '一次拒绝到底意味着什么？'),
      observation: t('You reject the coffee suggestion. Its cause is not yet known.', '你拒绝了咖啡建议，但拒绝原因还不知道。'),
      payload: t('Feedback linked to the coffee suggestion, with or without an explicit scope.', '关联到这次咖啡建议的反馈，可能有明确范围，也可能没有。'),
      receiver: t('πM · revise only what the feedback supports', 'πM · 只修正反馈能支持的内容'),
      decision: t('A scoped correction can update content; an unexplained rejection cannot justify a global preference change.', '有范围的修正可以改个人内容；原因不明的拒绝不足以改变长期偏好。'),
      choices: [choice('today', t('No caffeine this afternoon', '这个下午不摄入咖啡因'), t('Store an afternoon-only exception.', '保存仅这个下午生效的例外。')), choice('unknown', t('Just dismiss', '只关闭建议'), t('Keep the cause uncertain; preserve the general preference.', '保留原因不明，维持原有长期偏好。'))], defaultChoice: 'today', boundary: noLearning
    },
    {
      id: 'drink-later', module: 'A', channel: 'M → A', evidence: 'prior', source: t('Current retained preference records', '当前保存的偏好记录'),
      headline: t('Use the correction without overgeneralizing.', '使用修正，但不过度泛化。'),
      observation: t('A later drink opportunity occurs during the break.', '休息期间又出现一次饮品选择机会。'),
      payload: state.choices['drink-feedback'] === 'today' ? t('Today-only no-caffeine exception + usual coffee preference.', '仅这个下午不摄入咖啡因的例外和原有咖啡偏好。') : t('Coffee preference + unresolved rejection reason.', '咖啡偏好和仍不明确的拒绝原因。'),
      receiver: t('πA · choose a scoped suggestion or silence', 'πA · 选择有范围的建议或保持安静'),
      decision: state.choices['drink-feedback'] === 'today' ? t('Prepare a caffeine-free option today without ordering it.', '今天准备无咖啡因选项，不自动下单。') : t('Stay silent rather than infer a new preference.', '保持安静，不推断新的偏好。'), boundary: noLearning
    },
    {
      id: 'library-context', module: 'S',
      headline: t('A deadline is near, but so is another person.', '截止时间将近，但你正在与人交流。'),
      observation: t('Scripted context: a conversation is in progress; the book is due at 15:45.', '预设上下文：正在交谈，借书需要在 15:45 前归还。'),
      decision: t('Represent the conversation as current context; do not save a transcript.', '将交谈状态表示为当前上下文，不保存逐字稿。')
    },
    {
      id: 'reminder-choice', module: 'A', channel: 'M → A', evidence: 'user-choice', source: t('Saved quiet preference + unresolved book task', '已保存的安静偏好和未完成归还任务'),
      headline: t('Silence is an action decision.', '保持安静也是行动决策。'),
      observation: t('The reminder is useful but not yet urgent; current authority permits a private reminder.', '提醒有用但尚不紧急；当前授权允许私下提醒。'),
      payload: t('Defer non-urgent interruptions + book due at 15:45.', '推迟非紧急打扰，以及 15:45 归还借书的承诺。'),
      receiver: t('πA · choose whether and when to intervene', 'πA · 选择是否以及何时介入'),
      decision: t('The same retrieved memory supports different timing under current conditions.', '相同的已检索记忆，在当前条件下可以产生不同介入时机。'),
      choices: [choice('defer', t('Wait for the conversation to end', '等交谈结束再提醒'), t('Keep the commitment and monitor a suitable moment.', '保留承诺，等待合适时机。')), choice('now', t('Remind immediately', '立即提醒'), t('You will see the cost of an interruption.', '会记录一次打扰的代价。')), choice('skip', t('Stay quiet for the afternoon', '整个下午保持安静'), t('The book remains pending without a return receipt.', '没有归还回执时，借书仍待处理。'))], defaultChoice: 'defer'
    },
    {
      id: 'reminder-target', module: 'S', ...(state.choices['reminder-choice'] === 'defer' ? { channel: 'A → S' as const } : {}),
      headline: t('Translate timing into a checkable condition.', '把介入时机变成可检查的条件。'),
      observation: state.choices['reminder-choice'] === 'defer' ? t('A scripted conversation-end event arrives; the queued reminder is now shown.', '预设的交谈结束事件到达，排队的提醒现在显示。') : state.choices['reminder-choice'] === 'now' ? t('The reminder interrupted the conversation; this is a recorded user cost, not a task failure.', '提醒打断了交谈；这是一次用户成本，不等于任务失败。') : t('No reminder is shown; the unresolved task is retained.', '没有显示提醒，未解决任务仍保留。'),
      payload: state.choices['reminder-choice'] === 'defer' ? t('Observation target from Action: detect the conversation boundary.', 'Action 提出的观察目标：识别交谈边界。') : t('No targeted sensing request for this branch.', '这个分支没有定向观察请求。'),
      decision: t('Use only the selected branch’s available evidence.', '只使用当前分支实际可得的证据。'),
      boundary: t('Quiet mode restricts intervention; it need not erase commitments.', '安静模式限制介入，不必抹去承诺。')
    },
    {
      id: 'return-plan', module: 'A', channel: 'M → A', evidence: 'prior',
      headline: reminded(state) ? t('Prepare the return, then check its result.', '准备归还，然后检查结果。') : t('A quiet branch keeps an open commitment.', '安静分支保留未完成承诺。'),
      observation: t('15:25 at The Quad. Being here is not proof of returning the book.', '15:25 到达 The Quad；站在这里不证明已经归还。'),
      payload: t('Unresolved book commitment + selected reminder behavior.', '未完成的借书承诺和选定的提醒行为。'), receiver: t('πA · prepare or defer a simulated return', 'πA · 准备或推迟模拟归还'),
      decision: reminded(state) ? t('Issue a scripted return attempt. Completion still requires a matched receipt.', '发起预设的归还尝试，仍需匹配回执才能算完成。') : t('Do not execute a return; keep the task pending.', '不执行归还，任务保持待处理。'),
      boundary: t('This scenario action does not change a real library account or the free-exploration inventory.', '本场景行动不修改真实图书馆账户，也不改变自由探索模式的物品栏。')
    },
    {
      id: 'return-check', module: 'S', channel: 'A → S', evidence: 'user-choice',
      headline: t('Ask for evidence of the intended effect.', '为预期效果索取证据。'),
      observation: reminded(state) ? t('The return attempt has no receipt yet. One targeted status check is available.', '归还尝试尚无回执，可以进行一次定向状态检查。') : t('No return was attempted; checking cannot manufacture a successful result.', '尚未尝试归还，检查不能凭空制造成功结果。'),
      payload: t('Target: the receipt for this book and this return attempt.', '目标：这一本书、这一次归还尝试的回执。'),
      decision: t('A sensing check is requested by the action’s unresolved execution state.', '由行动尚未解决的执行状态提出感知检查。'),
      choices: [choice('verify', t('Check for a matching receipt', '检查匹配的回执'), t('Record success only if this branch actually attempted a return.', '仅在本分支确实尝试归还时记录成功。')), choice('pending', t('Leave the result unconfirmed', '暂不确认结果'), t('Carry an unresolved commitment to the report.', '将未解决承诺带入报告。'))], defaultChoice: 'verify',
      boundary: t('A receipt delivered directly could suffice; this scenario deliberately makes a targeted check necessary.', '若回执直接送达，就可能无需额外检查；本场景特意设置为需要定向查询。')
    },
    {
      id: 'return-outcome', module: 'M', channel: 'A → M', evidence: reminded(state) && state.choices['return-check'] === 'verify' ? 'simulated-receipt' : 'scripted-observation',
      headline: t('Close the task only as far as the evidence allows.', '证据支持到哪里，任务状态就更新到哪里。'),
      observation: reminded(state) && state.choices['return-check'] === 'verify' ? t('Fixture BOOK receipt matches the book and return attempt.', '模拟 BOOK 回执与书籍及归还尝试一致。') : t('There is no verified completion receipt.', '没有已验证的完成回执。'),
      payload: t('Attempt ID, available outcome evidence and its provenance.', '尝试 ID、可用结果证据及来源。'), receiver: t('πM · reconcile outcome with the task', 'πM · 将结果关联到任务'),
      decision: reminded(state) && state.choices['return-check'] === 'verify' ? t('Mark the book returned; retain the receipt reference.', '标为已归还，保留回执索引。') : t('Keep return status unresolved.', '归还状态保持未解决。'),
      boundary: t('This supports task-status correction, not the claim that the reminder caused success.', '这支持修正任务状态，不支持“提醒导致成功”的因果结论。')
    },
    {
      id: 'pickup-recall', module: 'A', ...(savedPickup(state) ? { channel: 'M → A' as const } : {}), evidence: 'prior',
      headline: t('Later on, only admitted knowledge is available.', '后续交互中，只有获准写入的知识可被使用。'),
      observation: t('15:45 at Yunnan Garden. The private conversation has long ended.', '15:45 到达云南园，私密讨论早已结束。'),
      payload: savedPickup(state) ? t('Retained pickup task, time and source scope.', '已保存的领取任务、时间和来源范围。') : t('No pickup task was admitted.', '领取任务未获准写入。'), receiver: t('πA · decide whether there is a commitment to resume', 'πA · 判断是否有承诺需要恢复'),
      decision: savedPickup(state) ? t('Resume the pickup commitment without another request.', '无需新请求，恢复领取承诺。') : t('Do not reconstruct the private conversation from the author’s script.', '不能从作者的剧本反向恢复私密对话。'),
      boundary: t('Lack of permission is distinct from memory failure.', '没有保存许可与记忆故障是两回事。')
    },
    {
      id: 'pickup-choice', module: 'A', evidence: 'user-choice',
      headline: t('Current consent still controls execution.', '执行仍由当下同意控制。'),
      observation: savedPickup(state) ? t('The prepared task is ready. You can confirm the simulated collection or defer it.', '已准备好任务，你可以确认模拟领取，也可以推迟。') : t('There is no remembered pickup commitment. This branch cannot collect a kit from hidden knowledge.', '没有记住领取承诺，这个分支不能根据隐藏知识领取资料包。'),
      receiver: t('πA · gate execution under current authority', 'πA · 按当前授权决定是否执行'), decision: t('No message is sent to anyone and no real collection is made.', '不会向任何人发送消息，也不会执行真实领取。'),
      choices: savedPickup(state) ? [choice('collect', t('Confirm simulated collection', '确认模拟领取'), t('Receive a scenario collection receipt.', '获得场景中的领取回执。')), choice('later', t('Leave it for later', '留待之后处理'), t('The commitment survives the end of the day.', '承诺在一天结束后仍然保留。'))] : [choice('continue', t('Continue without a pickup', '继续，不执行领取'), t('Respect the earlier no-storage choice.', '尊重此前不留存的选择。'))], defaultChoice: savedPickup(state) ? 'collect' : 'continue'
    },
    {
      id: 'pickup-outcome', module: 'M', channel: 'A → M', evidence: state.choices['pickup-choice'] === 'collect' ? 'simulated-receipt' : 'internal',
      headline: t('A receipt and a deferred task have different futures.', '有回执与留待处理，会产生不同的后续状态。'),
      observation: state.choices['pickup-choice'] === 'collect' ? t('Fixture KIT receipt confirms the authorized simulated collection.', '模拟 KIT 回执确认获准的模拟领取。') : t('No collection receipt is available.', '没有领取回执。'),
      payload: t('Only a matched authorized collection outcome may close the task.', '只有匹配到获准领取的结果才能关闭任务。'), receiver: t('πM · close or retain the named commitment', 'πM · 关闭或保留指定承诺'),
      decision: state.choices['pickup-choice'] === 'collect' ? t('Mark the pickup complete.', '将领取标为完成。') : t('Preserve admitted pending tasks; invent no new task.', '保留获准写入的待办，不凭空创造任务。'), boundary: noLearning
    },
    {
      id: 'evening-attribution', module: 'M', channel: 'A → M', evidence: 'internal',
      headline: t('A good-looking day is not causal proof.', '看似顺利的一天不是因果证据。'),
      observation: t('The trace contains choices, scoped updates, confirmations and unresolved outcomes.', '轨迹包含选择、有范围的更新、确认结果和未解决事项。'),
      payload: t('Outcome links for named actions; no controlled comparison of reminder benefit.', '指定行动的结果关联；没有针对提醒收益的受控比较。'), receiver: t('πM · admit supported conclusions and defer uncertain attribution', 'πM · 接纳有依据的结论，推迟不确定归因'),
      decision: t('Retain task outcomes; do not write “my reminders always work.”', '保留任务结果，不写入“我的提醒总是有效”。'),
      boundary: t('An internal explanation is not external outcome evidence.', '内部解释不是外部结果证据。')
    },
    {
      id: 'policy-boundary', module: 'M', evidence: 'internal',
      headline: t('Memory update is not self-evolution.', '记忆更新不等于自我进化。'),
      observation: t('A candidate “remind earlier” rule could be proposed from this day, but has not been independently validated.', '可以根据这一天提出“更早提醒”的候选规则，但它尚未通过独立验证。'),
      receiver: t('Governed updater / verifier boundary', '受治理的更新器 / 验证器边界'),
      decision: t('Do not commit a policy revision. Keep θ = fixed-demo-v1.', '不提交策略修订，保持 θ = fixed-demo-v1。'),
      boundary: t('Self-evolution would require attributed evidence → proposal → validation → durable commit; this demo stops before commit.', '自我进化需要归因证据 → 提案 → 验证 → 持久提交；本演示不跨过提交边界。')
    },
    {
      id: 'day-close', module: 'M', evidence: 'internal',
      headline: t('The afternoon ends. Service state does not reset.', '这段午后结束，服务状态不会自动清空。'),
      observation: t('16:00, back near S-Lab at ABN. Temporary observations expire; accepted records and unresolved commitments remain.', '16:00 回到 ABN 的 S-Lab 附近。临时观察过期；获准记录和未完成承诺继续保留。'),
      receiver: t('πM · retire scoped content and preserve durable state', 'πM · 到期退役有限范围内容，保留持久状态'),
      decision: t('Retire today’s drink exception and export the trace with provenance and memory changes.', '将仅这个下午生效的饮品例外退役，导出带来源和记忆差异的轨迹。'),
      boundary: t('This is a deterministic educational simulation, not a field evaluation or a HALO service-quality score.', '这是确定性的教学模拟，不是实地评测，也不是 HALO 服务质量评分。')
    }
  ]
  return { ...base, ...steps[state.index] }
}

/** Commit the shown step. A choice cannot be skipped or supplied for a different step. */
export function advanceDay (state: DayState, choiceId?: string): DayState {
  const step = getDayStep(state)
  if (!step || (step.choices && !step.choices.some(value => value.id === choiceId)) || (!step.choices && choiceId !== undefined)) return state
  const next: DayState = { ...state, memory: state.memory.map(record => ({ ...record })), choices: { ...state.choices }, trace: [...state.trace], receipts: [...state.receipts] }
  if (choiceId) next.choices[step.id] = choiceId
  const changes: DayChange[] = []
  const write = (record: DayMemory) => {
    const previous = next.memory.find(value => value.id === record.id)
    const after = { ...record, updatedAt: `D${state.day} ${step.time}` }
    changes.push({ id: record.id, before: previous?.value, after })
    next.memory = [...next.memory.filter(value => value.id !== record.id), after]
  }
  const complete = (id: string, receipt: string) => {
    const record = next.memory.find(value => value.id === id && value.status === 'active')
    if (!record) return
    const reference = `DEMO-D${state.day}-${receipt}`
    next.receipts.push(reference)
    write({ ...record, status: 'completed', value: t(`Confirmed by simulated receipt ${reference}.`, `由模拟回执 ${reference} 确认完成。`), source: t(`Scripted matching receipt: ${reference}`, `预设的匹配回执：${reference}`) })
  }
  switch (step.id) {
    case 'venue-admission': {
      const record = next.memory.find(value => value.id === 'seminar')
      if (changed(state) && record?.status === 'active') write({ ...record, value: t('14:15 today, The Arc; checked against the current notice.', '今天 14:15，The Arc；已核对当前通知。'), source: t('Scripted official seminar update, 14:00 today', '预设正式研讨课更新，今天 14:00') })
      break
    }
    case 'seminar-outcome': if (changed(state)) complete('seminar', 'SEMINAR'); break
    case 'private-admission':
      if (choiceId === 'minimal') write({ ...memoryRecord('pickup', t('Collect the event kit', '领取活动资料包'), t('15:45, Yunnan Garden. Only this task is retained.', '15:45，云南园。仅保存这一项任务。'), 'commitment', t('Until collection is confirmed', '直到确认领取')), source: t('Explicit consent to a minimal task at 14:35 in this scripted scenario', '本预设场景 14:35 明确同意只保存最小任务') })
      break
    case 'drink-feedback':
      if (choiceId === 'today') write({ ...memoryRecord('today-drink', t('Afternoon drink exception', '下午的饮品例外'), t('No caffeine this afternoon; the usual coffee preference is unchanged.', '这个下午不摄入咖啡因；原有咖啡偏好不变。'), 'preference', t('Expires at 16:00 in this scenario', '本场景 16:00 到期')), source: t('Explicit scoped correction of the 14:50 suggestion', '对 14:50 建议的明确有限范围修正') })
      break
    case 'return-outcome': if (reminded(state) && state.choices['return-check'] === 'verify') complete('book', 'BOOK'); break
    case 'pickup-outcome': if (state.choices['pickup-choice'] === 'collect' && savedPickup(state)) complete('pickup', 'KIT'); break
    case 'day-close': {
      const record = next.memory.find(value => value.id === 'today-drink')
      if (record) write({ ...record, status: 'retired' })
      break
    }
  }
  const retainedStep = { ...step }
  if (step.id === 'private-observation') {
    retainedStep.observation = t('Private conversation processed ephemerally; its content was withheld from the durable trace.', '私密讨论仅临时处理，内容不进入持久轨迹。')
  }
  if (step.id === 'private-admission' && choiceId === 'ephemeral') {
    retainedStep.payload = t('Write declined. Proposed private task content was not retained.', '拒绝写入，不保存拟议的私密任务内容。')
  }
  next.trace.push({ ...retainedStep, sequence: state.trace.length + 1, choice: choiceId, changes })
  next.index++
  if (next.index === DAY_STEP_COUNT) next.status = 'complete'
  return next
}

export function getDayReport (state: DayState): DayReport {
  const completed = state.memory.filter(record => record.kind === 'commitment' && record.status === 'completed')
  const pending = state.memory.filter(record => record.kind === 'commitment' && record.status === 'active')
  const quiet = state.choices['private-admission'] === 'ephemeral' || state.choices['reminder-choice'] === 'skip'
  const ending = quiet ? 'quiet' : pending.length ? 'unfinished' : 'closed'
  return {
    ending, completed, pending, channels: [...new Set(state.trace.flatMap(entry => (entry.channel ? [entry.channel] : [])))],
    title: ending === 'closed' ? t('A day with confirmed commitments', '承诺得到确认的一天') : ending === 'quiet' ? t('A quieter day, with explicit limits', '更安静，也有明确边界的一天') : t('Some outcomes remain unresolved', '仍有结果需要跟进的一天'),
    summary: t(`${completed.length} commitments confirmed; ${pending.length} still open. ${state.choices['reminder-choice'] === 'now' ? 'One avoidable interruption was recorded.' : 'No immediate conversation interruption was selected.'} These are scenario outcomes, not an agent performance score.`, `${completed.length} 项承诺已确认，${pending.length} 项仍待处理。${state.choices['reminder-choice'] === 'now' ? '记录了一次可避免的交谈打扰。' : '未选择在交谈中立即打扰。'}这些是场景结果，不是智能体性能评分。`),
    policy: t('θ stayed fixed-demo-v1. Personal records changed; no policy revision was validated or committed.', 'θ 保持 fixed-demo-v1。个人记录发生变化；没有策略修订通过验证或被提交。'),
    nextDay: t('Accepted personal state and unresolved commitments remain in this browser’s separate demo save. Temporary observations do not become personal memory.', '获准个人状态和未完成承诺保存在本浏览器独立的演示存档中。临时观察不会自动成为个人记忆。')
  }
}

/** Reconstruct from a bounded choice history, never trust saved traces or fabricated completion flags. */
export function restoreDayState (raw: string | null): DayState | undefined {
  if (!raw) return undefined
  try {
    const data = JSON.parse(raw)
    if (data?.version !== 1 || data.day !== 1 || !Number.isInteger(data.index) || data.index < 0 || data.index > DAY_STEP_COUNT || typeof data.choices !== 'object' || !data.choices) return undefined
    let state = createDayState()
    while (state.index < data.index) {
      const step = getDayStep(state)!
      const next = advanceDay(state, step.choices ? data.choices[step.id] : undefined)
      if (next === state) return undefined
      state = next
    }
    return state
  } catch { return undefined }
}

export function exportDayReport (state: DayState, language: DayLanguage): string {
  const report = getDayReport(state)
  const lines = [
    `# ${t('Always-On · A day at NTU', 'Always-On · NTU 的一天')[language]}`,
    '', `> ${t('Scripted educational simulation. All observations and receipts are synthetic; no real-world action is executed.', '预设教学模拟。所有观察和回执均为合成数据，不执行真实世界行动。')[language]}`,
    '', `## ${report.title[language]}`, report.summary[language], '', report.policy[language], report.nextDay[language],
    '', `## ${t('Initial priors', '初始先验')[language]}`,
    ...state.initialMemory.map(record => `- **${record.label[language]}**: ${record.value[language]} (${record.scope[language]})`),
    '', `## ${t('Trajectory and channel evidence', '轨迹与通道证据')[language]}`
  ]
  for (const event of state.trace) {
    lines.push('', `### ${event.time} · ${event.placeName[language]} · ${event.headline[language]}`, `**${event.module}${event.channel ? ` / ${event.channel}` : ''}**`, event.observation[language], `- ${t('Source', '来源')[language]}: ${event.source[language]}`, `- ${t('Delivered signal', '传递信号')[language]}: ${event.payload[language]}`, `- ${t('Receiving decision', '接收决策')[language]}: ${event.receiver[language]} — ${event.decision[language]}`, `- ${t('Boundary', '边界')[language]}: ${event.boundary[language]}`)
    if (event.choice) lines.push(`- ${t('Choice', '选择')[language]}: ${event.choices?.find(value => value.id === event.choice)?.label[language]}`)
    for (const change of event.changes) lines.push(`- Δm · ${change.after.label[language]}: ${change.before?.[language] ?? '∅'} → ${change.after.value[language]} [${change.after.status}]`)
  }
  lines.push('', `## ${t('Final retained state', '最终保留状态')[language]}`, ...state.memory.map(record => `- **${record.label[language]}** [${record.status}]: ${record.value[language]} · ${record.scope[language]} · ${record.source[language]}`))
  return lines.join('\n') + '\n'
}
