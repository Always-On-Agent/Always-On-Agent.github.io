import { EventEmitter } from 'events'
import { existsSync } from 'fs'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { test, expect, vi } from 'vitest'
import { Vec3 } from 'vec3'
import { Group } from 'three'
import * as physicsUtil from '@nxg-org/mineflayer-physics-util'
import { createNtuLiveEpisodeRuntime } from './ntuLiveEpisodeRuntime'
import { LIVE_ROUTE } from './ntuLiveRoute'

const require = createRequire(import.meta.url)
// Vitest uses the same source-only dependency entry as the browser build; its
// ambient package declaration intentionally omits these testing constructors.
const { BotcraftPhysics, EPhysicsCtx, PhysicsWorldSettings } = physicsUtil as any
const data = require('minecraft-data')('1.21.4')
const Block = require('prismarine-block')('1.21.4')
EPhysicsCtx.loadData(data)
const physics = new BotcraftPhysics(data)
const solid = (p: Vec3, yes: boolean) => {
  const block = Block.fromStateId(yes ? data.blocksByName.smooth_stone.defaultState : 0, 0)
  block.position = p.floored()
  return block
}
const floor = (p: Vec3) => solid(p, p.y < 52)
function fixture (start = new Vec3(0.5, 52, .5), getBlock = floor) {
  const bot: any = new EventEmitter()
  Object.assign(bot, {
    entity: { position: start.clone(), velocity: new Vec3(0, 0, 0), yaw: 0, pitch: 0, onGround: true, attributes: {}, effects: [], equipment: [], metadata: [] },
    registry: data, game: { gameMode: 'adventure' }, food: 20, inventory: { slots: [] }, getEquipmentDestSlot: () => 6,
    controlState: { forward: false, back: false, left: false, right: false, jump: false, sprint: false, sneak: false },
    setControlState (key: string, value: boolean) { this.controlState[key] = value },
    getControlState (key: string) { return this.controlState[key] },
    clearControlStates () { for (const key of Object.keys(this.controlState)) this.controlState[key] = false },
    look: vi.fn(async (yaw: number, pitch: number) => { bot.entity.yaw = yaw; bot.entity.pitch = pitch }),
    blockAt: getBlock
  })
  const renderer = { sceneOrigin: { x: 123, y: 45, z: -67, addAndTrack: vi.fn(), removeAndUntrack: vi.fn() } }
  const control = createNtuLiveEpisodeRuntime({ bot, renderer })
  const ctx = EPhysicsCtx.FROM_BOT(physics, bot, new PhysicsWorldSettings(data))
  const tick = (count = 1) => {
    for (let i = 0; i < count; i++) {
      ctx.state.update(bot)
      physics.simulate(ctx, { getBlock } as any).apply(bot)
      bot.emit('physicsTick')
      control.update(.05)
    }
  }
  const walk = async (path: ReadonlyArray<{ x: number, y: number, z: number }>, signal?: AbortSignal) => {
    let result
    const promise = control.autoWalk(path, value => { result = value }, signal, { speed: 1.8 })
    for (let i = 0; i < 3601; i++) { if (result) break; tick() }
    expect(result, JSON.stringify(control.getState())).toBeDefined()
    return promise
  }
  return { bot, renderer, control, tick, walk }
}

test('actual Botcraft physics follows every corner and closes all four episode walks', async () => {
  const f = fixture(new Vec3(LIVE_ROUTE.start.x, 52, LIVE_ROUTE.start.z))
  let distance = 0
  for (const [from, to] of [[0, 6], [6, 20], [20, 34], [34, 40]]) {
    const result = await f.walk(LIVE_ROUTE.path.slice(from, to + 1))
    expect(result.ok).toBe(true)
    distance += result.distance
    f.control.setPaused(true); f.tick(20); f.control.setPaused(false)
  }
  expect(distance).toBeGreaterThan(35)
  expect(distance).toBeLessThan(44)
  expect(f.bot.entity.position.distanceTo(new Vec3(LIVE_ROUTE.start.x, 52, LIVE_ROUTE.start.z))).toBeLessThan(.65)
  expect(f.bot.controlState.forward).toBe(false)
  f.control.dispose()
})

test('pause retains its route and abort settles once while clearing every control', async () => {
  const f = fixture()
  const abort = new AbortController()
  const done = vi.fn()
  const promise = f.control.autoWalk([{ x: .5, y: 52, z: .5 }, { x: .5, y: 52, z: -30 }], done, abort.signal)
  f.tick(35); f.control.setPaused(true); f.tick(10)
  const stopped = f.bot.entity.position.clone()
  f.tick(50)
  expect(f.bot.entity.position.distanceTo(stopped)).toBeLessThan(.02)
  expect(f.control.getState().walking).toBe(true)
  expect(done).not.toHaveBeenCalled()
  f.control.setPaused(false); f.tick(20)
  expect(f.bot.entity.position.distanceTo(stopped)).toBeGreaterThan(.5)
  abort.abort()
  expect((await promise).reason).toBe('cancelled')
  expect(done).toHaveBeenCalledTimes(1)
  expect(Object.values(f.bot.controlState).some(Boolean)).toBe(false)
  f.control.dispose()
})

test('a real collision wall fails without an arrival or position shortcut', async () => {
  const f = fixture(undefined, p => solid(p, p.y < 52 || (p.z < -2 && p.y < 55)))
  const result = await f.walk([{ x: .5, y: 52, z: .5 }, { x: .5, y: 52, z: -5 }])
  expect(result).toMatchObject({ ok: false, reason: 'blocked' })
  expect(f.bot.entity.position.z).toBeGreaterThan(-2)
  f.control.dispose()
})

test('a missing floor and stopped physics cannot create an arrival', async () => {
  const f = fixture(undefined, p => solid(p, false))
  const falling = await f.walk([{ x: .5, y: 52, z: .5 }, { x: .5, y: 52, z: -5 }])
  expect(falling.ok).toBe(false)
  expect(['no-ground', 'off-route']).toContain(falling.reason)
  f.control.dispose()
  const g = fixture()
  const pending = g.control.autoWalk([{ x: .5, y: 52, z: .5 }, { x: .5, y: 52, z: -5 }])
  for (let i = 0; i < 40; i++) g.control.update(.25)
  expect((await pending).reason).toBe('physics-unavailable')
  g.control.dispose()
})

test('initial placement validates without teleporting, tracks one world-zero root, and cleans up', async () => {
  const f = fixture()
  const initial = f.bot.entity.position.clone()
  expect(() => f.control.setPosition({ x: 100, y: 52, z: 100 })).toThrow(/Walk to/)
  f.control.setPosition({ x: .5, y: 52, z: .5 }, { x: 4, y: 53.5, z: .5 })
  expect(f.bot.entity.position.equals(initial)).toBe(true)
  const group = new Group()
  f.control.scene.add(group)
  expect(f.renderer.sceneOrigin.addAndTrack).toHaveBeenCalledWith(group)
  expect(group.position.toArray()).toEqual([0, 0, 0])
  expect(f.control.getCamera().position.toArray()).toEqual([.5, 53.65, .5])
  expect(f.control.getGroundHeight(initial)).toBe(52)
  const pending = f.control.autoWalk([initial, { x: .5, y: 52, z: -10 }])
  f.control.dispose(); f.control.dispose()
  expect((await pending).reason).toBe('cancelled')
  expect(f.bot.listenerCount('physicsTick')).toBe(0)
  expect(f.bot.listenerCount('forcedMove')).toBe(0)
  expect(f.renderer.sceneOrigin.removeAndUntrack).toHaveBeenCalledTimes(1)
})

const campusWorld = fileURLToPath(new URL('../game-assets/maps/ntu-campus-v3/region/', import.meta.url))
test('the Minecraft route walks through the repository Anvil reconstruction', async () => {
  expect(existsSync(campusWorld), 'Campus regions are required: run the game asset preparation script before tests.').toBe(true)
  const Anvil = require('prismarine-provider-anvil').Anvil('1.21.4')
  const provider = new Anvil(campusWorld)
  const chunks = new Map<string, any>()
  try {
    for (let z = 7; z <= 9; z++) for (let x = -3; x <= 1; x++) chunks.set(`${x},${z}`, await provider.load(x, z))
    const getBlock = (p: Vec3) => {
      const chunk = chunks.get(`${Math.floor(p.x / 16)},${Math.floor(p.z / 16)}`)
      if (!chunk) return null
      const block = chunk.getBlock(new Vec3(Math.floor(p.x) & 15, Math.floor(p.y), Math.floor(p.z) & 15))
      block.position = p.floored()
      return block
    }
    const shuttle = { x: -18.5, y: 52, z: 132.5 }
    const f = fixture(new Vec3(shuttle.x, shuttle.y, shuttle.z), getBlock)
    const shared = LIVE_ROUTE.path
    expect((await f.walk([shuttle, shared[0]])).ok).toBe(true)
    let distance = 0
    for (const [from, to] of [[0, 6], [6, 20], [20, 34], [34, 40]]) {
      const result = await f.walk(shared.slice(from, to + 1))
      expect(result, JSON.stringify(f.control.getState())).toMatchObject({ ok: true, reason: 'arrived' })
      distance += result.distance
      f.control.setPaused(true); f.tick(20); f.control.setPaused(false)
    }
    expect(distance).toBeGreaterThan(35)
    console.log('Actual Anvil shared route passed:', { distance, final: f.bot.entity.position, colliding: f.bot.entity.isCollidedHorizontally })
    f.control.dispose()
  } finally { await provider.close() }
}, 15_000)
