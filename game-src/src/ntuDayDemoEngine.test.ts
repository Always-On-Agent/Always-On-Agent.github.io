import { EventEmitter } from 'events'
import { Vec3 } from 'vec3'
import { expect, test, vi } from 'vitest'
import { createSingaporeActions } from './singaporeActions'
import { advanceDay, createDayState, DAY_CHAPTERS, DAY_STEP_COUNT, exportDayReport, getDayReport, getDayStep, restoreDayState, type DayStep } from './ntuDayDemoEngine'

function deferred<T> () {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

function travelFixture () {
  const client = new EventEmitter()
  const botProperties = {
    username: 'day-demo', entity: { position: new Vec3(0, 1, 0), velocity: new Vec3(1, -1, 1), yaw: .25, pitch: .1, flying: false },
    clearControlStates: vi.fn(), look: vi.fn(async () => {})
  }
  const bot = new EventEmitter() as EventEmitter & typeof botProperties
  Object.assign(bot, botProperties)
  const visitor = {
    username: bot.username, position: bot.entity.position.clone(), lastTeleportId: 0, gameMode: 2, flying: false,
    view: 2, loadedChunks: {} as Record<string, boolean>,
    setGameMode: vi.fn((value: number) => { visitor.gameMode = value }),
    pendingTeleport: false, validateNextPosition: undefined as Vec3 | undefined,
    _client: client, teleport: vi.fn(async (destination: Vec3) => {
      visitor.position = destination.clone()
      visitor.lastTeleportId++
      visitor.pendingTeleport = true
    })
  }
  const columns: Record<string, object> = {}
  const server = {
    players: [visitor], chunksUsed: {} as Record<string, number>, overworld: {
      columns,
      getLoadedColumn: (x: number, z: number) => columns[`${x},${z}`],
      unloadColumn: vi.fn((x: number, z: number) => { delete columns[`${x},${z}`] }),
      getColumn: vi.fn(async (x: number, z: number) => { columns[`${x},${z}`] ??= {}; return columns[`${x},${z}`] }),
      getBlock: vi.fn(async (position: Vec3) => ({ boundingBox: position.y === 0 ? 'block' : 'empty' }))
    }
  }
  const destination = { id: 'demo-place', position: { x: 32, y: 0, z: 48 }, approach: { x: 32.5, y: 1, z: 48.5, yaw: .5 } }
  const actions = createSingaporeActions(server, bot, [destination])
  const acknowledge = () => {
    bot.entity.position = visitor.position.clone()
    visitor.pendingTeleport = false
    bot.emit('forcedMove')
    client.emit('teleport_confirm', { teleportId: visitor.lastTeleportId })
  }
  return { actions, server, bot, visitor, client, destination, acknowledge }
}

test('shuttle cancellation before travel performs no loads or movement', async () => {
  const f = travelFixture(); const controller = new AbortController()
  controller.abort()
  expect(await f.actions.shuttle('demo-place', controller.signal)).toEqual({ ok: false, reason: 'cancelled' })
  expect(f.server.overworld.getColumn).not.toHaveBeenCalled()
  expect(f.visitor.teleport).not.toHaveBeenCalled()
})

test('shuttle cancellation during chunk preload returns promptly and cannot move later', async () => {
  const f = travelFixture(); const controller = new AbortController(); const load = deferred<object>()
  f.server.overworld.getColumn.mockImplementation(async () => load.promise)
  const travel = f.actions.shuttle('demo-place', controller.signal)
  expect(f.server.overworld.getColumn).toHaveBeenCalledTimes(9)
  controller.abort()
  expect(await travel).toEqual({ ok: false, reason: 'cancelled' })
  load.resolve({})
  await Promise.resolve()
  expect(f.visitor.teleport).not.toHaveBeenCalled()
  expect(f.bot.look).not.toHaveBeenCalled()
  // Cancellation releases the travel lock; a later explicit trip remains usable.
  f.server.overworld.getColumn.mockResolvedValue({})
  const next = f.actions.shuttle('demo-place')
  await vi.waitFor(() => expect(f.visitor.teleport).toHaveBeenCalledTimes(1))
  f.acknowledge()
  expect(await next).toEqual({ ok: true })
})

test('shuttle cancellation while awaiting acknowledgement removes listeners and suppresses late success', async () => {
  const f = travelFixture(); const controller = new AbortController()
  const travel = f.actions.shuttle('demo-place', controller.signal)
  await vi.waitFor(() => expect(f.visitor.teleport).toHaveBeenCalledTimes(1))
  controller.abort()
  expect(await travel).toEqual({ ok: false, reason: 'cancelled' })
  expect(f.bot.listenerCount('forcedMove')).toBe(0)
  expect(f.bot.listenerCount('end')).toBe(0)
  expect(f.client.listenerCount('teleport_confirm')).toBe(0)
  f.acknowledge()
  await Promise.resolve()
  expect(f.bot.look).not.toHaveBeenCalled()
})

test('shuttle still requires the real acknowledgement before returning success', async () => {
  const f = travelFixture(); let settled = false
  const travel = f.actions.shuttle('demo-place').then(result => { settled = true; return result })
  await vi.waitFor(() => expect(f.visitor.teleport).toHaveBeenCalledTimes(1))
  expect(settled).toBe(false)
  f.acknowledge()
  expect(await travel).toEqual({ ok: true })
  expect(f.bot.look).toHaveBeenCalledWith(.5, 0, true)
  expect(f.client.listenerCount('teleport_confirm')).toBe(0)
})

test('shuttle cancellation during final facing does not report successful arrival', async () => {
  const f = travelFixture(); const controller = new AbortController(); const facing = deferred<void>()
  f.bot.look.mockImplementation(async () => facing.promise)
  const travel = f.actions.shuttle('demo-place', controller.signal)
  await vi.waitFor(() => expect(f.visitor.teleport).toHaveBeenCalledTimes(1))
  f.acknowledge()
  await vi.waitFor(() => expect(f.bot.look).toHaveBeenCalledTimes(1))
  controller.abort()
  expect(await travel).toEqual({ ok: false, reason: 'cancelled' })
  facing.resolve()
})

test('cancelled distant preloads unload only after the underlying reads settle', async () => {
  const f = travelFixture(); const controller = new AbortController(); const load = deferred<void>()
  Object.assign(f.destination.approach, { x: 512.5, z: 512.5 })
  f.server.overworld.getColumn.mockImplementation(async (x, z) => {
    await load.promise
    f.server.overworld.columns[`${x},${z}`] ??= {}
    return f.server.overworld.columns[`${x},${z}`]
  })
  const travel = f.actions.shuttle('demo-place', controller.signal)
  controller.abort()
  expect(await travel).toEqual({ ok: false, reason: 'cancelled' })
  expect(f.server.overworld.unloadColumn).not.toHaveBeenCalled()
  load.resolve()
  await vi.waitFor(() => expect(f.server.overworld.unloadColumn).toHaveBeenCalledTimes(9))
  expect(Object.keys(f.server.overworld.columns)).toHaveLength(0)
})

test('a new trip keeps shared preloads alive after the previous trip is cancelled', async () => {
  const f = travelFixture(); const controller = new AbortController(); const load = deferred<void>()
  Object.assign(f.destination.approach, { x: 512.5, z: 512.5 })
  f.server.overworld.getColumn.mockImplementation(async (x, z) => {
    await load.promise
    f.server.overworld.columns[`${x},${z}`] ??= {}
    return f.server.overworld.columns[`${x},${z}`]
  })
  const first = f.actions.shuttle('demo-place', controller.signal)
  controller.abort(); await first
  const second = f.actions.shuttle('demo-place')
  expect(f.server.overworld.getColumn).toHaveBeenCalledTimes(9)
  load.resolve()
  await vi.waitFor(() => expect(f.visitor.teleport).toHaveBeenCalledTimes(1))
  expect(f.server.overworld.unloadColumn).not.toHaveBeenCalled()
  f.acknowledge()
  expect(await second).toEqual({ ok: true })
  expect(f.server.overworld.unloadColumn).not.toHaveBeenCalled()
  expect(Object.keys(f.server.overworld.columns)).toHaveLength(9)
})

test('failed safe-arrival checks release new chunks while preserving existing and referenced columns', async () => {
  const f = travelFixture()
  Object.assign(f.destination.approach, { x: 512.5, z: 512.5 })
  f.server.overworld.columns['31,31'] = {}
  f.server.chunksUsed['32,31'] = 1
  f.visitor.loadedChunks['33,31'] = true
  f.server.overworld.getBlock.mockResolvedValue({ boundingBox: 'empty' })
  expect(await f.actions.shuttle('demo-place')).toEqual({ ok: false, reason: 'unsafe-stop' })
  expect(Object.keys(f.server.overworld.columns).sort()).toEqual(['31,31', '32,31', '33,31'])
  expect(f.server.overworld.unloadColumn).toHaveBeenCalledTimes(6)
})

test('observer mode uses server spectator flight and restores the original walking pose after acknowledgement', async () => {
  const f = travelFixture()
  expect(await f.actions.observer('fly')).toEqual({ ok: true, observerMode: 'fly' })
  expect(f.visitor.gameMode).toBe(3)
  expect(f.visitor.flying).toBe(true)
  expect(f.bot.entity.velocity).toEqual(new Vec3(0, 0, 0))
  expect(await f.actions.shuttle('demo-place')).toEqual({ ok: false, reason: 'observer-mode' })
  f.visitor.position = new Vec3(100, 70, 100)
  f.bot.entity.position = f.visitor.position.clone()
  f.bot.entity.yaw = 2
  const walk = f.actions.observer('walk')
  await vi.waitFor(() => expect(f.visitor.teleport).toHaveBeenCalledTimes(1))
  expect(f.visitor.teleport).toHaveBeenCalledWith(new Vec3(0, 1, 0))
  expect(f.visitor.gameMode).toBe(3)
  f.acknowledge()
  expect(await walk).toEqual({ ok: true, observerMode: 'walk' })
  expect(f.visitor.gameMode).toBe(2)
  expect(f.visitor.flying).toBe(false)
  expect(f.bot.look).toHaveBeenLastCalledWith(.25, .1, true)
  expect(await f.actions.observer('walk')).toEqual({ ok: true, observerMode: 'walk' })
  expect(f.visitor.teleport).toHaveBeenCalledTimes(1)
})

test('overhead view is sixty metres above the saved origin and cannot overwrite it on mode changes', async () => {
  const f = travelFixture()
  const overhead = f.actions.observer('overhead')
  await vi.waitFor(() => expect(f.visitor.teleport).toHaveBeenCalledTimes(1))
  expect(f.visitor.teleport).toHaveBeenLastCalledWith(new Vec3(0, 61, 0))
  expect(await f.actions.observer('walk')).toEqual({ ok: false, reason: 'not-ready', observerMode: 'fly' })
  f.acknowledge(); expect(await overhead).toEqual({ ok: true, observerMode: 'overhead' })
  expect(f.bot.look).toHaveBeenLastCalledWith(.25, -Math.PI / 2, true)
  expect(await f.actions.observer('overhead')).toEqual({ ok: true, observerMode: 'overhead' })
  expect(f.visitor.teleport).toHaveBeenCalledTimes(1)
  await f.actions.observer('fly')
  const walk = f.actions.observer('walk')
  await vi.waitFor(() => expect(f.visitor.teleport).toHaveBeenCalledTimes(2))
  expect(f.visitor.teleport).toHaveBeenLastCalledWith(new Vec3(0, 1, 0))
  f.acknowledge(); expect(await walk).toEqual({ ok: true, observerMode: 'walk' })
})

test('observer return restores an existing creative mode and its previous flying state', async () => {
  const f = travelFixture()
  f.visitor.gameMode = 1; f.visitor.flying = true
  await f.actions.observer('fly')
  const walk = f.actions.observer('walk')
  await vi.waitFor(() => expect(f.visitor.teleport).toHaveBeenCalledTimes(1))
  f.acknowledge(); await walk
  expect(f.visitor.gameMode).toBe(1)
  expect(f.visitor.flying).toBe(true)
})

test('failed overhead movement reports the remaining flight mode so returning stays available', async () => {
  const f = travelFixture()
  f.visitor.teleport.mockRejectedValueOnce(new Error('test transport failure'))
  expect(await f.actions.observer('overhead')).toEqual({ ok: false, reason: 'observer-failed', observerMode: 'fly' })
  expect(f.visitor.gameMode).toBe(3)
  const walk = f.actions.observer('walk')
  await vi.waitFor(() => expect(f.visitor.teleport).toHaveBeenCalledTimes(2))
  f.acknowledge()
  expect(await walk).toEqual({ ok: true, observerMode: 'walk' })
  expect(f.visitor.gameMode).toBe(2)
})


function runDay (choose?: (step: DayStep) => string | undefined, initial = createDayState()) {
  let state = initial
  for (let index = 0; index <= DAY_STEP_COUNT; index++) {
    const step = getDayStep(state)
    if (!step) return state
    if (step.choices?.length) expect(step.choices.some(choice => choice.id === step.defaultChoice)).toBe(true)
    const next = advanceDay(state, choose?.(step) ?? step.defaultChoice)
    expect(next.index).toBeGreaterThan(state.index)
    state = next
  }
  throw new Error('The deterministic day never reached its final boundary.')
}

function branchRuns () {
  const defaults = runDay()
  return defaults.trace.flatMap(step => (step.choices ?? []).filter(choice => choice.id !== step.defaultChoice)
    .map(choice => ({ step, choice, state: runDay(current => (current.id === step.id ? choice.id : undefined)) })))
}

test('the complete default day is deterministic, covers all chapters and closes its commitments', () => {
  const first = runDay(); const second = runDay()
  expect(first).toEqual(second)
  expect(first.status).toBe('complete')
  expect(first.index).toBe(DAY_STEP_COUNT)
  expect(first.trace).toHaveLength(DAY_STEP_COUNT)
  expect(getDayStep(first)).toBeUndefined()
  expect(new Set(first.trace.map(step => step.chapter)).size).toBe(DAY_CHAPTERS.length)
  expect(getDayReport(first).ending).toBe('closed')
  expect(getDayReport(first).pending).toHaveLength(0)
})

test('previewing a step does not admit observations or mutate retained state', () => {
  let state = createDayState()
  while (getDayStep(state)) {
    const saved = JSON.stringify(state)
    const first = getDayStep(state)
    expect(getDayStep(state)).toEqual(first)
    expect(JSON.stringify(state)).toBe(saved)
    state = advanceDay(state, first?.defaultChoice)
  }
})

test('choice gates cannot advance or write memory without a valid explicit choice', () => {
  let state = createDayState(); let checked = 0
  while (getDayStep(state)) {
    const step = getDayStep(state)!
    if (step.choices?.length) {
      const before = JSON.stringify(state)
      expect(advanceDay(state)).toEqual(state)
      expect(advanceDay(state, 'not-a-valid-choice')).toEqual(state)
      expect(JSON.stringify(state)).toBe(before)
      checked++
    }
    state = advanceDay(state, step.defaultChoice)
  }
  expect(checked).toBeGreaterThan(0)
})

test('alternate decisions produce distinct quiet and unfinished endings', () => {
  const variants = branchRuns()
  const endings = new Set(variants.map(({ state }) => getDayReport(state).ending))
  expect(endings.has('quiet')).toBe(true)
  expect(endings.has('unfinished')).toBe(true)
  expect(variants.some(({ state }) => JSON.stringify(state.memory) !== JSON.stringify(runDay().memory))).toBe(true)
})

test('all five coupling channels expose source, signal, receiving decision and conditions', () => {
  const state = runDay()
  expect(new Set(state.trace.flatMap(step => (step.channel ? [step.channel] : [])))).toEqual(new Set(['S → M', 'M → A', 'A → S', 'M → S', 'A → M']))
  for (const step of state.trace.filter(step => step.channel)) {
    for (const field of ['source', 'payload', 'receiver', 'decision', 'boundary'] as const) {
      expect(step[field].en.trim().length).toBeGreaterThan(0)
      expect(step[field].zh.trim().length).toBeGreaterThan(0)
    }
    expect(step.receiver).not.toEqual(step.source)
  }
})

test('a new day retains personal preferences and unresolved commitments but clears the current trace', () => {
  const unfinished = branchRuns().find(({ state }) => getDayReport(state).pending.length > 0)?.state
  expect(unfinished).toBeDefined()
  const previous = unfinished!
  const next = createDayState(previous)
  expect(next.day).toBe(previous.day + 1)
  expect(next.index).toBe(0)
  expect(next.status).toBe('running')
  expect(next.trace).toEqual([])
  expect(next.choices).toEqual({})
  for (const memory of previous.memory.filter(item => (item.kind === 'preference' || item.kind === 'commitment') && item.status === 'active')) {
    expect(next.memory.find(item => item.id === memory.id)).toEqual(memory)
  }
  expect(next.memory).not.toBe(previous.memory)
})

test('one synthetic day never commits a policy revision across branches or the next day', () => {
  for (const state of [runDay(), ...branchRuns().map(value => value.state)]) {
    expect(state.policyVersion).toBe('fixed-demo-v1')
    expect(createDayState(state).policyVersion).toBe('fixed-demo-v1')
    expect(getDayReport(state).policy.en).toMatch(/fixed|unchanged|not.*evol|no.*revision/i)
  }
})

test('saved partial progress round-trips and malformed state is rejected safely', () => {
  let state = createDayState()
  for (let index = 0; index < Math.min(5, DAY_STEP_COUNT - 1); index++) state = advanceDay(state, getDayStep(state)?.defaultChoice)
  expect(restoreDayState(JSON.stringify(state))).toEqual(state)
  expect(runDay(undefined, restoreDayState(JSON.stringify(state)))).toEqual(runDay())
  expect(restoreDayState(JSON.stringify({ ...state, memory: null, receipts: ['forged'], trace: [], status: 'complete', policyVersion: 'tampered' }))).toEqual(state)
  for (const raw of [null, '', '{invalid', 'null', '[]', '{}', JSON.stringify({ ...state, version: 99 }), JSON.stringify({ ...state, index: DAY_STEP_COUNT + 1 })]) {
    expect(restoreDayState(raw)).toBeUndefined()
  }
})

test('exported reports identify the simulation and do not claim self-evolution', () => {
  const state = runDay()
  const english = exportDayReport(state, 'en')
  const chinese = exportDayReport(state, 'zh')
  expect(english).toMatch(/scripted|simulated|simulation|fictional/i)
  expect(english).toContain('fixed-demo-v1')
  expect(chinese).toMatch(/模拟|脚本|虚构/)
  expect(chinese).toContain('fixed-demo-v1')
})


function beforeStep (id: string, choices: Record<string, string> = {}, initial = createDayState()) {
  let state = initial
  while (getDayStep(state)) {
    const step = getDayStep(state)!
    if (step.id === id) return state
    state = advanceDay(state, choices[step.id] ?? step.defaultChoice)
  }
  throw new Error(`Missing scenario step ${id}`)
}

test('arrival, intention and a requested check cannot complete a task before its receipt', () => {
  const beforeOutcome = beforeStep('return-outcome')
  expect(beforeOutcome.memory.find(record => record.id === 'book')?.status).toBe('active')
  expect(beforeOutcome.receipts.some(receipt => receipt.endsWith('-BOOK'))).toBe(false)
  expect(beforeOutcome.trace.find(step => step.id === 'return-plan')?.changes).toEqual([])
  expect(beforeOutcome.trace.find(step => step.id === 'return-check')?.changes).toEqual([])
  const completed = advanceDay(beforeOutcome)
  expect(completed.memory.find(record => record.id === 'book')?.status).toBe('completed')
  const receipt = completed.receipts.find(value => value.endsWith('-BOOK'))
  expect(receipt).toBeDefined()
  expect(completed.memory.find(record => record.id === 'book')?.source.en).toContain(receipt!)
  expect(completed.trace.at(-1)?.evidence).toBe('simulated-receipt')
})

test('stale evidence, skipped receipt checks and deferred collection remain unresolved', () => {
  const stale = runDay(step => (step.id === 'morning-check' ? 'trust' : undefined))
  expect(stale.memory.find(record => record.id === 'seminar')?.status).toBe('active')
  expect(stale.receipts.some(receipt => receipt.endsWith('-SEMINAR'))).toBe(false)
  const unchecked = runDay(step => (step.id === 'return-check' ? 'pending' : undefined))
  expect(unchecked.memory.find(record => record.id === 'book')?.status).toBe('active')
  expect(unchecked.receipts.some(receipt => receipt.endsWith('-BOOK'))).toBe(false)
  const deferred = runDay(step => (step.id === 'pickup-choice' ? 'later' : undefined))
  expect(deferred.memory.find(record => record.id === 'pickup')?.status).toBe('active')
  expect(deferred.receipts.some(receipt => receipt.endsWith('-KIT'))).toBe(false)
})

test('a receipt check cannot manufacture success for a quiet branch with no return attempt', () => {
  const state = runDay(step => (step.id === 'reminder-choice' ? 'skip' : undefined))
  expect(state.choices['return-check']).toBe('verify')
  expect(state.memory.find(record => record.id === 'book')?.status).toBe('active')
  expect(state.receipts.some(receipt => receipt.endsWith('-BOOK'))).toBe(false)
  expect(state.trace.find(step => step.id === 'return-outcome')?.changes).toEqual([])
})

test('private observation is temporary; its quotation never enters the persistent trace', () => {
  const state = beforeStep('private-observation')
  const shown = getDayStep(state)!
  const next = advanceDay(state)
  expect(next.memory).toEqual(state.memory)
  expect(next.trace.at(-1)?.changes).toEqual([])
  expect(next.trace.at(-1)?.observation).not.toEqual(shown.observation)
  expect(JSON.stringify(next)).not.toContain('Collect my event kit at Yunnan Garden at 17:00.')
  expect(exportDayReport(next, 'en')).not.toContain('Collect my event kit at Yunnan Garden at 17:00.')
})

test('declined private admission leaves no retained task or reusable task payload', () => {
  const state = beforeStep('private-admission')
  const proposed = getDayStep(state)!.payload
  const next = advanceDay(state, 'ephemeral')
  expect(next.memory).toEqual(state.memory)
  expect(next.trace.at(-1)?.changes).toEqual([])
  expect(next.trace.at(-1)?.payload).not.toEqual(proposed)
  const later = beforeStep('pickup-choice', { 'private-admission': 'ephemeral' })
  expect(later.memory.some(record => record.id === 'pickup')).toBe(false)
  expect(getDayStep(later)?.choices?.map(choice => choice.id)).toEqual(['continue'])
  expect(advanceDay(later, 'collect')).toEqual(later)
  const final = runDay(step => (step.id === 'private-admission' ? 'ephemeral' : undefined))
  expect(final.receipts.some(receipt => receipt.endsWith('-KIT'))).toBe(false)
})

test('unexplained rejection neither changes a general preference nor trains a policy', () => {
  const initial = createDayState()
  const state = runDay(step => (step.id === 'drink-feedback' ? 'unknown' : undefined))
  expect(state.memory.find(record => record.id === 'coffee')).toEqual(initial.memory.find(record => record.id === 'coffee'))
  expect(state.memory.some(record => record.id === 'today-drink')).toBe(false)
  expect(state.trace.find(step => step.id === 'drink-feedback')?.changes).toEqual([])
  expect(state.trace.find(step => step.id === 'evening-attribution')?.changes).toEqual([])
  expect(state.trace.find(step => step.id === 'policy-boundary')?.changes).toEqual([])
})

test('unsupported later-day saves are rejected instead of silently replaying the authored day', () => {
  const previous = runDay(step => (step.id === 'pickup-choice' ? 'later' : undefined))
  let second = createDayState(previous)
  for (let index = 0; index < 4; index++) second = advanceDay(second, getDayStep(second)?.defaultChoice)
  expect(second.day).toBe(2)
  expect(second.memory.find(record => record.id === 'pickup')?.status).toBe('active')
  expect(restoreDayState(JSON.stringify(second))).toBeUndefined()
})
