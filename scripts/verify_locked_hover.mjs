import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=process.argv[2]||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let now=1000,timerId=0,dragging=false,focused=true;
const timers=new Map(),listeners=new Map(),started=[];
const data={},storage=new Map();
const document={hidden:false,hasFocus:()=>focused,documentElement:{dataset:data},
 addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);},
 dispatchEvent(event){for(const fn of listeners.get(event.type)||[])fn(event);return true;}};
const window=new EventTarget();
class Parameter{value=1;cancelScheduledValues(){}setValueAtTime(v){this.value=v;}linearRampToValueAtTime(v){this.value=v;}setTargetAtTime(v){this.value=v;}}
class AudioNode{gain=new Parameter();connect(){}disconnect(){}}
class AudioContext extends EventTarget{
 state='suspended';currentTime=0;destination={};
 createGain(){return new AudioNode();}
 createDynamicsCompressor(){return{connect(){},threshold:new Parameter(),knee:new Parameter(),ratio:new Parameter(),attack:new Parameter(),release:new Parameter()};}
 createBufferSource(){const source={playbackRate:new Parameter(),connect(){},disconnect(){},start(){started.push(source);},stop(){source.onended?.();}};return source;}
 async decodeAudioData(bytes){const data=Buffer.from(bytes);assert.equal(data.toString('ascii',0,4),'RIFF');return{duration:1.05,sha256:createHash('sha256').update(data).digest('hex')};}
 async resume(){this.state='running';this.dispatchEvent(new Event('statechange'));}
 async suspend(){this.state='suspended';this.dispatchEvent(new Event('statechange'));}
}
window.AudioContext=AudioContext;
const frame={dataset:{entryState:'ready',treePanState:'ready'}};
const sandbox=vm.createContext({window,document,CustomEvent,Event,console,frame,
 performance:{now:()=>now},setInterval:()=>1,clearInterval(){},
 setTimeout(fn,delay){timers.set(++timerId,{fn,at:now+delay});return timerId;},clearTimeout:id=>timers.delete(id),
 localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},
 fetch:async url=>{const b=fs.readFileSync(path.join(root,url.split('?')[0]));return{ok:true,arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)};},
 $:selector=>selector.includes('is-dragging')&&dragging?{}:null,
 ignoreChapterClickUntil:0,ignoreStoryHoverUntil:0});
vm.runInContext(fs.readFileSync(path.join(root,'ui-sound.js'),'utf8'),sandbox,{filename:'ui-sound.js'});
sandbox.uiSound=window.YorollSound;
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const start=app.indexOf('// Only deliberate controls sound;');
const end=app.indexOf("document.addEventListener('click',event=>{",start);
assert(start>=0&&end>start);
vm.runInContext(app.slice(start,end),sandbox,{filename:'app-hover-handlers.js'});
await window.YorollSound.unlock();
await new Promise(setImmediate);

function control(locked=false,disabled=false){
 const item={locked,disabled,isConnected:true,hover:true,
  closest(selector){if(selector==='.tree-node-cell.is-locked')return locked?item:null;if(selector==='button,a,input[type="range"]')return item;if(selector==='.tree-viewport'||selector==='#screen')return{};return null;},
  getAttribute(){return disabled?'true':null;},contains(other){return other===item;},
  matches(selector){if(selector===':hover')return item.hover;if(selector==='.tree-node-cell.is-locked')return locked;if(selector==='.chapter-card,.tree-node')return!locked;return false;}};
 return item;
}
function dispatch(type,target,extra={}){document.dispatchEvent({type,target,relatedTarget:null,buttons:0,...extra});}
function tick(ms){now+=ms;for(const [id,timer] of [...timers])if(timer.at<=now){timers.delete(id);timer.fn();}}
function leave(item){item.hover=false;dispatch('pointerout',item);}
function enter(item,extra={}){item.hover=true;dispatch('pointerover',item,extra);}
const count=()=>Number(data.audioPlayCount),passed=[];
const locked=control(true),ordinary=control();
enter(locked);tick(109);assert.equal(count(),0);tick(1);
assert.equal(data.audioLastCue,'locked');assert.equal(count(),1);assert.equal(started.at(-1).playbackRate.value,.5);
const lockedVoice=started.at(-1);
assert.equal(lockedVoice.buffer.sha256,createHash('sha256').update(fs.readFileSync(path.join(root,'assets/audio/ui-hover.wav'))).digest('hex'));
assert.equal(JSON.parse(data.audioCounts).hover,undefined);
passed.push('A deliberate locked hover uses the original hover recording at a lower pitch after its dwell.');

leave(locked);enter(locked);tick(110);assert.equal(count(),1);
leave(locked);tick(650);enter(locked);tick(110);assert.equal(count(),2);
passed.push('Crossing several locked fragments quickly is throttled; a later deliberate hover can sound again.');

let before=count();leave(locked);tick(700);enter(locked);tick(40);leave(locked);tick(150);assert.equal(count(),before);
passed.push('Brief pointer crossings do not play a locked cue.');

enter(locked,{buttons:1});tick(200);assert.equal(count(),before);
dragging=true;enter(locked);tick(200);assert.equal(count(),before);dragging=false;
enter(locked);frame.dataset.treePanState='moving';tick(110);assert.equal(count(),before);
frame.dataset.treePanState='ready';tick(800);assert.equal(count(),before);
passed.push('Mouse dragging and inertial panning suppress the cue and discard pending hover audio.');

leave(locked);frame.dataset.entryState='entering';enter(locked);tick(200);assert.equal(count(),before);frame.dataset.entryState='ready';
document.hidden=true;enter(locked);tick(200);assert.equal(count(),before);document.hidden=false;
passed.push('Entry animations and a hidden preview do not produce locked hover audio.');

window.YorollSound.setLevels({isMuted:true});await new Promise(setImmediate);
leave(locked);enter(locked);tick(110);assert.equal(count(),before);assert.equal(data.audioVoices,'0');
assert.equal(storage.get('yoroll-ui-preview:master-muted'),'true');
window.YorollSound.setLevels({isMuted:false});await new Promise(setImmediate);
leave(locked);tick(700);enter(locked);tick(110);assert.equal(count(),before+1);
passed.push('Master mute stops this cue as well; re-enabling audio restores it.');

before=count();leave(locked);tick(700);enter(ordinary);tick(70);assert.equal(data.audioLastCue,'hover');assert.equal(count(),before+1);
assert.equal(started.at(-1).buffer.sha256,lockedVoice.buffer.sha256);assert.equal(started.at(-1).playbackRate.value,1);
const disabled=control(false,true);enter(disabled);tick(200);assert.equal(count(),before+1);
passed.push('Playable and locked hover share the exact recording at different pitches; unrelated disabled buttons remain silent.');
console.log(JSON.stringify({revision:'locked-hover-octave-20261113',passed:passed.length,checks:passed},null,2));
