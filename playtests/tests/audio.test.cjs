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
function phone({muted=false,blocked=true,gameplay=false,manualTimers=false}={}){
 let gesture=false,focused=true,now=1000,timerId=0;const timers=new Map();
 const document=new EventTarget(),window=new EventTarget(),contexts=[],intervals=new Set(),fetched=[];
 const storage=new Map([['yoroll-ui-preview:master-muted',String(muted)]]);
 document.hidden=false;document.hasFocus=()=>focused;document.documentElement={dataset:{}};
 document.currentScript={src:'https://example.test/ui-sound.js'};document.querySelectorAll=()=>[];
 class Parameter{
  value=1;steps=[];cancelScheduledValues(){}setValueAtTime(v,t){this.value=v;this.steps.push({type:'set',value:v,time:t});}
  linearRampToValueAtTime(v,t){this.value=v;this.steps.push({type:'linear',value:v,time:t});}setTargetAtTime(v){this.value=v;}
  setValueCurveAtTime(){}
 }
 class AudioContext extends EventTarget{
  state='suspended';currentTime=0;destination={};sources=[];resumeCalls=[];gains=[];
  constructor(){super();contexts.push(this);}
  createGain(){const n={gain:new Parameter(),connect(){},disconnect(){}};this.gains.push(n);return n;}
  createDynamicsCompressor(){return {connect(){},threshold:new Parameter(),knee:new Parameter(),ratio:new Parameter(),attack:new Parameter(),release:new Parameter()};}
  createMediaElementSource(media){return {media,connect(destination){this.destination=destination;}};}
  createBufferSource(){const node={playbackRate:{value:1},connect(destination){this.destination=destination;},disconnect(){},start:(...args)=>{node.startArgs=args;this.sources.push(node);},stop:(time)=>{node.stopped=true;node.stopAt=time;queueMicrotask(()=>node.onended?.());}};return node;}
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
  fetch:async address=>{fetched.push(String(address));return {ok:true,json:async()=>plan,arrayBuffer:async()=>new ArrayBuffer(8)};},
  setTimeout:manualTimers?(fn,ms)=>{const id=++timerId;timers.set(id,{due:now+ms,fn});return id;}:setTimeout,
  clearTimeout:manualTimers?id=>timers.delete(id):clearTimeout,setInterval:fn=>{intervals.add(fn);return fn;},clearInterval:id=>intervals.delete(id),
 });
 for(const name of ['ui-sound.js',...(gameplay?['playtests/audio.js']:[]),'home-music.js']){document.currentScript={src:new URL(name,'https://example.test/').href};vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),sandbox,{filename:name});}
 const sound=window.YorollSound,music=window.YorollMusic;
 return {sound,music,contexts,document,window,fetched,data:document.documentElement.dataset,
  async prepare(){await music.prepareEntry('home');music.setScene('home');await flush();},
  async event(type,pointerType){gesture=type==='click'||type==='touchend'||type==='keydown'||type==='pointerup'&&pointerType!=='mouse'||type==='pointerdown'&&pointerType==='mouse';const e=new Event(type);if(pointerType)Object.defineProperty(e,'pointerType',{value:pointerType});document.dispatchEvent(e);gesture=false;await flush();},
  async leave(){focused=false;document.hidden=true;window.dispatchEvent(new Event('pagehide'));await flush();},
  async advance(ms){now+=ms;for(const [id,timer] of [...timers].sort((a,b)=>a[1].due-b[1].due))if(timer.due<=now&&timers.has(id)){timers.delete(id);timer.fn();}await flush();},
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


test('the gameplay bank shares the iPhone context, mute and closing gate',async()=>{
 const view=phone({gameplay:true});await view.prepare();await view.event('click');
 assert.equal(view.contexts.length,1);assert.equal(view.data.audioDecoded,'29');
 const bank=view.window.YorollPlayAudio;
 assert.equal(bank.play('tap'),true);assert.equal(view.data.audioLastCue,'game-tap');
 assert.equal(bank.play('place'),false,'rapid actions must not build a chord');
 view.sound.setLevels({isMuted:true});await flush();
 for(const event of bank.events)assert.equal(bank.play(event),false);
 view.sound.setLevels({isMuted:false});await view.event('click');await view.tick();
 assert.equal(bank.play('failure'),true);await view.leave();
 assert.equal(view.data.audioVoices,'0');assert.equal(bank.play('success'),false);
});

test('a late local bank uses the same bus and cannot replay a discarded gesture',async()=>{
 const view=phone();await view.prepare();await view.event('click');
 assert.equal(view.sound.registerCues({'game-late':{file:'playtests/assets/audio/tap.wav',channel:'gameplay-action'}}),1);
 view.sound.play('game-late');view.sound.stopChannel('gameplay-action');await flush();
 assert.equal(view.data.audioCounts.includes('game-late'),false);
 await view.tick();assert.equal(view.sound.play('game-late'),true);
 assert.equal(view.contexts.length,1);
 assert.equal(view.sound.registerCues({'game-remote':{file:'https://old-game.test/tap.wav'}}),0);
 await view.leave();
});

test('reference media stays silent across unmute; replacement media joins the shared gate',async()=>{
 const view=phone({gameplay:true});const media=[];view.document.querySelectorAll=()=>media;
 const reference=new EventTarget();Object.assign(reference,{dataset:{},muted:false,volume:1,isConnected:true});
 const themed=new EventTarget();Object.assign(themed,{dataset:{},muted:false,volume:1,isConnected:true});
 media.push(reference,themed);const bank=view.window.YorollPlayAudio;
 bank.protectMedia(reference);bank.protectMedia(themed,{themed:true});
 assert.equal(reference.muted,true);assert.equal(reference.volume,0);assert.equal(themed.muted,true);
 await view.prepare();await view.event('click');assert.equal(themed.muted,false);
 view.sound.setLevels({isMuted:true});assert.equal(themed.muted,true);
 view.sound.setLevels({isMuted:false});await view.event('click');
 assert.equal(reference.muted,true);assert.equal(reference.volume,0);assert.equal(themed.muted,false);
 reference.muted=false;reference.volume=1;reference.dispatchEvent(new Event('volumechange'));
 assert.equal(reference.muted,true);assert.equal(reference.volume,0);
 assert.equal(bank.policy.builtInUiSfx,false);assert.equal(bank.policy.referenceMediaAudio,false);
 assert.equal(new URL(bank.imageAudio).pathname,'/playtests/assets/audio/image-audio.wav');
 await view.leave();
});

test('settlement keeps its natural tail across the next node without a second entry accent',async()=>{
 const view=phone({gameplay:true});await view.prepare();await view.event('click');
 const bank=view.window.YorollPlayAudio;
 assert.equal(bank.play('success'),true);const source=view.contexts[0].sources.at(-1);
 bank.clear({keepResult:true});assert.equal(source.stopped,undefined);
 assert.equal(bank.play('start'),false);
 bank.clear();await flush();assert.equal(source.stopped,true);assert.equal(view.data.audioVoices,'0');
 await view.leave();
});


function hoverTarget(document){
 const target={isConnected:true,disabled:false,hovered:true,blocked:false,
  closest(){return this.blocked?{}:null;},matches(){return this.hovered;},contains(value){return value===this;}};
 document.activeElement=target;return target;
}

test('hover keeps its approved timbre at a quieter level and has one audible voice across normal and locked cues',async()=>{
 const view=phone({manualTimers:true});await view.event('click');await view.advance(700);
 assert.equal(view.sound.play('hover',{level:.68}),true);
 const normal=view.contexts[0].sources.at(-1);
 assert.ok(Math.abs(normal.destination.gain.value-.68*.45)<1e-9);
 await view.advance(300);
 assert.equal(view.sound.play('locked',{level:.44}),true);
 const locked=view.contexts[0].sources.at(-1);
 assert.equal(normal.stopped,true);assert.equal(locked.playbackRate.value,.5);
 assert.ok(Math.abs(locked.destination.gain.value-.44*.45)<1e-9);
 assert.equal(view.data.audioHoverVoices,'1');await view.leave();
});

test('hover, click, cancel and restored focus do not leave overlapping tails or a delayed hover',async()=>{
 const view=phone({manualTimers:true});await view.event('click');await view.advance(700);
 const target=hoverTarget(view.document);
 assert.equal(view.sound.play('hover'),true);const hover=view.contexts[0].sources.at(-1);
 assert.equal(view.sound.play('click'),true);const click=view.contexts[0].sources.at(-1);
 assert.equal(hover.stopped,true);assert.equal(view.data.audioHoverVoices,'0');
 await view.advance(100);assert.equal(view.sound.play('back'),true);
 assert.equal(click.stopped,true);assert.equal(view.data.audioUiForegroundVoices,'1');
 assert.equal(view.sound.play('click',{throttle:0}),false,'generic click cannot mask cancel');
 await view.advance(360);assert.equal(view.sound.requestHover(target,{keyboard:true}),false);
 await view.advance(240);assert.equal(view.data.audioCounts,'{"hover":1,"click":1,"back":1}');
 assert.equal(view.sound.requestHover(target,{keyboard:true}),true);await view.advance(120);
 assert.equal(JSON.parse(view.data.audioCounts).hover,2);await view.leave();
});

test('fast scanning cancels pending targets and plays only the last settled hover',async()=>{
 const view=phone({manualTimers:true});await view.event('click');await view.advance(700);
 const a=hoverTarget(view.document),b=hoverTarget(view.document),c=hoverTarget(view.document);
 view.sound.requestHover(a);await view.advance(70);
 view.sound.requestHover(b);await view.advance(70);
 view.sound.requestHover(c);await view.advance(119);assert.equal(view.data.audioPlayCount,'0');
 await view.advance(1);assert.equal(view.data.audioCounts,'{"hover":1}');
 view.sound.requestHover(a);await view.advance(120);assert.equal(view.data.audioCounts,'{"hover":1}','shared cooldown applies across targets');
 view.sound.cancelHover();await view.advance(300);
 view.sound.requestHover(b);view.sound.cancelHover(b);await view.advance(200);
 assert.equal(view.data.audioCounts,'{"hover":1}');await view.leave();
});

test('scrolling, a closing or inert dialog and a disposed preview cannot release a pending hover',async()=>{
 const view=phone({manualTimers:true});await view.event('click');await view.advance(700);
 const target=hoverTarget(view.document);
 view.sound.requestHover(target);await view.event('wheel');await view.advance(300);
 assert.equal(view.data.audioPlayCount,'0');
 target.blocked=true;assert.equal(view.sound.requestHover(target),false);
 target.blocked=false;view.sound.requestHover(target);target.blocked=true;await view.advance(120);
 assert.equal(view.data.audioPlayCount,'0');view.sound.cancelHover();
 target.blocked=false;view.sound.requestHover(target);await view.leave();await view.advance(500);
 assert.equal(view.data.audioPlayCount,'0');assert.equal(view.data.audioVoices,'0');
});

test('opening, confirming and navigation share one foreground voice; obsolete decoded hover requests are discarded',async()=>{
 const view=phone({manualTimers:true,gameplay:true});await view.event('click');await view.advance(700);
 assert.equal(view.sound.play('click'),true);const click=view.contexts[0].sources.at(-1);
 assert.equal(view.sound.play('open'),true);const open=view.contexts[0].sources.at(-1);
 assert.equal(click.stopped,true);assert.equal(view.sound.play('transition',{throttle:0}),false);
 assert.equal(view.data.audioUiForegroundVoices,'1');
 await view.advance(200);assert.equal(view.sound.play('confirm'),true);
 assert.equal(open.stopped,true);assert.equal(view.data.audioUiForegroundVoices,'1');
 await view.advance(700);
 view.sound.registerCues({'game-late-focus':{file:'playtests/assets/audio/focus.wav',channel:'hover'}});
 view.sound.play('game-late-focus');view.sound.play('back');await flush();
 assert.equal(JSON.parse(view.data.audioCounts)['game-late-focus'],undefined);
 assert.equal(view.data.audioHoverVoices,'0');await view.leave();
});

test('modal dismiss uses one quiet lower hover-family tone, with a continuous bounded fade instead of the long back accent',async()=>{
 const view=phone({manualTimers:true});await view.event('click');await view.advance(700);
 assert.equal(view.fetched.some(address=>address.includes('ui-back.wav')),false);
 assert.equal(view.sound.play('back'),true);const cue=view.contexts[0].sources.at(-1);
 assert.equal(cue.playbackRate.value,.75);
 assert.ok(Math.abs(cue.startArgs[0]-.06)<1e-9);
 assert.ok(Math.abs(cue.startArgs[2]/cue.playbackRate.value-.54)<1e-9);
 assert.deepEqual(cue.destination.gain.steps.map(step=>[step.type,step.value]),[['set',0],['linear',.24],['set',.24],['linear',0]]);
 assert.ok(Math.abs(cue.destination.gain.steps.at(-1).time-.6)<1e-9);
 assert.equal(view.data.audioCounts,'{"back":1}');await view.leave();
});

test('cancel waits until hover and the modal-opening cue have faded, and blocks click or focus from adding a second accent',async()=>{
 const view=phone({manualTimers:true});await view.event('click');await view.advance(700);
 view.sound.play('open');const opening=view.contexts[0].sources.at(-1);
 await view.advance(700);view.sound.play('hover');const hover=view.contexts[0].sources.at(-1);
 view.sound.play('back');const dismiss=view.contexts[0].sources.at(-1);
 assert.ok(opening.stopAt<dismiss.startArgs[0]);assert.ok(hover.stopAt<dismiss.startArgs[0]);
 assert.equal(view.data.audioHoverVoices,'0');assert.equal(view.data.audioUiForegroundVoices,'1');
 assert.equal(view.sound.play('click'),false);assert.equal(view.sound.play('transition'),false);
 assert.equal(view.sound.requestHover(hoverTarget(view.document),{keyboard:true}),false);
 await view.advance(100);assert.equal(view.sound.play('back'),false,'repeated dismissal cannot build another tail');
 assert.equal(view.data.audioCounts,'{"open":1,"hover":1,"back":1}');await view.leave();
});
