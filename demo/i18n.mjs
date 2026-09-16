// Display-only copy. Core state, identifiers and evidence remain canonical.
import {objective,worldLocation} from './core.mjs';
export const LANGUAGES=['en','zh'];
export const LANGUAGE_STORAGE='always-on-campus-language';
export function resolveLanguage(saved, browserLanguage='en'){return LANGUAGES.includes(saved)?saved:/^zh(?:[-_]|$)/i.test(browserLanguage)?'zh':'en';}
const copy={
 'section.eyebrow':['PLAY THE FRAMEWORK','走进这个世界'],
 'section.title':['A world that remembers.','世界变了，记忆还在。'],
 'section.deck':['One campus. Three visits. Put on the glasses and choose your own way through a small unfinished story.','一座校园，三次到访。戴上眼镜，自由走走，让一件未完成的小事串起故事。'],
 'section.caption':['Interactive simulation · Fictional observations and local state. The service runs while this demo is open.','互动模拟 · 观察与情节均为虚构，进度仅保存在本机。模拟服务只在演示开启时运行。'],
 'section.framework':['Explore the framework ↑','查看理论框架 ↑'],
 'brand':['FIELDNOTES / A CAMPUS LOOP','校园手记 / 再次到访'],
 'inside':['Inside the loop','眼镜在想什么'],
 'now':['Now','此刻'], 'memory':['Memory','记忆'], 'trace':['Trace','足迹'],
 'nextMoment':['YOUR NEXT MOMENT','接下来'], 'walkTo':['WALK TO','前往'],
 'controls':['WASD · drag to look · E to interact','WASD 移动 · 拖动环视 · E 互动'],
 'loan':['Loan slip','借书凭条'], 'restart':['Restart','重新开始'],
 'simulation':['Simulated vision · no camera or microphone','模拟视野 · 不调用摄像头或麦克风'],
 'saved':['Your story is saved on this device.','故事进度已保存在本机。'],
 'unsaved':['Local storage unavailable · progress lasts for this page session.','本机存储不可用 · 进度仅保留到本次页面会话结束。'],
 'approach':['Move closer to explore','走近一点，看看有什么'],
 'explore':['Explore {place}','查看{place}'], 'leavePrompt':['Leave / next visit','离校 / 下次到访'],
 'visitLabel':['Visit {visit} / 3 · {title}','第 {visit} / 3 次到访 · {title}'],
 'visitShort':['Visit {visit}','第 {visit} 次到访'],
 'visit.1.title':['One unfinished thing','一件未完成的小事'],
 'visit.2.title':['The familiar has changed','熟悉的地方变了'],
 'visit.3.title':['A different next time','下次，试着不一样'],
 'visit.1.time':['MON · 09:10','周一 · 09:10'],
 'visit.2.time':['TUE · 15:20','周二 · 15:20'],
 'visit.3.time':['FRI · 10:40','周五 · 10:40'],
 'chapter.1':['Remember','记下来'], 'chapter.2':['Find another way','换一条路'], 'chapter.3':['Try a better rule','试试新规则'],
 'place.Library':['Library','图书馆'], 'place.Café':['Café','咖啡馆'], 'place.Courtyard':['Courtyard','庭院'], 'place.Gate':['Campus gate','校门'],
 'place.leave':['Leave campus','离开校园'],
 'aria.root':['First-person campus loop simulation','第一人称校园互动模拟'],
 'aria.canvas':['Explore the campus. W A S D or up/down to move, left/right to turn, drag to look, E to interact. Escape releases keyboard control.','探索校园。W A S D 或上下方向键移动，左右方向键转向，拖动环视，E 互动。Escape 退出键盘控制。'],
 'aria.fullscreen':['Expand the demo','展开游戏画面'],
 'aria.language':['Switch to Chinese','切换为英文'],
 'aria.dialog':['Glasses interaction','眼镜互动'], 'aria.insight':['Live framework trace','实时机制与事件记录'],
 'aria.closeInsight':['Close framework trace','关闭机制记录'], 'aria.tabs':['Inspect the loop','查看运行过程'],
 'aria.movement':['Movement controls','移动控制'], 'aria.forward':['Walk forward','向前走'], 'aria.left':['Turn left','向左转'], 'aria.backward':['Walk backward','向后走'], 'aria.right':['Turn right','向右转'],
 'aria.destinations':['Walk to a place','选择步行目的地'], 'aria.modules':['Sensing, Memory, Action','感知、记忆、行动'], 'aria.chapters':['Three visits','三次到访'],
 'module.S':['Sensing','感知'], 'module.M':['Memory','记忆'], 'module.A':['Action','行动'],
 'channel.SM.name':['Admit evidence','选择留下什么'], 'channel.SM.text':['Select an observation for durable personal state. Memory realizes the write.','从当前观察中选择值得跨交互保留的信息，由记忆策略完成写入。'],
 'channel.MA.name':['Use personal context','用记忆决定行动'], 'channel.MA.text':['Retained tasks and preferences change whether, when and how the assistant acts.','保存的任务与偏好，改变助手是否行动、何时行动以及如何行动。'],
 'channel.AS.name':['Check an intended effect','为行动寻找证据'], 'channel.AS.text':['An action or plan creates an observation target, before acting or when checking its effects.','行动或计划提出具体观察目标，用于行动前检查或行动后核验。'],
 'channel.MS.name':['Guide observation with memory','记忆引导观察'], 'channel.MS.text':['Retained context guides observation and interpretation. Stale priors must leave room for corrective evidence.','已保存的背景引导观察与解释；旧先验必须给纠正证据留下进入的机会。'],
 'channel.AM.name':['Attribute before updating','先归因，再更新'], 'channel.AM.text':['Link external outcomes to earlier decisions before changing personal state or proposing a policy revision.','将外部结果关联到先前决策，再决定修正个人状态或提出策略更新。'],
 'channel.S':['Current observation','当前观察'], 'channel.M':['Persistent state','持久状态'], 'channel.default':['Decision','决策'],
 'state.heading':['PERSONAL STATE · m','个人状态 · m'], 'state.task':['Commitment','待办事项'],
 'state.none':['Nothing retained','尚未保留'], 'state.location':['Last known return point','上次记录的还书点'],
 'state.unobserved':['Not observed','尚未观察'], 'state.preference':['Cue preference','提示偏好'],
 'state.quiet':['Quiet visual cues · campus errands','安静的视觉提示 · 校园事务'],
 'state.raw':['Raw video / conversation','原始画面 / 对话'], 'state.notRetained':['Not retained','不保存'],
 'state.policy':['CONTROL POLICY · θ','控制策略 · θ'],
 'policy.1':['Use the last known return point for directions.','按上次记录的还书点指路。'],
 'policy.2':['Check current availability before giving directions.','先检查还书点当前是否可用，再指路。'],
 'state.distinction':['A place or preference is personal content. The rule for choosing an action is policy.','地点和偏好属于个人内容；选择如何行动的规则属于控制策略。'],
 'status.pending':['pending','待完成'], 'status.completed':['completed','已完成'],
 'due.Tuesday afternoon':['by Tuesday afternoon','周二下午之前'], 'due.Friday afternoon':['by Friday afternoon','周五下午之前'], 'due.This visit':['before leaving today','今天离校之前'],
 'trace.heading':['YOUR EVENT TRACE','你的事件足迹'], 'trace.empty':['Your next step will leave a trace here.','下一步发生的事，会记录在这里。'],
 'trace.evidence':['Follow the evidence','展开证据'], 'trace.source':['Source','来源'], 'trace.signal':['Signal','传递的信息'],
 'trace.observedSource':['Observed source','观察来源'], 'trace.interface':['Signal across the interface','跨模块传递的信息'],
 'trace.effect':['What changes','产生的变化'], 'trace.framework':['Read this channel in the framework ↗','在理论框架中查看此通道 ↗'],
 'trace.intro':['Take a walk. Each event reveals what the glasses sensed, kept or decided.','先走走。每次事件都会留下眼镜感知了什么、记住了什么、作出了什么决定。'],
 'action.start':['Enter campus','走进校园'], 'action.resume-game':['Continue my visit','继续这次到访'],
 'action.continue':['Keep walking','继续走走'], 'action.forget':['Forget this task','忘掉这件事'],
 'action.save-quiet':['Remember it · quiet cues','帮我记住 · 安静提示'], 'action.skip-save':['Just for now','这次看看就好'],
 'action.go-gate':['Head to the gate','去校门'], 'action.go-current':['Walk to {place}','前往{place}'],
 'action.feedback-detour':['That cue sent me to the closed door','那条提示让我走到了关门的地方'],
 'action.feedback-anyway':['I was coming back anyway','我本来就打算来还书'],
 'action.commit':['Keep the new rule','采用新规则'], 'action.keep-policy':['Keep my current rule','先用现在的规则'],
 'action.test-policy':['Try five test situations','试跑五种情况'], 'action.review':['Review the new rule','看看新规则'],
 'action.rollback':['Undo policy v2','撤销策略 v2'], 'action.pause':['Pause this visit','暂停这次到访'],
 'action.next.1':['Come back tomorrow','明天再来'], 'action.next.2':['Return on Friday','周五再来'],
 'action.see-trace':['Look back at my journey','回看我的足迹'], 'action.restart':['Start a new story','重走一次，换个选择'],
 'action.show-memory':['Open the memory notebook','翻开记忆手册'],
 'action.read-notice':['Read the notice','看看新告示'], 'action.receipt':['Check the receipt','核对还书回执'],
 'action.return-book':['Return the book','把书放进还书口'], 'action.go-framework':['Open the framework','打开理论框架'],
 'intro.kicker':['FIRST-PERSON / THREE VISITS','第一人称 / 三次到访'],
 'intro.title':['A book. A promise.','一本书，一件小事。'],
 'intro.returnTitle':['Back on familiar ground.','又回到了这里。'],
 'intro.setting':['Your book is due. The campus will change. What will your glasses remember?','书快到期了，校园也悄悄变了。你的眼镜会记住什么？'],
 'intro.move':['Walk with WASD, or choose a place below. Drag to look around.','用 WASD 漫步，或选择下方地点。拖动画面，环顾四周。'],
 'intro.interact':['Move close, then press E or tap Explore.','走近之后，按 E 或点“查看”互动。'],
 'intro.fine':['Fictional local state. Simulated checks run only while this demo is open.','仅在本机保存虚构进度；模拟检查只在演示开启时运行。'],
 'card.loan.kicker':['YOUR LOAN SLIP','借书凭条'], 'card.loan.title':['Bring it back tomorrow.','明天，记得带回来。'],
 'card.loan.laterTitle':['One more book.','又借了一本。'],
 'card.loan.body':['Book {id} is due {due}. Want a quiet nudge when you return?','{id} 要在{due}归还。下次到校园时，要不要悄悄提醒你？'],
 'card.pending.title':['Still on your list.','这件事还在。'], 'card.pending.body':['{id} · Return it {due}. Your glasses kept a quiet-cue preference with the task.','{id} · 请在{due}归还。眼镜记住了这件事，也记住了你喜欢安静提示。'],
 'card.closedLoan.title':['One less thing to carry.','可以放下这件事了。'], 'card.closedLoan.body':['The receipt confirms {id} is back. No second reminder needed.','回执确认 {id} 已归还。眼镜不会再为它提醒你。'],
 'card.notice.kicker':['TODAY’S NOTICE','今日告示'], 'card.notice.title':['A change of plans.','计划有变。'],
 'card.notice.1':['Returns are at the library. Your book is due tomorrow.','图书馆正常接收还书。你的书明天到期。'],
 'card.notice.2':['The library entrance is closed for repairs. The café desk is taking returns today.','图书馆入口正在维修。今天，请到咖啡馆服务台还书。'],
 'card.notice.3':['The café’s temporary desk has closed. Returns are back at the library.','咖啡馆的临时还书台已撤走。图书馆重新开放了。'],
 'card.feedback.kicker':['AFTER THE RETURN','还书之后'], 'card.feedback.title':['How did that go?','刚才感觉怎么样？'],
 'card.feedback.body':['The book is back. Did the glasses change your route, or were you already on your way?','书已经还好了。是眼镜改变了你的路线，还是你本来就准备过来？'],
 'card.feedbackResult.kicker':['A NOTE FOR NEXT TIME','留给下次的一笔'],
 'card.feedbackResult.title':['Got it.','记下了。'],
 'card.feedbackResult.candidate':['That cue led to a closed door. Next time, the glasses could check before pointing the way. Try the rule on your next visit.','那条提示把你带到了关门的地方。下次，眼镜可以先确认再指路。再来时试试这条新规则。'],
 'card.feedbackResult.noCandidate':['The book is returned. That does not mean the reminder made it happen. Your rule stays as it is.','书还好了，但不因此把功劳算给提醒。这次先保留原来的规则。'],
 'card.review.kicker':['BEFORE NEXT TIME','下一次之前'], 'card.review.title':['Check first. Then point.','先看清，再指路。'],
 'card.review.current':['Now: {rule}','当前：{rule}'], 'card.review.candidate':['Proposed: check that a return point is open before giving directions.','提议：先确认还书点还开着，再给出方向提示。'],
 'card.review.test':['Try the rule in five separate situations before keeping it.','先让它试过五种独立情况，再决定留下。'],
 'card.review.noneTitle':['No reason to rewrite it yet.','暂时不必改规则。'],
 'card.review.none':['This journey has not linked a detour to a recorded cue. The receipt can close the task without changing the rule.','这次经历尚未把绕行关联到一条已记录的提示。可以完成任务，暂时不改行动规则。'],
 'validation.context':['Test situation','测试情境'], 'validation.change':['v1 → v2','v1 → v2'],
 'validation.result':['{passed}/{count} deterministic checks pass. These test the rule, not real-world benefit.','{passed}/{count} 项确定性检查通过。这是在验证规则行为，并非真实世界效益。'],
 'validation.pass':['passed','通过'], 'validation.fail':['failed','未通过'],
 'card.leave.kicker':['UNTIL NEXT TIME','暂时告别'], 'card.leave.title':['The day ends here.','今天，先到这里。'],
 'card.leave.task':['{id} · {status}. Your glasses will carry this forward.','{id} · {status}。眼镜会把这条记录带到下次。'],
 'card.leave.noTask':['You kept no task. Tomorrow, the glasses will have nothing to pick up from this visit.','这次没有留下任务。明天，眼镜不会从这次到访中接续提醒。'],
 'card.leave.1':['Come back tomorrow. Something on campus will have changed.','明天再来。校园里会有一点变化。'],
 'card.leave.2':['On Friday, another book—and another chance to choose.','到了周五，你会带着另一本书，再作一次选择。'],
 'card.unfinished.title':['Not quite finished.','还差一步。'],
 'card.unfinished.deposited':['The book is in the slot. Its receipt is still unchecked.','书已经放进还书口，但回执还没核对。'],
 'card.unfinished.pending':['The book is still on your list. Pause here, or finish the errand.','书还在待办里。可以先暂停，也可以继续把它还好。'],
 'card.recap.kicker':['YOUR CAMPUS STORY','你的校园手记'], 'card.recap.title':['The next time is different.','下一次，已经不一样。'],
 'card.recap.openTitle':['A thread to pick up.','还有一件事，等你继续。'],
 'card.recap.done':['Another book, safely returned and confirmed.','又一本书，归还了，也确认了。'],
 'card.recap.open':['Your unfinished task is still here when you are ready.','没完成的事还留在这里，等你准备好。'],
 'card.recap.state':['Task: {task}','任务：{task}'], 'card.recap.noTask':['no retained task','没有保留的任务'],
 'card.recap.policy':['Policy: v{version} · {status}','策略：v{version} · {status}'],
 'card.recap.validated':['checked in simulation and accepted','已在模拟中检查并接受'], 'card.recap.unchanged':['unchanged','未改变'],
 'card.recap.fine':['A scripted demonstration of mechanisms—not HALO certification or evidence of real-world service quality.','这是预设世界中的机制演示，不是 HALO 认证，也不构成真实服务质量的证据。'],
 'card.quiet.kicker':['A MOMENT OF QUIET','安静片刻'], 'card.quiet.title':['This can wait.','这件事，可以等。'],
 'card.quiet.body':['There is a conversation here. The glasses hold the reminder until you step away.','这里有人在交谈。眼镜把提醒留到你走开之后。'],
 'card.first.kicker':['MONDAY / NO RUSH','周一 / 不必着急'], 'card.first.title':['Take the long way.','不妨绕一绕。'],
 'card.first.body':['The book is due tomorrow. Today, wander past the courtyard and café. Head to the gate when you are ready.','书明天才到期。今天可以逛逛庭院和咖啡馆。准备好离开时，就往校门走。'],
 'card.closedPoint.kicker':['AT THE DOOR','门前'], 'card.closedPoint.title':['Not here today.','今天，不在这里。'],
 'card.closedPoint.body':['{place} is not accepting returns. A fresh notice is posted beside the door.','{place}今天不接收还书。门边贴着一张新告示。'],
 'card.deposit.kicker':['ONE LAST CHECK','最后核对一下'], 'card.deposit.title':['Did it go through?','还书成功了吗？'],
 'card.deposit.body':['The book is in the slot. Check the receipt for its ID before crossing it off.','书放进去了。看看回执上的编号，再把它从待办里划掉。'],
 'card.return.kicker':['THE RETURN POINT','还书点'], 'card.return.title':['You made it.','到了。'],
 'card.return.body':['Return {id} at {place}. The glasses will then look for a matching receipt.','在{place}归还 {id}。眼镜随后会检查对应的回执。'],
 'card.next.2':['Yesterday’s task is still with you. Its remembered destination may have changed.','昨天的任务还在。记忆里的那个还书点，或许已经变了。'],
 'card.next.3.candidate':['A new book, B18. Before heading out, you can test the rule suggested by your last visit.','这次是新借的 B18。出发之前，可以试试上次经历带来的新规则。'],
 'card.next.3.ordinary':['A new book, B18. Your existing rule stays with you. Find today’s return point.','这次是新借的 B18。眼镜沿用原来的规则。找找今天的还书点吧。'],
 'card.pause.kicker':['PAUSED','已暂停'], 'card.pause.title':['We’ll pick up here.','回来时，从这里继续。'],
 'card.pause.body':['Your task is kept. The simulated service is paused until you continue.','任务还留着。模拟服务已暂停，等你继续。'],
 'card.unavailable.kicker':['SCENE UNAVAILABLE','场景暂不可用'], 'card.unavailable.title':['The campus could not open.','校园暂时打不开。'],
 'card.unavailable.body':['This scene needs WebGL. The interactive framework is still available below.','这个场景需要 WebGL 支持。你仍可查看网站中的交互式理论框架。'],
 'notify.saved':['Kept: the task and quiet cues. The raw scene is not saved.','记住任务，保持安静提示。原始画面不保存。'],
 'notify.skipped':['Seen, but not kept. There will be no reminder from this visit.','看过了，但没有留下。本次观察不会生成之后的提醒。'],
 'notify.forgot':['Task forgotten. Its future reminders and pending checks stop here.','任务已忘记。相关的后续提醒和待执行检查也一并停止。'],
 'notify.wait':['A conversation nearby. The reminder can wait.','附近有人交谈。提醒先等等。'],
 'notify.check':['Before pointing the way, check whether the remembered desk is still open.','先看看记忆里的还书点是否还开着，再指路。'],
 'notify.ask':['This check needs observation permission.','这项检查还需要观察权限。'],
 'notify.cue':['{id} is still pending. Last known return point: {place}.','{id} 还没完成。上次记录的还书点：{place}。'],
 'notify.resume':['A quieter moment. Return {id} at {place}.','现在安静一些了。去{place}归还 {id}。'],
 'notify.checked':['Today’s notice checked. Returns are at {place}.','已核对今日告示。现在的还书点是{place}。'],
 'notify.commit':['New rule kept. Watch what it checks next.','新规则已留下。看看接下来它会先检查什么。'],
 'notify.keep':['Policy v{version} stays. Your personal records are unchanged.','继续使用策略 v{version}，个人记录不变。'],
 'notify.rollback':['Back to policy v1. Tasks and facts stay as they are.','已回到策略 v1，任务和事实记录保持不变。'],
 'objective.start':['Put on the glasses','戴上眼镜'], 'objective.loan':['Read the loan slip','看看借书凭条'],
 'objective.first':['Explore, then head to the gate','先逛一逛，再走向校门'], 'objective.review':['Try the new rule, or keep exploring','试试新规则，或继续探索'],
 'objective.done':['Look back at your journey','回看这段旅程'], 'objective.returned':['Return confirmed. Head out when you are ready','归还已确认。准备好后就可以离校了'],
 'objective.receipt':['Check the matching receipt','核对对应的还书回执'],
 'objective.check':['Check {place} before giving directions','先检查{place}，再给出方向提示'],
 'objective.return':['Return your book · last known point: {place}','去还书 · 上次记录的地点：{place}']
};
export const CATALOG=Object.freeze(Object.fromEntries(Object.entries(copy).map(([key,[en,zh]])=>[key,Object.freeze({en,zh})])));
export function t(lang,key,vars={}){const row=CATALOG[key];if(!row)throw new Error(`Unknown campus copy key: ${key}`);return row[lang==='zh'?'zh':'en'].replace(/\{(\w+)\}/g,(_,name)=>String(vars[name]??''));}
export function placeLabel(lang,id){return CATALOG[`place.${id}`]?t(lang,`place.${id}`):String(id??'');}
export function statusLabel(lang,status){return CATALOG[`status.${status}`]?t(lang,`status.${status}`):String(status??'');}
export function dueLabel(lang,due){return CATALOG[`due.${due}`]?t(lang,`due.${due}`):String(due??'');}
export function visitCopy(lang,visit){return {title:t(lang,`visit.${visit}.title`),time:t(lang,`visit.${visit}.time`)};}
export function objectiveText(lang,s){
 const raw=objective(s),place=placeLabel(lang,s.memory.location);
 const exact={'Put on the glasses':'start','Read the loan slip; choose what to remember':'loan','Explore campus, then leave for the day':'first','Review the proposed rule, or keep exploring':'review','Your story is ready to review':'done','Return confirmed. Reflect, then come back another day':'returned','Check the kiosk receipt before closing the task':'receipt'};
 return t(lang,`objective.${exact[raw]||(/^Check /.test(raw)?'check':'return')}`,{place});
}
export function dialogModel(lang,kind,s,data={}){
 const tr=(key,vars)=>t(lang,key,vars),task=s.memory.task,id=task?.id||(s.visit===3?'B18':'B17');
 const place=placeLabel(lang,data.place||worldLocation(s.visit));
 const a=(id,key=`action.${id}`,vars)=>({id,label:tr(key,vars)});
 const model=(kicker,title,paragraphs,actions,extra={})=>({kicker:tr(kicker),title:tr(title),paragraphs,actions,...extra});
 switch(kind){
  case 'welcome':return model('intro.kicker',s.started?'intro.returnTitle':'intro.title',[tr('intro.setting'),tr('intro.move'),tr('intro.interact')],[a(s.started?'resume-game':'start')],{intro:true,chapters:[1,2,3].map(n=>tr(`chapter.${n}`)),fine:tr('intro.fine')});
  case 'loan':
   if(task?.status==='completed')return model('state.heading','card.closedLoan.title',[tr('card.closedLoan.body',{id})],[a('continue'),a('go-gate')]);
   if(task?.status==='pending')return model('state.heading','card.pending.title',[tr('card.pending.body',{id,due:dueLabel(lang,task.due)})],[a('continue'),a('forget')]);
   return model('card.loan.kicker',s.visit===1?'card.loan.title':'card.loan.laterTitle',[tr('card.loan.body',{id,due:dueLabel(lang,s.visit===1?'Tuesday afternoon':'This visit')})],[a('save-quiet'),a('skip-save')]);
  case 'notice':return model('card.notice.kicker','card.notice.title',[tr(`card.notice.${s.visit}`)],[a('go-current','action.go-current',{place}),a('continue')]);
  case 'feedback':return model('card.feedback.kicker','card.feedback.title',[tr('card.feedback.body')],[...(s.flags[`${s.visit}:detourCue`]?[a('feedback-detour')]:[]),a('feedback-anyway')]);
  case 'feedback-result':return model('card.feedbackResult.kicker','card.feedbackResult.title',[tr(s.candidate?'card.feedbackResult.candidate':'card.feedbackResult.noCandidate')],[a('go-gate'),a('show-memory')]);
  case 'review':
   if(!s.candidate)return model('card.review.kicker','card.review.noneTitle',[tr('card.review.none')],[a('continue')]);
   return model('card.review.kicker','card.review.title',[tr('card.review.current',{rule:tr(`policy.${s.policy}`)}),tr('card.review.candidate'),...(!s.validation?[tr('card.review.test')]:[])],s.validation?[a('commit'),a('keep-policy')]:[a('test-policy'),a('keep-policy')],{validation:s.validation?.map(row=>localizeValidation(lang,row)),fine:s.validation?tr('validation.result',{passed:s.validation.filter(r=>r.pass).length,count:s.validation.length}):null});
  case 'leave':
   if(s.visit===2&&task?.status==='pending')return model('card.leave.kicker','card.unfinished.title',[tr(s.flags['2:deposited']?'card.unfinished.deposited':'card.unfinished.pending')],[a('continue'),a('pause')]);
   return model('card.leave.kicker','card.leave.title',[task?tr('card.leave.task',{id,status:statusLabel(lang,task.status)}):tr('card.leave.noTask'),tr(`card.leave.${s.visit}`)],[a('next',`action.next.${s.visit}`),a('continue')]);
  case 'recap':return model('card.recap.kicker',s.complete?'card.recap.title':'card.recap.openTitle',[tr(s.complete?'card.recap.done':'card.recap.open'),tr('card.recap.state',{task:task?`${id} · ${statusLabel(lang,task.status)}`:tr('card.recap.noTask')}),tr('card.recap.policy',{version:s.policy,status:tr(s.committed?'card.recap.validated':'card.recap.unchanged')})],[a('see-trace'),a('continue'),a('restart')],{channels:[...new Set(s.log.map(e=>e.channel))].filter(c=>['SM','MA','AS','MS','AM'].includes(c)),fine:tr('card.recap.fine')});
  case 'quiet':return model('card.quiet.kicker','card.quiet.title',[tr('card.quiet.body')],[a('continue'),a('show-memory')]);
  case 'first-visit':return model('card.first.kicker','card.first.title',[tr('card.first.body')],[a('continue'),a('go-gate')]);
  case 'completed':return model('state.heading','card.closedLoan.title',[tr('card.closedLoan.body',{id})],[a('go-gate'),a('continue')]);
  case 'closed-point':return model('card.closedPoint.kicker','card.closedPoint.title',[tr('card.closedPoint.body',{place})],[a('read-notice'),a('continue')]);
  case 'deposited':return model('card.deposit.kicker','card.deposit.title',[tr('card.deposit.body')],[a('receipt'),a('continue')]);
  case 'return':return model('card.return.kicker','card.return.title',[tr('card.return.body',{id,place})],[a('return-book'),a('continue')]);
  case 'next-visit':return {kicker:tr('visitShort',{visit:s.visit})+' / '+visitCopy(lang,s.visit).time,title:visitCopy(lang,s.visit).title,paragraphs:[tr(s.visit===2?'card.next.2':s.candidate?'card.next.3.candidate':'card.next.3.ordinary')],actions:[a(s.visit===3&&s.candidate?'review':'continue'),a('show-memory')]};
  case 'pause':return model('card.pause.kicker','card.pause.title',[tr('card.pause.body')],[a('resume-game')]);
  case 'unavailable':return model('card.unavailable.kicker','card.unavailable.title',[tr('card.unavailable.body')],[a('go-framework')]);
  default:throw new Error(`Unknown campus dialog: ${kind}`);
 }
}

const evidence={
 'Glasses on':'戴上眼镜', 'A commitment worth keeping':'值得留下的一件事',
 'A remembered place guides attention':'记住的地点引导观察', 'A cue from retained context':'依据记忆给出提示',
 'Check before giving directions':'先检查，再指路', 'Silence is a decision':'沉默也是一种决定',
 'Observation needs permission':'观察需要权限', 'No pending commitment':'没有待完成的事项', 'No retained commitment':'没有保留的任务',
 'The familiar place changed':'熟悉的地点变了', 'Fresh evidence, same destination':'新证据确认了原来的地点',
 'Keep the corrected fact':'保存修正后的事实', 'This return point is closed':'这个还书点关闭了',
 'Did the return actually register?':'这次归还真的登记了吗？', 'A receipt closes this commitment':'回执确认任务完成',
 'A bounded explanation, not a guess':'有依据、有限度的解释', 'Completion is not causal credit':'完成不等于提醒有功',
 'A different book, a later visit':'下一次，另一本书', 'An interaction ends; state survives':'交互结束，状态保留',
 'Test the proposed control rule':'检验候选控制规则', 'A rule, not a personal fact':'改变控制规则，而非个人事实',
 'Keep the current policy':'继续使用当前策略', 'Policy restored':'策略已恢复', 'Commitment removed':'任务已删除',
 'Simulated loan slip B17':'模拟借书凭条 B17', 'Loan slip + your choice':'借书凭条与你的选择',
 'Last retained return point':'上次保留的还书地点', 'Campus-entry event; no new request':'进入校园的事件；没有新的用户请求',
 'Conversation zone + saved cue preference':'交谈区域与已保存的提示偏好', 'Left the conversation zone':'离开交谈区域',
 'Fresh return-point notice':'新的还书点告示', 'Dated return-point notice':'带日期的还书点告示',
 'The door / return kiosk in front of you':'眼前的入口或还书设备', 'You place the book in the return slot':'你把书放进还书口',
 'Your report + recorded cue and unavailable return point':'你的反馈，以及记录中的方向提示和关闭地点',
 'Your report after return':'归还之后，你给出的反馈', 'New loan slip B18':'新借书凭条 B18', 'Visit boundary':'到访之间的交互边界',
 'Five separate simulated validation contexts':'五种独立的模拟验证情境', 'Validation checks + your explicit acceptance':'验证检查与你的明确接受',
 'Your choice':'你的选择', 'Your undo request':'你的撤销请求', 'Your deletion request':'你的删除请求',
 'Book due Tuesday. No raw camera or microphone capture.':'书在周二到期。不采集真实摄像头或麦克风数据。',
 'Current observation only; nothing retained yet.':'目前仅是一次观察，尚未保留内容。',
 'Written to personal memory. The raw scene is not stored.':'写入个人记忆，不保存原始场景。',
 'Withhold the directional cue until fresh evidence is acquired.':'等待新证据，暂不给出方向提示。',
 'Non-urgent task; a conversation is in progress.':'任务不紧急，当前有人交谈。',
 'Wait for a quiet moment. No conversation transcript is retained.':'等到安静的时机，不保存谈话文本。',
 'The current grant does not allow this check.':'当前授权不允许进行这项检查。',
 'Ask for permission; do not sample or issue a directional cue.':'请求权限，暂不采样，也不发出方向提示。',
 'No pending task is available.':'没有可继续执行的待办事项。', 'The service stays silent.':'服务保持沉默。',
 'Current availability is verified.':'已核验当前位置的可用性。',
 'This matches the earlier cue target; ask the wearer whether it caused a detour.':'这与先前提示的目标一致；询问佩戴者是否因此绕了路。',
 'No matching directional cue is recorded. This visit alone does not establish a policy failure.':'没有对应的方向提示记录，仅凭这次到访不能认定策略出错。',
 'Check the kiosk receipt; depositing alone does not close the task.':'检查设备回执；仅仅把书放进去，还不能完成任务。',
 'Propose checking availability before future directional cues. Nothing committed yet.':'提出“先确认可用性，再指路”的候选规则，尚未提交。',
 'No matching prior cue supports that attribution.':'没有相匹配的先前提示，无法支持这项归因。',
 'You planned to return the book anyway.':'你本来就打算归还这本书。',
 'Close the task, but do not credit the reminder or revise the policy.':'完成任务，但不把结果归功于提醒，也不因此修改策略。',
 'Return B18 before leaving campus.':'离校前归还 B18。',
 'New commitment admitted; prior location and cue preference retained.':'保存新的任务，继续保留先前地点与提示偏好。',
 'No task was retained.':'没有保留任务。', 'Read the same personal state on the next visit.':'下次到访时读取同一份个人状态。',
 'Candidate v2 remains uncommitted. These checks are not a real-world benefit estimate.':'候选 v2 仍未提交。这些检查不能估计真实世界的效益。',
 'v2: obtain fresh availability before non-urgent directional cues.':'v2：在发出非紧急方向提示之前，取得新的可用性证据。',
 'Control policy saved for later decisions. You can undo it.':'控制策略已保存，供后续决策使用；可以撤销。',
 'No new candidate is accepted.':'没有接受新的候选规则。', 'Candidate not accepted.':'未接受候选规则。',
 'v2 → v1':'v2 → v1', 'Personal tasks and facts remain intact.':'个人任务与事实记录保持不变。',
 'Remove the retained task and its pending observation/receipt requests.':'删除保留的任务及其待执行的观察、回执请求。',
 'No further task reminder can be generated from that record.':'之后不会再根据这条记录生成任务提醒。',
 // Earlier local demo records remain readable after an update.
 'The task returns with you':'任务随你一起回来', 'A quieter moment':'等到了安静的时机',
 'Saved policy v2; pending task':'已保存的策略 v2 与待完成任务',
 'A private reminder is prepared from retained state.':'根据保留的状态准备私人提醒。',
 'A fresh observation is required before choosing a destination.':'选择目的地之前，需要一次新的观察。',
 'Non-urgent return task; the wearer is talking.':'还书并不紧急，佩戴者正在交谈。',
 'Your report + recorded unavailable return point':'你的反馈与已记录的关闭还书点',
 'The old directional cue sent you to a closed point.':'旧的方向提示把你带到了关闭的还书点。',
 'Book ID matches the earlier return action.':'图书编号与先前的归还动作相匹配。',
 'Remove the retained task.':'删除保留的任务。',
 'The service stays silent. Read the loan slip to start a task.':'服务保持沉默。可以读取借书凭条，建立新的任务。',
 'The task remains pending. Read the notice for an alternative.':'任务仍待完成。读取告示，寻找其他还书点。'
};
const templates=[
 [/^(B\d+): return book; (.+) cues; source retained\.$/,(id)=>`${id}：归还图书；使用安静提示；来源已保留。`],
 [/^Select (Library|Café) as the observation target; current evidence may correct the prior\.$/,place=>`选择${placeLabel('zh',place)}作为观察目标；当前证据可以纠正旧先验。`],
 [/^(B\d+): last known return point (Library|Café); (.+) cue\.$/,(id,place)=>`${id}：上次记录的还书点为${placeLabel('zh',place)}；使用安静提示。`],
 [/^Give a directional cue toward (Library|Café)\.$/,place=>`发出前往${placeLabel('zh',place)}的方向提示。`],
 [/^Check whether (Library|Café) accepts returns now\.$/,place=>`检查${placeLabel('zh',place)}现在是否接收还书。`],
 [/^Today's sign at (Library|Café|Courtyard|Gate)$/,place=>`${placeLabel('zh',place)}的今日告示`],
 [/^Observed: returns accepted at (Library|Café)\.$/,place=>`观察结果：${placeLabel('zh',place)}目前接收还书。`],
 [/^The prior (Library|Café|location) is corrected by fresh evidence\.$/,place=>`新的证据修正了${place==='location'?'原来的地点判断':`“${placeLabel('zh',place)}”这一旧先验`}。`],
 [/^(Library|Café) accepts returns during this visit\.$/,place=>`本次到访期间，${placeLabel('zh',place)}接收还书。`],
 [/^Location record updated; policy stays v(\d+)\.$/,version=>`地点记录已更新，策略仍为 v${version}。`],
 [/^(Library|Café) is unavailable\.$/,place=>`${placeLabel('zh',place)}目前不可用。`],
 [/^Expected receipt for (B\d+)\.$/,id=>`等待 ${id} 的对应回执。`],
 [/^Kiosk receipt (B\d+)$/,id=>`还书设备回执 ${id}`],
 [/^Book and task instance match return action #(\d+)\.$/,id=>`图书与本次任务实例均匹配归还动作 #${id}。`],
 [/^(B\d+) marked complete\. This does not prove the reminder caused the return\.$/,id=>`${id} 已标记完成。这并不能证明归还是由提醒促成的。`],
 [/^You report cue #(\d+) toward (Library|Café) caused the detour; observation #(\d+) confirms it was closed\.$/,(cue,place,observation)=>`你反馈：指向${placeLabel('zh',place)}的提示 #${cue} 导致了绕行；观察 #${observation} 确认该处关闭。`],
 [/^(B\d+): (pending|completed)$/,(id,status)=>`${id}：${statusLabel('zh',status)}`],
 [/^(\d+)\/(\d+) rule checks pass\.$/,(passed,total)=>`${passed}/${total} 项规则检查通过。`],
 [/^v(\d+) stays active\. The pending task is unchanged\.$/,version=>`继续使用 v${version}，待办任务不变。`],
 [/^(B\d+) remains pending\. Cue preference: (.+)\.$/,id=>`${id} 仍待完成，提示偏好为安静提示。`],
 [/^Observation is directed toward (Library|Café); this prior may be stale\.$/,place=>`观察指向${placeLabel('zh',place)}，这一先验可能已经过时。`],
 [/^The (B\d+) commitment is still pending\.$/,id=>`${id} 这件事仍待完成。`],
 [/^Show a (.+) cue now\.$/,()=>`现在给出安静的视觉提示。`],
 [/^The cue pointed to (Library|Café); this point is unavailable\.$/,place=>`提示指向${placeLabel('zh',place)}，但该还书点当前不可用。`]
];
export function localizeEvidence(lang,value){
 const raw=String(value??'');if(lang!=='zh')return {text:raw,known:true};
 if(Object.hasOwn(evidence,raw))return {text:evidence[raw],known:true};
 if(['Library','Café','Courtyard','Gate'].includes(raw))return {text:placeLabel(lang,raw),known:true};
 for(const [pattern,render] of templates){const match=raw.match(pattern);if(match)return {text:render(...match.slice(1)),known:true};}
 return {text:raw,known:raw===''||/^B\d+$/.test(raw)};
}
export function localizeEvent(lang,event){
 const output={...event},untranslated=[];
 for(const field of ['title','source','payload','effect']){const result=localizeEvidence(lang,event[field]);output[field]=result.text;if(!result.known)untranslated.push(field);}
 return {...output,untranslated};
}
const validationNames={
 'Familiar point, stale observation':'熟悉地点的观察已过时',
 'Usual point closed; alternative observed':'常用点关闭，已观察到替代点',
 'In a conversation':'正在交谈',
 'Observation permission revoked':'观察权限已撤销',
 'No pending task':'没有待办任务'
};
export function decisionLabel(lang,value){
 if(lang!=='zh')return value;
 const [action,target]=value.split(' · '),name={silence:'沉默',wait:'等待',ask:'请求权限',check:'检查',cue:'提示'}[action]||action;
 return name+(target?' · '+placeLabel(lang,target):'');
}
export function localizeValidation(lang,row){return {...row,name:lang==='zh'?validationNames[row.name]||row.name:row.name,before:decisionLabel(lang,row.before),after:decisionLabel(lang,row.after)};}
