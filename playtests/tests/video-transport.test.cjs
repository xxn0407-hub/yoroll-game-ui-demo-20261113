const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
const functions=source.slice(source.indexOf('function syncVideoTimeline('),source.indexOf('function format(t)'));

function transport(type='choice'){
 const seek={disabled:false,value:0},fill={style:{}},timeline={attributes:{},setAttribute(key,value){this.attributes[key]=value;},contains:element=>element===seek};
 let focused=0,suppressed=0;
 const control={focus(){focused++;}},run={type,qteStarted:false,settled:false,body:{querySelector:()=>control},element:{dataset:{},querySelector:selector=>({'.suite-timeline':timeline,'.suite-track':seek,'[data-suite-progress]':fill,'[data-suite="pause"]':control})[selector]}};
 const document={activeElement:null},context=vm.createContext({document,sound:{suppressHover(){suppressed++;}}});
 vm.runInContext(functions,context);
 return {run,seek,fill,timeline,document,get focused(){return focused;},get suppressed(){return suppressed;},sync(){context.syncVideoTimeline(run);},progress:value=>context.updateVideoProgress(run,value)};
}

test('a watch-only segment keeps its video timeline and seeking available',()=>{
 const view=transport('basic');view.run.qteStarted=true;view.sync();
 assert.equal(view.run.element.dataset.videoTimeline,'visible');assert.equal(view.seek.disabled,false);
 assert.equal(view.timeline.attributes['aria-hidden'],'false');assert.equal(view.suppressed,0);
});
test('choices, gestures, rhythm and native gameplay hide and disable video seeking only when they appear',()=>{
 for(const type of ['choice','longpress','rhythm','PoolQTE','scene_search']){
  const view=transport(type);view.sync();assert.equal(view.seek.disabled,false);
  view.run.qteStarted=true;view.sync();assert.equal(view.run.element.dataset.videoTimeline,'hidden');
  assert.equal(view.seek.disabled,true);assert.equal(view.timeline.attributes['aria-hidden'],'true');
  assert.equal(view.suppressed,1);view.sync();assert.equal(view.suppressed,1);
 }
});
test('the video timeline stays hidden after selecting an option until that interactive segment ends',()=>{
 const view=transport();view.run.qteStarted=true;view.sync();view.run.settled=true;view.sync();
 assert.equal(view.seek.disabled,true);assert.equal(view.run.element.dataset.videoTimeline,'hidden');
});
test('hiding a focused timeline hands focus to an interactive control without stealing other focus',()=>{
 const view=transport();view.document.activeElement=view.seek;view.run.qteStarted=true;view.sync();assert.equal(view.focused,1);
 const other=transport();other.document.activeElement={};other.run.qteStarted=true;other.sync();assert.equal(other.focused,0);
});
test('the visible handle and fine-line fill share the same media position',()=>{
 const view=transport('basic');view.progress(500);assert.equal(view.seek.value,500);assert.equal(view.fill.style.width,'50%');
 view.progress(1200);assert.equal(view.seek.value,1000);assert.equal(view.fill.style.width,'100%');
 view.progress(-10);assert.equal(view.seek.value,0);assert.equal(view.fill.style.width,'0%');
});
