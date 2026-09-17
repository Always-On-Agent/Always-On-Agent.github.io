const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{createRequire}=require('node:module');
const esbuild=require('esbuild'),{Anvil}=require('prismarine-provider-anvil'),{Vec3}=require('vec3');
(async()=>{
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ntu-architecture-')),out=path.join(tmp,'a.cjs');
await esbuild.build({entryPoints:['src/ntuCampusArchitecture.ts'],bundle:true,platform:'node',format:'cjs',outfile:out,plugins:[{name:'deps',setup(b){b.onResolve({filter:/^[^./]/},a=>({path:require.resolve(a.path),external:true}))}}]});
const scene=JSON.parse(fs.readFileSync('assets/maps/ntu/scene.json')),data=require('minecraft-data')(scene.version),provider=new(Anvil(scene.version))('assets/maps/ntu/region');
const decorate=require(out).createCampusArchitecture(data,scene.architectureOffset),cache=new Map();
async function chunk(x,z){const cx=Math.floor(x/16),cz=Math.floor(z/16),k=cx+','+cz;if(!cache.has(k)){const c=await provider.load(cx,cz);assert(c);decorate(c,cx,cz);cache.set(k,c)}return cache.get(k)}
async function block(x,y,z){return (await chunk(x,z)).getBlock(new Vec3(Math.floor(x)&15,y,Math.floor(z)&15))}
for(const stop of [...scene.stations,...(scene.tourStops||[]),{id:'spawn',approach:scene.spawn}]){const a=stop.approach;for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
 assert.equal((await block(a.x+dx,a.y,a.z+dz)).boundingBox,'empty',stop.id+' feet');assert.equal((await block(a.x+dx,a.y+1,a.z+dz)).boundingBox,'empty',stop.id+' head');assert.equal((await block(a.x+dx,a.y-1,a.z+dz)).boundingBox,'block',stop.id+' ground');}}
const o=scene.architectureOffset;for(let y=-37;y<=0;y++)assert.equal((await block(690+o.x,y+o.y,698+o.z)).name,'air','Hive atrium open to sky');
let pale=0;for(let y=-30;y<0;y++){const b=await block(721+o.x,y+o.y,699+o.z);if(['smooth_sandstone','white_concrete','cut_sandstone'].includes(b.name))pale++}assert(pale>2,'Hive external pod has pale ribbed cladding');
// The expanded OSM projection places this east-facing source wall just outside
// the authored footprint. It is a continuous solid facade above the road, so
// looking only for the first air block incorrectly preserves the old castle.
for(const z of [699,700]){for(let y=-40;y<=-17;y++)assert.equal((await block(724+o.x,y+o.y,z+o.z)).name,'air','Hive residual east facade removed');assert.equal((await block(724+o.x,-41+o.y,z+o.z)).boundingBox,'block','Hive east pavement preserved');}
for(let y=-40;y<=-17;y++)assert.equal((await block(725+o.x,y+o.y,698+o.z)).name,'air','Hive furthest rasterized east boundary column removed');
for(const [key,c] of cache){const [cx,cz]=key.split(',').map(Number);const first=c.dump();decorate(c,cx,cz);assert.deepEqual(c.dump(),first,'idempotent '+key)}
console.log('PASS: decorated real Anvil, all 3x3 spawn/station clearances, open Hive atrium, ribbed facade, repeated chunk loading.');fs.rmSync(tmp,{recursive:true});process.exit(0)
})().catch(e=>{console.error(e);process.exit(1)})
