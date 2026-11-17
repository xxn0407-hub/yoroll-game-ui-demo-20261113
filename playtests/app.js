(function(){
 'use strict';
 const U=window.YorollPlayUI,R=window.YorollPlayRules,S=window.YorollPlaySession,F=window.YorollPlayFeedback,sound=window.YorollSound,A=window.YorollPlayAudio;
 const $=s=>document.querySelector(s),frame=$('#game-frame'),screen=$('#screen'),review=$('#suite-review');
 const esc=U.escape,icon=U.icon,button=U.button;
 let orientationOverride=null;
 let game,chapters,mediaMap,category=0,current=null,stack=[],state,flow=false,adapter=null,last=performance.now(),muted=sound.isMuted(),baseSpeed=1;
 const gate=new S.Gate(),key='yoroll-playtests:progress:v1';
 const descriptions=['选择会改变好感、物品和后续的可用分支。','从点击到描摹，让每一种操作都有清晰而轻柔的反馈。','在场景中发现线索，回看支线，拼合故事。','采集、阅读、使用和组合道具，让线索相互关联。','将思考的空间留给棋盘，以克制的光感提示当前状态。','让目标、机会和结果清晰可见。','让判定跟随动作，让节奏中的反馈保持连贯。','选择、慢放和图音播放之间，保持稳定的时间关系。','独立小游戏与故事流程的连接。'];
 function pageLocation(nodeId){const address=new URL(location.href);address.searchParams.set('chapter',category+1);if(nodeId)address.searchParams.set('node',nodeId);else address.searchParams.delete('node');return address.pathname+address.search;}
 function contentOrientation(node){return window.YorollLayout.orientationOf(orientationOverride||node?.screenOrientation||chapters[category]?.meta.screenOrientation||game.screenOrientation);}
 const roots={image:'https://lineargame.top/test/Images/',audio:'https://lineargame.top/test/Audios/',video:'https://lineargame.top/test/Videos/'};
 function url(value,kind='video'){if(!value)return '';const full=/^https?:/.test(value)?value:new URL(value,roots[kind]).href;return mediaMap[full]?.path||full;}
 function poster(node){if(node.playback_mode==='image_audio')return url(node.images[0].image_url,'image');if(node.qte?.type==='puzzle')return url(node.qte.jigsaw_puzzle_img_url,'image');const id=(node.video||'1.mp4').match(/([123])\.mp4$/)?.[1]||'1';return `assets/${{1:'0b430eb9de71df92',2:'ef83cca40bbe5cf5',3:'6dfb502d3018a6bf'}[id]}-poster.jpg`;}
 function allNodes(chapter){return [...chapter.nodes,...(chapter.side_nodes||[])];}
 function save(){if(!flow)return;if(current)state.location={chapter:category+1,nodeId:(stack[0]?.run||current).node.id};try{localStorage.setItem(key,JSON.stringify(state));}catch{}}
 function effects(source,ledger){const changes=R.applyEffects(state,source,game,ledger);save();if(changes.length){const text=changes.map(c=>`${c.character?(game.characterConfigs.find(a=>a.characterId===c.character)?.displayName||'')+' ':''}${c.type==='item'?item(c.id).itemName:game.statConfigs.find(s=>s.id===c.id)?.displayName||c.id} ${c.delta>0?'+':''}${c.delta}`).join('　');F.toast(text);}}
 const item=id=>game.itemConfigs.find(v=>v.itemId===id)||{itemId:id,itemName:id};
 const itemIcon=id=>({herb:'leaf',rope:'rope',potion:'flask'})[id]||'bag';
 function motion(root){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;root.querySelectorAll('.suite-top,.suite-library-heading,.suite-category,.suite-card,.suite-play-heading,.suite-stage-controls,.suite-operation,.suite-native-stage,.suite-calendar,.suite-paper,.suite-choices').forEach((el,i)=>el.animate([{opacity:0,transform:`translate3d(0,${8+Math.min(i,6)}px,0)`},{opacity:1,transform:'none'}],{duration:640,delay:Math.min(i*32,220),easing:'cubic-bezier(.16,1,.3,1)',fill:'backwards'}));}
 function top(title,back='hub'){return `<header class="suite-top"><div class="back-heading"><button class="back-btn" data-suite="${back}" aria-label="返回">${icon('back')}</button><h1>${esc(title)}</h1></div><div class="suite-top-actions"><button class="subtle-btn" data-suite="inventory" aria-label="随身道具">${icon('bag')}<span>道具</span></button><button class="subtle-btn" data-suite="stats" aria-label="角色状态">${icon('heart')}<span>角色</span></button><button class="icon-btn suite-sound" data-suite="sound" aria-label="${muted?'开启声音':'关闭声音'}" aria-pressed="${!muted}">${icon(muted?'mute':'volume')}</button></div></header>`;}
 function setBackground(node){$('#suite-background').innerHTML=`<img src="${esc(poster(node))}" alt="">`;}
 function stopRuntime(run,{keepResult=false}={}){if(!run)return;A.clear({keepResult});if(run.engineSession){window.dispatchEvent(new CustomEvent('yoroll:gameplay-stop',{detail:{sessionId:run.engineSession.sessionId}}));try{adapter?.stop?.({sessionId:run.engineSession.sessionId});}catch{}}run.abort.abort();run.module?.dispose?.();run.media?.pause();run.module?.suspend?.();run.element?.querySelectorAll('video,audio').forEach(m=>m.pause());run.element?.querySelectorAll('iframe').forEach(m=>m.remove());run.element?.remove();}
 function dispose(){gate.stop();stopRuntime(current);stack.forEach(v=>stopRuntime(v.run));stack=[];current=null;}
 function later(run,fn,ms){(run.scheduled||(run.scheduled=[])).push({due:run.clock.time+ms/1000,fn});}
 function hub(index=category){dispose();category=index;flow=false;F.closeModal(true);frame.dataset.mode='library';const chapter=chapters[category];setBackground(chapter.nodes[0]);
  screen.innerHTML=`${top('玩法交互','home')}<nav class="suite-categories" aria-label="玩法分类">${game.chapters.map((c,i)=>`<button class="suite-category" data-suite="category" data-index="${i}" aria-current="${i===category}"><small>${String(i+1).padStart(2,'0')}</small><span>${esc(c.title)}</span></button>`).join('')}</nav><section class="suite-library"><div class="suite-library-heading"><div><h2>${esc(chapter.meta.title||game.chapters[category].title)}</h2><p>${descriptions[category]}</p></div><div class="suite-flow-actions">${button('连续体验','flow',{small:true,primary:true,iconName:'play'})}<button class="subtle-btn" data-suite="resume-flow">继续上次体验</button></div></div><div class="suite-grid">${chapter.nodes.map((node,i)=>`<button class="suite-card" data-suite="node" data-index="${i}" aria-label="${esc(node.title)}"><img src="${esc(poster(node))}" alt="" loading="lazy"><span class="suite-card-symbol">${icon(U.modeOf(node)[2])}</span><span class="suite-card-time">${node.qte?.duration>0?`${icon('clock')}${node.qte.duration} s`:''}</span><span class="suite-card-copy"><strong>${esc(U.shortTitle(node))}</strong><small>${esc(U.modeOf(node)[1])}${U.nativeTypes.has(U.typeOf(node))?' · 引擎接口预览':''}</small></span></button>`).join('')}</div></section><footer class="suite-footer"><span>9 类场景 · 34 种玩法</span><a href="../">返回游戏界面 ${icon('arrow')}</a></footer>`;
  updateReview();motion(screen);history.replaceState(null,'',pageLocation());
 }
 function seed(node){state=R.initialState(game);const index=chapters[category].nodes.indexOf(node);for(const n of chapters[category].nodes.slice(0,index))R.applyEffects(state,n,game,`seed:${n.id}`);}
 function beginFlow(resume=false){flow=true;let saved;try{saved=JSON.parse(localStorage.getItem(key));}catch{}state=resume&&saved?.version===1?saved:R.initialState(game);if(resume&&saved?.location){category=saved.location.chapter-1;load(saved.location.nodeId);}else load(chapters[category].meta.startNodeId);}
 function playNode(node){dispose();flow=false;seed(node);load(node.id);}
 function updateReview(){const chapterButtons=game.chapters.map((c,i)=>`<button data-suite="category" data-index="${i}">${String(i+1).padStart(2,'0')}　${esc(c.title)}</button>`).join('');const nodeButtons=current?'<hr>'+chapters[category].nodes.map((n,i)=>`<button data-suite="node" data-index="${i}">${esc(n.title)}</button>`).join(''):'';$('#suite-review-modes').innerHTML=chapterButtons+nodeButtons;}
 function context(run){return {node:run.node,q:run.node.qte||{},type:run.type,body:run.body,stage:run.element,state,game,R,U,url,poster,item,itemIcon,
  active:()=>current===run&&run.started&&run.qteStarted&&!run.clock.paused&&!run.settled&&!run.abort.signal.aborted,
  on:(el,name,fn,options={})=>el?.addEventListener(name,fn,{...options,signal:run.abort.signal}),
  sfx:(event,options={})=>{const inNote=options.note&&run.clock.pauses.size===1&&run.clock.pauses.has('note');return current===run&&run.started&&run.qteStarted&&!run.settled&&!run.abort.signal.aborted&&(!run.clock.paused||inNote)?A.play(event,options):false;},audio:A,
  get reference(){return window.YorollLayout.referenceSize(run.contentOrientation);},get muted(){return muted;},get time(){return run.qteTime;},get mediaTime(){return run.media?.currentTime||run.clock.time;},get duration(){return run.duration;},
  status:(message,failure=false)=>status(run,message,failure),toast:F.toast,finish:(score,options)=>finish(run,score,options),
  effects:(source,ledger)=>effects(source,ledger),save,side:(option,onReturn)=>openSide(run,option,onReturn),
  setMedia:ref=>setMedia(run,ref),slow:(active,config)=>setSlow(run,active,config),
  engineAction:(action,payload)=>engineAction(run,action,payload),engineState:()=>run.engineSession,
  note:(title,html)=>note(run,title,html),closeNote:()=>closeNote(run),
  onEnd:fn=>{run.onEnd=fn;},setDuration:value=>{run.duration=value;},penalty:seconds=>{run.qteTime+=seconds;},delay:(fn,ms)=>later(run,fn,ms)
 };}
 function load(id,{restoring=false}={}){const chapter=chapters[category],node=allNodes(chapter).find(v=>v.id===id);if(!node){F.toast('未找到对应片段');return hub();}
  if(current&&!restoring){stopRuntime(current,{keepResult:current.settled});gate.stop();}
  F.closeModal(true);const type=U.typeOf(node),native=U.nativeTypes.has(type),run={node,type,clock:new S.Clock(),abort:new AbortController(),started:false,qteStarted:false,qteTime:0,duration:node.qte?.duration||node.duration||0,settled:false,ended:false,slowFactor:1,slowTarget:1,slowStyle:1,flow};current=run;run.contentOrientation=contentOrientation(node);frame.dataset.contentOrientation=run.contentOrientation;
  if(flow){R.recordVisit(state,String(category+1),node.id);if(!stack.length)state.history.push({chapter:category+1,nodeId:node.id});}effects(node,`node:${category+1}:${node.id}`);save();setBackground(node);frame.dataset.mode=type;
  const element=document.createElement('section');element.className=`suite-player ${native?'is-native':['paper_cutting','balance','puzzle','craft_bench','dial_lock','dating_calendar'].includes(type)?'is-board':''} is-ready`;run.element=element;
  const title=U.modeOf(node)[0],spatial=['choice_area','scene_choice','insight','investigation','sceneclickvideo','scene_search','shoot2','rhythm','use_item'].includes(type);
  element.innerHTML=`<div class="suite-media" data-media-container></div><div class="suite-dust-field">${Array.from({length:18},(_,i)=>`<i class="suite-float-dot" style="left:${(i*73)%100}%;top:${(i*37)%100}%;animation-delay:${-i*.7}s"></i>`).join('')}</div>${top(title,'leave')}<div class="suite-timer" hidden>${icon('clock')}<span></span></div><div class="suite-play-heading"><h2>${esc(U.shortTitle(node))}</h2><p>${esc(node.qte?.instruction_text_1||U.modeOf(node)[1])}</p></div><div class="suite-spatial-plane"><div class="suite-playbody ${spatial?'is-spatial':''}"></div></div><div class="suite-status" role="status"></div><div class="suite-stage-controls"><div class="playback-controls"><div class="suite-transport"><button data-suite="pause" aria-label="暂停" aria-keyshortcuts="Space" title="播放 / 暂停（观看时按空格）">${icon('pause')}</button><small data-media-time aria-hidden="true" title="已播放 / 本段总时长">00:00 / --:--</small><div class="suite-speed-wrap"><button class="subtle-btn" data-suite="speed" aria-expanded="false">${baseSpeed}× ${icon('chevron')}</button><div class="glass-menu suite-speed-menu" hidden>${[1,1.25,1.5,2].map(v=>`<button role="menuitemradio" aria-checked="${v===baseSpeed}" data-suite="speed-option" data-value="${v}"><span>${v}×</span>${v===baseSpeed?icon('check'):''}</button>`).join('')}</div></div></div><div class="suite-controls-right">${flow&&!stack.length&&state.history.length>1?`<button class="subtle-btn" data-suite="previous-node">${icon('back')} 上一片段</button>`:''}<button class="subtle-btn" data-suite="replay">${icon('replay')} 重播</button>${button('继续','next',{small:true,iconName:'arrow',data:'hidden'})}</div></div><div class="playback-track suite-timeline"><span data-suite-progress></span><input class="suite-track playback-seek" type="range" aria-label="播放进度" min="0" max="1000" value="0"></div></div><div class="suite-readiness"><div>${button(native?'预览操作':'开始体验','start',{primary:true,iconName:'play'})}<small>${native?'原玩法引擎接入前，可预览操作与界面状态':flow?'连续流程':'单项体验'}</small></div></div>`;
  screen.replaceChildren(element);run.body=element.querySelector('.suite-playbody');run.plane=element.querySelector('.suite-spatial-plane');run.ctx=context(run);
  setMedia(run,backgroundRef(node));
  if(spatial)element.classList.add('has-spatial');
  if(type==='choice'){run.body.classList.add('is-spatial');run.module=choices(run);}else if(type==='end'||type==='basic')run.module=narrative(run);else if(native){run.engineSession=gate.begin(type,node.id);run.module=window.YorollPlayNative.mount(run.ctx);}else run.module=window.YorollPlayInteractions.mount(run.ctx);
  run.ctx.on(element.querySelector('.suite-track'),'input',ev=>{if(ev.target.disabled)return;updateVideoProgress(run,Number(ev.target.value));if(run.media&&Number.isFinite(run.media.duration)){run.ended=false;run.media.currentTime=Number(ev.target.value)/1000*run.media.duration;syncVideoTime(run);if(type==='rhythm'){run.qteTime=Math.max(0,run.media.currentTime-(node.qte.delay_from_start_seconds||0));run.settled=false;run.pending=null;run.module.seek?.();F.toast('节奏判定已重新同步');}}});
  run.ctx.on(run.media,'ended',()=>mediaEnded(run));
  syncVideoTimeline(run);updateReview();motion(element);history.replaceState(null,'',pageLocation(id));
  if(flow||stack.length)start(run);
 }
 function backgroundRef(node){const q=node.qte||{};return q.scene_choice?.background||q.scene_click_video?.background||q.peek_config?.normal_video_url||q.background_video_url||node.video||'1.mp4';}
 function setMedia(run,ref){run.media?.pause();run.ended=false;const holder=run.element.querySelector('[data-media-container]');holder.replaceChildren();let media;
  if(run.node.playback_mode==='image_audio'){
   holder.innerHTML=`<img data-image-audio src="${esc(url(run.node.images[0].image_url,'image'))}" alt="">`;media=document.createElement('audio');media.src=A.imageAudio;holder.append(media);A.protectMedia(media,{themed:true});
  }else if(/\.(png|jpg|jpeg|webp)(\?|$)/i.test(ref)){holder.innerHTML=`<img src="${esc(url(ref,'image'))}" alt="">`;run.media=null;return;
  }else{media=document.createElement('video');media.playsInline=true;media.preload='metadata';media.src=url(ref);media.poster=poster(run.node);holder.append(media);A.protectMedia(media);}
  run.media=media;A.sync();media.playbackRate=baseSpeed*run.slowFactor;syncVideoTime(run);
  for(const event of ['durationchange','seeked'])run.ctx?.on(media,event,()=>syncVideoTime(run));
  run.ctx?.on(media,'loadedmetadata',()=>{syncVideoTime(run);if(run.started&&!run.clock.paused)media.play().catch(()=>status(run,'点击继续播放画面'));});
  run.ctx?.on(media,'error',()=>{status(run,'片段暂时无法加载，交互仍可预览');run.mediaFailed=true;});
  run.ctx?.on(media,'ended',()=>mediaEnded(run));if(run.started&&!run.clock.paused)media.play().catch(()=>{});
 }
 function mediaEnded(run){if(current!==run||run.ended)return;run.ended=true;if(run.settled){if(run.pending)complete(run);return;}if(run.onEnd){run.onEnd();return;}if(!run.node.qte&&!run.node.choices){finishNarrative(run);} }
 function start(run){if(current!==run||run.started)return;if(document.hidden||!document.hasFocus())run.clock.pause('visibility');run.started=true;run.element.classList.remove('is-ready');run.element.querySelector('.suite-readiness')?.remove();if(!run.clock.paused){run.media?.play().catch(()=>status(run,'点击播放按钮继续'));run.module?.start?.();}if(run.node.playback_mode!=='image_audio')A.play('start');}
 function status(run,text,failure=false){if(current!==run)return;const el=run.element.querySelector('.suite-status');el.classList.toggle('is-failure',failure);el.textContent=text;}
 function choices(run){let shown=false;const node=run.node;
  function show(){shown=true;const options=R.choicesFor(node,state);run.body.innerHTML=`<section class="suite-choices"><h3 class="suite-question ${node.question?.length>65?'is-long':''}">${esc(node.question||'你会如何选择？')}</h3><div class="suite-choice-rule"></div><div class="suite-choice-grid">${options.map(c=>`<button class="suite-choice" data-choice="${c.index}" aria-disabled="${!c.enabled}">${!c.enabled?icon('lock'):''}${esc(c.label)}</button>`).join('')}</div></section>`;run.element.classList.add('has-choices');setSlow(run,true,node.video_slow_motion);motion(run.body);}
  run.ctx.on(run.body,'click',ev=>{const el=ev.target.closest('[data-choice]');if(!el||!run.ctx.active())return;const selection=R.choose(node,Number(el.dataset.choice),state);if(!selection){A.play('invalid');return;}pick(selection);});
  function pick(selection){if(run.settled)return;run.settled=true;run.pending={next:selection.next,immediate:selection.immediate};run.body.querySelectorAll('button').forEach(el=>el.disabled=true);setSlow(run,false);status(run,selection.immediate?'选择已记录':'选择已记录 · 片段结束后继续');if(selection.immediate||run.ended)complete(run);else if(!flow)showNext(run,'等待片段结束');A.play('turn');}
  return {tick(){if(!shown)show();},timeout(){const index=node.default_choice_index??-1;const c=R.choose(node,index,state);if(c)pick(c);},seek(){}};
 }
 function narrative(run){const node=run.node;if(node.is_end){run.body.innerHTML=`<div class="suite-summary"><div class="suite-summary-symbol">${icon(node.id.includes('death')?'close':'star')}</div><h2>${node.id.includes('death')?'行动失败':'旅程告一段落'}</h2><p>${esc(node.description||'每一次选择，都留下了新的线索。')}</p><div class="suite-summary-actions">${stack.length?button('返回现场','side-return',{primary:true}):button('返回玩法目录','hub',{primary:true})}${!stack.length?button('重播本章','flow'):''}</div></div>`;run.ctx.onEnd(()=>{if(stack.length)closeSide();});}else{run.body.innerHTML=`<div class="suite-narrative"><span>${icon('play')}</span><h3>${esc(node.question||U.shortTitle(node))}</h3><p>故事正在继续</p></div>`;}
  return {};
 }
 function finishNarrative(run){if(stack.length&&run.node.is_end)return closeSide();if(run.node.next){run.pending={next:run.node.next,immediate:true};if(flow)load(run.node.next);else showNext(run);}else if(!run.node.is_end)showNext(run);}
 function finish(run,score,{message,preview=false}={}){if(current!==run||run.settled)return false;
  if(preview){if(run.engineSession){gate.stop();try{adapter?.stop?.({sessionId:run.engineSession.sessionId});}catch{}}run.clock.pause('preview-state');run.media?.pause();run.module?.suspend?.();status(run,message||(score?'已完成':'未完成'),!score);run.element.dataset.feedback=score?'success':'failure';A.play(score?'success':'failure',{level:.8});return true;}
  run.settled=true;run.element.dataset.feedback=score?'success':'failure';run.pending=R.qteOutcome(run.node,score);setSlow(run,false);
  const scoreEffects=run.node.qte?.score_effects?.[String(score)];if(scoreEffects)effects({statEffects:scoreEffects},`score:${category+1}:${run.node.id}`);status(run,message||(score?'已完成':'未完成，再试一次'),!score);A.play(score?'success':'failure');
  if(run.pending.retry){run.settled=false;run.pending=null;return false;}
  if(run.pending.immediate||run.ended||!run.media)later(run,()=>complete(run),620);else if(!flow)showNext(run,'片段结束后继续');return true;
 }
 function complete(run){if(current!==run||!run.pending)return;if(flow||stack.length){const next=run.pending.next;if(next)load(next);else hub();}else{run.media?.pause();showNext(run);}}
 function showNext(run,label='继续'){const el=run.element.querySelector('[data-suite="next"]');if(!el)return;el.hidden=false;el.querySelector('span').textContent=label;el.disabled=label==='等待片段结束'||label==='片段结束后继续';}
 function setSlow(run,active,config){if(config)run.slowConfig=config;const c=run.slowConfig;run.slowTarget=active&&c?Number(c.target_speed)||.7:1;run.slowStyle=Number(c?.style)||1;if(run.slowStyle===1)run.slowFactor=run.slowTarget;}
 function note(run,title,html){closeNote(run);run.clock.pause('note');run.media?.pause();const panel=document.createElement('section');panel.className='suite-note-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-label',title);panel.innerHTML=`<button class="note-close" data-suite="note-close" aria-label="关闭">${icon('close')}</button><h3>${esc(title)}</h3>${html}`;run.element.append(panel);panel.querySelector('.note-close').focus();if(!matchMedia('(prefers-reduced-motion: reduce)').matches)panel.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:440,easing:'cubic-bezier(.16,1,.3,1)'});motion(panel);return panel;}
 function closeNote(run){run.element.querySelector('.suite-note-panel')?.remove();run.clock.resume('note');if(run.started&&!run.clock.paused)run.media?.play().catch(()=>{});}
 function inventory(){if(!current){F.toast('进入玩法后可查看道具');return;}const run=current;note(run,'随身道具',`<div class="suite-inventory">${game.itemConfigs.map(v=>`<button class="suite-item" data-suite="item-read" data-item="${v.itemId}">${icon(itemIcon(v.itemId))}<span>${esc(v.itemName)}</span><small>× ${state.items[v.itemId]||0}</small></button>`).join('')}</div><p>选择物品，查看收集到的记录。</p>${R.canCraft(state,game.craftRecipes[0])?button('合成解毒药水','inventory-craft',{small:true,primary:true}):''}`);}
 function stats(){if(!current){F.toast('进入玩法后可查看角色信息');return;}note(current,'角色状态',`<div class="suite-character-stats">${game.characterConfigs.map(c=>`<article><h3>${esc(c.displayName)}</h3><p>好感度　${state.characters[c.characterId]?.favor||0}</p><div class="suite-progress"><span style="width:${state.characters[c.characterId]?.favor||0}%"></span></div><p>信任度　${state.characters[c.characterId]?.trust||0}</p></article>`).join('')}</div>`);}
 function openSide(run,option,onReturn){if(!run.ctx.active()||!option.side_node_id)return;run.media?.pause();run.clock.pause('side');run.module?.suspend?.();A.clear();A.play('turn');run.element.remove();stack.push({run,option,onReturn});current=null;load(option.side_node_id);}
 function closeSide({skipped=false}={}){const entry=stack.pop();if(!entry)return;const finished=current;stopRuntime(finished);current=entry.run;screen.replaceChildren(current.element);current.clock.resume('side');current.ended=current.media?.ended||false;entry.onReturn?.(entry.option,skipped);if(current.started&&!current.clock.paused)current.media?.play().catch(()=>{});current.module?.resume?.();motion(current.element);updateReview();save();history.replaceState(null,'',pageLocation(current.node.id));}
 function engineStart(run){if(!run.engineSession)return;const request={...run.engineSession,chapterId:String(category+1),config:R.clone(run.node.qte),state:R.clone(state),muted:true,hostMuted:muted,audioPolicy:A.policy,orientation:run.contentOrientation,referenceSize:window.YorollLayout.referenceSize(run.contentOrientation)};
  window.dispatchEvent(new CustomEvent('yoroll:gameplay-start',{detail:request}));if(adapter?.start)try{adapter.start(request,window.YorollGameplayUI);adapter.setMuted?.({sessionId:run.engineSession.sessionId,muted:true,hostMuted:muted,audioPolicy:A.policy});}catch{status(run,'引擎未响应，仍可查看界面状态');}}
 function engineAction(run,action,payload={}){if(!gate.accept(run.engineSession?.sessionId))return false;const event={...run.engineSession,action,payload};window.dispatchEvent(new CustomEvent('yoroll:gameplay-action',{detail:event}));if(adapter?.action){try{adapter.action(event);return true;}catch{status(run,'引擎操作暂时未响应');return false;}}return false;}
 function attachAdapter(value){
  if(adapter&&adapter!==value&&current?.engineSession)try{adapter.stop?.({sessionId:current.engineSession.sessionId});}catch{}
  adapter=value;
  if(current?.engineSession){current.engineSession=gate.begin(current.type,current.node.id);if(current.started&&current.qteStarted)engineStart(current);}
  return ()=>{if(adapter!==value)return;if(current?.engineSession){try{adapter?.stop?.({sessionId:current.engineSession.sessionId});}catch{}gate.stop();current.module?.update?.({connected:false,renderMode:'preview'});}adapter=null;};
 }
 const api={version:1,audioPolicy:A.policy,playSound(sessionId,event){return A.inputEvents.includes(event)&&gate.accept(sessionId)&&current?.engineSession?.sessionId===sessionId?current.ctx.sfx(event):false;},setOrientation(value){orientationOverride=window.YorollLayout.orientationOf(value);if(current){current.contentOrientation=orientationOverride;frame.dataset.contentOrientation=orientationOverride;}return window.YorollLayout.referenceSize(orientationOverride);},attach:attachAdapter,getRenderTarget(sessionId){return current?.engineSession?.sessionId===sessionId&&gate.accept(sessionId)?current.body.querySelector('[data-engine-mount]'):null;},update(sessionId,value){if(!value||typeof value!=='object'||Array.isArray(value)||!gate.accept(sessionId)||!current?.engineSession||current.engineSession.sessionId!==sessionId)return false;current.module?.update?.(value);return true;},complete(sessionId,score){if(!current?.started||!current.qteStarted||!Number.isFinite(score)||current?.engineSession?.sessionId!==sessionId||!Object.hasOwn(current.node.qte.next_node_map,String(score))||!gate.settle(sessionId))return false;return finish(current,score);},getSession(){return current?.engineSession?R.clone(current.engineSession):null;},getState(){return state?R.clone(state):null;}};window.YorollGameplayUI=Object.freeze(api);
 function pause(reason,value){if(!current)return;if(value)current.clock.pause(reason);else current.clock.resume(reason);if(current.clock.paused){current.media?.pause();current.module?.suspend?.();A.clear();}else if(current.started){current.media?.play().catch(()=>{});current.module?.resume?.();}if(current.engineSession){const event={sessionId:current.engineSession.sessionId,paused:current.clock.paused};window.dispatchEvent(new CustomEvent('yoroll:gameplay-pause',{detail:event}));try{adapter?.pause?.(event);}catch{}}const el=current.element.querySelector('[data-suite="pause"]');if(el){el.innerHTML=icon(current.clock.paused?'play':'pause');el.setAttribute('aria-label',current.clock.paused?'继续播放':'暂停');}}
 function menu(run,open){const el=run.element.querySelector('.suite-speed-menu'),trigger=run.element.querySelector('[data-suite="speed"]');trigger.setAttribute('aria-expanded',String(open));if(matchMedia('(prefers-reduced-motion: reduce)').matches){el.hidden=!open;return;}if(open){el.hidden=false;el.animate([{opacity:0,transform:'translateY(6px) scale(.985)'},{opacity:1,transform:'none'}],{duration:280,easing:'cubic-bezier(.16,1,.3,1)'});}else if(!el.hidden){const a=el.animate([{opacity:1,transform:'none'},{opacity:0,transform:'translateY(4px) scale(.985)'}],{duration:180,easing:'cubic-bezier(.22,.68,.25,1)'});a.finished.then(()=>{if(trigger.getAttribute('aria-expanded')==='false')el.hidden=true;}).catch(()=>{});}}
 document.addEventListener('click',ev=>{const el=ev.target.closest('[data-suite]');if(!el)return;const action=el.dataset.suite,run=current;if(el.disabled)return;
  if(['home','hub','category','node','flow','resume-flow','previous-node','next','inventory','stats','note-close','item-read','side-return','speed','speed-option','review-close'].includes(action))sound.play('click',{level:.45});
  switch(action){case'home':location.href='../';break;case'hub':hub();break;case'category':review.hidden=true;hub(Number(el.dataset.index));break;case'node':review.hidden=true;playNode(chapters[category].nodes[Number(el.dataset.index)]);break;case'flow':dispose();beginFlow();break;case'resume-flow':{let saved;try{saved=JSON.parse(localStorage.getItem(key));}catch{}if(saved?.location){dispose();beginFlow(true);}else F.toast('还没有连续体验的记录');break;}case'previous-node':if(flow&&state.history.length>1){state.history.pop();const previous=state.history.pop();load(previous.nodeId);}break;case'start':start(run);break;
   case'leave':if(stack.length){if(stack.at(-1).option.allowSkip!==false)closeSide({skipped:true});else F.toast('看完这段线索后即可返回');}else{pause('modal',true);F.openModal({title:'返回玩法目录？',message:flow?'当前进度已保存在本地。':'你可以随时重新体验这个玩法。',confirm:'返回目录',onConfirm:()=>hub()});}break;
   case'pause':if(run){if(!run.started)start(run);else pause('manual',!run.clock.pauses.has('manual'));}break;
   case'replay':if(run){if(stack.length){load(run.node.id);}else playNode(run.node);}break;
   case'next':if(run?.pending?.next)load(run.pending.next);else if(run?.node.next)load(run.node.next);else hub();break;
   case'sound':muted=!muted;current?.module?.setMuted?.(muted);if(current?.engineSession){const detail={sessionId:current.engineSession.sessionId,muted:true,hostMuted:muted,audioPolicy:A.policy};window.dispatchEvent(new CustomEvent('yoroll:gameplay-audio',{detail}));try{if(adapter?.setMuted)adapter.setMuted(detail);else adapter?.audio?.(detail);}catch{}}sound.setLevels({isMuted:muted,master:1,sfx:1});A.sync();document.querySelectorAll('.suite-sound').forEach(b=>{b.innerHTML=icon(muted?'mute':'volume');b.setAttribute('aria-pressed',String(!muted));b.setAttribute('aria-label',muted?'开启声音':'关闭声音');});F.toast(muted?'全部声音已关闭':'声音已开启');break;
   case'inventory':inventory();break;case'stats':stats();break;case'note-close':if(run)closeNote(run);break;case'item-read':{const v=item(el.dataset.item);note(run,v.itemName,`<p class="suite-note-text">${esc((v.documentPages||[v.description]).join('\n\n'))}</p>`);break;}case'inventory-craft':if(R.craft(state,game.craftRecipes[0])){save();A.play('combine');inventory();F.toast('获得解毒药水');}break;
   case'side-return':if(stack.length){if(run.ended)closeSide();else if(stack.at(-1).option.allowSkip!==false)closeSide({skipped:true});else F.toast('看完这段线索后即可返回');}break;
   case'speed':menu(run,el.getAttribute('aria-expanded')!=='true');break;case'speed-option':baseSpeed=Number(el.dataset.value);menu(run,false);run.element.querySelector('[data-suite="speed"]').innerHTML=`${baseSpeed}× ${icon('chevron')}`;run.element.querySelectorAll('[data-suite="speed-option"]').forEach(b=>{const yes=Number(b.dataset.value)===baseSpeed;b.setAttribute('aria-checked',String(yes));b.innerHTML=`<span>${b.dataset.value}×</span>${yes?icon('check'):''}`;});break;
   case'review-close':review.hidden=true;$('#suite-review-toggle').setAttribute('aria-expanded','false');pause('review',false);break;
   case'preview-state':if(run){review.hidden=true;pause('review',false);if(el.dataset.state==='playing'){playNode(run.node);start(current);}else{if(!run.started)start(run);finish(run,el.dataset.state==='success'?1:0,{preview:true});}}break;
   default:run?.module?.action?.(action,el,ev);
  }
 });
 $('#suite-review-toggle').addEventListener('click',()=>{review.hidden=!review.hidden;$('#suite-review-toggle').setAttribute('aria-expanded',String(!review.hidden));pause('review',!review.hidden);});
 document.addEventListener('pointerover',ev=>{if(ev.pointerType&&ev.pointerType!=='mouse')return;const el=ev.target.closest('button,a');if(!el||el.contains(ev.relatedTarget)||el.disabled||ev.buttons)return;if(current?.body.contains(el)){if(el.matches('.suite-choice,.suite-direction,.suite-area-option')&&current.ctx.active())sound.requestHover(el,{locked:el.getAttribute('aria-disabled')==='true',cue:'game-focus',level:.7});return;}sound.requestHover(el,{locked:el.getAttribute('aria-disabled')==='true',level:.6});});
 document.addEventListener('pointerout',ev=>{const el=ev.target.closest('button,a');if(el&&!el.contains(ev.relatedTarget))sound.cancelHover(el);});
 document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&!$('#modal-root').firstElementChild){if(current?.element.querySelector('.suite-note-panel'))closeNote(current);else if(!review.hidden){review.hidden=true;pause('review',false);}else if(current){pause('manual',!current.clock.pauses.has('manual'));}}handleVideoSpace(ev);});
 window.addEventListener('suite:modal-closed',()=>pause('modal',false));
 function sync(){pause('visibility',document.hidden||!document.hasFocus());}
 document.addEventListener('visibilitychange',sync);window.addEventListener('blur',()=>pause('visibility',true));window.addEventListener('focus',sync);window.addEventListener('pagehide',()=>{pause('visibility',true);sound.stopAll();save();});
 function handleVideoSpace(event){
  if(event.key!==' '||!current||event.defaultPrevented||event.isComposing||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return false;
  if($('#modal-root').firstElementChild||!review.hidden||current.element.querySelector('.suite-note-panel')||current.element.querySelector('[data-suite="speed"]')?.getAttribute('aria-expanded')==='true')return false;
  if(current.qteStarted&&!['basic','end'].includes(current.type))return false;
  if(event.target?.isContentEditable||event.target?.closest?.('button,a,input:not(.suite-track),textarea,select,[contenteditable],[role="button"],[role="menuitem"]'))return false;
  event.preventDefault();
  if(!event.repeat){if(!current.started)start(current);else pause('manual',!current.clock.pauses.has('manual'));}
  return true;
 }
 function syncVideoTimeline(run){
  const hidden=run.qteStarted&&!['basic','end'].includes(run.type),mode=hidden?'hidden':'visible';
  if(run.element.dataset.videoTimeline===mode)return;
  const timeline=run.element.querySelector('.suite-timeline'),seek=run.element.querySelector('.suite-track');
  const moveFocus=hidden&&timeline.contains(document.activeElement);
  run.element.dataset.videoTimeline=mode;timeline.setAttribute('aria-hidden',String(hidden));seek.disabled=hidden;
  if(hidden){
   sound.suppressHover();
   if(moveFocus)(run.body.querySelector('button:not(:disabled):not([aria-disabled="true"]),[tabindex="0"]')||run.element.querySelector('[data-suite="pause"]'))?.focus({preventScroll:true});
  }
 }
 function updateVideoProgress(run,value){
  const position=Math.max(0,Math.min(1000,Number(value)||0));
  run.element.querySelector('.suite-track').value=position;
  run.element.querySelector('[data-suite-progress]').style.width=`${position/10}%`;
 }
 function format(t){const seconds=Number.isFinite(t)?Math.floor(Math.max(0,t)):0;return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
 function syncVideoTime(run){
  const media=run.media;if(!media)return;
  const duration=media.duration,known=Number.isFinite(duration)&&duration>0;
  const text=`${format(media.currentTime)} / ${known?format(duration):'--:--'}`;
  const time=run.element.querySelector('[data-media-time]');if(time.textContent!==text)time.textContent=text;
  run.element.querySelector('.suite-track').setAttribute('aria-valuetext',text);
  updateVideoProgress(run,known?media.currentTime/duration*1000:0);
 }
 function tick(now){const dt=Math.min((now-last)/1000,.1);last=now;const run=current;if(run)syncVideoTimeline(run);
  if(run&&run.started&&!run.abort.signal.aborted){const previous=run.clock.time;run.clock.advance(dt);const delta=run.clock.time-previous;
   if(delta){for(const task of (run.scheduled||[]).filter(t=>t.due<=run.clock.time)){run.scheduled=run.scheduled.filter(t=>t!==task);task.fn();if(current!==run)break;}if(current!==run){requestAnimationFrame(tick);return;}const mediaTime=run.media&&!run.mediaFailed?run.media.currentTime:run.clock.time,delay=Number(run.node.qte?.delay_from_start_seconds??run.node.delay_from_start_seconds)||0;
    if(!run.qteStarted&&mediaTime>=delay){run.qteStarted=true;run.module?.activate?.();if(run.engineSession)engineStart(run);}
    if(run.qteStarted&&!run.settled){run.qteTime+=delta;run.module?.tick?.(delta,run.qteTime);if(run.duration>0&&run.qteTime>=run.duration&&!run.timedOut){run.timedOut=true;if(run.type==='choice')run.module.timeout();else if(!U.nativeTypes.has(run.type))run.module?.timeout?run.module.timeout():finish(run,0);}}
    if(run.slowStyle===2){const amount=delta/.5;run.slowFactor+=Math.sign(run.slowTarget-run.slowFactor)*Math.min(Math.abs(run.slowTarget-run.slowFactor),amount*.3);}else run.slowFactor=run.slowTarget;
    if(run.media){run.media.playbackRate=Math.max(.1,baseSpeed*run.slowFactor);const duration=run.media.duration||0;syncVideoTime(run);
     if(run.node.playback_mode==='image_audio'){const i=R.mediaFrameAt(run.node.images,mediaTime,duration),img=run.element.querySelector('[data-image-audio]');if(img.dataset.index!==String(i)){img.src=url(run.node.images[i].image_url,'image');img.dataset.index=i;}}
    }
    for(const [i,trigger] of (run.node.ui_triggers||[]).entries()){const visible=mediaTime>=trigger.delay_from_start_seconds&&mediaTime<trigger.delay_from_start_seconds+trigger.duration;let el=run.element.querySelector(`[data-trigger="${i}"]`);if(visible&&!el){el=document.createElement('div');el.className=`suite-timed-feedback ${trigger.name==='rhythm_fail'?'is-miss':''}`;el.dataset.trigger=i;el.innerHTML=`${icon(trigger.name==='rhythm_fail'?'close':'check')}<span>${trigger.name==='rhythm_fail'?'错过时机':'完美'}</span>`;run.element.append(el);}if(!visible&&el)el.remove();}
   }
   const timer=run.element.querySelector('.suite-timer');timer.hidden=!(run.duration>0&&run.qteStarted&&!run.settled);if(!timer.hidden){const remaining=Math.max(0,run.duration-run.qteTime);timer.querySelector('span').textContent=`${remaining.toFixed(1)} s`;timer.classList.toggle('is-urgent',remaining<3);}
  }
  requestAnimationFrame(tick);
 }
 async function boot(){try{[game,mediaMap]=await Promise.all([fetch('data/game.json').then(r=>r.json()),fetch('assets/media-map.json').then(r=>r.json())]);chapters=await Promise.all(game.chapters.map(c=>fetch(`data/${c.dataPath}`).then(r=>r.json())));const errors=R.validateGraph(chapters);if(errors.length)throw new Error(errors.join(','));state=R.initialState(game);const params=new URLSearchParams(location.search);category=Math.max(0,Math.min(8,Number(params.get('chapter')||1)-1));const node=allNodes(chapters[category]).find(n=>n.id===params.get('node'));if(node)playNode(node);else hub();requestAnimationFrame(tick);}catch(error){screen.innerHTML=`<div class="suite-loading">玩法暂时无法加载，请刷新重试。</div>`;console.error(error);}}
 boot();
})();
