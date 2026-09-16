import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialState,reduce,currentDecision} from '../demo/core.mjs';
import {CATALOG,LANGUAGES,resolveLanguage,t,placeLabel,statusLabel,dueLabel,visitCopy,objectiveText,dialogModel,localizeEvent,localizeValidation} from '../demo/i18n.mjs';

const snapshots=[];
function advance(s,...steps){
 snapshots.push(structuredClone(s));
 for(const step of steps){s=reduce(s,...(Array.isArray(step)?step:[step]));snapshots.push(structuredClone(s));}
 return s;
}
function visitTwo(){return advance(initialState(),'start','save','next');}
let ordinary=advance(visitTwo(),'enter','quiet','resume',['wrong-place',{place:'Library'}],['notice',{place:'Library'}],['return',{place:'Café'}],['receipt',{taskId:'B17'}],['feedback',{reason:'detour'}]);
const candidate=ordinary;
const freshVisit=advance(candidate,'next');
const tested=advance(freshVisit,'test');
const committed=advance(tested,'commit','enter','quiet','resume',['notice',{automatic:true,place:'Café'}],['return',{place:'Library'}],['receipt',{taskId:'B18'}]);
advance(committed,'keep','rollback','forget');
advance(visitTwo(),'enter',['return',{place:'Café'}],'receipt',['feedback',{reason:'anyway'}]);
advance(initialState(),'start','next','enter','save',['wrong-place',{place:'Library'}],['notice',{place:'Library'}],['return',{place:'Café'}],'receipt',['feedback',{reason:'detour'}]);
let permission=visitTwo();permission.policy=2;advance(permission,['enter',{permission:false}],'forget','enter');
advance(advance(initialState(),'start','save'),['notice',{place:'Library'}],'enter','quiet','resume');
advance(initialState(),'start','next');

function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;}
function strings(model){return [model.kicker,model.title,...model.paragraphs,...model.actions.map(a=>a.label),...(model.chapters||[]),...(model.validation||[]).flatMap(r=>[r.name,r.before,r.after]),model.fine].filter(Boolean);}

const dialogs=[
 ['welcome',initialState()],['welcome',committed],
 ['loan',initialState()],['loan',visitTwo()],['loan',committed],
 ['notice',visitTwo()],['notice',freshVisit],['notice',advance(initialState(),'start')],
 ['feedback',candidate],['feedback',advance(visitTwo(),['return',{place:'Café'}],'receipt')],
 ['feedback-result',candidate],['feedback-result',visitTwo()],
 ['review',visitTwo()],['review',candidate],['review',tested],['review',committed],
 ['leave',advance(initialState(),'start','save')],['leave',initialState()],['leave',visitTwo()],['leave',advance(visitTwo(),['return',{place:'Café'}])],['leave',candidate],
 ['recap',committed],['recap',freshVisit],['recap',initialState()],
 ['quiet',visitTwo()],['first-visit',advance(initialState(),'start','save')],['completed',candidate],
 ['closed-point',visitTwo(),{place:'Library'}],['deposited',visitTwo()],['return',freshVisit,{place:'Library'}],
 ['next-visit',visitTwo()],['next-visit',freshVisit],['next-visit',{...freshVisit,candidate:false}],['pause',visitTwo()],['unavailable',initialState()]
];

test('saved preference and browser locale resolve only to supported languages',()=>{
 assert.equal(resolveLanguage(null,'zh-CN'),'zh');
 assert.equal(resolveLanguage(null,'zh-TW'),'zh');
 assert.equal(resolveLanguage(null,'ZH-hant'),'zh');
 assert.equal(resolveLanguage(null,'en-SG'),'en');
 assert.equal(resolveLanguage('en','zh-CN'),'en');
 assert.equal(resolveLanguage('zh','en-US'),'zh');
 assert.equal(resolveLanguage('unknown','zh'),'zh');
});

test('every catalog entry has both languages with matching interpolation variables',()=>{
 for(const [key,row] of Object.entries(CATALOG)){
  for(const lang of LANGUAGES)assert.equal(typeof row[lang],'string',`${key}:${lang}`);
  const vars=text=>[...text.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();
  assert.deepEqual(vars(row.zh),vars(row.en),`${key} has equivalent dynamic fields`);
  assert.ok(row.en.trim()&&row.zh.trim());
 }
 assert.equal(t('zh','notify.cue',{id:'B17',place:'图书馆'}),'B17 还没完成。上次记录的还书点：图书馆。');
});

test('all scene branches have short bilingual copy and preserve the same gameplay actions',()=>{
 for(const [kind,state,data] of dialogs){
  const before=JSON.stringify(state);freeze(state);
  const en=dialogModel('en',kind,state,data),zh=dialogModel('zh',kind,state,data);
  assert.deepEqual(zh.actions.map(a=>a.id),en.actions.map(a=>a.id),`${kind} must not change its available choices`);
  assert.equal(JSON.stringify(state),before,`${kind} is display-only`);
  for(const [lang,model] of [['en',en],['zh',zh]]){
   assert.ok(model.actions.length>0,kind);
   for(const text of strings(model)){assert.ok(text.trim(),`${kind}:${lang}`);assert.ok(!/undefined|\{\w+\}/.test(text),`${kind}:${lang}: ${text}`);}
  }
  assert.ok(/[\u3400-\u9fff]/.test(zh.title),`${kind} has a Chinese title`);
  assert.ok(en.paragraphs.length<=3,`${kind} avoids long explanatory cards`);
 }
});

test('every reachable trace field has an explicit Chinese sentence or template translation',()=>{
 const records=new Map(snapshots.flatMap(s=>s.log).map(e=>[JSON.stringify([e.title,e.source,e.payload,e.effect]),e]));
 const titles=new Set([...records.values()].map(e=>e.title));
 for(const title of ['Glasses on','A commitment worth keeping','A remembered place guides attention','A cue from retained context','Check before giving directions','Silence is a decision','Observation needs permission','No pending commitment','The familiar place changed','Fresh evidence, same destination','Keep the corrected fact','This return point is closed','Did the return actually register?','A receipt closes this commitment','A bounded explanation, not a guess','Completion is not causal credit','A different book, a later visit','An interaction ends; state survives','Test the proposed control rule','A rule, not a personal fact','Keep the current policy','Policy restored','Commitment removed'])assert.ok(titles.has(title),`cover ${title}`);
 for(const event of records.values()){
  const before=JSON.stringify(event),zh=localizeEvent('zh',event),en=localizeEvent('en',event);
  assert.deepEqual(zh.untranslated,[],`${event.title}: ${zh.untranslated.map(field=>event[field]).join(' | ')}`);
  for(const field of ['title','source','payload','effect'])assert.equal(en[field],event[field],'canonical English evidence remains unchanged');
  assert.equal(JSON.stringify(event),before,'translation must not rewrite saved history');
 }
});

test('language rendering preserves candidate, receipt and policy decisions across a complete story',()=>{
 for(const state of snapshots){
  const before=JSON.stringify(state),choice=currentDecision(state);
  objectiveText('zh',state);objectiveText('en',state);
  state.log.forEach(e=>{localizeEvent('zh',e);localizeEvent('en',e);});
  state.validation?.forEach(row=>{const localized=localizeValidation('zh',row);assert.equal(localized.pass,row.pass);assert.notEqual(localized.name,row.name);});
  assert.deepEqual(currentDecision(state),choice);
  assert.equal(JSON.stringify(state),before);
 }
 assert.equal(placeLabel('zh','Café'),'咖啡馆');
 assert.equal(statusLabel('zh','completed'),'已完成');
 assert.equal(dueLabel('zh','Friday afternoon'),'周五下午之前');
 assert.equal(visitCopy('zh',3).time,'周五 · 10:40');
});

test('all literal UI and notification catalog keys used by app are defined',async()=>{
 const app=await readFile(new URL('../demo/app.mjs',import.meta.url),'utf8');
 for(const match of app.matchAll(/(?:tr|notify)\('([^']+)'/g))assert.ok(CATALOG[match[1]],`app key ${match[1]}`);
 for(const match of app.matchAll(/data-copy="([^"]+)"/g))assert.ok(CATALOG[match[1]],`DOM key ${match[1]}`);
 assert.match(app,/world\.mjs\?v=campus-anime-20260916/);
});
