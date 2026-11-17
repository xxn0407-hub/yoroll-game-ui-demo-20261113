const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../../app.js'),'utf8');
const functions=source.slice(source.indexOf('function syncPlaybackSeek('),source.indexOf('function tryResultSound('));

function playback({paused=false,position=0}={}){
 class Timeline extends EventTarget{
  currentTime=0;playState='running';rate=1;plays=0;finished=new Promise(()=>{});
  pause(){this.playState='paused';}play(){this.playState='running';this.plays++;}
  updatePlaybackRate(value){this.rate=value;}
 }
 class Seek extends EventTarget{
  value='0';attributes={};setAttribute(key,value){this.attributes[key]=value;}setPointerCapture(){}
 }
 const seek=new Seek(),timeline=new Timeline(),routes=[],jobs=new Map();let nextJob=0,suppressed=0;
 const progress={animate:()=>timeline};
 const context=vm.createContext({PLAYBACK_DURATION:24000,currentPage:'gameplay',playbackPosition:position,playbackRate:1,playbackPaused:paused,playbackSeeking:false,playbackSeekFrame:0,playAnimation:null,frame:{dataset:{}},document:{hidden:false},$:selector=>selector==='#playback-seek'?seek:selector==='#play-progress'?progress:null,track:value=>value,uiSound:{suppressHover:()=>suppressed++},requestAnimationFrame:callback=>{jobs.set(++nextJob,callback);return nextJob;},cancelAnimationFrame:id=>jobs.delete(id),go:page=>routes.push(page)});
 vm.runInContext(functions+'\nbindPlaybackSeek();startPlayback();',context);
 const event=(type,key)=>{const e=new Event(type);if(key)Object.defineProperty(e,'key',{value:key});seek.dispatchEvent(e);};
 return {context,seek,timeline,routes,jobs,get suppressed(){return suppressed;},event,
  scrub(value){seek.value=String(value);event('input');},
  finish(){timeline.playState='finished';timeline.dispatchEvent(new Event('finish'));}};
}

test('dragging a playing timeline pauses while scrubbing and resumes from the chosen position once',()=>{
 const view=playback({position:4000});view.event('pointerdown');assert.equal(view.timeline.playState,'paused');
 view.scrub(12000);assert.equal(view.timeline.currentTime,12000);assert.equal(view.seek.attributes['aria-valuetext'],'00:12 / 00:24');
 view.event('change');view.event('pointerup');assert.equal(view.timeline.playState,'running');assert.equal(view.timeline.plays,1);
 assert.equal(view.suppressed,1);assert.deepEqual(view.routes,[]);
});
test('scrubbing a paused timeline keeps it paused and stores the new position for return or resume',()=>{
 const view=playback({paused:true,position:4000});view.event('pointerdown');view.scrub(18000);view.event('pointerup');
 assert.equal(view.context.playbackPosition,18000);assert.equal(view.timeline.currentTime,18000);
 assert.equal(view.timeline.playState,'paused');assert.equal(view.timeline.plays,0);assert.deepEqual(view.routes,[]);
});
test('keyboard seeking retains pause state and clamps the timeline to its bounds',()=>{
 const view=playback({paused:true});view.event('keydown','End');view.scrub(30000);view.event('keyup','End');
 assert.equal(view.timeline.currentTime,24000);assert.equal(view.timeline.playState,'paused');assert.deepEqual(view.routes,[]);
 view.event('keydown','Home');view.scrub(-100);view.event('keyup','Home');assert.equal(view.timeline.currentTime,0);
});
test('reaching the end during a drag waits for release and does not restart the timeline',()=>{
 const view=playback();view.event('pointerdown');view.scrub(24000);view.finish();assert.deepEqual(view.routes,[]);
 view.event('pointerup');assert.deepEqual(view.routes,['choice']);assert.equal(view.timeline.plays,0);
});
test('scrubbing back from the end keeps normal end-of-playback navigation working',()=>{
 const view=playback();view.event('pointerdown');view.scrub(24000);view.finish();view.scrub(6000);view.event('pointerup');
 assert.deepEqual(view.routes,[]);assert.equal(view.timeline.currentTime,6000);assert.equal(view.timeline.playState,'running');
 view.finish();assert.deepEqual(view.routes,['choice']);
});
