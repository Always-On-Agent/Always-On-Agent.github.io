/**
 * Inventory codec and real teleport-handshake regression. The installed flying-
 * squid movement/guard modules and Mineflayer physics plugin communicate through
 * the application's actual async CustomChannelClient. No teleport is mocked.
 * Terrain and other-player rendering are the only game-world boundaries stubbed.
 */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { EventEmitter } = require('node:events')
const esbuild = require('esbuild')
const { Vec3 } = require('vec3')
const protocol = require('minecraft-protocol')
const version = '1.21.4'
const Item = require('prismarine-item')(version)
const root = path.resolve(__dirname, '..')
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ntu-actions-'))
const file = path.join(dir, 'actions.cjs')
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
const angleDistance = (first, second) => Math.abs(Math.atan2(Math.sin(first - second), Math.cos(first - second)))
let bot

async function run () {
  await esbuild.build({
    stdin: {
      contents: `export {default as injectPhysics} from ${JSON.stringify(require.resolve('mineflayer/lib/plugins/physics'))};
        export {default as Channel} from './src/customClient.js';
        export {unsupportedLocalServerFeatures} from './src/createLocalServer.ts';
        export * from './src/singaporeActions.ts';`,
      resolveDir: root, loader: 'ts'
    },
    outfile: file, bundle: true, platform: 'node', format: 'cjs',
    plugins: [{
      name: 'same-physics-entry-as-browser-build',
      setup (build) {
        build.onResolve({ filter: /.*/ }, args => {
          if (args.path === './optionsStorage') return { path: args.path, namespace: 'settings' }
          if (args.path === '@nxg-org/mineflayer-physics-util') return { path: path.join(root, 'scripts/mineflayerPhysicsUtilEntry.ts') }
          if (!args.path.startsWith('.') && !path.isAbsolute(args.path)) return { path: require.resolve(args.path), external: true }
        })
        build.onLoad({ filter: /.*/, namespace: 'settings' }, () => ({ contents: 'exports.options={excludeCommunicationDebugEvents:[]}', loader: 'js' }))
      }
    }]
  })
  global.window = { serverDataChannel: {} }
  const { createSingaporeActions, Channel, injectPhysics, unsupportedLocalServerFeatures } = require(file)
  const registry = require('prismarine-registry')(version)
  const appSupportsFeature = feature => !unsupportedLocalServerFeatures.includes(feature) && registry.supportFeature(feature)
  assert(appSupportsFeature('teleportUsesOwnPacket'), 'The actual app singleplayer configuration must permit teleport acknowledgments')
  bot = new EventEmitter()
  Object.assign(bot, {
    username: 'Visitor', registry, version, supportFeature: appSupportsFeature,
    _client: new Channel(false, version),
    entity: { position: new Vec3(0.5, -37, 3.5), velocity: new Vec3(0, 0, 0), yaw: 0, pitch: 0, onGround: true }
  })
  bot._client.state = 'play'
  // The branded plugin channel is unrelated to movement or game-mode packets.
  bot._client.registerChannel = () => {}
  require('mineflayer/lib/plugins/game')(bot, {})
  bot.game.gameMode = 'adventure'
  injectPhysics(bot, { physicsEnabled: false })
  const slots = Array(46).fill(null)
  const visitor = new EventEmitter()
  Object.assign(visitor, {
    id: 1, type: 'player', username: 'Visitor', position: bot.entity.position.clone(),
    onGround: true, yaw: 0, pitch: 0, gameMode: 2, onReady: Promise.resolve(), _client: new Channel(true, version),
    _writeOthersNearby () {}, sendChunkWhenMove () {},
    inventory: { slots, updateSlot: (slot, item) => { slots[slot] = item }, firstEmptyInventorySlot: () => slots.findIndex(item => !item) }
  })
  visitor._client.state = 'play'
  visitor.writePacket = visitor._client.write.bind(visitor._client)
  visitor.onPacket = visitor._client.on.bind(visitor._client)
  visitor.behavior = require('flying-squid/dist/lib/behavior').default(visitor)
  let safe = true
  const server = {
    players: [visitor], PrismarineItem: Item, mcData: require('minecraft-data')(version), supportFeature: registry.supportFeature,
    bridge: { player_info () {} },
    overworld: { getColumn: async () => ({}), getBlock: async point => ({ boundingBox: safe && point.y === -38 ? 'block' : 'empty' }) }
  }
  const updates = require('flying-squid/dist/lib/modules/updatePositions')
  updates.entity(visitor, server)
  updates.player(visitor)
  await require('flying-squid/dist/lib/modules/playerLogin').player(visitor, server, { version })
  require('flying-squid/dist/lib/modules/safeZones').player(visitor, server, {})
  const stations = [
    { id: 'return', position: { x: 20, y: -36, z: 20 }, approach: { x: 20.5, y: -37, z: 23.5, yaw: -.32175055 } },
    { id: 'plaza', position: { x: 0, y: -36, z: 0 }, approach: { x: .5, y: -37, z: 3.5, yaw: 0 } }
  ]
  const destination = stations[0].approach
  // The old app override disabled a feature supported by the current server.
  // Reproduce its missing acknowledgment using the real Mineflayer handler.
  bot.supportFeature = feature => feature !== 'teleportUsesOwnPacket' && appSupportsFeature(feature)
  await visitor.teleport(bot.entity.position.clone())
  await delay(30)
  assert(visitor.pendingTeleport, 'The old app override leaves the server waiting for an acknowledgment')
  bot.supportFeature = appSupportsFeature
  visitor.sendSelfPosition(false)
  await delay(30)
  assert.equal(visitor.pendingTeleport, undefined, 'The real app configuration now completes the same handshake')
  // Reproduce the browser's settled spawn handshake: an identical reply leaves
  // safeZones' validateNextPosition guard behind even though both endpoints agree.
  await visitor.teleport(bot.entity.position.clone())
  await delay(30)
  assert(visitor.validateNextPosition.equals(bot.entity.position))
  await visitor.teleport(new Vec3(destination.x, destination.y, destination.z))
  await bot.look(destination.yaw, 0, true)
  await delay(30)
  assert(bot.entity.position.distanceTo(new Vec3(.5, -37, 3.5)) < .01,
    'Stale spawn validation reproduces the original rejected shuttle')
  assert(angleDistance(bot.entity.yaw, destination.yaw) > 1,
    'The delayed correction packet also overwrites an immediately assigned yaw')

  const actions = createSingaporeActions(server, bot, stations)
  assert.equal((await actions.acceptLoan()).ok, true)
  assert.equal((await actions.acceptLoan()).ok, true)
  assert.equal(slots.filter(Boolean).length, 1, 'restoring the pending loan must not duplicate it')
  const serializer = protocol.createSerializer({ state: 'play', version, isServer: true })
  const parser = protocol.createDeserializer({ state: 'play', version, isServer: false })
  const bytes = serializer.createPacketBuffer({ name: 'set_slot', params: { windowId: 0, stateId: 0, slot: 36, item: Item.toNotch(slots[36]) } })
  slots[36] = Item.fromNotch(parser.parsePacketBuffer(bytes).data.params.item)
  assert.equal(slots[36].components[0].data.value.AlwaysOnTask.value, 'NTU-DEMO-LOAN-1', 'task identity survives the actual 1.21.4 network codec')
  assert.equal((await actions.returnLoan()).reason, 'too-far')
  const baseline = { move: bot.listenerCount('forcedMove'), end: bot.listenerCount('end'), confirm: visitor._client.listenerCount('teleport_confirm') }
  assert.equal((await actions.shuttle('return')).ok, true)
  assert(bot.entity.position.distanceTo(new Vec3(destination.x, destination.y, destination.z)) < .01)
  assert(visitor.position.distanceTo(bot.entity.position) < .01)
  assert.equal(visitor.pendingTeleport, undefined)
  assert(angleDistance(bot.entity.yaw, destination.yaw) < .003, 'Final look is applied after the real client position packet')
  const receipt = await actions.returnLoan()
  assert.equal(receipt.ok, true)
  assert.ok(receipt.receiptId.startsWith('NTU-RETURN-'))
  assert.equal(slots.filter(Boolean).length, 0, 'confirmed return consumes the actual book')
  assert.equal((await actions.returnLoan()).reason, 'already-returned')
  assert.equal((await actions.collectKit()).reason, 'too-far')
  assert.equal((await actions.shuttle('plaza')).ok, true)
  assert.equal((await actions.collectKit()).ok, true)
  assert.equal(slots.find(Boolean).name, 'bundle')
  assert.equal((await actions.collectKit()).reason, 'already-collected')
  const walkingOrigin = bot.entity.position.clone()
  let lastAbilities
  bot._client.on('abilities', packet => { lastAbilities = packet })
  assert.equal((await actions.observer('fly')).ok, true)
  await delay(30)
  assert.equal(bot.game.gameMode, 'spectator', 'The actual server setter reaches the Mineflayer game-mode plugin')
  assert.equal(lastAbilities.flags, 7, 'Spectator gets invulnerability, flight, and permission to fly')
  assert.equal((await actions.shuttle('return')).reason, 'observer-mode')
  assert.equal((await actions.observer('overhead')).ok, true)
  assert(bot.entity.position.distanceTo(walkingOrigin.offset(0, 60, 0)) < .01)
  assert(Math.abs(bot.entity.pitch + Math.PI / 2) < .003)
  assert.equal((await actions.observer('walk')).ok, true)
  await delay(30)
  assert.equal(bot.game.gameMode, 'adventure')
  assert.equal(lastAbilities.flags, 0)
  assert(bot.entity.position.distanceTo(walkingOrigin) < .01)
  assert.equal(bot.entity.velocity.norm(), 0)
  safe = false
  assert.equal((await actions.shuttle('return')).reason, 'unsafe-stop')
  assert.equal((await actions.shuttle('unknown')).ok, false)
  safe = true
  const originalWrite = bot._client.write.bind(bot._client)
  bot._client.write = (name, data) => { if (name !== 'teleport_confirm') originalWrite(name, data) }
  assert.equal((await actions.shuttle('return')).reason, 'travel-failed', 'Missing acknowledgment cannot be reported as arrival')
  assert.equal(bot.listenerCount('forcedMove'), baseline.move)
  assert.equal(bot.listenerCount('end'), baseline.end)
  assert.equal(visitor._client.listenerCount('teleport_confirm'), baseline.confirm)
  console.log('PASS: actual app feature configuration and real flying-squid/Mineflayer/async-channel acknowledgment, stale spawn/consecutive-teleport guard recovery, confirmed negative-Y arrival and final yaw, timeout listener cleanup, 1.21.4 item codec, inventory transactions, safe shuttle destinations, server spectator/overhead/adventure round trip and abilities.')
}
run().finally(() => { bot?.emit('end'); fs.rmSync(dir, { recursive: true, force: true }) }).catch(error => { console.error(error); process.exitCode = 1 })
