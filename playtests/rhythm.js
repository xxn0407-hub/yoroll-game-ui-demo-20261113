(function(){
 'use strict';
 const I=window.YorollPlayInteractions;
 I.register('rhythm',c=>{const map=c.q.rhythm_beatmap,notes=map.notes,resolved=new Set(),judgments=Array(notes.length).fill(null),live=new Map();let finished=false;
  c.body.classList.add('is-spatial');c.body.innerHTML='<div class="suite-rhythm-field"></div><div class="suite-rhythm-score"><span>完成</span><strong>0</strong><small></small></div>';const field=c.body.querySelector('.suite-rhythm-field');
  function place(el,note){const ref=c.reference;el.style.left=`${note.screenX/ref.width*100}%`;el.style.top=`${(ref.height-note.screenY)/ref.height*100}%`;}
  function label(note){return ({OSUTapNote:'点击',OSUHoldNote:'按住',OSUMashNote:'连点',OSUFightNote:'连点'})[note.noteType]||({left:'←',right:'→',up:'↑',down:'↓'})[note.stringParam]||'点击';}
  function create(note,i){const el=document.createElement('button');el.className='suite-rhythm-note';el.dataset.note=i;el.setAttribute('aria-label',label(note));place(el,note);el.innerHTML=`<span>${label(note)}</span><small>${i+1}</small><svg class="note-progress" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" pathLength="100"/></svg>`;field.append(el);live.set(i,{el,count:0,held:false,started:null,progress:0,pointer:null,swipe:null});}
  function judge(i,value){if(resolved.has(i)||finished)return;resolved.add(i);judgments[i]=value;const item=live.get(i),note=notes[i];if(item){item.el.remove();live.delete(i);}const el=document.createElement('div');el.className=`suite-rhythm-judgment ${value?'':'is-miss'}`;place(el,note);el.textContent=value?'完美':'错过';field.append(el);c.delay(()=>el.remove(),1000);c.body.querySelector('.suite-rhythm-score strong').textContent=resolved.size;c.body.querySelector('.suite-rhythm-score small').textContent=`/ ${notes.length}`;
   c.sfx(value?'rhythm-hit':'rhythm-miss',{level:.8});const result=c.R.rhythmResult(map,judgments.filter(v=>v!==null),c.q.target_score??80);if(result.failedEarly){finished=true;c.slow(false);c.finish(0,{message:'错过次数已达到上限'});return;}if(resolved.size===notes.length){finished=true;c.slow(false);c.finish(result.success?1:0,{message:result.success?'动作已完成':'再试一次，跟随收拢的光圈'});}}
  function within(note,time){return Math.abs(time-note.perfectTime)<=(Number(note.duration)||.45);}
  c.on(field,'pointerdown',ev=>{const el=ev.target.closest('[data-note]');if(!el||!c.active())return;ev.preventDefault();const i=Number(el.dataset.note),note=notes[i],entry=live.get(i);if(!entry)return;entry.pointer=ev.pointerId;el.setPointerCapture(ev.pointerId);const t=c.time;
   if(note.noteType==='OSUTapNote'){if(within(note,t))judge(i,100);else{c.sfx('rhythm-miss',{level:.5});c.status('等待光圈靠近目标');}}
   else if(note.noteType==='OSUMashNote'||note.noteType==='OSUFightNote'){if(t<note.perfectTime-(note.duration||.45))return;entry.count++;c.sfx('rhythm-hit',{level:.65});entry.started??=t;const needed=note.intParam||Math.max(4,Math.ceil((note.floatParam||1.5)*5));entry.progress=entry.count/needed;el.classList.add('is-hit');if(entry.count>=needed)judge(i,100);}
   else if(note.noteType==='OSUHoldNote'){if(!within(note,t))return;entry.held=true;c.sfx('hold',{level:.6});entry.started=t;el.classList.add('is-hit');}
   else if(note.noteType==='OSUSwipeNote'){if(!within(note,t))return;entry.swipe={x:ev.clientX,y:ev.clientY};}
  });
  function up(ev){const el=ev.target.closest('[data-note]');if(!el)return;const i=Number(el.dataset.note),note=notes[i],entry=live.get(i);if(!entry)return;if(note.noteType==='OSUHoldNote'&&entry.held){entry.held=false;if(c.time-entry.started>=(note.floatParam||1)*.95)judge(i,100);else judge(i,0);}if(note.noteType==='OSUSwipeNote'&&entry.swipe){const ok=c.R.swipeMatches(entry.swipe,{x:ev.clientX,y:ev.clientY},{direction:note.stringParam,minDistance:45*Math.min(innerWidth/1920,innerHeight/1080),angleTolerance:35});judge(i,ok?100:0);}}
  c.on(field,'pointerup',up);c.on(field,'pointercancel',ev=>{const i=Number(ev.target.closest('[data-note]')?.dataset.note);if(live.has(i))judge(i,0);});
  return {tick(dt,t){if(finished)return;for(let i=0;i<notes.length;i++){if(resolved.has(i))continue;const note=notes[i],appear=note.perfectTime-(Number(note.duration)||.45)-.45;if(t>=appear&&!live.has(i))create(note,i);const entry=live.get(i);if(!entry)continue;const window=Number(note.duration)||.45;entry.el.style.setProperty('--approach',String(Math.max(.98,1+(note.perfectTime-t)/Math.max(.6,window))));entry.el.style.setProperty('--note-opacity',String(Math.min(1,(t-appear)*4)));
    if(entry.held){entry.progress=Math.min(1,(t-entry.started)/(note.floatParam||1));if(entry.progress>=1){judge(i,100);continue;}}
    const circle=entry.el.querySelector('circle');circle.style.strokeDashoffset=100*(1-entry.progress);
    const deadline=note.noteType==='OSUTapNote'||note.noteType==='OSUSwipeNote'?note.perfectTime+window:c.R.rhythmNoteEnd(note);if(t>deadline&&!entry.held)judge(i,0);
   }
   // Retain slow motion until every overlapping note (including a held note) is resolved.
   const active=c.R.activeNotes(notes,t,resolved).length>0||[...live.values()].some(v=>v.held);c.slow(active,c.q.video_slow_motion);
  },suspend(){for(const entry of live.values()){entry.held=false;entry.started=null;entry.el.classList.remove('is-hit');}},dispose(){c.slow(false);},seek(){for(const entry of live.values())entry.el.remove();live.clear();resolved.clear();judgments.fill(null);finished=false;c.status('节奏判定已重置');}};
 });
})();
