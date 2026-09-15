export const CHANNELS = {
  SM:{label:'S → M', name:'Admit evidence', module:'M', text:'Select an observation for durable personal state. Memory realizes the write.', anchor:'framework-tab-sm'},
  MA:{label:'M → A', name:'Use personal context', module:'A', text:'A retained task or preference changes when, what, or how the assistant acts.', anchor:'framework-tab-ma'},
  AS:{label:'A → S', name:'Check an intended effect', module:'S', text:'An action or plan creates a concrete observation target.', anchor:'framework-tab-as'},
  MS:{label:'M → S', name:'Question a familiar route', module:'S', text:'Memory directs attention. An old prior must leave room for corrective evidence.', anchor:'framework-tab-ms'},
  AM:{label:'A → M', name:'Attribute before updating', module:'M', text:'Link an external outcome to an earlier decision before changing state or policy.', anchor:'framework-tab-am'}
};
export const VISITS = [null,
  {label:'A small commitment', time:'MON · 09:10', light:0, subtitle:'A book is due tomorrow. What should your glasses keep?'},
  {label:'A familiar place changes', time:'TUE · 15:20', light:1, subtitle:'The conversation ended. Your commitment did not.'},
  {label:'A better next time?', time:'FRI · 10:40', light:2, subtitle:'A new loan. Test a rule before keeping it.'}
];
export const worldLocation = visit => visit === 2 ? 'Café' : 'Library';
export function initialState(){return {version:1,started:false,visit:1,memory:{task:null,preference:'quiet',location:null},policy:1,flags:{},log:[],completedLoans:[],candidate:false,validation:null,committed:false,complete:false,seq:0};}
export function decision({pending,quiet,permission,fresh,available,location,alternative}, policy=1){
  if(!pending) return {action:'silence',reason:'No pending commitment.'};
  if(quiet) return {action:'wait',reason:'A conversation is in progress.'};
  if(!permission) return {action:'ask',reason:'Observation permission is unavailable.'};
  if(policy===2&&!fresh) return {action:'check',target:location,reason:'Verify current availability before a directional cue.'};
  return {action:'cue',target:policy===2&&!available?alternative:location,reason:'A pending task can be acted on here.'};
}
export function currentDecision(s, {quiet, permission} = {}){
  const key=`${s.visit}:`, location=s.memory.location||'Library';
  const fresh=Boolean(s.flags[key+'notice']);
  return decision({pending:s.memory.task?.status==='pending',
    quiet:quiet??Boolean(s.flags[key+'inQuiet']),
    permission:permission??(s.flags[key+'observationPermission']!==false),
    fresh, available:fresh&&s.flags[key+'observedLocation']===location,
    location, alternative:fresh?s.flags[key+'observedLocation']:undefined},s.policy);
}
export function validatePolicy(){
  const common={pending:true,quiet:false,permission:true,fresh:true,available:true,location:'Library',alternative:'Café'};
  const cases=[
    {name:'Familiar point, stale observation',ctx:{...common,fresh:false},expected:'check'},
    {name:'Usual point closed; alternative observed',ctx:{...common,available:false},expected:'cue',target:'Café'},
    {name:'In a conversation',ctx:{...common,quiet:true},expected:'wait'},
    {name:'Observation permission revoked',ctx:{...common,permission:false},expected:'ask'},
    {name:'No pending task',ctx:{...common,pending:false},expected:'silence'}
  ];
  return cases.map(test=>{const old=decision(test.ctx,1),next=decision(test.ctx,2);return {name:test.name,before:old.action+(old.target?' · '+old.target:''),after:next.action+(next.target?' · '+next.target:''),pass:next.action===test.expected&&(!test.target||next.target===test.target)};});
}
function record(s,channel,title,source,payload,effect,evidence={}){const event={id:++s.seq,visit:s.visit,channel,title,source,payload,effect,...evidence};s.log.push(event);s.log=s.log.slice(-80);s.last=event;return event;}
const taskInstance=task=>task?.instanceId||`${task?.id}:${task?.savedVisit}:legacy`;
function matchesTask(evidence,task){return Boolean(task&&evidence&&evidence.taskId===task.id&&evidence.taskInstance===taskInstance(task));}
function clearTaskFlags(s){
  const key=`${s.visit}:`;
  for(const name of ['cue','detour','detourCue','closedPoint','deposited','depositEvidence','receipt','receiptEvidence','feedback','checkRequested','observationTarget','decision'])delete s.flags[key+name];
  s.flags[key+'entry']=false;s.complete=false;
}
function takeDecision(s,source,options={}){
  const key=`${s.visit}:`, task=s.memory.task;
  if(options.quiet!==undefined)s.flags[key+'inQuiet']=options.quiet;
  if(options.permission!==undefined)s.flags[key+'observationPermission']=options.permission;
  const next=currentDecision(s), evidence={taskId:task?.id,taskInstance:taskInstance(task),decision:next.action,policy:s.policy};
  s.flags[key+'checkRequested']=false;
  delete s.flags[key+'cue'];delete s.flags[key+'observationTarget'];
  if(next.action==='cue'||next.action==='check'){
    s.flags[key+'observationTarget']=next.target;
    record(s,'MS','A remembered place guides attention','Last retained return point',next.target,`Select ${next.target} as the observation target; current evidence may correct the prior.`,evidence);
  }
  let event;
  if(next.action==='cue'){
    event=record(s,'MA','A cue from retained context',source,`${task.id}: last known return point ${next.target}; ${s.memory.preference} cue.`,`Give a directional cue toward ${next.target}.`,{...evidence,target:next.target});
    s.flags[key+'cue']={taskId:task.id,taskInstance:taskInstance(task),target:next.target,eventId:event.id,visit:s.visit,policy:s.policy};
  }else if(next.action==='check'){
    s.flags[key+'checkRequested']=true;
    event=record(s,'AS','Check before giving directions',source,`Check whether ${next.target} accepts returns now.`,'Withhold the directional cue until fresh evidence is acquired.',{...evidence,target:next.target});
  }else if(next.action==='wait')event=record(s,'MA','Silence is a decision',source,'Non-urgent task; a conversation is in progress.','Wait for a quiet moment. No conversation transcript is retained.',evidence);
  else if(next.action==='ask')event=record(s,'MA','Observation needs permission',source,'The current grant does not allow this check.','Ask for permission; do not sample or issue a directional cue.',evidence);
  else event=record(s,'S','No pending commitment',source,'No pending task is available.','The service stays silent.',evidence);
  s.flags[key+'decision']={...next,eventId:event.id};
  return next;
}
export function reduce(state,action,payload={}){
  const s=structuredClone(state), key=`${s.visit}:`;
  const add=(...args)=>record(s,...args);
  switch(action){
    case 'start': s.started=true;add('S','Glasses on','Simulated loan slip B17','Book due Tuesday. No raw camera or microphone capture.','Current observation only; nothing retained yet.');break;
    case 'save':
      if(s.memory.task?.status==='pending')return state;
      if((s.completedLoans||[]).includes(s.visit===3?'B18':'B17')||(s.memory.task?.id===(s.visit===3?'B18':'B17')&&s.memory.task.status==='completed'))return state;
      clearTaskFlags(s);
      s.memory.task={id:s.visit===3?'B18':'B17',instanceId:`${s.visit===3?'B18':'B17'}:${s.seq+1}`,status:'pending',due:s.visit===1?'Tuesday afternoon':'This visit',source:'Loan slip',savedVisit:s.visit};
      s.memory.preference=payload.preference||'quiet';s.memory.location=s.memory.location||'Library';
      add('SM','A commitment worth keeping','Loan slip + your choice',`${s.memory.task.id}: return book; ${s.memory.preference} cues; source retained.`,`Written to personal memory. The raw scene is not stored.`);break;
    case 'enter':
      if(s.flags[key+'entry'])return state;s.flags[key+'entry']=true;
      takeDecision(s,'Campus-entry event; no new request',payload);break;
    case 'quiet':
      if(s.flags[key+'inQuiet'])return state;s.flags[key+'quiet']=true;
      takeDecision(s,'Conversation zone + saved cue preference',{quiet:true});break;
    case 'resume':
      if(!s.flags[key+'inQuiet'])return state;s.flags[key+'resumed']=true;
      takeDecision(s,'Left the conversation zone',{quiet:false});break;
    case 'notice':{
      if(payload.automatic&&(currentDecision(s).action!=='check'||(payload.place&&payload.place!==currentDecision(s).target)))return state;
      if(s.flags[key+'notice'])return state;s.flags[key+'notice']=true;
      const old=s.memory.location, location=worldLocation(s.visit);
      s.flags[key+'oldLocation']=old;s.flags[key+'observedLocation']=location;
      if(s.memory.task)s.memory.location=location;
      add(payload.automatic?'AS':'S',old!==location?'The familiar place changed':'Fresh evidence, same destination',`Today's sign at ${payload.place||'Library'}`,`Observed: returns accepted at ${location}.`,old!==location?`The prior ${old||'location'} is corrected by fresh evidence.`:'Current availability is verified.');
      if(s.memory.task)add('SM','Keep the corrected fact','Dated return-point notice',`${location} accepts returns during this visit.`,`Location record updated; policy stays v${s.policy}.`);
      takeDecision(s,'Fresh return-point notice');
      break;}
    case 'wrong-place':{
      if(s.memory.task?.status!=='pending'||!['Library','Café'].includes(payload.place)||payload.place===worldLocation(s.visit))return state;
      const cue=s.flags[key+'cue'];
      const linked=matchesTask(cue,s.memory.task)&&cue.target===payload.place&&s.log.some(e=>e.id===cue.eventId&&e.decision==='cue'&&matchesTask(e,s.memory.task));
      if(s.flags[key+'closedPoint']===payload.place&&(!linked||s.flags[key+'detourCue']?.eventId===cue.eventId))return state;
      s.flags[key+'detour']=true;s.flags[key+'closedPoint']=payload.place;
      const event=add('S','This return point is closed','The door / return kiosk in front of you',`${payload.place} is unavailable.`,linked?'This matches the earlier cue target; ask the wearer whether it caused a detour.':'No matching directional cue is recorded. This visit alone does not establish a policy failure.');
      if(linked)s.flags[key+'detourCue']={...cue,outcomeEventId:event.id};
      break;}
    case 'return':{
      if(s.memory.task?.status!=='pending'||payload.place!==worldLocation(s.visit))return state;
      if(matchesTask(s.flags[key+'depositEvidence'],s.memory.task))return state;
      s.flags[key+'deposited']=s.memory.task.id;
      const event=add('AS','Did the return actually register?','You place the book in the return slot',`Expected receipt for ${s.memory.task.id}.`,'Check the kiosk receipt; depositing alone does not close the task.');
      s.flags[key+'depositEvidence']={taskId:s.memory.task.id,taskInstance:taskInstance(s.memory.task),eventId:event.id,visit:s.visit,place:payload.place};
      break;}
    case 'receipt':{
      const deposit=s.flags[key+'depositEvidence'];
      if(s.memory.task?.status!=='pending'||s.flags[key+'deposited']!==s.memory.task.id||!matchesTask(deposit,s.memory.task)||deposit.visit!==s.visit||deposit.place!==worldLocation(s.visit)||(payload.taskId!==undefined&&payload.taskId!==s.memory.task.id)||(payload.taskInstance!==undefined&&payload.taskInstance!==taskInstance(s.memory.task))||(payload.actionId!==undefined&&payload.actionId!==deposit.eventId))return state;
      s.memory.task.status='completed';s.flags[key+'receipt']=true;
      s.flags[key+'checkRequested']=false;delete s.flags[key+'cue'];delete s.flags[key+'observationTarget'];
      s.completedLoans=[...new Set([...(s.completedLoans||[]),s.memory.task.id])];
      const event=add('AM','A receipt closes this commitment',`Kiosk receipt ${s.memory.task.id}`,`Book and task instance match return action #${deposit.eventId}.`,`${s.memory.task.id} marked complete. This does not prove the reminder caused the return.`);
      s.flags[key+'receiptEvidence']={...deposit,receiptEventId:event.id};
      if(s.visit===3)s.complete=true;break;}
    case 'feedback':
      if(!s.flags[key+'receipt']||s.flags[key+'feedback']||s.memory.task?.status!=='completed'||!matchesTask(s.flags[key+'receiptEvidence'],s.memory.task))return state;
      s.flags[key+'feedback']=payload.reason;
      if(payload.reason==='detour'&&matchesTask(s.flags[key+'detourCue'],s.memory.task)){
        const cue=s.flags[key+'detourCue'];
        s.candidate=true;s.validation=null;s.candidateEvidence={...cue};
        const event=add('AM','A bounded explanation, not a guess','Your report + recorded cue and unavailable return point',`You report cue #${cue.eventId} toward ${cue.target} caused the detour; observation #${cue.outcomeEventId} confirms it was closed.`,'Propose checking availability before future directional cues. Nothing committed yet.');
        s.candidateEvidence.reportEventId=event.id;
      }else add('AM','Completion is not causal credit','Your report after return',payload.reason==='detour'?'No matching prior cue supports that attribution.':'You planned to return the book anyway.','Close the task, but do not credit the reminder or revise the policy.');break;
    case 'next':
      if(s.visit>=3)return state;
      if(s.visit===2&&s.memory.task?.status==='pending')return state;
      s.visit++;s.flags={};
      if(s.visit===3){s.complete=false;s.memory.task={id:'B18',instanceId:`B18:${s.seq+1}`,status:'pending',due:'Friday afternoon',source:'New loan slip',savedVisit:3};add('SM','A different book, a later visit','New loan slip B18','Return B18 before leaving campus.','New commitment admitted; prior location and cue preference retained.');}
      else add('M','An interaction ends; state survives','Visit boundary',s.memory.task?`${s.memory.task.id}: ${s.memory.task.status}`:'No task was retained.','Read the same personal state on the next visit.');break;
    case 'test':
      if(!s.candidate)return state;s.validation=validatePolicy();
      add('AM','Test the proposed control rule','Five separate simulated validation contexts',`${s.validation.filter(x=>x.pass).length}/${s.validation.length} rule checks pass.`,`Candidate v2 remains uncommitted. These checks are not a real-world benefit estimate.`);break;
    case 'commit':
      if(!s.candidate||!s.validation?.length||!s.validation.every(x=>x.pass))return state;
      s.policy=2;s.committed=true;s.flags[key+'entry']=false;
      s.flags[key+'checkRequested']=false;delete s.flags[key+'cue'];
      add('AM','A rule, not a personal fact','Validation checks + your explicit acceptance','v2: obtain fresh availability before non-urgent directional cues.','Control policy saved for later decisions. You can undo it.');break;
    case 'keep':add('AM','Keep the current policy','Your choice','No new candidate is accepted.',`v${s.policy} stays active. The pending task is unchanged.`);break;
    case 'rollback':s.policy=1;s.committed=false;s.flags[key+'entry']=false;s.flags[key+'checkRequested']=false;delete s.flags[key+'cue'];add('AM','Policy restored','Your undo request','v2 → v1','Personal tasks and facts remain intact.');break;
    case 'forget':s.memory.task=null;clearTaskFlags(s);add('M','Commitment removed','Your deletion request','Remove the retained task and its pending observation/receipt requests.','No further task reminder can be generated from that record.');break;
    default:return state;
  }
  return s;
}
export function objective(s){
 if(!s.started)return 'Put on the glasses';
 if(!s.memory.task)return 'Read the loan slip; choose what to remember';
 if(s.visit===1)return 'Explore campus, then leave for the day';
 if(s.visit===3&&s.candidate&&!s.validation)return 'Review the proposed rule, or keep exploring';
 if(s.memory.task.status==='completed')return s.visit===3?'Your story is ready to review':'Return confirmed. Reflect, then come back another day';
 if(s.flags[`${s.visit}:deposited`])return 'Check the kiosk receipt before closing the task';
 return s.policy===2&&!s.flags[`${s.visit}:notice`]?`Check ${s.memory.location} before giving directions`:`Return the book · last known point: ${s.memory.location}`;
}
