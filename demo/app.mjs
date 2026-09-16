import {CHANNELS,initialState,reduce,worldLocation,currentDecision} from './core.mjs';
import {createWorld,PLACES} from './world.mjs?v=campus-anime-20260916';
import {LANGUAGE_STORAGE,resolveLanguage,t,placeLabel,statusLabel,visitCopy,objectiveText,dialogModel,localizeEvent} from './i18n.mjs';
const root=document.querySelector('#campus-demo');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORAGE='always-on-campus-demo-v1';
let state=initialState(),stored=false,savedLanguage=null;
try{const raw=JSON.parse(localStorage.getItem(STORAGE)||'null');if(raw?.version===1&&[1,2,3].includes(raw.visit)&&Array.isArray(raw.log)&&raw.memory&&[1,2].includes(raw.policy)){state=raw;stored=true;}}catch{}
try{savedLanguage=localStorage.getItem(LANGUAGE_STORAGE);}catch{}
const requestedLanguage=new URL(location.href).searchParams.get('lang');
let language=resolveLanguage(['en','zh'].includes(requestedLanguage)?requestedLanguage:savedLanguage,navigator.language);
const tr=(key,vars)=>t(language,key,vars);
const placeName=id=>placeLabel(language,id);
let world=null,dialogOpen=false,activeCard=null,nearest=null,lastPlace=null,insideQuiet=false,visible=true,insightOpen=false,view='event',lastRenderedId=-1;
root.innerHTML=`<div class="demo-stage">
 <canvas class="demo-world" tabindex="0"></canvas>
 <div class="demo-lens" aria-hidden="true"></div>
 <div class="demo-hud-top"><div class="demo-visit"><span class="demo-kicker" data-copy="brand"></span><strong id="demo-time"></strong><span id="demo-visit-label"></span></div><div class="demo-tools"><button type="button" data-demo="insight" aria-expanded="false"><span class="demo-insight-label" data-copy="inside"></span><span class="demo-loop-mini" aria-hidden="true"><i>S</i><i>M</i><i>A</i></span></button><button type="button" class="demo-language" data-demo="language"></button><button type="button" data-demo="fullscreen">⤢</button></div></div>
 <div class="demo-landmarks" aria-hidden="true">${PLACES.map(p=>`<span hidden data-marker="${p.id}"></span>`).join('')}</div>
 <div class="demo-reticle" aria-hidden="true"></div>
 <div class="demo-whisper" role="status" aria-live="polite"></div>
 <div class="demo-dialog demo-scene-dialog" hidden tabindex="-1" role="region"></div>
 <aside class="demo-insight" hidden><div class="demo-insight-top"><strong data-copy="inside"></strong><button type="button" data-demo="close-insight">×</button></div><div class="demo-trace-tabs" role="group"><button type="button" data-inspect="event" data-copy="now" aria-pressed="true"></button><button type="button" data-inspect="memory" data-copy="memory" aria-pressed="false"></button><button type="button" data-inspect="trace" data-copy="trace" aria-pressed="false"></button></div><div class="demo-insight-body"></div></aside>
 <div class="demo-hud-bottom"><div class="demo-mission"><span class="demo-kicker" data-copy="nextMoment"></span><p id="demo-objective"></p></div><button type="button" class="demo-interact" data-demo="interact" disabled><kbd>E</kbd><span></span></button></div>
 <div class="demo-touch"><button type="button" data-move="ArrowUp">↑</button><div><button type="button" data-move="ArrowLeft">←</button><button type="button" data-move="ArrowDown">↓</button><button type="button" data-move="ArrowRight">→</button></div></div>
 <div class="demo-fade" aria-hidden="true"></div>
 </div><div class="demo-controls"><div class="demo-destinations"><span data-copy="walkTo"></span>${PLACES.map(p=>`<button type="button" data-place="${p.id}"></button>`).join('')}</div><div class="demo-control-meta"><span class="demo-desktop-help" data-copy="controls"></span><button type="button" data-demo="loan" data-copy="loan"></button><button type="button" data-demo="restart" data-copy="restart"></button></div></div><div class="demo-local-note"><span id="demo-save-state"></span><span data-copy="simulation"></span></div>`;
const $=s=>root.querySelector(s),stage=$('.demo-stage'),dialog=$('.demo-dialog'),insight=$('.demo-insight'),body=$('.demo-insight-body'),whisper=$('.demo-whisper');
let whisperTimer,whisperMessage=null;
function save(){try{localStorage.setItem(STORAGE,JSON.stringify(state));stored=true;}catch{stored=false;}}
function notificationText(message){return tr(message.key,{...message.vars,...(message.vars?.place?{place:placeName(message.vars.place)}:{})});}
function notify(key,vars={}){whisperMessage={key,vars};whisper.textContent=notificationText(whisperMessage);whisper.classList.add('is-visible');clearTimeout(whisperTimer);whisperTimer=setTimeout(()=>whisper.classList.remove('is-visible'),5500);}
function dispatch(action,payload){const next=reduce(state,action,payload);if(next===state)return false;state=next;save();render();return true;}
function closeCard(){dialog.hidden=true;dialogOpen=false;activeCard=null;root.dataset.intro='false';dialog.classList.remove('demo-intro');dialog.classList.add('demo-scene-dialog');world?.setPaused(false);world?.focus();}
function renderDialog(initial=false){
 if(!activeCard)return;
 const model=dialogModel(language,activeCard.kind,activeCard.state,activeCard.data);
 const scroll=dialog.scrollTop,focused=dialog.contains(document.activeElement)?document.activeElement.closest('[data-demo]')?.dataset.demo:null;
 dialog.classList.toggle('demo-intro',Boolean(model.intro));dialog.classList.toggle('demo-scene-dialog',!model.intro);root.dataset.intro=String(Boolean(model.intro));
 dialog.innerHTML=`<span class="demo-kicker">${esc(model.kicker)}</span><h3>${esc(model.title)}</h3><div class="demo-dialog-copy">${model.paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')}${model.chapters?`<ol class="demo-chapters" aria-label="${esc(tr('aria.chapters'))}">${model.chapters.map((chapter,i)=>`<li><span>0${i+1}</span><strong>${esc(chapter)}</strong></li>`).join('')}</ol>`:''}${model.validation?`<table class="demo-validation"><thead><tr><th scope="col">${esc(tr('validation.context'))}</th><th scope="col">${esc(tr('validation.change'))}</th></tr></thead><tbody>${model.validation.map(row=>`<tr><td>${esc(row.name)}</td><td>${esc(row.before)} → <b>${esc(row.after)}</b> <span aria-label="${esc(tr(row.pass?'validation.pass':'validation.fail'))}">${row.pass?'✓':'×'}</span></td></tr>`).join('')}</tbody></table>`:''}${model.channels?`<div class="demo-channel-summary">${model.channels.map(c=>`<span>${CHANNELS[c].label}</span>`).join('')}</div>`:''}${model.fine?`<p class="demo-fine">${esc(model.fine)}</p>`:''}</div><div class="demo-dialog-actions">${model.actions.map((a,i)=>`<button type="button" data-demo="${a.id}" class="${i===0?'is-primary':''}">${esc(a.label)}</button>`).join('')}</div>`;
 dialog.hidden=false;dialog.scrollTop=initial?0:scroll;
 if(initial)dialog.focus({preventScroll:true});else if(focused)dialog.querySelector(`[data-demo="${focused}"]`)?.focus({preventScroll:true});
}
function card(kind,data={}){
 setInsight(false);activeCard={kind,data:structuredClone(data),state:structuredClone(state)};
 dialogOpen=true;world?.setPaused(true);renderDialog(true);
 const bounds=dialog.getBoundingClientRect();if(bounds.top<110||bounds.bottom>innerHeight-24)dialog.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 if(!matchMedia('(prefers-reduced-motion: reduce)').matches)dialog.animate([{opacity:0,filter:'blur(9px)',transform:'translateY(8px)'},{opacity:1,filter:'blur(0px)',transform:'translateY(0)'}],{duration:800,easing:'ease-out'});
}
function loan(){card('loan');}
function welcome(){card('welcome');}
function renderNearby(){const button=$('[data-demo="interact"]');button.disabled=!nearest;button.querySelector('span').textContent=nearest?(nearest.id==='Gate'?tr('leavePrompt'):tr('explore',{place:placeName(nearest.id)})):tr('approach');}
function renderChrome(){
 root.lang=language==='zh'?'zh-CN':'en';root.dataset.language=language;
 root.querySelectorAll('[data-copy]').forEach(el=>{el.textContent=tr(el.dataset.copy);});
 const labels=[['.demo-world','aria.canvas'],['[data-demo="fullscreen"]','aria.fullscreen'],['[data-demo="language"]','aria.language'],['.demo-dialog','aria.dialog'],['.demo-insight','aria.insight'],['[data-demo="close-insight"]','aria.closeInsight'],['.demo-trace-tabs','aria.tabs'],['.demo-touch','aria.movement'],['[data-move="ArrowUp"]','aria.forward'],['[data-move="ArrowLeft"]','aria.left'],['[data-move="ArrowDown"]','aria.backward'],['[data-move="ArrowRight"]','aria.right'],['.demo-destinations','aria.destinations']];
 labels.forEach(([selector,key])=>$(selector).setAttribute('aria-label',tr(key)));root.setAttribute('aria-label',tr('aria.root'));
 const languageButton=$('[data-demo="language"]');languageButton.textContent=language==='zh'?'EN':'中文';languageButton.lang=language==='zh'?'en':'zh-CN';languageButton.title=tr('aria.language');
 root.querySelectorAll('[data-marker]').forEach(el=>{el.textContent=placeName(el.dataset.marker);});
 root.querySelectorAll('[data-place]').forEach(el=>{el.textContent=el.dataset.place==='Gate'?tr('place.leave'):placeName(el.dataset.place);});
 const section=root.closest('.live-demo-section');
 if(section){section.lang=root.lang;const heading=section.querySelector('#live-demo-title'),eyebrow=section.querySelector('.section-number'),deck=section.querySelector('.section-deck'),caption=section.querySelector('.demo-caption');if(heading)heading.textContent=tr('section.title');if(eyebrow)eyebrow.textContent=tr('section.eyebrow');if(deck)deck.textContent=tr('section.deck');if(caption)caption.innerHTML=`${esc(tr('section.caption'))} <a href="#framework">${esc(tr('section.framework'))}</a>`;}
 if(whisperMessage)whisper.textContent=notificationText(whisperMessage);
 renderNearby();
}
function render(){
 const visit=visitCopy(language,state.visit);root.dataset.started=String(state.started);
 $('#demo-time').textContent=visit.time;$('#demo-visit-label').textContent=tr('visitLabel',{visit:state.visit,title:visit.title});$('#demo-objective').textContent=objectiveText(language,state);$('#demo-save-state').textContent=tr(stored?'saved':'unsaved');
 if(state.last?.id!==lastRenderedId){lastRenderedId=state.last?.id;root.dataset.channel=state.last?.channel||'';$('.demo-loop-mini').dataset.active=CHANNELS[state.last?.channel]?.module||state.last?.channel||'';}
 world?.setCarrying?.(Boolean(state.started&&!state.flags[`${state.visit}:deposited`]&&!state.flags[`${state.visit}:receipt`]));
 renderInsight();
}
function renderInsight(){
 const scroll=body.scrollTop,expanded=new Set([...body.querySelectorAll('details[open]')].map(el=>el.dataset.event));
 root.querySelectorAll('[data-inspect]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.inspect===view)));
 if(view==='memory'){
  const items=[['state.task',state.memory.task?`${state.memory.task.id} · ${statusLabel(language,state.memory.task.status)}`:tr('state.none')],['state.location',state.memory.location?placeName(state.memory.location):tr('state.unobserved')],['state.preference',tr('state.quiet')],['state.raw',tr('state.notRetained')]];
  body.innerHTML=`<span class="demo-kicker">${esc(tr('state.heading'))}</span><dl>${items.map(([label,value])=>`<div><dt>${esc(tr(label))}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl><span class="demo-kicker">${esc(tr('state.policy'))}</span><p class="demo-policy">v${state.policy} · ${esc(tr(`policy.${state.policy}`))}</p><p class="demo-fine">${esc(tr('state.distinction'))}</p>${state.candidate?`<button type="button" data-demo="review">${esc(tr('action.review'))}</button>`:''}${state.committed?`<button type="button" data-demo="rollback">${esc(tr('action.rollback'))}</button>`:''}`;
 }else if(view==='trace'){
  body.innerHTML=`<span class="demo-kicker">${esc(tr('trace.heading'))}</span>${state.log.length?`<ol class="demo-event-list">${[...state.log].reverse().map(raw=>{const e=localizeEvent(language,raw);return `<li><span>${esc(tr('visitShort',{visit:e.visit}))} · ${CHANNELS[e.channel]?.label||e.channel}</span><strong>${esc(e.title)}</strong><p>${esc(e.effect)}</p><details data-event="${e.id}"${expanded.has(String(e.id))?' open':''}><summary>${esc(tr('trace.evidence'))}</summary><p><b>${esc(tr('trace.source'))}</b> ${esc(e.source)}</p><p><b>${esc(tr('trace.signal'))}</b> ${esc(e.payload)}</p></details></li>`;}).join('')}</ol>`:`<p>${esc(tr('trace.empty'))}</p>`}`;
 }else{
  const e=state.last?localizeEvent(language,state.last):null,c=CHANNELS[e?.channel];
  const channelName=c?tr(`channel.${e.channel}.name`):tr(`channel.${['S','M'].includes(e?.channel)?e.channel:'default'}`);
  body.innerHTML=`<div class="demo-sma" aria-label="${esc(tr('aria.modules'))}">${['S','M','A'].map(m=>`<span class="${(e?.channel||'').includes(m)?'active':''}" data-module="${m}">${m}<small>${esc(tr(`module.${m}`))}</small></span>`).join('')}</div>${e?`<span class="demo-channel">${c?.label||e.channel} · ${esc(channelName)}</span><h4>${esc(e.title)}</h4><dl><div><dt>${esc(tr('trace.observedSource'))}</dt><dd>${esc(e.source)}</dd></div><div><dt>${esc(tr('trace.interface'))}</dt><dd>${esc(e.payload)}</dd></div><div><dt>${esc(tr('trace.effect'))}</dt><dd>${esc(e.effect)}</dd></div></dl>${c?`<p class="demo-definition">${esc(tr(`channel.${e.channel}.text`))}</p><a href="#${c.anchor}" data-framework="${c.anchor}">${esc(tr('trace.framework'))}</a>`:''}`:`<p>${esc(tr('trace.intro'))}</p>`}`;
 }
 body.scrollTop=scroll;
}
function setLanguage(next){
 if(next===language)return;language=resolveLanguage(next);
 try{localStorage.setItem(LANGUAGE_STORAGE,language);}catch{}
 const url=new URL(location.href);url.searchParams.set('lang',language);history.replaceState(history.state,'',url);
 renderChrome();render();if(dialogOpen)renderDialog();world?.setLanguage?.(language);
}
function setInsight(open){insightOpen=open;insight.hidden=!open;$('[data-demo="insight"]').setAttribute('aria-expanded',String(open));if(open)$('[data-demo="close-insight"]').focus({preventScroll:true});}
function readNotice(automatic=false){
 const place=nearest?.id||state.memory.location||'Library';const changed=dispatch('notice',{place,automatic});
 if(automatic){if(changed)notify('notify.checked',{place:worldLocation(state.visit)});return;}
 card('notice');
}
function feedback(){card('feedback');}
function review(){card('review');}
function leave(){if(state.visit===3)recap();else card('leave');}
function recap(){card('recap');}
function interact(){
 if(!nearest||!state.started||dialogOpen)return;
 const place=nearest.id,key=`${state.visit}:`;
 if(place==='Gate'){leave();return;}
 if(place==='Courtyard'){dispatch('quiet');card('quiet');return;}
 if(!state.memory.task){loan();return;}
 if(state.visit===1){card('first-visit',{place});return;}
 if(state.memory.task.status==='completed'){if(state.visit===2&&!state.flags[key+'feedback'])feedback();else card('completed');return;}
 if(place!==worldLocation(state.visit)){dispatch('wrong-place',{place});card('closed-point',{place});return;}
 if(state.flags[key+'deposited']){card('deposited');return;}
 card('return',{place});
}
function onFrame(info){
 if(!state.started)return;
 nearest=info.landmarks.filter(p=>p.distance<3.05).sort((a,b)=>a.distance-b.distance)[0]||null;
 info.landmarks.forEach(p=>{const el=root.querySelector(`[data-marker="${p.id}"]`);if(!el)return;el.hidden=!p.visible||p.distance<2;el.style.left=`${p.screenX*100}%`;el.style.top=`${p.screenY*100}%`;el.dataset.target=String(state.memory.location===p.id);});
 const place=nearest?.id||'';if(place!==lastPlace){lastPlace=place;renderNearby();}
 if(dialogOpen)return;
 const quiet=info.landmarks.find(p=>p.id==='Courtyard').distance<3.1;
 if(!state.flags[`${state.visit}:entry`]){dispatch('enter',{quiet});if(state.visit>1&&state.memory.task?.status==='pending'){const choice=currentDecision(state,{quiet});if(choice.action==='wait')notify('notify.wait');else if(choice.action==='check')notify('notify.check');else if(choice.action==='ask')notify('notify.ask');else if(choice.action==='cue')notify('notify.cue',{id:state.memory.task.id,place:choice.target||state.memory.location});}}
 if(quiet&&!insideQuiet&&state.visit>1){if(dispatch('quiet')&&currentDecision(state).action==='wait')notify('notify.wait');}
 if(!quiet&&insideQuiet&&state.visit>1){if(dispatch('resume')){const choice=currentDecision(state);if(choice.action==='cue')notify('notify.resume',{id:state.memory.task.id,place:choice.target});else if(choice.action==='check')notify('notify.check');}}insideQuiet=quiet;
 if(currentDecision(state,{quiet}).action==='check'&&state.flags[`${state.visit}:checkRequested`]&&!state.flags[`${state.visit}:notice`]&&nearest?.id===state.memory.location)readNotice(true);
}
async function init(){
 try{world=createWorld($('.demo-world'),{onFrame,onInteract:interact});world.setLanguage?.(language);world.setVisit(state.visit);world.setActive(state.started);render();welcome();}
 catch(error){console.error('Campus scene unavailable',error);card('unavailable');}
}
root.addEventListener('click',event=>{
 const place=event.target.closest('[data-place]');if(place){if(!state.started)return;closeCard();world?.go(place.dataset.place);return;}
 const tab=event.target.closest('[data-inspect]');if(tab){view=tab.dataset.inspect;body.scrollTop=0;renderInsight();return;}
 const link=event.target.closest('[data-framework]');if(link){document.getElementById(link.dataset.framework)?.click();return;}
 const button=event.target.closest('[data-demo]');if(!button)return;
 const action=button.dataset.demo;
 if(action==='language'){setLanguage(language==='zh'?'en':'zh');return;}
 if(action==='start'){dispatch('start');world?.setActive(true);loan();}
 if(action==='resume-game'||action==='continue'){closeCard();world?.setActive(true);}
 if(action==='save-quiet'){const saved=dispatch('save',{preference:'quiet'});closeCard();if(saved)notify('notify.saved');}
 if(action==='skip-save'){closeCard();notify('notify.skipped');}
 if(action==='loan'){if(state.started)loan();}
 if(action==='forget'){dispatch('forget');closeCard();notify('notify.forgot');}
 if(action==='interact')interact();
 if(action==='read-notice')readNotice();
 if(action==='go-current'){closeCard();world?.go(worldLocation(state.visit));}
 if(action==='go-gate'){closeCard();world?.go('Gate');}
 if(action==='return-book'){dispatch('return',{place:nearest?.id});closeCard();interact();}
 if(action==='receipt'){if(dispatch('receipt',{taskId:state.memory.task?.id})){if(state.visit===2)feedback();else recap();}}
 if(action==='feedback-detour'||action==='feedback-anyway'){dispatch('feedback',{reason:action==='feedback-detour'?'detour':'anyway'});card('feedback-result');}
 if(action==='next'){if(!dispatch('next'))return;world?.setVisit(state.visit);nearest=null;lastPlace=null;insideQuiet=false;if(!matchMedia('(prefers-reduced-motion: reduce)').matches)stage.querySelector('.demo-fade').animate([{opacity:1},{opacity:0}],{duration:1000,easing:'ease-out'});card('next-visit');}
 if(action==='pause'){world?.setActive(false);card('pause');}
 if(action==='review')review();
 if(action==='test-policy'){dispatch('test');review();}
 if(action==='commit'){if(dispatch('commit')){closeCard();notify('notify.commit');}}
 if(action==='keep-policy'){dispatch('keep');closeCard();notify('notify.keep',{version:state.policy});}
 if(action==='rollback'){dispatch('rollback');notify('notify.rollback');}
 if(action==='show-memory'){closeCard();view='memory';setInsight(true);body.scrollTop=0;renderInsight();}
 if(action==='see-trace'){closeCard();view='trace';setInsight(true);body.scrollTop=0;renderInsight();}
 if(action==='insight')setInsight(!insightOpen);
 if(action==='close-insight'){setInsight(false);world?.focus();}
 if(action==='restart'){state=initialState();save();world?.setVisit(1);world?.setActive(false);nearest=null;lastPlace=null;insideQuiet=false;render();welcome();}
 if(action==='go-framework'){location.hash='framework';}
 if(action==='fullscreen'){if(document.fullscreenElement){document.exitFullscreen?.();}else if(root.requestFullscreen){root.requestFullscreen().catch(()=>root.classList.toggle('is-expanded'));}else root.classList.toggle('is-expanded');}
});
root.addEventListener('keydown',event=>{if(event.key==='Escape'){if(insightOpen){setInsight(false);world?.focus();}if(root.classList.contains('is-expanded'))root.classList.remove('is-expanded');}});
root.querySelectorAll('[data-move]').forEach(button=>{
 button.addEventListener('pointerdown',e=>{if(!state.started||dialogOpen)return;e.preventDefault();button.setPointerCapture(e.pointerId);world?.key(button.dataset.move,true);});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>world?.key(button.dataset.move,false));
});
const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;world?.setVisible(visible);if(visible&&!world){observer.unobserve(root);init();const activity=new IntersectionObserver(items=>world?.setVisible(items[0].isIntersecting),{rootMargin:'100px'});activity.observe(root);}},{rootMargin:'200px'});observer.observe(root);
renderChrome();render();
