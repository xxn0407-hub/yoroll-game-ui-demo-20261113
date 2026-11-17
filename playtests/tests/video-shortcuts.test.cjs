const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const mainSource=fs.readFileSync(path.join(root,'app.js'),'utf8'),suiteSource=fs.readFileSync(path.join(root,'playtests/app.js'),'utf8');
function key(options={}){return {key:' ',defaultPrevented:false,target:{closest:()=>null},preventDefault(){this.defaultPrevented=true;},...options};}
function main(){
 let clicks=0;
 const ui={'#screen':{getAttribute:()=>null},'#modal-root':{firstElementChild:null},'#review-panel':{hidden:true},'#playback-speed-toggle':{getAttribute:()=>null},'#playback-toggle':{click(){clicks++;}}};
 const context=vm.createContext({currentPage:'gameplay',playbackSeeking:false,$:selector=>ui[selector]});
 vm.runInContext(mainSource.slice(mainSource.indexOf('function handlePlaybackSpace('),mainSource.indexOf('function syncPlaybackSeek(')),context);
 return {ui,context,get clicks(){return clicks;},press:event=>context.handlePlaybackSpace(event)};
}
function suite(){
 let starts=0;const pauses=[],ui={'#modal-root':{firstElementChild:null}},controls={},review={hidden:true};
 const current={started:true,qteStarted:true,type:'basic',clock:{pauses:new Set()},element:{querySelector:selector=>controls[selector]||null}};
 const context=vm.createContext({current,review,$:selector=>ui[selector],start(){starts++;current.started=true;},pause(reason,value){pauses.push([reason,value]);if(value)current.clock.pauses.add(reason);else current.clock.pauses.delete(reason);}});
 vm.runInContext(suiteSource.slice(suiteSource.indexOf('function handleVideoSpace('),suiteSource.indexOf('function syncVideoTimeline(')),context);
 return {current,controls,review,ui,context,pauses,get starts(){return starts;},press:event=>context.handleVideoSpace(event)};
}

test('Space on the page or progress control delegates once to the existing playback button',()=>{
 const view=main(),first=key();assert.equal(view.press(first),true);assert.equal(first.defaultPrevented,true);assert.equal(view.clicks,1);
 for(let i=0;i<4;i++)view.press(key({repeat:true}));assert.equal(view.clicks,1);
 view.press(key());assert.equal(view.clicks,2);
});
test('Space leaves native button activation, text editing, composing and modified shortcuts alone',()=>{
 const view=main();
 for(const event of [key({target:{closest:()=>({})}}),key({target:{isContentEditable:true}}),key({isComposing:true}),key({ctrlKey:true}),key({metaKey:true}),key({altKey:true}),key({shiftKey:true})]){
  assert.equal(view.press(event),false);assert.equal(event.defaultPrevented,false);
 }
 assert.equal(view.clicks,0);
});
test('main playback shortcuts cannot act behind a modal, review panel, speed menu or page transition',()=>{
 for(const block of [v=>{v.ui['#modal-root'].firstElementChild={};},v=>{v.ui['#review-panel'].hidden=false;},v=>{v.ui['#playback-speed-toggle'].getAttribute=()=> 'true';},v=>{v.ui['#screen'].getAttribute=()=> 'true';},v=>{v.context.currentPage='choice';},v=>{v.context.playbackSeeking=true;}]){
  const view=main();block(view);assert.equal(view.press(key()),false);assert.equal(view.clicks,0);
 }
});
test('watching a real media segment toggles manual pause once and Space can start an unstarted preview',()=>{
 const view=suite();view.press(key());view.press(key({repeat:true}));view.press(key());
 assert.deepEqual(view.pauses,[['manual',true],['manual',false]]);
 const fresh=suite();fresh.current.started=false;fresh.current.qteStarted=false;fresh.press(key());assert.equal(fresh.starts,1);assert.deepEqual(fresh.pauses,[]);
});
test('Space belongs to active choices and gameplay rather than the video transport',()=>{
 for(const type of ['choice','longpress','rhythm','PoolQTE']){
  const view=suite();view.current.type=type;const event=key();assert.equal(view.press(event),false);assert.equal(event.defaultPrevented,false);assert.deepEqual(view.pauses,[]);
 }
});
test('suite Space shortcuts respect foreground dialogs, notes, menus and input focus',()=>{
 for(const block of [v=>{v.ui['#modal-root'].firstElementChild={};},v=>{v.review.hidden=false;},v=>{v.controls['.suite-note-panel']={};},v=>{v.controls['[data-suite="speed"]']={getAttribute:()=> 'true'};}]){
  const view=suite();block(view);assert.equal(view.press(key()),false);assert.deepEqual(view.pauses,[]);
 }
 const view=suite();assert.equal(view.press(key({target:{closest:()=>({})}})),false);assert.equal(view.press(key({isComposing:true})),false);assert.deepEqual(view.pauses,[]);
});

function mediaTime(){
 const seek={value:0,attributes:{},setAttribute(key,value){this.attributes[key]=value;}},fill={style:{}},time={textContent:''};
 const run={started:false,media:{currentTime:0,duration:NaN},element:{querySelector:selector=>({'.suite-track':seek,'[data-suite-progress]':fill,'[data-media-time]':time})[selector]}};
 const context=vm.createContext({});vm.runInContext(suiteSource.slice(suiteSource.indexOf('function updateVideoProgress('),suiteSource.indexOf('function tick(now)')),context);
 return {run,seek,fill,time,sync:()=>context.syncVideoTime(run)};
}
test('per-segment duration becomes visible on metadata load before playback and stays correct while paused',()=>{
 const view=mediaTime();view.sync();assert.equal(view.time.textContent,'00:00 / --:--');
 view.run.media.duration=84;view.sync();assert.equal(view.time.textContent,'00:00 / 01:24');
 view.run.media.currentTime=21;view.sync();assert.equal(view.time.textContent,'00:21 / 01:24');assert.equal(view.fill.style.width,'25%');
 assert.equal(view.seek.attributes['aria-valuetext'],'00:21 / 01:24');assert.equal(view.run.started,false);
});
