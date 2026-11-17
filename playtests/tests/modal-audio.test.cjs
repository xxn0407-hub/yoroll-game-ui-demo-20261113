const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');

function dialog(file,{reduced=false}={}){
 const source=fs.readFileSync(path.join(root,file),'utf8'),sounds=[],animations=[],clicks=[],stopped=[];
 let hoverSuppressions=0;
 const timing=source.match(/const MODAL_CLOSE_TIMING\s*=[^;]+;/)[0];
 const start=source.indexOf('function clearModalEntryMotion(');
 const end=source.indexOf(file==='app.js'?'function showExit()':"document.addEventListener('click',e=>",start);
 const makeElement=()=>({dataset:{},style:{setProperty(){}},animate(){let finish;const animation={finished:new Promise(resolve=>{finish=resolve;}),finish:()=>finish(),cancel(){}};animations.push(animation);return animation;}});
 const modalRoot={firstElementChild:null},node=makeElement(),panel=makeElement(),caption=makeElement();
 const content=Array.from({length:5},makeElement),screen={inert:true};
 node.querySelector=()=>panel;panel.querySelector=()=>caption;panel.querySelectorAll=()=>content;
 node.contains=()=>false;node.remove=()=>{modalRoot.firstElementChild=null;};modalRoot.firstElementChild=node;
 const focus={isConnected:true,calls:0,focus(){this.calls++;}};
 const document={addEventListener(type,callback){if(type==='click')clicks.push(callback);}};
 const context=vm.createContext({document,modalRoot,screen,modalPreviousFocus:focus,modalCloseMotion:null,confirmAction:null,enterAnimations:new Set(),motionPreference:{matches:reduced},unit:n=>n,uiSound:{play:name=>sounds.push(name),suppressHover:()=>hoverSuppressions++,stopChannel:(channel,fade)=>stopped.push({channel,fade})},getComputedStyle:()=>({opacity:'1',transform:'none',filter:'none',maskSize:'100% 100%'})});
 vm.runInContext(timing+'\n'+source.slice(start,end),context);
 // Execute the actual generic click listener too: it must not add a button cue.
 const app=fs.readFileSync(path.join(root,file==='app.js'?'app.js':'playtests/app.js'),'utf8');
 const captureStart=app.indexOf(file==='app.js'?"document.addEventListener('click',event=>{\n const control=event.target.closest('button,a');":"document.addEventListener('click',ev=>{const el=ev.target.closest('[data-suite]');");
 const captureEnd=file==='app.js'?app.indexOf('},{capture:true});',captureStart)+'},{capture:true});'.length:app.indexOf("$('#suite-review-toggle').addEventListener",captureStart);
 vm.runInContext(app.slice(captureStart,captureEnd),context);
 const control={disabled:false,dataset:{action:'modal-cancel'},hasAttribute:()=>false,getAttribute:()=>null,
  closest(selector){if(selector==='button,a')return this;if(selector==='[data-closing="true"]')return node.dataset.closing?node:null;return null;},
  matches(selector){return selector.includes(`[data-action="${this.dataset.action}"]`);}};
 return {context,sounds,animations,modalRoot,screen,focus,stopped,get hoverSuppressions(){return hoverSuppressions;},
  cancel(){control.dataset.action='modal-cancel';clicks.forEach(fn=>fn({target:control}));return context.closeModal();},
  confirm(){control.dataset.action='modal-confirm';clicks.forEach(fn=>fn({target:control}));return context.confirmModal();},
  finish(){animations.at(-1)?.finish();}};
}

for(const file of ['app.js','playtests/feedback.js']){
 test(`${file}: cancel and the complete closing animation are silent and fade out hover and the opening cue`,async()=>{
  const view=dialog(file),first=view.cancel(),again=view.cancel();
  assert.deepEqual(view.sounds,[]);assert.equal(view.screen.inert,true);
  assert.equal(view.hoverSuppressions,1);assert.deepEqual(view.stopped,[{channel:'navigation',fade:.035}]);
  view.finish();await Promise.all([first,again]);
  assert.deepEqual(view.sounds,[]);assert.equal(view.modalRoot.firstElementChild,null);
  assert.equal(view.focus.calls,1);assert.equal(view.screen.inert,false);
 });
 test(`${file}: confirm owns its cue and silent replacement never adds a dismiss cue`,async()=>{
  const view=dialog(file);let confirmed=0;view.context.confirmAction=()=>confirmed++;
  const first=view.confirm(),again=view.confirm();assert.deepEqual(view.sounds,['confirm']);
  view.finish();await Promise.all([first,again]);assert.equal(confirmed,1);
  assert.deepEqual(view.sounds,['confirm']);
  const replacement=dialog(file);await replacement.context.closeModal(true);
  assert.deepEqual(replacement.sounds,[]);
 });
 test(`${file}: reduced-motion and repeated cancellation stay silent`,async()=>{
  const view=dialog(file,{reduced:true});await view.cancel();await view.cancel();
  assert.deepEqual(view.sounds,[]);assert.equal(view.animations.length,0);
  assert.equal(view.focus.calls,1);
 });
}
