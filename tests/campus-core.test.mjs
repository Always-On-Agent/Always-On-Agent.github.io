import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,reduce,currentDecision,validatePolicy} from '../demo/core.mjs';

function run(state,...steps){return steps.reduce((s,step)=>reduce(s,...(Array.isArray(step)?step:[step])),state);}
function secondVisit(){return run(initialState(),'start','save','next');}
function attributedReturn(){return run(secondVisit(),'enter',['wrong-place',{place:'Library'}],['notice',{place:'Library'}],['return',{place:'Café'}],['receipt',{taskId:'B17'}],['feedback',{reason:'detour'}]);}

test('an unsaved task stays silent; a retained task changes the later event-triggered decision',()=>{
  const absent=run(initialState(),'start','next','enter');
  assert.equal(currentDecision(absent).action,'silence');
  assert.equal(absent.flags['2:cue'],undefined);
  const retained=run(secondVisit(),'enter');
  const cue=retained.flags['2:cue'];
  assert.equal(cue.taskId,'B17');
  assert.equal(cue.taskInstance,retained.memory.task.instanceId);
  assert.equal(cue.target,'Library');
  assert.equal(retained.log.find(e=>e.id===cue.eventId).decision,'cue');
});

test('live policy v2 waits in a conversation and requests observation after each quiet-zone exit',()=>{
  let s=secondVisit();s.policy=2;
  s=reduce(s,'enter',{quiet:true});
  assert.equal(s.flags['2:decision'].action,'wait');
  assert.equal(s.flags['2:checkRequested'],false);
  assert.equal(s.flags['2:cue'],undefined);
  assert.strictEqual(reduce(s,'notice',{automatic:true,place:'Library'}),s);
  s=reduce(s,'resume');
  assert.equal(s.flags['2:decision'].action,'check');
  assert.equal(s.flags['2:checkRequested'],true);
  s=run(s,'quiet','resume');
  assert.equal(s.flags['2:decision'].action,'check');
  assert.strictEqual(reduce(s,'notice',{automatic:true,place:'Café'}),s);
  s=reduce(s,'notice',{automatic:true,place:'Library'});
  assert.equal(s.memory.location,'Café');
  assert.equal(s.flags['2:decision'].action,'cue');
  assert.equal(s.flags['2:cue'].target,'Café');
  assert.equal(s.flags['2:checkRequested'],false);
});

test('revoked observation permission reaches the same live gate exercised by validation',()=>{
  let s=secondVisit();s.policy=2;
  s=reduce(s,'enter',{permission:false});
  assert.equal(currentDecision(s).action,'ask');
  assert.equal(s.flags['2:decision'].action,'ask');
  assert.equal(s.flags['2:checkRequested'],false);
  assert.equal(s.flags['2:cue'],undefined);
  assert.strictEqual(reduce(s,'notice',{automatic:true,place:'Library'}),s);
  assert.equal(validatePolicy().find(row=>row.name==='Observation permission revoked').after,'ask');
});

test('visiting a closed point without an earlier cue cannot support causal policy credit',()=>{
  let s=run(initialState(),'start','next','enter','save',['wrong-place',{place:'Library'}]);
  assert.equal(s.flags['2:detour'],true);
  assert.equal(s.flags['2:detourCue'],undefined);
  s=run(s,['notice',{place:'Library'}],['return',{place:'Café'}],['receipt',{taskId:'B17'}],['feedback',{reason:'detour'}]);
  assert.equal(s.memory.task.status,'completed');
  assert.equal(s.candidate,false);
  assert.match(s.last.payload,/No matching prior cue/);
});

test('an independently visited closed point is not attributed to a cue for another target',()=>{
  const s=run(secondVisit(),'enter',['notice',{place:'Library'}],['wrong-place',{place:'Library'}]);
  assert.equal(s.flags['2:cue'].target,'Café');
  assert.equal(s.flags['2:detourCue'],undefined);
});

test('a candidate links the actual cue, unavailable point, matching return, and user report',()=>{
  const s=attributedReturn(),e=s.candidateEvidence;
  assert.equal(s.candidate,true);
  assert.equal(s.policy,1);
  assert.equal(s.validation,null);
  assert.equal(e.taskId,'B17');
  assert.equal(e.target,'Library');
  assert.equal(s.log.find(row=>row.id===e.eventId).decision,'cue');
  assert.equal(s.log.find(row=>row.id===e.outcomeEventId).title,'This return point is closed');
  assert.equal(s.log.find(row=>row.id===e.reportEventId).channel,'AM');
  assert.equal(s.flags['2:receiptEvidence'].taskInstance,s.memory.task.instanceId);
});

test('completion without causal credit closes the task without proposing a policy',()=>{
  const s=run(secondVisit(),'enter',['wrong-place',{place:'Library'}],['notice',{place:'Library'}],['return',{place:'Café'}],'receipt',['feedback',{reason:'anyway'}]);
  assert.equal(s.memory.task.status,'completed');
  assert.equal(s.candidate,false);
  assert.equal(s.policy,1);
});

test('a receipt must match the task instance and its actual return action',()=>{
  let s=secondVisit();
  assert.strictEqual(reduce(s,'receipt',{taskId:'B17'}),s);
  assert.strictEqual(reduce(s,'return',{place:'Library'}),s);
  s=reduce(s,'return',{place:'Café'});
  for(const payload of [{taskId:'B18'},{taskInstance:'B17:old'},{actionId:-1}])assert.strictEqual(reduce(s,'receipt',payload),s);
  const d=s.flags['2:depositEvidence'];
  s=reduce(s,'receipt',{taskId:d.taskId,taskInstance:d.taskInstance,actionId:d.eventId});
  assert.equal(s.memory.task.status,'completed');
  assert.equal(s.flags['2:receiptEvidence'].eventId,d.eventId);
  assert.strictEqual(reduce(s,'save'),s);
  s=reduce(s,'forget');
  assert.strictEqual(reduce(s,'save'),s,'the same completed fictional loan cannot be recreated after forgetting its reminder');
});

test('forget cancels sampling and old execution evidence cannot close a re-admitted task',()=>{
  let s=secondVisit();s.policy=2;
  s=run(s,'enter',['return',{place:'Café'}]);
  const old=s.flags['2:depositEvidence'];
  s=reduce(s,'forget');
  assert.equal(currentDecision(s).action,'silence');
  for(const name of ['cue','detourCue','checkRequested','deposited','depositEvidence','receiptEvidence'])assert.equal(s.flags['2:'+name],undefined);
  assert.strictEqual(reduce(s,'notice',{automatic:true,place:'Library'}),s);
  s=reduce(s,'save');
  assert.notEqual(s.memory.task.instanceId,old.taskInstance);
  assert.strictEqual(reduce(s,'receipt',{taskId:old.taskId}),s);
  s=reduce(s,'return',{place:'Café'});
  assert.strictEqual(reduce(s,'receipt',{taskId:old.taskId,taskInstance:old.taskInstance,actionId:old.eventId}),s);
});

test('validated durable policy changes run on the next task, and can be rolled back',()=>{
  let s=attributedReturn();
  assert.strictEqual(reduce(s,'commit'),s);
  s=run(s,'next','test');
  assert.equal(s.memory.task.id,'B18');
  assert.equal(s.validation.length,5);
  assert.ok(s.validation.every(row=>row.pass));
  const failed=structuredClone(s);failed.validation[0].pass=false;
  assert.strictEqual(reduce(failed,'commit'),failed);
  const empty=structuredClone(s);empty.validation=[];
  assert.strictEqual(reduce(empty,'commit'),empty);
  s=run(s,'commit','enter');
  s=JSON.parse(JSON.stringify(s));
  assert.equal(s.policy,2);
  assert.equal(s.flags['3:decision'].action,'check');
  assert.equal(currentDecision(s).target,'Café');
  assert.equal(s.flags['3:cue'],undefined);
  s=run(s,['notice',{automatic:true,place:'Café'}],['return',{place:'Library'}],['receipt',{taskId:'B18'}]);
  assert.equal(s.complete,true);
  assert.equal(s.memory.task.status,'completed');
  s=reduce(s,'rollback');
  assert.equal(s.policy,1);
  assert.equal(s.memory.task.status,'completed');
});

test('the next-visit action cannot discard an unresolved second-visit commitment',()=>{
  const s=secondVisit();
  assert.strictEqual(reduce(s,'next'),s);
});
