(function(){
'use strict';
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const screen=$('#screen'),modalRoot=$('#modal-root'),uiSound=window.YorollSound;
const unit=n=>n*(window.YorollLayout?.isMobile?window.YorollLayout.unit:Math.min(innerWidth/1920,innerHeight/1080));
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)'),enterAnimations=new Set();
const TOAST_MOTION={duration:2600,surfaceEnter:440,contentDelay:140,contentEnter:280,contentExitStart:2050,contentExit:170,surfaceExitStart:2140};
const MODAL_CLOSE_TIMING={content:110,lead:80,surface:280,veil:200};
let toastMotion=null,modalPreviousFocus=null,modalCloseMotion=null,confirmAction=null;
const button=(label,action,kind='')=>`<button class="btn ${kind} ${kind.includes('btn-primary')?'btn-glass':''}" data-action="${action}">${label}</button>`;
function enter(el,{y=18,delay=0,duration=620}={}){if(!el||motionPreference.matches)return;const a=el.animate([{opacity:0,transform:`translate3d(0,${y}px,0)`},{opacity:1,transform:'none'}],{duration,delay,fill:'both',easing:'cubic-bezier(.16,1,.3,1)'});enterAnimations.add(a);a.finished.then(()=>{enterAnimations.delete(a);a.cancel();}).catch(()=>{});}
function toast(message){
 const el=$('#toast'),wasVisible=el.dataset.toastActive==='true';
 if(!el.querySelector('.toast-material'))el.innerHTML='<span class="toast-material" aria-hidden="true"></span><span class="toast-edge" aria-hidden="true"></span><span class="toast-content"><span class="toast-mark" aria-hidden="true"></span><span class="toast-copy"></span></span>';
 const material=el.querySelector('.toast-material'),edge=el.querySelector('.toast-edge'),content=el.querySelector('.toast-content'),copy=el.querySelector('.toast-copy');
 // Capture interrupted entry/closing before cancelling, so the background resumes in place.
 const materialPose=getComputedStyle(material),edgePose=getComputedStyle(edge),contentPose=getComputedStyle(content);
 const startMaterial={opacity:wasVisible?materialPose.opacity:0,maskSize:wasVisible?materialPose.maskSize:'4% 100%'};
 const startEdge={opacity:wasVisible?edgePose.opacity:0,transform:wasVisible?edgePose.transform:'scaleX(.04)'};
 const keepCopy=wasVisible&&copy.textContent===message&&Number(contentPose.opacity)>.5;
 const startContent={opacity:keepCopy?contentPose.opacity:0,transform:keepCopy?contentPose.transform:`translate3d(0,${unit(3)}px,0)`};
 toastMotion?.cancel();
 copy.textContent=message;
 el.style.opacity='1';el.dataset.toastActive='true';
 const motion={animations:[],cancelled:false,cancel(){this.cancelled=true;this.animations.forEach(animation=>animation.cancel());}};
 toastMotion=motion;
 const total=TOAST_MOTION.duration,offset=ms=>ms/total;
 const enterEase='cubic-bezier(.22,.61,.36,1)',exitEase='cubic-bezier(.4,0,.2,1)';
 const add=(element,frames)=>{
  const animation=element.animate(frames,{duration:total,fill:'both',easing:'linear'});
  motion.animations.push(animation);
 };
 if(motionPreference.matches){
  const still=pose=>[{...pose,offset:0},{...pose,offset:1}];
  add(material,still({opacity:1,maskSize:'100% 100%'}));
  add(edge,still({opacity:1,transform:'scaleX(1)'}));
  add(content,still({opacity:1,transform:'none'}));
 }else{
  add(material,[
   {...startMaterial,offset:0,easing:enterEase},
   {opacity:1,maskSize:'100% 100%',offset:offset(TOAST_MOTION.surfaceEnter)},
   {opacity:1,maskSize:'100% 100%',offset:offset(TOAST_MOTION.surfaceExitStart),easing:exitEase},
   {opacity:0,maskSize:'4% 100%',offset:1}
  ]);
  add(edge,[
   {...startEdge,offset:0,easing:enterEase},
   {opacity:1,transform:'scaleX(1)',offset:offset(TOAST_MOTION.surfaceEnter)},
   {opacity:1,transform:'scaleX(1)',offset:offset(TOAST_MOTION.surfaceExitStart),easing:exitEase},
   {opacity:0,transform:'scaleX(.04)',offset:1}
  ]);
  const delay=keepCopy?0:TOAST_MOTION.contentDelay;
  const copyFrames=[{...startContent,offset:0,easing:enterEase}];
  if(delay)copyFrames.push({...startContent,offset:offset(delay),easing:enterEase});
  copyFrames.push(
   {opacity:1,transform:'translate3d(0,0,0)',offset:offset(delay+TOAST_MOTION.contentEnter)},
   {opacity:1,transform:'translate3d(0,0,0)',offset:offset(TOAST_MOTION.contentExitStart),easing:exitEase},
   {opacity:0,transform:`translate3d(0,${unit(-2)}px,0)`,offset:offset(TOAST_MOTION.contentExitStart+TOAST_MOTION.contentExit)},
   {opacity:0,transform:`translate3d(0,${unit(-2)}px,0)`,offset:1}
  );
  add(content,copyFrames);
 }
 Promise.all(motion.animations.map(animation=>animation.finished)).then(()=>{
  if(toastMotion!==motion||motion.cancelled)return;
  el.style.opacity='0';el.dataset.toastActive='false';
  motion.cancel();toastMotion=null;
 }).catch(()=>{});
}
function openModal({title,message,confirm='确认',onConfirm,eyebrow='CONFIRM',danger=false,kind='confirm'}){
 closeModal(true);
 uiSound.play('open',{level:.8});
 modalPreviousFocus=document.activeElement;
 confirmAction=onConfirm;
 modalRoot.innerHTML=`<div class="modal-scrim"><section class="modal" data-context="${eyebrow}" data-dialog-kind="${kind}" data-destructive="${danger}" role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-message"><h2 class="modal-caption" id="modal-title"><span class="modal-caption-label">提示</span></h2><p id="modal-message"><span>${title}</span><span>${message}</span></p><div class="modal-actions">${button('取消','modal-cancel','btn-small')}${button(confirm,'modal-confirm','btn-small btn-primary')}</div></section></div>`;
 screen.inert=true;
 enter($('.modal-scrim'),{y:0,duration:220});
 enter($('.modal-caption-label'),{y:unit(4),delay:180,duration:380});
 $$('#modal-message>span').forEach((el,index)=>enter(el,{y:unit(6),delay:230+index*45,duration:440}));
 $$('.modal-actions>button').forEach((el,index)=>enter(el,{y:unit(6),delay:310+index*45,duration:420}));
 $('.modal [data-action="modal-cancel"]').focus({preventScroll:true});
}
function clearModalEntryMotion(node){
 for(const animation of enterAnimations){
  const target=animation.effect?.target;
  if(target&&node.contains(target)){enterAnimations.delete(animation);animation.cancel();}
 }
}
function cancelModalCloseMotion(){
 const record=modalCloseMotion;
 if(!record)return;
 record.cancelled=true;
 modalCloseMotion=null;
 record.animations.forEach(animation=>animation.cancel());
}
async function closeModal(immediate=false,{silent=false,restoreFocus=true}={}){
 const node=modalRoot.firstElementChild;
 if(!node){cancelModalCloseMotion();screen.inert=false;return true;}
 if(!immediate&&modalCloseMotion?.node===node)return modalCloseMotion.promise;
 const previousFocus=modalPreviousFocus;
 confirmAction=null;
 if(!immediate){uiSound.suppressHover();uiSound.stopChannel('navigation',.035);}
 if(immediate||motionPreference.matches){
  cancelModalCloseMotion();
  node.remove();
  clearModalEntryMotion(node);
  screen.inert=false;
  if(!immediate&&restoreFocus&&previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
  return true;
 }
 const panel=node.querySelector('.modal');
 const caption=panel.querySelector('.modal-caption');
 const surface=getComputedStyle(panel,'::before');
 const edge=getComputedStyle(panel,'::after');
 const header=getComputedStyle(caption,'::before');
 const dots=getComputedStyle(caption,'::after');
 const content=Array.from(panel.querySelectorAll('.modal-caption-label,#modal-message>span,.modal-actions>button')).map(element=>{
  const style=getComputedStyle(element);
  return {element,opacity:style.opacity,transform:style.transform,filter:style.filter};
 });
 const foldDelay=content.some(item=>Number(item.opacity)>.01)?MODAL_CLOSE_TIMING.lead:0;
 const variables={
  '--dialog-fold-mask':surface.maskSize,
  '--dialog-fold-surface-opacity':surface.opacity,
  '--dialog-fold-edge-transform':edge.transform,
  '--dialog-fold-edge-opacity':edge.opacity,
  '--dialog-fold-header-transform':header.transform,
  '--dialog-fold-header-opacity':header.opacity,
  '--dialog-fold-dots-opacity':dots.opacity,
  '--dialog-fold-delay':`${foldDelay}ms`,
  '--dialog-fold-duration':`${MODAL_CLOSE_TIMING.surface}ms`,
  '--dialog-content-exit-duration':`${MODAL_CLOSE_TIMING.content}ms`
 };
 for(const [name,value] of Object.entries(variables))panel.style.setProperty(name,value);
 const veilOpacity=getComputedStyle(node).opacity;
 const record={node,animations:[],cancelled:false,promise:null};
 modalCloseMotion=record;
 node.dataset.closing='true';
 for(const {element,opacity,transform,filter} of content){
  const animation=element.animate([{opacity,transform,filter},{opacity:0,transform:`translate3d(0,${unit(-3)}px,0)`,filter:'none'}],{duration:MODAL_CLOSE_TIMING.content,easing:'cubic-bezier(.4,0,.2,1)',fill:'both'});
  animation.finished.catch(()=>{});
  record.animations.push(animation);
 }
 const veil=node.animate([{opacity:veilOpacity},{opacity:0}],{duration:MODAL_CLOSE_TIMING.veil,delay:foldDelay+MODAL_CLOSE_TIMING.surface-MODAL_CLOSE_TIMING.veil,easing:'cubic-bezier(.4,0,.2,1)',fill:'both'});
 record.animations.push(veil);
 record.promise=(async()=>{
  await veil.finished.catch(()=>{});
  if(record.cancelled||modalCloseMotion!==record||modalRoot.firstElementChild!==node)return false;
  node.remove();
  clearModalEntryMotion(node);
  modalCloseMotion=null;
  record.animations.forEach(animation=>animation.cancel());
  screen.inert=false;
  if(restoreFocus&&previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
  return true;
 })();
 return record.promise;
}
async function confirmModal(){
 if(!confirmAction)return;
 const action=confirmAction;
 uiSound.play('confirm',{level:.8});
 if(await closeModal(false,{silent:true,restoreFocus:false}))action();
}

document.addEventListener('click',e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(action==='modal-cancel'){closeModal().then(()=>window.dispatchEvent(new Event('suite:modal-closed')));}if(action==='modal-confirm')confirmModal();});
document.addEventListener('keydown',e=>{if(!modalRoot.firstElementChild)return;if(e.key==='Escape'){e.preventDefault();closeModal().then(()=>window.dispatchEvent(new Event('suite:modal-closed')));}if(e.key==='Tab'){const all=Array.from(modalRoot.querySelectorAll('button:not(:disabled)')),first=all[0],last=all.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
window.YorollPlayFeedback={toast,openModal,closeModal};
})();
