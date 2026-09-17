/** Copy a tested build into the sibling Pages game directory; never pushes. */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const website = resolve(process.env.ALWAYS_ON_WEBSITE_DIR || join(root, '..'))
if (!readFileSync(join(website, 'index.html'), 'utf8').includes('id="live-demo"')) {
  throw new Error('Target must be the Always-On project website. Set ALWAYS_ON_WEBSITE_DIR explicitly if needed.')
}
const dist = join(root, 'dist')
for (const file of ['index.html', 'maps/ntu-campus-v3/index.json', 'maps/ntu-campus-v2/index.json']) {
  if (!existsSync(join(dist, file))) throw new Error(`Build first: missing dist/${file}`)
}
const target = join(website, 'game')
mkdirSync(target, { recursive: true })
// Only hashed bundles are replaced. Keep canonical map inputs in place.
rmSync(join(target, 'static'), { recursive: true, force: true })
cpSync(dist, target, { recursive: true, filter: file => !file.endsWith('.map') })
for (const file of ['LICENSE', 'THIRD_PARTY_NOTICES.txt', 'credits.html']) cpSync(join(root, file), join(target, file))
mkdirSync(join(target, 'source'), { recursive: true })
cpSync(join(root, 'gpl-dependency-source.zip'), join(target, 'source/gpl-dependency-source.zip'))
writeFileSync(join(target, 'source/README.md'), '# Game development\n\nComplete editable source and instructions: https://github.com/Always-On-Agent/Always-On-Agent.github.io/tree/main/game-src\n\nThe old partial source snapshots have been replaced by the versioned game-src directory.\n')
console.log(`Staged game at ${target}. Review, test, then commit game-src/ and game/ together.`)
