import {CHANNELS,VISITS,initialState,reduce,objective,worldLocation,currentDecision} from './core.mjs';
import {createWorld,PLACES} from './world.mjs';
const root=document.querySelector('#campus-demo');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORAGE='always-on-campus-demo-v1';
let state=initialState(),stored=false;
try{const raw=JSON.parse(localStorage.getItem(STORAGE)||'null');if(raw?.version===1&&[1,2,3].includes(raw.visit)&&Array.isArray(raw.log)&&raw.memory&&[1,2].includes(raw.policy)){state=raw;stored=true;}}catch{}
let world=null,dialogOpen=false,nearest=null,lastPlace=null,insideQuiet=false,visible=true,insightOpen=false,view='event',lastRenderedId=-1;
root.innerHTML=`<div class="demo-stage">
 <canvas class="demo-world" tabindex="0" aria-label="Explore the campus. W A S D or up/down to move, left/right to turn, drag to look, E to interact. Escape releases keyboard control."></canvas>
 <div class="demo-lens" aria-hidden="true"></div>
 <div class="demo-hud-top"><div class="demo-visit"><span class="demo-kicker">FIELDNOTES / A CAMPUS LOOP</span><strong id="demo-time"></strong><span id="demo-visit-label"></span></div><div class="demo-tools"><button type="button" data-demo="insight" aria-expanded="false">Inside the loop <span class="demo-loop-mini"><i>S</i><i>M</i><i>A</i></span></button><button type="button" data-demo="fullscreen" aria-label="Expand the demo">⤢</button></div></div>
 <div class="demo-landmarks" aria-hidden="true">${PLACES.map(p=>`<span hidden data-marker="${p.id}">${p.name}</span>`).join('')}</div>
 <div class="demo-reticle" aria-hidden="true"></div>
 <div class="demo-whisper" role="status" aria-live="polite"></div>
 <div class="demo-dialog" hidden tabindex="-1" role="region" aria-label="Glasses interaction"></div>
 <aside class="demo-insight" hidden aria-label="Live framework trace"><div class="demo-insight-top"><strong>Inside the loop</strong><button type="button" data-demo="close-insight" aria-label="Close framework trace">×</button></div><div class="demo-trace-tabs" role="group" aria-label="Inspect the loop"><button type="button" data-inspect="event" aria-pressed="true">Now</button><button type="button" data-inspect="memory" aria-pressed="false">Memory</button><button type="button" data-inspect="trace" aria-pressed="false">Trace</button></div><div class="demo-insight-body"></div></aside>
 <div class="demo-hud-bottom"><div class="demo-mission"><span class="demo-kicker">YOUR NEXT MOMENT</span><p id="demo-objective"></p></div><button type="button" class="demo-interact" data-demo="interact" disabled><kbd>E</kbd><span>Move closer to explore</span></button></div>
 <div class="demo-touch" aria-label="Movement controls"><button type="button" data-move="ArrowUp" aria-label="Walk forward">↑</button><div><button type="button" data-move="ArrowLeft" aria-label="Turn left">←</button><button type="button" data-move="ArrowDown" aria-label="Walk backward">↓</button><button type="button" data-move="ArrowRight" aria-label="Turn right">→</button></div></div>
 <div class="demo-fade" aria-hidden="true"></div>
 </div><div class="demo-controls"><div class="demo-destinations" aria-label="Walk to a place"><span>WALK TO</span>${PLACES.map(p=>`<button type="button" data-place="${p.id}">${p.id==='Café'?'Café':p.id==='Gate'?'Leave campus':p.id}</button>`).join('')}</div><div class="demo-control-meta"><span class="demo-desktop-help">WASD · drag to look · E to interact</span><button type="button" data-demo="loan">Loan slip</button><button type="button" data-demo="restart">Restart</button></div></div><div class="demo-local-note"><span id="demo-save-state"></span><span>Simulated vision · no camera or microphone</span></div>`;
const $=s=>root.querySelector(s),stage=$('.demo-stage'),dialog=$('.demo-dialog'),insight=$('.demo-insight'),body=$('.demo-insight-body'),whisper=$('.demo-whisper');
let whisperTimer;
function save(){try{localStorage.setItem(STORAGE,JSON.stringify(state));stored=true;}catch{stored=false;}}
function notify(text){whisper.textContent=text;whisper.classList.add('is-visible');clearTimeout(whisperTimer);whisperTimer=setTimeout(()=>whisper.classList.remove('is-visible'),5500);}
function dispatch(action,payload){const next=reduce(state,action,payload);if(next===state)return false;state=next;save();render();return true;}
function closeCard(){dialog.hidden=true;dialogOpen=false;world?.setPaused(false);world?.focus();}
function card(title,text,actions,kicker='YOUR GLASSES'){
 setInsight(false);
 dialogOpen=true;world?.setPaused(true);dialog.innerHTML=`<span class="demo-kicker">${kicker}</span><h3>${title}</h3><div class="demo-dialog-copy">${text}</div><div class="demo-dialog-actions">${actions.map((a,i)=>`<button type="button" data-demo="${a.id}" class="${i===0?'is-primary':''}">${a.label}</button>`).join('')}</div>`;dialog.hidden=false;dialog.scrollTop=0;dialog.focus({preventScroll:true});
 const bounds=dialog.getBoundingClientRect();if(bounds.top<110||bounds.bottom>innerHeight-24)dialog.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 if(!matchMedia('(prefers-reduced-motion: reduce)').matches)dialog.animate([{opacity:0,filter:'blur(9px)',transform:'translateY(8px)'},{opacity:1,filter:'blur(0px)',transform:'translateY(0)'}],{duration:800,easing:'ease-out'});
}
function loan(){
 if(state.memory.task?.status==='completed'){card('This loan is already closed.',`<p>The matching receipt completed <strong>${esc(state.memory.task.id)}</strong>. A completed loan does not create another return task.</p>`,[{id:'continue',label:'Keep exploring'},{id:'go-gate',label:'Walk to the gate'}],'PERSONAL MEMORY / COMPLETED');return;}
 if(state.memory.task?.status==='pending'){card('A small, unfinished thing.',`<p><strong>${esc(state.memory.task.id)}</strong> · Return your book ${esc(state.memory.task.due.toLowerCase())}.</p><p>Retained from the loan slip. Your preferred cue is ${esc(state.memory.preference)}.</p>`,[{id:'continue',label:'Keep exploring'},{id:'forget',label:'Forget this commitment'}],'PERSONAL MEMORY');return;}
 card('Something for later.',`<p>Your loan slip says: <strong>return book ${state.visit===3?'B18':'B17'} ${state.visit===1?'tomorrow afternoon':'during this visit'}.</strong></p><p>What you see can be temporary. Choose what your glasses should keep.</p>`,[{id:'save-quiet',label:'Remember · quiet visual cues'},{id:'skip-save',label:'Keep it in this moment only'}],'SENSING → MEMORY');
}
function welcome(){
 card(state.started?'Welcome back to your afternoon.':'One unfinished thing.',`<p>A book to return. A familiar campus. An assistant that keeps the thread.</p><p>Walk freely through three visits. Your choices become the story—and the framework.</p><p class="demo-fine">Checks run at campus entry and near relevant places while this demo is open. Only fictional state is saved on this device.</p>`,[{id:state.started?'resume-game':'start',label:state.started?'Continue my visit':'Put on the glasses'}],state.started?'YOUR STORY IS SAVED':'FIRST-PERSON / 3 SHORT VISITS');
}
function render(){
 $('#demo-time').textContent=VISITS[state.visit].time;$('#demo-visit-label').textContent=`Visit ${state.visit} / 3 · ${VISITS[state.visit].label}`;$('#demo-objective').textContent=objective(state);$('#demo-save-state').textContent=stored?'Your fictional story is saved on this device.':'Local demo · this visit stays in memory until saved.';
 if(state.last?.id!==lastRenderedId){lastRenderedId=state.last?.id;root.dataset.channel=state.last?.channel||'';$('.demo-loop-mini').dataset.active=CHANNELS[state.last?.channel]?.module||state.last?.channel||'';}
 renderInsight();
}
function renderInsight(){
 root.querySelectorAll('[data-inspect]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.inspect===view)));
 if(view==='memory'){
  body.innerHTML=`<span class="demo-kicker">PERSONAL STATE · m</span><dl><div><dt>Commitment</dt><dd>${state.memory.task?`${esc(state.memory.task.id)} · ${esc(state.memory.task.status)}`:'Nothing retained'}</dd></div><div><dt>Last known return point</dt><dd>${esc(state.memory.location||'Not observed')}</dd></div><div><dt>Cue preference</dt><dd>${esc(state.memory.preference)} · campus errands</dd></div><div><dt>Raw video / conversation</dt><dd>Not retained</dd></div></dl><span class="demo-kicker">CONTROL POLICY · θ</span><p class="demo-policy">v${state.policy} · ${state.policy===2?'Check current availability before giving directions.':'Use the last known point for a directional cue.'}</p><p class="demo-fine">Changing a place or preference updates personal content. Changing this decision rule updates policy.</p>${state.candidate?'<button type="button" data-demo="review">Review the candidate rule</button>':''}${state.committed?'<button type="button" data-demo="rollback">Undo policy v2</button>':''}`;
 }else if(view==='trace'){
  body.innerHTML=`<span class="demo-kicker">YOUR EVENT TRACE</span>${state.log.length?`<ol class="demo-event-list">${[...state.log].reverse().map(e=>`<li><span>Visit ${e.visit} · ${CHANNELS[e.channel]?.label||e.channel}</span><strong>${esc(e.title)}</strong><p>${esc(e.effect)}</p><details><summary>Follow the evidence</summary><p><b>Source</b> ${esc(e.source)}</p><p><b>Signal</b> ${esc(e.payload)}</p></details></li>`).join('')}</ol>`:'<p>Your actions will appear here.</p>'}`;
 }else{
  const e=state.last,c=CHANNELS[e?.channel];
  body.innerHTML=`<div class="demo-sma" aria-label="Sensing, Memory, Action">${['S','M','A'].map(m=>`<span class="${(e?.channel||'').includes(m)?'active':''}" data-module="${m}">${m}<small>${{S:'Sensing',M:'Memory',A:'Action'}[m]}</small></span>`).join('')}</div>${e?`<span class="demo-channel">${c?.label||e.channel} · ${c?.name||{S:'Current observation',M:'Persistent state'}[e.channel]||'Decision'}</span><h4>${esc(e.title)}</h4><dl><div><dt>Observed source</dt><dd>${esc(e.source)}</dd></div><div><dt>Signal across the interface</dt><dd>${esc(e.payload)}</dd></div><div><dt>What changes</dt><dd>${esc(e.effect)}</dd></div></dl>${c?`<p class="demo-definition">${c.text}</p><a href="#${c.anchor}" data-framework="${c.anchor}">Read this channel in the framework ↗</a>`:''}`:'<p>Explore the campus. After each event, see which information crossed between modules.</p>'}`;
 }
}
function setInsight(open){insightOpen=open;insight.hidden=!open;$('[data-demo="insight"]').setAttribute('aria-expanded',String(open));if(open)$('[data-demo="close-insight"]').focus({preventScroll:true});}
function readNotice(automatic=false){
 const place=nearest?.id||state.memory.location||'Library';dispatch('notice',{place,automatic});
 if(automatic){notify(`Checked today's notice: returns are at ${worldLocation(state.visit)}.`);return;}
 card('A prior meets today.',`<p>${state.visit===2?'The library entrance is closed for maintenance. <strong>Today, return books at the café desk.</strong>':state.visit===3?'The café desk is no longer accepting returns. <strong>The library has reopened.</strong>':'The library accepts returns. Your book is due tomorrow afternoon.'}</p><p>A current sign can correct yesterday’s memory. The controller’s rule stays the same.</p>`,[{id:'go-current',label:`Walk to ${worldLocation(state.visit)}`},{id:'continue',label:'Explore my own route'}],'FRESH OBSERVATION');
}
function feedback(){
 const detour=state.flags[`${state.visit}:detourCue`];
 card('What actually happened?',`<p>The receipt confirms the book was returned. It does not tell us whether the reminder helped.</p><p>What should the assistant learn from this visit?</p>`,[...(detour?[{id:'feedback-detour',label:'The closed-door cue caused a detour'}]:[]),{id:'feedback-anyway',label:'I was going to return it anyway'}],'OUTCOME → ATTRIBUTION');
}
function review(){
 if(!state.candidate){card('Keep the distinction clear.',`<p>Your book’s status can be corrected by a receipt. A lasting policy change needs attributed evidence.</p><p>This run has not linked a detour to the earlier cue, so no policy revision is proposed.</p>`,[{id:'continue',label:'Keep exploring'}],'PERSONAL STATE ≠ POLICY');return;}
 const rows=state.validation;
 card(rows?'Check before keeping.':'A change worth testing?',`<p><b>Current rule:</b> direct you to the last known return point.</p><p><b>Candidate:</b> check current availability before a non-urgent directional cue.</p>${rows?`<table class="demo-validation"><thead><tr><th>New test context</th><th>v1 → v2</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.name)}</td><td>${esc(r.before)} → <b>${esc(r.after)}</b> <span>${r.pass?'✓':'×'}</span></td></tr>`).join('')}</tbody></table><p class="demo-fine">${rows.filter(r=>r.pass).length}/${rows.length} deterministic rule checks pass. This tests the rule’s behavior, not real-world benefit.</p>`:'<p>Test fresh contexts before changing future behavior. The earlier detour is the reason to propose—not the test result.</p>'}`,rows?[{id:'commit',label:'Accept and keep v2'},{id:'keep-policy',label:'Keep the current rule'}]:[{id:'test-policy',label:'Run the five rule checks'},{id:'keep-policy',label:'Keep the current rule'}],'GOVERNED POLICY REVISION');
}
function leave(){
 if(state.visit===2&&state.memory.task?.status==='pending'){card('The thread is still open.',`<p>${state.flags['2:deposited']?'The book is in the slot, but no receipt has been checked.':'Your book is still pending. You can stop now and resume here later.'}</p><p>Leaving a conversation does not erase this commitment.</p>`,[{id:'continue',label:'Keep exploring'},{id:'pause',label:'Pause this visit'}],'UNFINISHED COMMITMENT');return;}
 if(state.visit===3){recap();return;}
 card('An interaction ends.',`<p>${state.memory.task?`<strong>${esc(state.memory.task.id)} · ${esc(state.memory.task.status)}</strong> stays in memory.`:'No commitment was saved. Tomorrow’s assistant will have no retained task to resume.'}</p><p>${state.visit===1?'Come back tomorrow. The world will not be quite the same.':'Return on Friday with a different book. You can try a better rule—or keep the current one.'}</p>`,[{id:'next',label:state.visit===1?'Come back tomorrow':'Return on Friday'},{id:'continue',label:'Stay a little longer'}],'ACROSS A VISIT BOUNDARY');
}
function recap(){
 const channels=[...new Set(state.log.map(e=>e.channel))].filter(c=>CHANNELS[c]);
 card(state.complete?'The next visit starts differently.':'Your loop is still open.',`<p>${state.complete?'A different book reached a verified outcome.':'You can keep exploring and close the outstanding commitment.'}</p><p><b>Personal state:</b> ${state.memory.task?`${esc(state.memory.task.id)} · ${esc(state.memory.task.status)}`:'no retained task'}.</p><p><b>Policy:</b> v${state.policy}${state.committed?' · validated in synthetic checks and explicitly accepted':' · unchanged'}.</p><div class="demo-channel-summary">${channels.map(c=>`<span>${CHANNELS[c].label}</span>`).join('')}</div><p class="demo-fine">These are mechanisms you experienced in a scripted world, not a HALO certification or evidence of real-world service quality.</p>`,[{id:'see-trace',label:'Inspect my event trace'},{id:'continue',label:'Keep exploring'},{id:'restart',label:'Replay a different choice'}],'YOUR STORY / YOUR EVIDENCE');
}
function interact(){
 if(!nearest||!state.started||dialogOpen)return;
 const place=nearest.id,key=`${state.visit}:`;
 if(place==='Gate'){leave();return;}
 if(place==='Courtyard'){dispatch('quiet');card('Some moments need no prompt.','<p>A conversation is in progress. Your glasses hold the non-urgent cue until you leave this area.</p><p>Waiting is an action decision. The conversation itself is not saved.</p>',[{id:'continue',label:'Stay in the moment'},{id:'show-memory',label:'See what was retained'}],'ACTION / WAIT');return;}
 if(!state.memory.task){loan();return;}
 if(state.visit===1){card(place==='Library'?'There is still time.':'Take the long way.','<p>The loan is due tomorrow. Today you can explore the courtyard and café, then leave campus.</p><p>The point is what survives when this visit ends.</p>',[{id:'continue',label:'Keep exploring'},{id:'go-gate',label:'Walk to the gate'}],'VISIT 1 / AN OPEN COMMITMENT');return;}
 if(state.memory.task.status==='completed'){
  if(state.visit===2&&!state.flags[key+'feedback'])feedback();else card('No duplicate reminder.','<p>The receipt closed this task. Your glasses keep the outcome without asking you to return the book again.</p>',[{id:'go-gate',label:'Walk to the gate'},{id:'continue',label:'Keep exploring'}],'MEMORY / COMPLETED');return;
 }
 if(place!==worldLocation(state.visit)){
  dispatch('wrong-place',{place});card('This point is closed.',`<p>You reached ${esc(place)}, but returns are unavailable here today.</p><p>The remembered destination alone was not enough. There is a new notice beside the door.</p>`,[{id:'read-notice',label:'Look at today’s notice'},{id:'continue',label:'Explore without updating'}],'SENSING / CORRECTIVE EVIDENCE');return;
 }
 if(state.flags[key+'deposited']){card('A book in the slot. A task still open.','<p>The kiosk can confirm the book ID and this return. Check that evidence before treating the commitment as complete.</p>',[{id:'receipt',label:'Read the matching receipt'},{id:'continue',label:'Leave it unverified for now'}],'ACTION → SENSING');return;}
 card('You found the return point.',`<p>Return <strong>${esc(state.memory.task.id)}</strong> at ${esc(place)}.</p><p>You perform the physical action. The glasses can then check whether the expected outcome was recorded.</p>`,[{id:'return-book',label:'Place the book in the slot'},{id:'continue',label:'Not yet'}],'YOUR ACTION / THE ASSISTANT CHECKS');
}
function onFrame(info){
 if(!state.started)return;
 nearest=info.landmarks.filter(p=>p.distance<3.05).sort((a,b)=>a.distance-b.distance)[0]||null;
 info.landmarks.forEach(p=>{const el=root.querySelector(`[data-marker="${p.id}"]`);el.hidden=!p.visible||p.distance<2;el.style.left=`${p.screenX*100}%`;el.style.top=`${p.screenY*100}%`;el.dataset.target=String(state.memory.location===p.id);});
 const place=nearest?.id||'';
 if(place!==lastPlace){lastPlace=place;const button=$('[data-demo="interact"]');button.disabled=!nearest;button.querySelector('span').textContent=nearest?(nearest.id==='Gate'?'Leave / next visit':`Explore ${nearest.id}`):'Move closer to explore';}
 if(dialogOpen)return;
 const quiet=info.landmarks.find(p=>p.id==='Courtyard').distance<3.1;
 if(!state.flags[`${state.visit}:entry`]){dispatch('enter',{quiet});if(state.visit>1&&state.memory.task?.status==='pending'){const choice=currentDecision(state,{quiet});notify(choice.action==='wait'?'A conversation nearby. Holding the non-urgent cue.':choice.action==='check'?'Before a cue, check whether the remembered return point is open.':`Still pending: ${state.memory.task.id}. Last known return point: ${choice.target||state.memory.location}.`);}}
 if(quiet&&!insideQuiet&&state.visit>1){if(dispatch('quiet')&&currentDecision(state).action==='wait')notify('A conversation nearby. Holding the non-urgent cue.');}
 if(!quiet&&insideQuiet&&state.visit>1){if(dispatch('resume')){const choice=currentDecision(state);if(choice.action==='cue')notify(`A quiet moment. ${state.memory.task.id} is still pending at ${choice.target}.`);else if(choice.action==='check')notify('A quiet moment. Check current availability before giving directions.');}}insideQuiet=quiet;
 if(currentDecision(state,{quiet}).action==='check'&&state.flags[`${state.visit}:checkRequested`]&&!state.flags[`${state.visit}:notice`]&&nearest?.id===state.memory.location)readNotice(true);
}
async function init(){
 try{world=createWorld($('.demo-world'),{onFrame,onInteract:interact});world.setVisit(state.visit);world.setActive(state.started);render();welcome();}
 catch(error){console.error('Campus scene unavailable',error);card('The 3D view could not start.','<p>This demo needs WebGL. You can still explore the paper’s interactive Sensing–Memory–Action framework.</p>',[{id:'go-framework',label:'Open the framework'}],'DEMO UNAVAILABLE');}
}
root.addEventListener('click',event=>{
 const place=event.target.closest('[data-place]');if(place){if(!state.started)return;closeCard();world?.go(place.dataset.place);return;}
 const tab=event.target.closest('[data-inspect]');if(tab){view=tab.dataset.inspect;renderInsight();return;}
 const link=event.target.closest('[data-framework]');if(link){document.getElementById(link.dataset.framework)?.click();return;}
 const button=event.target.closest('[data-demo]');if(!button)return;
 const action=button.dataset.demo;
 if(action==='start'){dispatch('start');world?.setActive(true);loan();}
 if(action==='resume-game'||action==='continue'){closeCard();world?.setActive(true);}
 if(action==='save-quiet'){dispatch('save',{preference:'quiet'});closeCard();notify('A task, source and quiet-cue preference kept. The raw scene stays temporary.');}
 if(action==='skip-save'){closeCard();notify('Observed, not retained. Tomorrow’s service will not have this commitment.');}
 if(action==='loan'){if(state.started)loan();}
 if(action==='forget'){dispatch('forget');closeCard();notify('Commitment removed. Future reminders from this record stop.');}
 if(action==='interact')interact();
 if(action==='read-notice')readNotice();
 if(action==='go-current'){closeCard();world?.go(worldLocation(state.visit));}
 if(action==='go-gate'){closeCard();world?.go('Gate');}
 if(action==='return-book'){dispatch('return',{place:nearest?.id});closeCard();interact();}
 if(action==='receipt'){dispatch('receipt',{taskId:state.memory.task?.id});if(state.visit===2)feedback();else recap();}
 if(action==='feedback-detour'||action==='feedback-anyway'){dispatch('feedback',{reason:action==='feedback-detour'?'detour':'anyway'});card('The update has a scope.',`<p>${state.candidate?'The closed point and your report support a specific candidate: verify availability before directing you. The rule is not changed yet.':'The receipt closes the task. Your report gives no reason to credit the reminder or revise its rule.'}</p>`,[{id:'go-gate',label:'Walk to the gate'},{id:'show-memory',label:'Inspect state and policy'}],'ACTION → MEMORY');}
 if(action==='next'){dispatch('next');world?.setVisit(state.visit);nearest=null;lastPlace=null;insideQuiet=false;if(!matchMedia('(prefers-reduced-motion: reduce)').matches)stage.querySelector('.demo-fade').animate([{opacity:1},{opacity:0}],{duration:1000,easing:'ease-out'});card(VISITS[state.visit].label,`<p>${VISITS[state.visit].subtitle}</p><p>${state.visit===2?'Your own route is still yours to choose. The last remembered return point may not be current.':state.candidate?'A different book makes a new test. Review the proposed rule before using it.':'The prior visit supplied no attributed policy failure, so the current rule stays in place.'}</p>`,[{id:state.visit===3&&state.candidate?'review':'continue',label:state.visit===3&&state.candidate?'Review the candidate':'Step back into campus'},{id:'show-memory',label:'Inspect what carried forward'}],`VISIT ${state.visit} / ${VISITS[state.visit].time}`);}
 if(action==='pause'){world?.setActive(false);card('Your place is kept.','<p>The simulated service is paused. Your task remains available when you resume.</p>',[{id:'resume-game',label:'Resume this visit'}],'A PLANNED PAUSE');}
 if(action==='review')review();
 if(action==='test-policy'){dispatch('test');review();}
 if(action==='commit'){dispatch('commit');closeCard();notify('Policy v2 saved. Watch what it checks before giving the next cue.');}
 if(action==='keep-policy'){dispatch('keep');closeCard();notify(`Policy v${state.policy} stays active. Personal memory is unchanged.`);}
 if(action==='rollback'){dispatch('rollback');notify('Policy restored to v1. Tasks and facts are unchanged.');}
 if(action==='show-memory'){closeCard();view='memory';setInsight(true);renderInsight();}
 if(action==='see-trace'){closeCard();view='trace';setInsight(true);renderInsight();}
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
render();
