import * as T from './vendor/three.module.js';
import {blocked, planRoute} from './routes.mjs';
export const PLACES=[
 {id:'Library',name:'Library',x:-10,z:-4.3,labelY:3.3},
 {id:'Café',name:'Café · returns desk',x:10,z:-4.3,labelY:3.3},
 {id:'Courtyard',name:'Courtyard',x:0,z:1.3,labelY:2.4},
 {id:'Gate',name:'Campus gate',x:0,z:12.8,labelY:2.9}
];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function createWorld(canvas,{onFrame,onInteract,onReady}){
 const scene=new T.Scene();scene.background=new T.Color('#c5e1e3');scene.fog=new T.Fog('#c5e1e3',24,85);
 const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
 const camera=new T.PerspectiveCamera(67,1,.08,120);camera.rotation.order='YXZ';camera.position.set(0,1.72,10);
 const hemisphere=new T.HemisphereLight('#d6eef5','#80805f',2.7);scene.add(hemisphere);
 const sun=new T.DirectionalLight('#fff0d0',3.2);sun.position.set(-16,24,11);sun.castShadow=true;sun.shadow.mapSize.set(1536,1536);sun.shadow.camera.left=-24;sun.shadow.camera.right=24;sun.shadow.camera.top=24;sun.shadow.camera.bottom=-24;sun.shadow.normalBias=.04;scene.add(sun);
 const materials=new Map();
 function mat(color){if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.87}));return materials.get(color);}
 function mesh(geometry,color,x,y,z,parent=scene){const m=new T.Mesh(geometry,typeof color==='string'?mat(color):color);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 function box(w,h,d,color,x,y,z,parent){return mesh(new T.BoxGeometry(w,h,d),color,x,y,z,parent);}
 function cyl(rt,rb,h,color,x,y,z,n=16,parent){return mesh(new T.CylinderGeometry(rt,rb,h,n),color,x,y,z,parent);}
 function sign(text,x,y,z,w=3,h=.65,bg='#edf0e5',ink='#314c47',parent=scene){
  const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,1024,256);ctx.fillStyle=ink;ctx.font='500 64px Helvetica,Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,130,950);
  const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;
  return mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}),x,y,z,parent);
 }
 box(90,.16,90,'#92a58c',0,-.14,0);
 box(34,.12,33,'#e4dfcd',0,-.04,0);
 box(5,.02,31,'#f2ecdc',0,.035,0);
 box(29,.02,4.8,'#f2ecdc',0,.035,-3.8);
 for(let x=-16;x<=16;x+=2)box(.015,.018,32,'#c6cbb9',x,.045,0);
 for(let z=-15;z<=16;z+=2)box(33,.018,.015,'#c6cbb9',0,.045,z);
 // The level is deliberately small: each landmark is visible from the central path.
 function building(x,color,name){
  const g=new T.Group();g.position.x=x;scene.add(g);
  box(8.7,4.7,6,color,0,2.35,-10,g);box(9.3,.28,6.6,'#f6f2e8',0,4.75,-10,g);
  box(8.9,.7,6.2,'#d3d4bd',0,.35,-10,g);box(8.9,.18,1.9,'#e6e6d7',0,3.05,-6.3,g);
  const glass=new T.MeshStandardMaterial({color:'#486b70',metalness:.2,roughness:.25});
  for(const xx of [-2.8,2.8]){box(2.3,2.6,.09,glass,xx,1.83,-6.96,g);box(.065,2.65,.11,'#3f595a',xx,1.83,-6.86,g);box(2.4,.065,.12,'#3f595a',xx,1.8,-6.85,g);}
  box(1.7,2.8,.12,'#344f52',0,1.65,-6.94,g);box(.62,.06,.06,'#d7cb98',.3,1.3,-6.84,g);
  for(const xx of [-3.9,3.9]){box(.16,2.85,.16,'#dee1cf',xx,1.5,-5.62,g);}
  sign(name,0,3.85,-6.95,4.3,.65,'#eef0e0','#344e4b',g);
  // Clerestory detail and timber ceiling soften the otherwise simple game geometry.
  for(let xx=-3.5;xx<4;xx+=.45)box(.06,.12,1.75,'#a79570',xx,2.92,-6.3,g);
  return g;
 }
 building(-10,'#e6e6d6','FIELD LIBRARY');building(10,'#d7bc94','COMMON GROUND');
 const libraryBarrier=new T.Group();scene.add(libraryBarrier);
 for(const x of [-11.1,-8.9])box(.11,1.1,.11,'#9b7453',x,.6,-5.8,libraryBarrier);
 box(2.6,.22,.1,'#dba55f',-10,.95,-5.8,libraryBarrier);box(2.6,.2,.1,'#efe3b9',-10,.57,-5.8,libraryBarrier);
 const notice=sign('RETURNS → CAFÉ',-10,1.88,-5.7,2.4,.55,'#f0e6c6');libraryBarrier.add(notice); // world positions remain local to the zero-position group
 const returnBins={};
 for(const [id,x] of [['Library',-7.5],['Café',12.6]]){
  const group=new T.Group();scene.add(group);box(.86,1.35,.62,'#638c78',x,.7,-5.8,group);box(.72,.12,.06,'#263e36',x,1.02,-5.45,group);sign('RETURNS',x,1.5,-5.42,.94,.25,'#d5e5c9');returnBins[id]=group;
 }
 const cafeClosed=sign('RETURNS → LIBRARY',10,1.8,-5.5,2.5,.5,'#f1e8d0');
 function tree(x,z,size=1){
  cyl(.16,.25,2.3*size,'#86775a',x,1.1*size,z,7);
  mesh(new T.IcosahedronGeometry(1.55*size,1),'#668774',x,3.1*size,z);
  mesh(new T.IcosahedronGeometry(1.15*size,1),'#7a9a76',x-.6*size,3.9*size,z-.25);
  cyl(1.55,1.65,.32,'#c9cbb2',x,.14,z,24);
 }
 for(const [x,z,k] of [[-6,3,1],[6,3,1],[-16,-4,1.2],[16,-4,1.2],[-16,9,1.3],[16,9,1.3],[-5,-15,1.3],[5,-15,1.3],[-18,-14,1.5],[18,-14,1.5]])tree(x,z,k);
 for(const x of [-12,12]){
  for(const z of [6,9]){box(3.2,.13,.62,'#aa865a',x,.72,z);for(const xx of [-1.2,1.2])box(.13,.68,.48,'#607066',x+xx,.32,z);box(3.2,.65,.1,'#ab8d65',x,1.1,z-.35);}
 }
 // A shallow reflecting pool is a navigation landmark, not a collision trap.
 cyl(2.25,2.35,.35,'#c2cbb9',0,.12,-7.4,40);
 const water=cyl(2.1,2.1,.03,new T.MeshStandardMaterial({color:'#83b5b3',roughness:.18,metalness:.2}),0,.31,-7.4,40);
 cyl(.32,.55,.64,'#dedfc7',0,.59,-7.4);cyl(.035,.035,.65,'#bad7c9',0,1.23,-7.4,8);
 function umbrella(x,z){
  cyl(.04,.04,2.8,'#776b52',x,1.4,z,8);mesh(new T.ConeGeometry(1.4,.5,8),'#e3c89c',x,2.8,z);
  cyl(.63,.63,.12,'#c6a16e',x,.85,z,24);cyl(.08,.13,.8,'#687367',x,.4,z,8);
  for(const dx of [-.9,.9]){box(.5,.12,.5,'#b69970',x+dx,.47,z);box(.08,.48,.08,'#697568',x+dx,.22,z);}
 }
 umbrella(11,.6);umbrella(15,.6);
 function person(x,z,color,rotation=0){
  const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rotation;scene.add(g);
  cyl(.24,.2,.7,color,0,1.05,0,8,g);mesh(new T.SphereGeometry(.21,12,10),'#bc9170',0,1.64,0,g);
  for(const dx of [-.12,.12]){cyl(.075,.08,.65,'#4b5961',dx,.38,0,6,g);box(.16,.11,.29,'#e7e5d6',dx,.07,.08,g);}
  for(const dx of [-.31,.31])cyl(.064,.075,.62,color,dx,.98,0,6,g);
  return g;
 }
 const people=[person(1.8,.3,'#9d675d',-.45),person(3,1,'#607a6d',-1.8)];
 sign('COURTYARD',0,3.2,-14.6,3,.55,'#e6e8d4');
 // The gate and low walls enclose an explorable, legible world.
 for(const x of [-3,3])box(.3,3.4,.3,'#597363',x,1.7,14.7);box(6.5,.3,.4,'#597363',0,3.5,14.7);
 const gateSign=sign('SEE YOU TOMORROW',0,2.9,14.49,4.6,.45,'#d4e3cd');gateSign.rotation.y=Math.PI;
 for(const x of [-17,17]){box(.3,.75,34,'#b6c4ad',x,.4,0);for(let z=-14;z<15;z+=3)cyl(.035,.035,3.5,'#526c63',x*.96,1.75,z,8);}
 for(let i=0;i<16;i++){const x=(i-8)*6;box(4+(i%3),7+(i%5),5,'#adbdb2',x,2.8,-30-(i%3)*5);}
 const keys=new Set();let yaw=0,pitch=0,active=false,visible=true,paused=false,lastTime=0,travel=null,look=null,visit=1,raf=0,disposed=false;
 const ray=new T.Vector3(),viewVector=new T.Vector3();
 function fit(){const r=canvas.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}
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
  if(active&&!paused){
   if(travel){const target=travel[0],dx=target.x-camera.position.x,dz=target.z-camera.position.z,dist=Math.hypot(dx,dz);const angle=Math.atan2(-dx,-dz);let diff=angle-yaw;while(diff>Math.PI)diff-=Math.PI*2;while(diff< -Math.PI)diff+=Math.PI*2;yaw+=diff*Math.min(1,dt*4);pitch*=.94;if(dist<.2){travel.shift();if(!travel.length)travel=null;}else move(dx/dist*Math.min(dist,dt*4.2),dz/dist*Math.min(dist,dt*4.2));
   }else{
    if(keys.has('ArrowLeft'))yaw+=dt*1.4;if(keys.has('ArrowRight'))yaw-=dt*1.4;
    let f=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),r=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0);const n=Math.hypot(f,r)||1;f/=n;r/=n;
    move((-Math.sin(yaw)*f+Math.cos(yaw)*r)*dt*3.4,(-Math.cos(yaw)*f-Math.sin(yaw)*r)*dt*3.4);
   }
  }
  camera.rotation.set(pitch,yaw,0);people.forEach((p,i)=>{p.rotation.z=Math.sin(time*.001+i)*.013;});water.material.color.setHSL(.49,.21,.62+Math.sin(time*.001)*.015);
  renderer.render(scene,camera);
  camera.getWorldDirection(viewVector);
  const landmarks=PLACES.map(p=>{ray.set(p.x,p.labelY,p.z);const delta=ray.clone().sub(camera.position),front=delta.dot(viewVector)>0;ray.project(camera);return {...p,distance:Math.hypot(camera.position.x-p.x,camera.position.z-p.z),screenX:(ray.x+1)/2,screenY:(1-ray.y)/2,visible:front&&ray.z<1&&Math.abs(ray.x)<.96&&Math.abs(ray.y)<.94};});
  if(active&&!paused)onFrame({x:camera.position.x,z:camera.position.z,landmarks,traveling:!!travel});
 }
 raf=requestAnimationFrame(frame);fit();onReady?.();
 return {
  setVisit(value){visit=value;libraryBarrier.visible=visit===2;cafeClosed.visible=visit===3;returnBins.Library.visible=visit!==2;returnBins['Café'].visible=visit===2;scene.background.set(visit===2?'#c1d1d4':'#d2e5e2');scene.fog.color.copy(scene.background);sun.color.set(visit===2?'#ebedef':'#fff0d0');sun.intensity=visit===2?2:3.2;camera.position.set(0,1.72,10);yaw=0;pitch=0;travel=null;stop();},
  setActive(value){active=value;if(!value){stop();travel=null;}},
  setPaused(value){paused=value;if(value)stop();},
  setVisible(value){visible=value;if(!value)stop();},
  go(id){const p=PLACES.find(p=>p.id===id);if(!p)return;active=true;paused=false;stop();const route=planRoute(camera.position,p);travel=route.length?route:null;},
  key(code,down){if(down){travel=null;keys.add(code);}else keys.delete(code);},
  focus(){canvas.focus({preventScroll:true});},
  destroy(){disposed=true;cancelAnimationFrame(raf);resize.disconnect();window.removeEventListener('blur',stop);scene.traverse(o=>{o.geometry?.dispose();});materials.forEach(m=>m.dispose());renderer.dispose();}
 };
}
