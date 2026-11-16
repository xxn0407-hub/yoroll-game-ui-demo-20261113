const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const plan=JSON.parse(fs.readFileSync(path.join(root,'music-spec.json'),'utf8'));
const flush=async()=>{await new Promise(setImmediate);await new Promise(setImmediate);};

// Model a fresh iPhone visit: resume requests outside a user activation can
// remain pending forever. Touch pointerdown is not an activation; release is.
function phone({muted=false,blocked=true}={}){
 let gesture=false,focused=true,now=1000;
 const document=new EventTarget(),window=new EventTarget(),contexts=[],intervals=new Set();
 const storage=new Map([['yoroll-ui-preview:master-muted',String(muted)]]);
 document.hidden=false;document.hasFocus=()=>focused;document.documentElement={dataset:{}};
 document.currentScript={src:'https://example.test/ui-sound.js'};
 class Parameter{
  value=1;cancelScheduledValues(){}setValueAtTime(v){this.value=v;}
  linearRampToValueAtTime(v){this.value=v;}setTargetAtTime(v){this.value=v;}
  setValueCurveAtTime(){}
 }
 class AudioContext extends EventTarget{
  state='suspended';currentTime=0;destination={};sources=[];resumeCalls=[];gains=[];
  constructor(){super();contexts.push(this);}
  createGain(){const n={gain:new Parameter(),connect(){},disconnect(){}};this.gains.push(n);return n;}
  createDynamicsCompressor(){return {connect(){},threshold:new Parameter(),knee:new Parameter(),ratio:new Parameter(),attack:new Parameter(),release:new Parameter()};}
  createBufferSource(){const node={playbackRate:{value:1},connect(){},disconnect(){},start:()=>this.sources.push(node),stop:()=>queueMicrotask(()=>node.onended?.())};return node;}
  decodeAudioData(){return Promise.resolve({duration:plan.fileDurationSeconds});}
  resume(){
   this.resumeCalls.push({gesture});
   if(blocked&&!gesture)return new Promise(()=>{});
   return Promise.resolve().then(()=>{this.state='running';this.dispatchEvent(new Event('statechange'));});
  }
  suspend(){return Promise.resolve().then(()=>{this.state='suspended';this.dispatchEvent(new Event('statechange'));});}
 }
 window.AudioContext=AudioContext;
 const sandbox=vm.createContext({
  window,document,URL,Event,CustomEvent,console,location:{href:'https://example.test/'},
  performance:{now:()=>now},Date,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},
  fetch:async()=>({ok:true,json:async()=>plan,arrayBuffer:async()=>new ArrayBuffer(8)}),
  setTimeout,clearTimeout,setInterval:fn=>{intervals.add(fn);return fn;},clearInterval:id=>intervals.delete(id),
 });
 for(const name of ['ui-sound.js','home-music.js'])vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),sandbox,{filename:name});
 const sound=window.YorollSound,music=window.YorollMusic;
 return {sound,music,contexts,document,window,data:document.documentElement.dataset,
  async prepare(){await music.prepareEntry('home');music.setScene('home');await flush();},
  async event(type,pointerType){gesture=type==='click'||type==='touchend'||type==='keydown'||type==='pointerup'&&pointerType!=='mouse'||type==='pointerdown'&&pointerType==='mouse';const e=new Event(type);if(pointerType)Object.defineProperty(e,'pointerType',{value:pointerType});document.dispatchEvent(e);gesture=false;await flush();},
  async leave(){focused=false;document.hidden=true;window.dispatchEvent(new Event('pagehide'));await flush();},
  async tick(){now+=1000;for(const fn of intervals)fn();await flush();},
  onClick(fn){document.addEventListener('click',fn);},
 };
}

test('a touch release unlocks opening and UI cues after blocked autoplay',async()=>{
 const view=phone();await view.prepare();
 assert.equal(view.contexts[0].state,'suspended');
 await view.event('pointerdown','touch');await view.event('pointerup','touch');
 assert.equal(view.contexts[0].state,'running');
 assert.equal(view.data.musicStarts,'1');assert.equal(view.sound.play('click'),true);
 await view.leave();
});

test('a tap can issue a new resume even when an earlier resume never settles',async()=>{
 const view=phone();await view.prepare();
 void view.sound.unlock();await flush();
 const attempts=view.contexts[0].resumeCalls.length;
 await view.event('click');
 assert.ok(view.contexts[0].resumeCalls.length>attempts);
 assert.equal(view.contexts[0].state,'running');assert.equal(view.data.musicStarts,'1');
 await view.leave();
});

test('touchend fallback works without pointer events and does not duplicate the opening',async()=>{
 const view=phone();await view.prepare();await view.event('touchend');await view.event('click');
 assert.equal(view.contexts[0].state,'running');assert.equal(view.data.musicStarts,'1');
 await view.leave();
});

test('enabling sound on a muted phone resumes in that same click',async()=>{
 const view=phone({muted:true});await view.prepare();
 await view.event('pointerdown','touch');await view.event('pointerup','touch');
 assert.equal(view.sound.isMuted(),true);assert.equal(view.contexts[0].sources.length,0);
 view.onClick(()=>view.sound.setLevels({isMuted:false}));await view.event('click');
 assert.equal(view.contexts[0].state,'running');assert.equal(view.data.musicStarts,'1');
 assert.equal(view.sound.play('click'),true);await view.leave();
});

test('a later tap recovers an interrupted iOS context without restarting the opening',async()=>{
 const view=phone();await view.prepare();await view.event('click');
 view.contexts[0].state='interrupted';await view.tick();await view.event('click');
 assert.equal(view.contexts.length,1);assert.equal(view.contexts[0].state,'running');
 assert.equal(view.data.musicStarts,'1');await view.leave();
});

test('page close and explicit mute remain silent after gesture recovery',async()=>{
 const view=phone();await view.prepare();await view.event('click');
 assert.equal(view.contexts[0].state,'running');
 view.sound.setLevels({isMuted:true});await flush();await view.event('click');
 assert.equal(view.contexts[0].state,'suspended');assert.equal(view.sound.play('click'),false);
 view.sound.setLevels({isMuted:false});await view.leave();await view.event('click');
 assert.equal(view.contexts[0].state,'suspended');assert.equal(view.sound.isActive(),false);
 assert.equal(view.sound.play('click'),false);
});
