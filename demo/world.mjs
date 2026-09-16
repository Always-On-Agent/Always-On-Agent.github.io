import * as T from './vendor/three.module.js';
import {blocked, planRoute} from './routes.mjs';
import {buildCampus} from './world-art.mjs';
export const PLACES=[
 {id:'Library',name:'Library',x:-10,z:-4.3,labelY:3.3},
 {id:'Café',name:'Café · returns desk',x:10,z:-4.3,labelY:3.3},
 {id:'Courtyard',name:'Courtyard',x:0,z:1.3,labelY:2.4},
 {id:'Gate',name:'Campus gate',x:0,z:12.8,labelY:2.9}
];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function createWorld(canvas,{onFrame,onInteract,onReady}){
 const scene=new T.Scene();
 const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power'});
 renderer.info.autoReset=false;
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,matchMedia('(pointer: coarse)').matches?1.35:1.65));
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
 renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;
 const camera=new T.PerspectiveCamera(64,1,.06,150);camera.rotation.order='YXZ';camera.position.set(0,1.72,10);
 const hemisphere=new T.HemisphereLight('#b7e4ff','#b2a182',2.35);scene.add(hemisphere);
 const sun=new T.DirectionalLight('#ffe3b3',3.4);sun.position.set(16,26,9);sun.castShadow=true;sun.shadow.mapSize.set(1536,1536);sun.shadow.camera.left=-23;sun.shadow.camera.right=23;sun.shadow.camera.top=23;sun.shadow.camera.bottom=-23;sun.shadow.camera.near=.5;sun.shadow.camera.far=70;sun.shadow.normalBias=.035;sun.shadow.bias=-.0001;scene.add(sun);
 const art=buildCampus(scene,camera);
 const {libraryBarrier,cafeClosed,returnBins,people,waterMaterial,carrying}=art;
 const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
 let stride=0,lastDiagnostics=0,peakDrawCalls=0,carryingBook=true;
 art.setSky(new URL('./assets/campus-sky-v2.jpg',import.meta.url).href).then(()=>{scene.backgroundRotation.y=Math.PI*.35;}).catch(()=>{});
 art.setPaving(new URL('./assets/campus-paving-v2.jpg',import.meta.url).href).catch(()=>{});
 const keys=new Set();let yaw=0,pitch=-.025,active=false,visible=true,paused=false,lastTime=0,travel=null,look=null,visit=1,raf=0,disposed=false;
 const ray=new T.Vector3(),viewVector=new T.Vector3();
 function fit(){const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}
 const resize=new ResizeObserver(fit);resize.observe(canvas);
 function move(dx,dz){const x=camera.position.x+dx,z=camera.position.z+dz;if(!blocked(x,camera.position.z))camera.position.x=x;if(!blocked(camera.position.x,z))camera.position.z=z;}
 const stop=()=>{keys.clear();look=null;};
 canvas.addEventListener('keydown',e=>{if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyE','Escape'].includes(e.code)){e.preventDefault();if(e.code==='KeyE'){if(!e.repeat)onInteract();}else if(e.code==='Escape'){stop();travel=null;canvas.blur();}else{keys.add(e.code);travel=null;}}});
 canvas.addEventListener('keyup',e=>keys.delete(e.code));canvas.addEventListener('blur',stop);window.addEventListener('blur',stop);
 canvas.addEventListener('pointerdown',e=>{if(!active||paused||e.button!==0)return;canvas.focus({preventScroll:true});look={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);travel=null;});
 canvas.addEventListener('pointermove',e=>{if(!look||look.id!==e.pointerId)return;yaw-=(e.clientX-look.x)*.004;pitch=clamp(pitch-(e.clientY-look.y)*.003,-.65,.55);look.x=e.clientX;look.y=e.clientY;});
 const endLook=e=>{if(look?.id!==e.pointerId)return;look=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);};
 canvas.addEventListener('pointerup',endLook);canvas.addEventListener('pointercancel',endLook);canvas.addEventListener('lostpointercapture',()=>{look=null;});
 function frame(time){
  if(disposed)return;raf=requestAnimationFrame(frame);const dt=Math.min((time-lastTime)/1000||0,.05);lastTime=time;
  if(!visible||document.hidden)return;
  const beforeX=camera.position.x,beforeZ=camera.position.z;
  if(active&&!paused){
   if(travel){const target=travel[0],dx=target.x-camera.position.x,dz=target.z-camera.position.z,dist=Math.hypot(dx,dz);const angle=Math.atan2(-dx,-dz);let diff=angle-yaw;while(diff>Math.PI)diff-=Math.PI*2;while(diff< -Math.PI)diff+=Math.PI*2;yaw+=diff*Math.min(1,dt*4);pitch*=.94;if(dist<.2){travel.shift();if(!travel.length)travel=null;}else move(dx/dist*Math.min(dist,dt*4.2),dz/dist*Math.min(dist,dt*4.2));
   }else{
    if(keys.has('ArrowLeft'))yaw+=dt*1.4;if(keys.has('ArrowRight'))yaw-=dt*1.4;
    let f=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),r=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0);const n=Math.hypot(f,r)||1;f/=n;r/=n;
    move((-Math.sin(yaw)*f+Math.cos(yaw)*r)*dt*3.4,(-Math.cos(yaw)*f-Math.sin(yaw)*r)*dt*3.4);
   }
  }
  const walked=Math.hypot(camera.position.x-beforeX,camera.position.z-beforeZ);stride+=walked*7;
  const animate=active&&!paused&&!reducedMotion.matches;
  camera.position.y=1.72+(animate&&walked>.0001?Math.sin(stride)*.012:0);
  camera.rotation.set(pitch,yaw,0);
  people.forEach((p,i)=>{p.rotation.z=animate?Math.sin(time*.0011+i)*.004:0;});
  carrying.visible=carryingBook;carrying.position.y=-.4+(animate?Math.sin(walked>.0001?stride:time*.0017)*(walked>.0001?.009:.002):0);
  carrying.rotation.z=.13+(animate&&walked>.0001?Math.cos(stride*.5)*.008:0);
  waterMaterial.roughness=animate?.18+Math.sin(time*.0007)*.012:.18;
  // Three resets its default counters after the shadow pass. Reset explicitly here
  // so this diagnostic includes shadow/background work as well as the main scene.
  renderer.info.reset();renderer.render(scene,camera);peakDrawCalls=Math.max(peakDrawCalls,renderer.info.render.calls);
  if(time-lastDiagnostics>1000){lastDiagnostics=time;canvas.dataset.sceneDrawCalls=String(renderer.info.render.calls);canvas.dataset.scenePeakDrawCalls=String(peakDrawCalls);}
  camera.getWorldDirection(viewVector);
  const landmarks=PLACES.map(p=>{ray.set(p.x,p.labelY,p.z);const delta=ray.clone().sub(camera.position),front=delta.dot(viewVector)>0;ray.project(camera);return {...p,distance:Math.hypot(camera.position.x-p.x,camera.position.z-p.z),screenX:(ray.x+1)/2,screenY:(1-ray.y)/2,visible:front&&ray.z<1&&Math.abs(ray.x)<.96&&Math.abs(ray.y)<.94};});
  if(active&&!paused)onFrame({x:camera.position.x,z:camera.position.z,landmarks,traveling:!!travel});
 }
 raf=requestAnimationFrame(frame);fit();onReady?.();
 return {
  setVisit(value){visit=value;libraryBarrier.visible=visit===2;cafeClosed.visible=visit===3;returnBins.Library.visible=visit!==2;returnBins['Café'].visible=visit===2;scene.fog.color.set(visit===2?'#c4d5de':'#bed8df');sun.color.set(visit===2?'#f6e0bd':'#ffe3b3');sun.intensity=visit===2?2.9:3.4;renderer.shadowMap.needsUpdate=true;camera.position.set(0,1.72,10);yaw=0;pitch=-.025;stride=0;travel=null;stop();},
  setLanguage(value){art.setLanguage(value);},
  setCarrying(value){carryingBook=Boolean(value);carrying.visible=carryingBook;},
  setSky(url){return art.setSky(url);},
  setActive(value){active=value;if(!value){stop();travel=null;}},
  setPaused(value){paused=value;if(value)stop();},
  setVisible(value){visible=value;if(!value)stop();},
  go(id){const p=PLACES.find(p=>p.id===id);if(!p)return;active=true;paused=false;stop();const route=planRoute(camera.position,p);travel=route.length?route:null;},
  key(code,down){if(down){travel=null;keys.add(code);}else keys.delete(code);},
  focus(){canvas.focus({preventScroll:true});},
  destroy(){disposed=true;cancelAnimationFrame(raf);resize.disconnect();window.removeEventListener('blur',stop);art.dispose();renderer.dispose();}
 };
}
