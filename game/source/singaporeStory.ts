/**
 * Fictional, coordinate-independent activities placed on the NTU map.
 * Map geometry describes real geography; none of these notices describe real
 * campus opening hours, services, events, people, or weather.
 *
 * A loop is complete only after its explicit action has a runtime receipt.
 * Reading these definitions must never mark their observations as seen.
 */
export type SingaporeLanguage = 'en' | 'zh'
export type SingaporeText = Readonly<Record<SingaporeLanguage, string>>
export type SingaporeStation = 'plaza' | 'library' | 'return' | 'meetup'
export type SingaporeLoopId = 'return-book' | 'meet-group' | 'collect-kit'

type SingaporeLoop = {
  id: SingaporeLoopId
  title: SingaporeText
  rememberedContext: SingaporeText
  evidence: {
    id: string
    station: SingaporeStation
    source: SingaporeText
    text: SingaporeText
  }
  action: {
    id: string
    station: SingaporeStation
    label: SingaporeText
    confirmation: SingaporeText
    receiptPrefix: string
    kind: 'remove-tagged-item' | 'confirm-presence' | 'grant-tagged-item'
    itemTag?: string
    requiresReceiptFrom?: SingaporeLoopId
  }
  suggestion: SingaporeText
  staleSuggestion: SingaporeText
  completed: SingaporeText
  trace: {
    observation: SingaporeText
    suggestion: SingaporeText
    outcome: SingaporeText
  }
}

export const SINGAPORE_STORY = {
  id: 'ntu-campus-day-v1',
  memoryKey: 'always-on-ntu-campus-memory-v1',
  title: { en: 'A day on campus.', zh: '校园里的一天。' },
  subtitle: {
    en: 'Return a book and meet your study group. Take your own route, and discover what comes next.',
    zh: '还一本书，再和学习小组碰面。路线由你决定，看看途中还有什么安排。'
  },
  geographyNote: {
    en: 'NTU campus · Geographic reconstruction',
    zh: 'NTU 校园 · 地理重建'
  },
  simulationNote: {
    en: 'Campus geography covers the academic areas, residences, NIE and sports facilities. Key exteriors follow map footprints and reference photographs; other buildings remain simplified. People, traffic and activities are simulated.',
    zh: '地理范围覆盖教学区、宿舍、NIE 和体育设施。主要建筑依据地图轮廓与照片重建，其余建筑仍为简化模型。人物、交通与活动均为模拟。'
  },
  rememberAction: { en: 'Remember these plans', zh: '记住这些安排' },
  quietAction: { en: 'Only tell me when it matters', zh: '有必要时再提醒我' },
  evidenceMissing: { en: 'Check the board nearby first.', zh: '先看看附近的告示。' },
  staleEvidence: {
    en: 'I remember the last notice. It has not been checked this visit.',
    zh: '我记得上次的告示，但这次还没有确认。'
  },
  resume: {
    en: 'Your plans and receipts are still here. Check what has changed before continuing.',
    zh: '你的安排和凭证还在。继续之前，先看看什么发生了变化。'
  },
  done: { en: 'All three plans are accounted for. Keep exploring.', zh: '三件事都有了结果，可以继续逛逛。' },
  stations: {
    plaza: { en: 'Demo plaza board & kit box', zh: '试玩广场告示与材料箱' },
    library: { en: 'Demo library notice', zh: '试玩图书馆告示' },
    return: { en: 'Demo book return box', zh: '试玩还书箱' },
    meetup: { en: 'Demo study-group point', zh: '试玩学习小组集合点' }
  }
} as const

/** The first two loops can be explored in either order; collecting the kit follows check-in. */
export const SINGAPORE_LOOPS: readonly SingaporeLoop[] = [
  {
    id: 'return-book',
    title: { en: 'One book to return.', zh: '把借来的书还回去。' },
    rememberedContext: { en: 'You brought demo loan SG-B17 to return today.', zh: '你带着试玩借书 SG-B17，打算今天归还。' },
    evidence: {
      id: 'book-return-notice', station: 'library',
      source: { en: 'Demo library board · this visit', zh: '试玩图书馆告示 · 本次访问' },
      text: { en: 'DEMO: SG-B17 returns have moved to the marked return box. Leave ordinary books in your bag.', zh: '试玩告示：SG-B17 的归还地点已改为指定还书箱，其他书留在背包里。' }
    },
    action: {
      id: 'return-book', station: 'return', kind: 'remove-tagged-item', itemTag: 'SG-B17', receiptPrefix: 'SG-RETURN',
      label: { en: 'Return SG-B17', zh: '归还 SG-B17' },
      confirmation: { en: 'Move this borrowed book from your bag into the demo return box?', zh: '将这本借书从背包放入试玩还书箱？' }
    },
    suggestion: { en: 'That notice matches your loan. The marked box can take it.', zh: '告示对应你借的这本书，可以去指定还书箱归还。' },
    staleSuggestion: { en: 'You still have the loan. Check the library board before following the old route.', zh: '借书还在。沿用上次路线前，先确认图书馆告示。' },
    completed: { en: 'Book transferred. Return receipt saved.', zh: '书已转交，归还凭证已保存。' },
    trace: {
      observation: { en: 'S → M · A visible notice updates the destination, with its source and visit.', zh: 'S → M · 可见告示更新归还地点，并保留来源与访问记录。' },
      suggestion: { en: 'M → A · The observed destination is matched to your retained loan.', zh: 'M → A · 将观察到的地点与保留的借书待办对应。' },
      outcome: { en: 'A → M · A verified tagged-item transfer closes this loan.', zh: 'A → M · 核实带标记物品的转移后，结束这条借书待办。' }
    }
  },
  {
    id: 'meet-group',
    title: { en: 'Find your study group.', zh: '去和学习小组碰面。' },
    rememberedContext: { en: 'You planned to join fictional study session G-07.', zh: '你计划参加虚构学习小组 G-07。' },
    evidence: {
      id: 'group-location-notice', station: 'library',
      source: { en: 'Demo campus board · this visit', zh: '试玩校园告示 · 本次访问' },
      text: { en: 'DEMO: G-07 meets at the marked study-group point. Check in there when you arrive.', zh: '试玩告示：G-07 在指定学习小组集合点见面，请到达后确认签到。' }
    },
    action: {
      id: 'check-in-group', station: 'meetup', kind: 'confirm-presence', receiptPrefix: 'SG-MEET',
      label: { en: 'Confirm I am here', zh: '确认我已到达' },
      confirmation: { en: 'Record your arrival at demo session G-07?', zh: '记录你已到达试玩学习小组 G-07？' }
    },
    suggestion: { en: 'This is your group. You can check in at its marked meeting point.', zh: '这是你约好的小组，可以去指定集合点签到。' },
    staleSuggestion: { en: 'The group is on your list. Its last meeting point may be out of date.', zh: '你约好了这个小组，上次的集合地点还需要确认。' },
    completed: { en: 'Arrival confirmed by you. Demo check-in saved.', zh: '你已确认到达，试玩签到记录已保存。' },
    trace: {
      observation: { en: 'S → M · The group board provides current meeting-place evidence.', zh: 'S → M · 小组告示提供当前集合地点的证据。' },
      suggestion: { en: 'M → A · Your remembered appointment makes this notice relevant.', zh: 'M → A · 保留的约定让这条告示与你相关。' },
      outcome: { en: 'A → M · Location and your explicit confirmation produce a demo check-in receipt.', zh: 'A → M · 结合所在位置与你的明确确认，生成试玩签到凭证。' }
    }
  },
  {
    id: 'collect-kit',
    title: { en: 'Take the project kit with you.', zh: '把项目材料一起带上。' },
    rememberedContext: { en: 'At check-in, you accepted the follow-up to collect kit K-07.', zh: '签到时，你接受了领取材料 K-07 的后续安排。' },
    evidence: {
      id: 'kit-pickup-note', station: 'meetup',
      source: { en: 'Demo group pickup card · this visit', zh: '试玩小组领取卡 · 本次访问' },
      text: { en: 'DEMO: Kit K-07 is in the plaza supply box. Use your G-07 check-in receipt to collect it once.', zh: '试玩领取卡：K-07 在广场材料箱，用 G-07 签到凭证可领取一份。' }
    },
    action: {
      id: 'collect-project-kit', station: 'plaza', kind: 'grant-tagged-item', itemTag: 'SG-K07', receiptPrefix: 'SG-KIT', requiresReceiptFrom: 'meet-group',
      label: { en: 'Collect K-07', zh: '领取 K-07' },
      confirmation: { en: 'Place one demo project kit into your bag?', zh: '将一份试玩项目材料放入背包？' }
    },
    suggestion: { en: 'Your check-in receipt matches this kit. Pick it up when you pass the plaza.', zh: '你的签到凭证对应这份材料，经过广场时可以领取。' },
    staleSuggestion: { en: 'You have a pickup to finish. Recheck the pickup card before going.', zh: '还有一份材料待领，出发前再确认一下领取卡。' },
    completed: { en: 'Kit added to your bag. Collection receipt saved.', zh: '材料已放入背包，领取凭证已保存。' },
    trace: {
      observation: { en: 'S → M · The visible pickup card gives the kit and collection point.', zh: 'S → M · 可见领取卡提供材料编号与领取地点。' },
      suggestion: { en: 'M → A · The retained check-in receipt enables a later, separate action.', zh: 'M → A · 保留的签到凭证支持稍后另一项行动。' },
      outcome: { en: 'A → M · A one-time inventory grant is verified before the pickup is marked complete.', zh: 'A → M · 核实一次性物品发放后，才将领取标记为完成。' }
    }
  }
]
