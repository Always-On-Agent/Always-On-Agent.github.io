import * as T from './vendor/three.module.js';

// The scene shares geometry and batches static props by material. Detail is inexpensive
// enough for a phone; movement and the story remain in world.mjs and core.mjs.
export function buildCampus(scene, camera) {
  const geometries = new Map(), materials = new Map(), textures = new Set(), batches = new Map();
  const labels = [];
  let seed = 20260916, language = 'en';
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const geometry = (key, make) => { if (!geometries.has(key)) geometries.set(key, make()); return geometries.get(key); };
  const cube = geometry('cube', () => new T.BoxGeometry(1,1,1));
  const ball = geometry('ball', () => new T.SphereGeometry(1,12,8));
  const tube = geometry('tube', () => new T.CylinderGeometry(1,1,1,12));
  const taper = geometry('taper', () => new T.CylinderGeometry(.7,1,1,10));
  const plane = geometry('plane', () => new T.PlaneGeometry(1,1));
  const matrix = new T.Object3D();
  function material(color, options = {}) {
    const key = color + JSON.stringify(options);
    if (!materials.has(key)) materials.set(key, new T.MeshStandardMaterial({color, roughness:.83, ...options}));
    return materials.get(key);
  }
  function instance(geo, color, x,y,z, sx=1,sy=1,sz=1, rx=0,ry=0,rz=0, parent=scene, cast=true) {
    const mat = typeof color === 'string' ? material(color) : color;
    const key = `${parent.uuid}:${geo.uuid}:${mat.uuid}:${cast}`;
    if (!batches.has(key)) batches.set(key, {geo, mat, parent, cast, matrices:[]});
    matrix.position.set(x,y,z); matrix.scale.set(sx,sy,sz); matrix.rotation.set(rx,ry,rz); matrix.updateMatrix();
    batches.get(key).matrices.push(matrix.matrix.clone());
  }
  const box = (w,h,d,c,x,y,z,parent=scene,ry=0,rz=0) => instance(cube,c,x,y,z,w,h,d,0,ry,rz,parent);
  const sphere = (c,x,y,z,sx,sy=sx,sz=sx,parent=scene) => instance(ball,c,x,y,z,sx,sy,sz,0,0,0,parent);
  const cylinder = (r,h,c,x,y,z,parent=scene) => instance(tube,c,x,y,z,r,h,r,0,0,0,parent);
  const group = (parent=scene) => { const g=new T.Group();parent.add(g);return g; };
  function canvasTexture(width,height,paint) {
    const c=document.createElement('canvas');c.width=width;c.height=height;paint(c.getContext('2d'),width,height);
    const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;textures.add(texture);return texture;
  }
  function surface(color,kind) {
    const texture=canvasTexture(512,512,(ctx,w,h)=>{
      ctx.fillStyle=color;ctx.fillRect(0,0,w,h);
      for(let i=0;i<4500;i++){ctx.fillStyle=`rgba(${random()>.5?'255,255,244':'70,63,45'},${.035+random()*.05})`;const r=1+random()*2;ctx.fillRect(random()*w,random()*h,r,r);}
      if(kind==='paving'){
        ctx.strokeStyle='#78817430';ctx.lineWidth=2;
        for(let y=0;y<=512;y+=128){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(512,y);ctx.stroke();for(let x=(y/128)%2?128:0;x<512;x+=256){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+128);ctx.stroke();}}
      }
      if(kind==='wood'){for(let i=0;i<40;i++){ctx.strokeStyle=`rgba(56,32,13,${random()*.12})`;ctx.lineWidth=.3+random();ctx.beginPath();ctx.moveTo(random()*w,0);ctx.bezierCurveTo(random()*w,h*.3,random()*w,h*.7,random()*w,h);ctx.stroke();}}
    });
    texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(kind==='paving'?11:3,kind==='paving'?11:3);
    const mat=new T.MeshStandardMaterial({map:texture,roughness:.94});materials.set(`surface-${kind}`,mat);return mat;
  }
  const paving=surface('#d3cbbb','paving'), plaster=surface('#f0e5cb','plaster');
  const wood=material('#78604a'), darkWood=material('#443d35'), warmWood=material('#ae8461');
  const stone=material('#c8c8b6'), iron=material('#3b5553'), roof=material('#769ba1'), roofLight=material('#a1b8b6');
  const interior=material('#595e54'), glass=material('#91bdc6',{roughness:.16,metalness:.2,transparent:true,opacity:.3,depthWrite:false});
  const glow=material('#f2dca9',{emissive:'#edc789',emissiveIntensity:.8});
  // A painted sky gradient with layered, soft-edged cumulus clouds.
  const sky=canvasTexture(2048,1024,(ctx,w,h)=>{
    const grad=ctx.createLinearGradient(0,0,0,h);grad.addColorStop(0,'#287eb0');grad.addColorStop(.4,'#79c5d5');grad.addColorStop(.53,'#d6eadb');grad.addColorStop(.7,'#e8e6c9');grad.addColorStop(1,'#ddd9c4');ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
    for(let i=0;i<38;i++){const x=random()*w,y=140+random()*320,scale=35+random()*105;for(let layer=0;layer<3;layer++){ctx.fillStyle=layer===0?'#c8deded9':layer===1?'#f4f1ddeb':'#fff8e3e8';for(let k=0;k<6;k++){ctx.beginPath();ctx.ellipse(x+(k-2.5)*scale*.45,y-layer*scale*.18-Math.sin(k)*scale*.18,scale*(.5+random()*.35),scale*(.18+random()*.12),0,0,Math.PI*2);ctx.fill();}}}
  });sky.mapping=T.EquirectangularReflectionMapping;scene.background=sky;
  scene.backgroundIntensity=1.05;scene.backgroundBlurriness=.008;
  scene.fog=new T.Fog('#bed8df',32,100);
  // Pavement and a central promenade. Fine texture replaces a giant block grid.
  box(160,.12,160,'#86987b',0,-.2,0);box(33.5,.14,33.5,paving,0,-.08,0);
  box(4.6,.022,31,'#ded9c7',0,.01,0);box(31,.022,4.25,'#ded9c7',0,.012,-3.9);
  for(const x of [-2.35,2.35])box(.1,.025,31,'#b4bda6',x,.025,0);
  for(const z of [-6.08,-1.73])box(31,.025,.1,'#b4bda6',0,.025,z);

  function sign(en,zh,x,y,z,w,h=.5,parent=scene,background='#e4e3cf',ink='#314c49',rotation=0) {
    const c=document.createElement('canvas');c.width=1024;c.height=Math.max(160,Math.round(1024*h/w));
    const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;textures.add(texture);
    const m=new T.MeshBasicMaterial({map:texture,side:T.DoubleSide,toneMapped:false});materials.set(m.uuid,m);
    const face=new T.Mesh(plane,m);face.position.set(x,y,z);face.scale.set(w,h,1);face.rotation.y=rotation;parent.add(face);
    const repaint=()=>{const ctx=c.getContext('2d');ctx.fillStyle=background;ctx.fillRect(0,0,c.width,c.height);ctx.strokeStyle=ink+'45';ctx.lineWidth=3;ctx.strokeRect(13,13,c.width-26,c.height-26);ctx.fillStyle=ink;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`500 ${Math.round(c.height*.44)}px "Noto Sans SC","PingFang SC",Helvetica,Arial,sans-serif`;ctx.fillText(language==='zh'?zh:en,c.width/2,c.height/2,c.width-70);texture.needsUpdate=true;};labels.push(repaint);repaint();return face;
  }
  function branch(a,b,r,color,parent=scene) {
    const from=new T.Vector3(...a),to=new T.Vector3(...b),direction=to.clone().sub(from),center=from.clone().add(to).multiplyScalar(.5);
    const quaternion=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),direction.clone().normalize());
    const euler=new T.Euler().setFromQuaternion(quaternion);
    instance(taper,color,center.x,center.y,center.z,r,direction.length(),r,euler.x,euler.y,euler.z,parent);
  }
  function roofPanel(x,y,z,w,d,angle,parent) {
    instance(cube,roof,x,y,z,w,.14,d,angle,0,0,parent);
    for(let xx=-w/2;xx<=w/2;xx+=.3)instance(cube,roofLight,x+xx,y+.07,z,.035,.035,d,angle,0,0,parent,false);
  }
  function windowBay(x,y,z,w,h,parent,library) {
    box(w,h,.1,interior,x,y,z-.68,parent);
    for(const dx of [-w/2,w/2])box(.11,h+.2,.68,darkWood,x+dx,y,z-.25,parent);
    for(const dy of [-h/2,h/2])box(w+.22,.12,.68,darkWood,x,y+dy,z-.25,parent);
    box(.07,h,.08,wood,x,y,z+.12,parent);box(w,.065,.08,wood,x,y+.17,z+.12,parent);
    instance(plane,glass,x,y,z+.08,w,h,1,0,0,0,parent,false);
    box(w+.38,.13,.86,stone,x,y-h/2-.08,z-.06,parent);
    if(library){
      for(const yy of [-.55,0,.55]){box(w-.2,.07,.23,warmWood,x,y+yy,z-.48,parent);for(let i=0;i<9;i++){const colors=['#8b9b89','#a98168','#c3b08c','#7f8e9d'];box(.12+random()*.055,.32+random()*.12,.14,colors[i%4],x-w*.39+i*w*.09,y+yy+.2,z-.42,parent);}}
    }else{
      box(w*.72,.07,.34,warmWood,x,y-.48,z-.43,parent);cylinder(.075,.14,'#ece4cf',x+.22,y-.37,z-.26,parent);sphere(glow,x,y+.5,z-.32,.12,.18,.12,parent);
      box(.5,h*.9,.055,'#c3bea3',x-w*.38,y,z-.23,parent);
    }
  }
  function building(x,isLibrary) {
    const g=group();g.position.x=x;
    const wall=isLibrary?plaster:material('#e7caaa');
    box(9,.5,6.5,stone,0,.22,-10,g);
    box(9,6.4,.4,wall,0,3.5,-12.85,g);
    for(const xx of [-4.35,4.35])box(.38,6.45,6,wall,xx,3.45,-10,g);
    for(const yy of [.65,3.35,6.35])box(9,.58,.45,wall,0,yy,-7,g);
    for(const xx of [-4.25,-1.5,1.5,4.25])box(.36,5.75,.5,wall,xx,3.55,-6.96,g);
    box(8.5,.15,5.6,'#7a7968',0,3.2,-10,g);box(8.5,.16,5.6,'#8e8d73',0,6.35,-10,g);
    // Central glazed entry, flanking reading rooms, and a real recessed second floor.
    for(const xx of [-2.8,2.8]){windowBay(xx,1.94,-6.94,2.35,2.15,g,isLibrary);windowBay(xx,4.87,-6.94,2.35,2.25,g,isLibrary);}
    windowBay(0,4.87,-6.94,2.5,2.25,g,isLibrary);
    box(2.4,2.45,.14,'#36565b',0,1.69,-7.36,g);box(.08,2.44,.18,warmWood,0,1.69,-7.16,g);
    for(const xx of [-.65,.65]){instance(plane,glass,xx,1.82,-7.07,1.05,1.95,1,0,0,0,g,false);box(.045,.4,.15,'#c6b88e',xx*.25,1.47,-6.99,g);}
    // Continuous eaves and an open timber veranda add depth at human height.
    box(9.65,.18,1.8,wood,0,3.25,-6.25,g);box(9.7,.12,1.86,'#c0b398',0,3.36,-6.25,g);
    for(const xx of [-4.15,-1.58,1.58,4.15]){box(.18,2.9,.18,wood,xx,1.7,-5.55,g);box(.3,.18,.3,stone,xx,.33,-5.55,g);branch([xx,2.48,-5.55],[xx+.42,3.12,-5.55],.075,wood,g);}
    for(let xx=-4.5;xx<4.6;xx+=.4)box(.065,.16,1.8,wood,xx,3.12,-6.25,g);
    box(9.7,.16,6.6,darkWood,0,6.73,-10,g);
    roofPanel(0,7.24,-8.26,9.9,3.78,-.29,g);roofPanel(0,7.24,-11.74,9.9,3.78,.29,g);
    box(10.1,.2,.24,'#65858d',0,7.81,-10,g);
    for(const xx of [-4.65,4.65])cylinder(.045,6.55,'#6e7c76',xx,3.35,-6.94,g);
    sign(isLibrary?'FIELD LIBRARY':'COMMON GROUND',isLibrary?'青岚图书馆':'庭院咖啡',0,3.63,-5.33,3.6,.42,g,'#e7e1ce','#38554b');
    // Open curtains, wall lamps and planted window boxes prevent identical tiled windows.
    for(const xx of [-3.3,3.3]){box(1.5,.3,.48,'#7b765c',xx,3.77,-6.64,g);for(let i=0;i<9;i++)sphere(i%3?'#718e61':'#bdbb82',xx-.65+i*.16,4.0+random()*.15,-6.55,.17,.2,.19,g);}
    for(const xx of [-1.5,1.5]){box(.14,.4,.16,iron,xx,2.2,-6.52,g);sphere(glow,xx,2.2,-6.4,.08,.15,.08,g);}
    if(!isLibrary){
      for(let i=0;i<10;i++)instance(cube,i%2?'#ece0c7':'#bb805d',-3.65+i*.3,2.75,-6.2,.3,.06,1.15,-.14,0,0,g);
      sign('COFFEE · TEA · BOOKS','咖啡 · 茶 · 书',2.78,1.82,-6.7,1.76,.29,g,'#e3d6b5','#5b5443');
    }
  }
  building(-10,true);building(10,false);

  // Story-specific props remain separate groups so visit changes can toggle them.
  const libraryBarrier=group();
  for(const x of [-11.1,-8.9]){box(.1,1.18,.12,warmWood,x,.62,-5.7,libraryBarrier);box(.65,.06,.48,wood,x,.08,-5.7,libraryBarrier);}
  for(const y of [.57,.99])box(2.5,.19,.08,'#c1a56c',-10,y,-5.7,libraryBarrier);
  sign('RETURNS → CAFÉ','还书请前往咖啡馆 →',-10,1.67,-5.61,2.05,.5,libraryBarrier,'#e9ddbd');
  const returnBins={};
  for(const [id,x] of [['Library',-7.5],['Café',12.6]]){
    const g=group();box(.72,1.08,.56,'#4f7363',x,.59,-5.62,g);box(.8,.09,.64,'#819a82',x,1.17,-5.62,g);box(.49,.075,.05,'#203d33',x,1.03,-5.31,g);box(.48,.24,.03,'#c9d3b0',x,.79,-5.32,g);sign('BOOK RETURNS','自助还书',x,1.36,-5.31,.96,.24,g,'#dee3cc');returnBins[id]=g;
  }
  const cafeClosed=group();sign('RETURNS → LIBRARY','还书请前往图书馆 ←',10,1.67,-5.55,2.1,.5,cafeClosed,'#e9ddbd');

  // Clustered leaf cards give trees an irregular, airy outline rather than toy spheres.
  const leafTexture=canvasTexture(128,128,(ctx)=>{
    ctx.clearRect(0,0,128,128);ctx.fillStyle='#ffffff';
    for(let i=0;i<26;i++){const x=17+random()*94,y=17+random()*94;ctx.save();ctx.translate(x,y);ctx.rotate(random()*Math.PI);ctx.beginPath();ctx.ellipse(0,0,5+random()*6,3+random()*4,0,0,Math.PI*2);ctx.fill();ctx.restore();}
  });
  const leafMats=['#4c7856','#6c925d','#96ad68','#b6c580'].map(color=>{const m=new T.MeshLambertMaterial({color,map:leafTexture,alphaTest:.38,side:T.DoubleSide});materials.set(m.uuid,m);return m;});
  function tree(x,z,s=1,planter=false){
    const trunk='#746249';branch([x,0,z],[x+.13*s,3.9*s,z-.15*s],.16*s,trunk);
    for(let i=0;i<7;i++){const angle=i*2.4;branch([x,2.25*s,z],[x+Math.cos(angle)*1.4*s,3.1*s+(i%3)*.47*s,z+Math.sin(angle)*1.25*s],.055*s,trunk);}
    for(let i=0;i<90;i++){
      const a=random()*Math.PI*2,r=Math.sqrt(random())*2.1*s,yy=3.2*s+Math.sqrt(Math.max(0,1-(r/(2.3*s))**2))*1.7*s+(random()-.5)*.9*s;
      instance(plane,leafMats[i%4],x+Math.cos(a)*r,yy,z+Math.sin(a)*r*.85,1.0*s,1.0*s,1,random()*Math.PI,random()*Math.PI,random()*Math.PI,scene,true);
    }
    if(planter){cylinder(1.54,.25,stone,x,.105,z);cylinder(1.4,.05,'#687452',x,.25,z);for(let i=0;i<26;i++){const a=i*2.4,r=.35+random();sphere(i%4?'#74845d':'#a4a67a',x+Math.cos(a)*r,.3+random()*.15,z+Math.sin(a)*r,.2,.11,.2);}}
  }
  [[-6,3,1,true],[6,3,1,true],[-16,-4,1.15], [16,-4,1.1],[-16,9,1.2],[16,9,1.15],[-6,-16,1.4],[6,-16,1.35],[-18,-14,1.35],[18,-14,1.25],[-20,1,1.65],[20,4,1.65]].forEach(p=>tree(...p));
  // Hedges, grasses and small flowers sit at the edges, away from playable paths.
  const flowerColors=['#d9c89e','#c69091','#ede3c8'];
  for(const x of [-15.3,15.3])for(let z=-1;z<13;z+=.55){
    sphere('#71866a',x,.44,z,.42,.35,.47);sphere('#849674',x+.13,.6,z+.1,.28,.23,.34);
    for(let k=0;k<3;k++){const px=x+(random()-.5)*1.1,pz=z+(random()-.5)*.5;branch([px,.15,pz],[px,.55+random()*.3,pz+.06],.014,'#7d8d5e');sphere(flowerColors[k],px,.63+random()*.08,pz,.07,.035,.07);}
  }
  for(const x of [-12,12])for(const z of [6.6,10.1]){
    for(let i=0;i<5;i++){box(3,.06,.105,warmWood,x,.55,z+i*.135);box(3,.1,.085,warmWood,x,.78+i*.105,z-.12);}
    for(const xx of [-1.1,1.1]){box(.07,.54,.55,iron,x+xx,.28,z+.24);box(.07,.88,.06,iron,x+xx,.68,z-.16);box(.06,.06,.65,iron,x+xx,.84,z+.1);}
  }
  // Low reflecting basin, a stone rim, and thin concentric ripples.
  cylinder(2.34,.31,stone,0,.1,-7.4);cylinder(2.17,.33,'#798c84',0,.11,-7.4);
  const waterMaterial=material('#77aca9',{roughness:.17,metalness:.3});
  cylinder(2.13,.025,waterMaterial,0,.286,-7.4);cylinder(.43,.7,stone,0,.59,-7.4);cylinder(.65,.11,stone,0,.93,-7.4);
  const ringGeo=geometry('ring',()=>new T.TorusGeometry(1,.012,4,64));
  for(const r of [.75,1.25,1.8])instance(ringGeo,'#c7dad0',0,.306,-7.4,r,r,r,Math.PI/2,0,0,scene,false);

  function cafeTable(x,z){
    cylinder(.48,.08,warmWood,x,.77,z);cylinder(.045,.75,iron,x,.36,z);cylinder(.27,.035,iron,x,.04,z);
    for(const dx of [-.83,.83]){cylinder(.26,.06,'#9d8870',x+dx,.43,z);for(const sx of [-.17,.17])for(const zz of [-.16,.16])branch([x+dx+sx*.8,.42,z+zz*.8],[x+dx+sx,.03,z+zz],.025,iron);box(.48,.33,.065,'#9d8870',x+dx,.71,z-.23);}
    cylinder(.06,.11,'#e9e0cb',x+.16,.87,z);cylinder(.13,.018,'#ede4ce',x+.16,.803,z);box(.25,.012,.19,'#8a9a8f',x-.17,.821,z+.12,scene,.25);
  }
  cafeTable(11,.6);cafeTable(14,.5);
  const parasolGeo=geometry('parasol',()=>new T.ConeGeometry(1.75,.5,16,1,true));
  for(const [x,z] of [[11,.6],[14,.5]]){cylinder(.028,2.65,wood,x,1.33,z);instance(parasolGeo,'#dfd5b3',x,2.75,z,1,1,1,0,0,0,scene);}
  // Bicycles, a notice board and bins make the courtyard feel inhabited.
  const tire=geometry('tire',()=>new T.TorusGeometry(.34,.024,5,28));
  for(const bx of [-14.2,-12.8]){
    for(const dx of [-.52,.52])instance(tire,iron,bx+dx,.39,-5.32,1,1,1,0,0,0,scene);
    const joints=[[bx-.52,.4,-5.32],[bx-.06,.4,-5.32],[bx-.24,.87,-5.32],[bx+.38,.86,-5.32],[bx+.52,.4,-5.32]];
    for(const [a,b] of [[0,1],[0,2],[1,2],[1,3],[2,3],[3,4]])branch(joints[a],joints[b],.022,'#8d6f5c');
    box(.22,.05,.14,iron,bx-.24,.94,-5.32);branch([bx+.36,.8,-5.32],[bx+.28,1.12,-5.32],.023,iron);box(.18,.025,.3,iron,bx+.28,1.12,-5.32);
  }
  for(const x of [-3.2,3.2]){box(.15,2.9,.15,iron,x,1.45,14.68);box(.3,.2,.3,stone,x,2.96,14.68);}
  box(6.7,.2,.26,iron,0,3.1,14.68);sign('FIELD CAMPUS','青岚校园',0,2.67,14.48,3.5,.45,scene,'#e8e3cf','#415b51',Math.PI);
  for(const x of [-17,17]){box(.25,.6,34,stone,x,.25,0);for(let z=-15;z<15;z+=.45)box(.026,.72,.026,iron,x,.87,z);box(.065,.06,34,iron,x,1.23,0);}
  for(const [x,z] of [[-4.3,10.2],[4.3,10.2],[-15,-1],[15,-1]]){
    cylinder(.045,3.9,iron,x,1.95,z);sphere(glow,x,3.78,z,.17,.24,.17);cylinder(.23,.075,iron,x,4.02,z);
  }

  // Adult proportions, bent arms and layered clothes. Faces are deliberately subtle.
  const people=[];
  function person(x,z,coat,rotation=0,longHair=false){
    const g=group();g.position.set(x,0,z);g.rotation.y=rotation;
    const skin=material('#cba88b'),hair=material(longHair?'#4d4036':'#343c3b'),trousers=material('#4d5963');
    for(const dx of [-.09,.09]){branch([dx,.8,0],[dx*1.15,.4,.025],.066,trousers,g);branch([dx*1.15,.42,.025],[dx*1.25,.08,.05],.057,trousers,g);sphere('#4e4b44',dx*1.25,.075,.115,.078,.06,.14,g);}
    instance(taper,coat,0,1.1,0,.205,.59,.13,0,0,0,g);sphere(coat,0,1.34,0,.21,.095,.135,g);
    cylinder(.052,.09,skin,0,1.435,0,g);sphere(skin,0,1.59,.012,.115,.145,.105,g);
    const scalp=geometry('scalp',()=>new T.SphereGeometry(1,12,8,0,Math.PI*2,0,Math.PI*.62));instance(scalp,hair,0,1.64,0,.122,.113,.117,0,0,0,g);
    if(longHair)sphere(hair,0,1.49,-.052,.122,.18,.076,g);
    sphere(skin,0,1.576,.116,.022,.032,.025,g);
    for(const dx of [-.039,.039])sphere('#4b4640',dx,1.61,.109,.011,.008,.007,g);
    branch([-.21,1.29,0],[-.3,1.03,.04],.061,coat,g);branch([-.3,1.03,.04],[-.22,.88,.18],.049,coat,g);sphere(skin,-.22,.86,.2,.044,.063,.043,g);
    branch([.21,1.29,0],[.3,1.13,.13],.061,coat,g);branch([.3,1.13,.13],[.13,1.17,.28],.047,coat,g);sphere(skin,.12,1.17,.3,.044,.055,.041,g);
    box(.23,.32,.09,'#8e7b60',-.19,.96,-.09,g);branch([-.19,1.35,-.05],[.16,.84,.04],.018,'#91816b',g);
    people.push(g);return g;
  }
  person(2.2,.3,'#9c8272',-.58,true);person(3.3,1.1,'#657d78',-2.1,false);person(13.8,2.5,'#9d977e',-.7,true);

  // Distant campus silhouettes and layered hills provide atmospheric perspective.
  for(let i=0;i<13;i++){
    const x=(i-6)*7,h=5+random()*6,z=-31-random()*8;
    box(5,h,5,i%2?'#9dafaa':'#b2bfb1',x,h/2-.6,z);
    for(let yy=2;yy<h;yy+=1.7)for(let xx=-1.6;xx<=1.6;xx+=1.1)box(.58,.9,.025,'#849e9b',x+xx,yy,z+2.52);
    instance(cube,'#7e9897',x,h-.2,z,5.3,.25,5.4,0,0,0,scene,false);
  }
  function mountain(z,color,height){
    const shape=new T.Shape();shape.moveTo(-95,-3);for(let x=-95;x<=95;x+=6)shape.lineTo(x,height+Math.sin(x*.1)*3+random()*5);shape.lineTo(95,-3);shape.closePath();
    const geo=new T.ShapeGeometry(shape);geometries.set(geo.uuid,geo);const m=new T.MeshBasicMaterial({color,fog:true});materials.set(m.uuid,m);const ridge=new T.Mesh(geo,m);ridge.position.set(0,0,z);scene.add(ridge);
  }
  mountain(-69,'#b2c8bd',14);mountain(-57,'#98b5ad',10);

  // A low, peripheral book anchors the first-person view without covering the HUD.
  const carrying=group(camera);camera.add(carrying);scene.add(camera);
  carrying.position.set(.47,-.4,-.72);carrying.scale.setScalar(.83);carrying.rotation.set(-.24,-.33,.13);
  box(.235,.315,.035,'#58716b',0,0,0,carrying);box(.218,.291,.038,'#e8dfc8',-.004,0,-.001,carrying);box(.237,.32,.008,'#58716b',0,0,.027,carrying);
  const coverCanvas=document.createElement('canvas');coverCanvas.width=512;coverCanvas.height=720;
  const coverTexture=new T.CanvasTexture(coverCanvas);coverTexture.colorSpace=T.SRGBColorSpace;textures.add(coverTexture);
  const coverMaterial=new T.MeshStandardMaterial({map:coverTexture,roughness:.9});materials.set(coverMaterial.uuid,coverMaterial);
  const cover=new T.Mesh(plane,coverMaterial);cover.position.set(0,0,.034);cover.scale.set(.235,.318,1);carrying.add(cover);
  const repaintCover=()=>{
    const ctx=coverCanvas.getContext('2d');ctx.fillStyle='#547269';ctx.fillRect(0,0,512,720);
    ctx.strokeStyle='#bcbf96';ctx.lineWidth=1.4;ctx.strokeRect(30,30,452,660);ctx.strokeRect(39,39,434,642);
    ctx.fillStyle='#e1dec2';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font=language==='zh'?'500 56px "PingFang SC","Noto Sans SC",sans-serif':'500 47px Georgia,serif';ctx.fillText(language==='zh'?'观察手记':'FIELDNOTES',256,155,420);
    ctx.font='400 18px Georgia,serif';ctx.fillText(language==='zh'?'A CAMPUS JOURNAL':'A  C A M P U S  J O U R N A L',256,214,400);
    ctx.beginPath();ctx.moveTo(180,250);ctx.lineTo(332,250);ctx.stroke();
    // A fine botanical plate, drawn directly on the linen-like cover.
    ctx.strokeStyle='#ced1a4';ctx.lineWidth=2.4;ctx.beginPath();ctx.moveTo(238,556);ctx.bezierCurveTo(274,460,223,399,268,315);ctx.stroke();
    for(let i=0;i<8;i++){
      const y=355+i*22,x=252+Math.sin(i*.8)*9,side=i%2?1:-1;
      ctx.beginPath();ctx.moveTo(x,y+16);ctx.bezierCurveTo(x+side*34,y+12,x+side*62,y-17,x+side*50,y-34);ctx.bezierCurveTo(x+side*16,y-22,x+side*8,y-6,x,y+16);ctx.stroke();
    }
    ctx.font='400 17px Georgia,serif';ctx.fillStyle='#d1d0ad';ctx.fillText(language==='zh'?'青 岚 校 园':'FIELD CAMPUS',256,617);
    ctx.fillStyle='#354f4833';ctx.fillRect(0,0,16,720);coverTexture.needsUpdate=true;
  };labels.push(repaintCover);repaintCover();
  // Only the thumb and fingertips catch the book edge; the palm stays out of view.
  sphere('#cba78c',.123,-.067,.051,.019,.055,.02,carrying);
  for(let i=0;i<3;i++)sphere('#cba78c',.107,-.109+i*.023,-.021,.031,.011,.024,carrying);

  // One draw call per shared material/geometry/group, rather than one per brick or leaf.
  for(const batch of batches.values()){
    const instanced=new T.InstancedMesh(batch.geo,batch.mat,batch.matrices.length);
    batch.matrices.forEach((value,i)=>instanced.setMatrixAt(i,value));instanced.instanceMatrix.needsUpdate=true;
    instanced.castShadow=batch.cast&&batch.parent!==carrying;instanced.receiveShadow=batch.parent!==carrying;batch.parent.add(instanced);
  }
  return {
    libraryBarrier,cafeClosed,returnBins,people,waterMaterial,carrying,
    setLanguage(value){language=value==='zh'?'zh':'en';labels.forEach(repaint=>repaint());},
    dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());},
    setSky(url){return new Promise((resolve,reject)=>new T.TextureLoader().load(url,texture=>{texture.colorSpace=T.SRGBColorSpace;texture.mapping=T.EquirectangularReflectionMapping;textures.add(texture);scene.background=texture;resolve();},undefined,reject));},
    setPaving(url){return new Promise((resolve,reject)=>new T.TextureLoader().load(url,texture=>{texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.MirroredRepeatWrapping;texture.repeat.set(6,6);texture.anisotropy=4;textures.add(texture);paving.map=texture;paving.needsUpdate=true;resolve();},undefined,reject));}
  };
}
