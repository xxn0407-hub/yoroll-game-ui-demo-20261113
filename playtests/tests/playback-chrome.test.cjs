const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');

function player({grouped=false}={}){
 class Target{
  listeners=new Map();dataset={};attributes={};inert=false;children=new Set();isConnected=true;
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
  removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
  contains(target){return target===this||this.children.has(target);}
  setAttribute(key,value){this.attributes[key]=value;}
  getAttribute(key){return this.attributes[key]??null;}
  removeAttribute(key){delete this.attributes[key];}
  fire(type,props={}){const event={target:this,pointerType:'mouse',defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...props};for(const fn of this.listeners.get(type)||[])fn(event);return event;}
 }
 let now=0,next=0,playing=true,menu=false,hides=0;
 const jobs=new Map(),doc=new Target(),surface=new Target(),controls=new Target(),header=new Target(),back=new Target(),button=new Target(),video=new Target();
 const view={setTimeout(fn,ms){jobs.set(++next,{fn,due:now+ms});return next;},clearTimeout(id){jobs.delete(id);},queueMicrotask:fn=>fn()};
 doc.defaultView=view;doc.hidden=false;doc.body=new Target();doc.documentElement=new Target();doc.activeElement=doc.body;
 controls.ownerDocument=doc;header.ownerDocument=doc;controls.children.add(button);header.children.add(back);surface.children=new Set([header,back,controls,button,video]);
 const context=vm.createContext({window:{}});vm.runInContext(fs.readFileSync(path.join(root,'playback-chrome.js'),'utf8'),context);
 const chrome=context.window.YorollPlaybackChrome.attach({surface,controls:grouped?[header,controls]:controls,isPlaying:()=>playing,keepVisible:()=>menu,onHide:()=>hides++});
 function advance(ms){const until=now+ms;for(;;){const first=[...jobs.entries()].filter(([,job])=>job.due<=until).sort((a,b)=>a[1].due-b[1].due)[0];if(!first)break;jobs.delete(first[0]);now=first[1].due;first[1].fn();}now=until;}
 return {doc,surface,controls,header,back,button,video,chrome,jobs,advance,get hides(){return hides;},get hidden(){return controls.dataset.controlsVisibility==='hidden';},play(value){playing=value;chrome.sync();},menu(value){menu=value;chrome.sync();}};
}

test('only an idle playing transport hides, and hidden controls cannot intercept input or focus',()=>{
 const p=player();p.advance(2799);assert.equal(p.hidden,false);p.advance(1);
 assert.equal(p.hidden,true);assert.equal(p.controls.inert,true);assert.equal(p.controls.getAttribute('aria-hidden'),'true');assert.equal(p.hides,1);
 p.advance(10000);assert.equal(p.hides,1);assert.equal(p.jobs.size,0);
});
test('mouse movement reveals the transport and restarts the complete idle window',()=>{
 const p=player();p.advance(2800);p.surface.fire('pointermove',{target:p.video});assert.equal(p.hidden,false);
 assert.equal(p.controls.inert,false);assert.equal(p.controls.getAttribute('aria-hidden'),'false');
 p.advance(2000);p.surface.fire('pointermove',{target:p.video});p.advance(2000);assert.equal(p.hidden,false);
 p.advance(800);assert.equal(p.hidden,true);
});
test('a phone tap reveals controls without consuming or inventing a playback action',()=>{
 const p=player();p.advance(2800);
 const tap=p.surface.fire('pointerdown',{target:p.video,pointerType:'touch'});
 p.doc.fire('pointerup',{target:p.video,pointerType:'touch'});
 assert.equal(tap.defaultPrevented,false);assert.equal(p.hidden,false);
 p.advance(2800);assert.equal(p.hidden,true);
 p.surface.fire('pointermove',{target:p.video,pointerType:'touch'});assert.equal(p.hidden,true);
});
test('a stationary mouse over controls can hide, but a held drag stays visible even outside them',()=>{
 const p=player();p.controls.fire('pointerenter');p.advance(2800);assert.equal(p.hidden,true);
 p.surface.fire('pointerdown',{target:p.button,pointerType:'touch'});p.advance(10000);assert.equal(p.hidden,false);
 p.doc.fire('pointercancel',{target:p.doc.body,pointerType:'touch'});p.advance(2799);assert.equal(p.hidden,false);p.advance(1);assert.equal(p.hidden,true);
});
test('pause, seeking or an open menu reveals hidden controls and starts a fresh delay after release',()=>{
 const p=player();p.advance(2800);p.play(false);p.advance(10000);assert.equal(p.hidden,false);
 p.play(true);p.advance(2799);assert.equal(p.hidden,false);p.advance(1);assert.equal(p.hidden,true);
 p.menu(true);p.advance(10000);assert.equal(p.hidden,false);
 p.menu(false);p.advance(2800);assert.equal(p.hidden,true);
});
test('keyboard navigation reveals before Tab and preserves focus, while pointer focus does not pin forever',()=>{
 const p=player();p.advance(2800);p.doc.fire('keydown',{target:p.doc.body,key:'Tab'});assert.equal(p.controls.inert,false);
 p.doc.activeElement=p.button;p.controls.fire('focusin',{target:p.button});p.advance(10000);assert.equal(p.hidden,false);
 p.surface.fire('pointerdown',{target:p.video,pointerType:'touch'});p.doc.fire('pointerup',{target:p.video,pointerType:'touch'});
 p.advance(2800);assert.equal(p.hidden,true);
});
test('page hiding clears the idle timer and returning starts with visible controls',()=>{
 const p=player();p.advance(2800);p.doc.hidden=true;p.doc.fire('visibilitychange');assert.equal(p.hidden,false);assert.equal(p.jobs.size,0);
 p.advance(10000);p.doc.hidden=false;p.doc.fire('visibilitychange');p.advance(2799);assert.equal(p.hidden,false);p.advance(1);assert.equal(p.hidden,true);
});
test('disposing a page removes timers, input listeners and hidden accessibility state',()=>{
 const p=player();p.advance(2800);p.chrome.dispose();p.chrome.dispose();
 assert.equal(p.controls.dataset.controlsVisibility,undefined);assert.equal(p.controls.inert,false);assert.equal(p.controls.getAttribute('aria-hidden'),null);
 p.doc.fire('keydown',{target:p.doc.body,key:'Tab'});p.surface.fire('pointermove',{target:p.video});p.advance(10000);
 assert.equal(p.jobs.size,0);assert.equal(p.controls.dataset.controlsVisibility,undefined);
 for(const target of [p.doc,p.surface,p.controls])for(const listeners of target.listeners.values())assert.equal(listeners.size,0);
});
test('the main player pins the transport for scrubbing, menus, overlays and pause',()=>{
 let config;
 const controls={},ui={'#review-panel':{hidden:true},'#playback-speed-toggle':{getAttribute:()=> 'false'},'.game-hud':{},'.playback-bar':controls};
 const context=vm.createContext({window:{YorollPlaybackChrome:{attach:value=>{config=value;return {dispose(){}};}}},playbackChrome:null,frame:{},$:s=>ui[s],currentPage:'gameplay',playbackPaused:false,playbackSeeking:false,playAnimation:{playState:'running'},modalRoot:{firstElementChild:null},screen:{getAttribute:()=> 'false'},uiSound:{suppressHover(){}}});
 const source=fs.readFileSync(path.join(root,'app.js'),'utf8');vm.runInContext(source.slice(source.indexOf('function bindPlaybackChrome('),source.indexOf('function formatPlaybackTime('))+'\nbindPlaybackChrome();',context);
 assert.equal(config.controls.length,2);assert.equal(config.controls[0],ui['.game-hud']);assert.equal(config.controls[1],controls);
 assert.equal(config.isPlaying(),true);context.playbackSeeking=true;assert.equal(config.isPlaying(),false);context.playbackSeeking=false;
 context.playbackPaused=true;assert.equal(config.isPlaying(),false);context.playbackPaused=false;
 ui['#playback-speed-toggle'].getAttribute=()=> 'true';assert.equal(config.keepVisible(),true);
 ui['#playback-speed-toggle'].getAttribute=()=> 'false';context.modalRoot.firstElementChild={};assert.equal(config.keepVisible(),true);
});
test('the gameplay host hides only while watching and keeps controls for active interactions, buffering and ending',()=>{
 let config;
 const nodes={'.suite-top':{},'[data-suite="speed"]':{getAttribute:()=> 'false'},'.suite-stage-controls':{}};
 const run={started:true,clock:{paused:false},qteStarted:false,type:'choice',ended:false,media:{paused:false,ended:false,readyState:4},element:{querySelector:s=>nodes[s]||null}};
 const context=vm.createContext({window:{YorollPlaybackChrome:{attach:value=>{config=value;return {dispose(){}};}}},current:run,review:{hidden:true},$:()=>({firstElementChild:null}),sound:{suppressHover(){}}});
 const source=fs.readFileSync(path.join(root,'playtests/app.js'),'utf8');vm.runInContext(source.slice(source.indexOf('function bindVideoChrome('),source.indexOf('function handleVideoSpace(')),context);context.bindVideoChrome(run);
 assert.equal(config.controls.length,2);assert.equal(config.controls[0],nodes['.suite-top']);
 assert.equal(config.isPlaying(),true);run.qteStarted=true;assert.equal(config.isPlaying(),false);
 run.type='basic';assert.equal(config.isPlaying(),true);run.media.readyState=1;assert.equal(config.isPlaying(),false);
 run.media.readyState=4;run.ended=true;assert.equal(config.isPlaying(),false);
});

test('hit-test events at unchanged mouse coordinates cannot repeatedly reveal the fading UI',()=>{
 const p=player();p.surface.fire('pointermove',{target:p.button,clientX:120,clientY:680});
 for(let i=0;i<8;i++){p.advance(500);p.surface.fire('pointermove',{target:p.video,clientX:120,clientY:680});}
 assert.equal(p.hidden,true);p.controls.fire('pointerenter',{clientX:120,clientY:680});assert.equal(p.hidden,true);
 p.surface.fire('pointermove',{target:p.video,clientX:121,clientY:680});assert.equal(p.hidden,false);
 p.advance(2800);assert.equal(p.hidden,true);
});
test('header and bottom transport share one timer, wake together and release their hidden state on dispose',()=>{
 const p=player({grouped:true});p.advance(2800);
 for(const group of [p.header,p.controls]){assert.equal(group.dataset.controlsVisibility,'hidden');assert.equal(group.inert,true);}
 p.surface.fire('pointermove',{target:p.video,clientX:40,clientY:50});
 for(const group of [p.header,p.controls]){assert.equal(group.dataset.controlsVisibility,'visible');assert.equal(group.inert,false);}
 p.surface.fire('pointerdown',{target:p.back,pointerType:'touch'});p.advance(6000);
 assert.equal(p.hidden,false);assert.equal(p.header.dataset.controlsVisibility,'visible');
 p.doc.fire('pointerup',{target:p.back,pointerType:'touch'});p.advance(2800);
 assert.equal(p.hidden,true);assert.equal(p.header.dataset.controlsVisibility,'hidden');
 p.chrome.dispose();for(const group of [p.header,p.controls]){assert.equal(group.dataset.controlsVisibility,undefined);assert.equal(group.inert,false);}
});
