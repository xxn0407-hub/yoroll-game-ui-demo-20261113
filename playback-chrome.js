(function(){
 'use strict';
 // Both players share idle timing and input ownership; revealing controls never consumes a tap.
 function attach({surface,controls,isPlaying,keepVisible=()=>false,onHide=()=>{},idleMs=2800}){
  const doc=controls.ownerDocument,view=doc.defaultView,listeners=[];
  const previousAria=controls.getAttribute('aria-hidden'),previousInert=controls.inert;
  let timer=0,disposed=false,visible=true,hovered=false,pressed=false,keyboard=false,lastPinned;
  function listen(target,type,fn,options){target.addEventListener(type,fn,options);listeners.push(()=>target.removeEventListener(type,fn,options));}
  function clear(){view.clearTimeout(timer);timer=0;}
  function pinned(){return doc.hidden||!isPlaying()||keepVisible()||hovered||pressed||(keyboard&&controls.contains(doc.activeElement));}
  function apply(show){
   if(visible===show&&controls.dataset.controlsVisibility)return;
   visible=show;controls.dataset.controlsVisibility=show?'visible':'hidden';
   controls.inert=!show;controls.setAttribute('aria-hidden',String(!show));
   if(!show)onHide();
  }
  function wake(){
   if(disposed)return;
   clear();apply(true);lastPinned=Boolean(pinned());
   if(!lastPinned)timer=view.setTimeout(()=>{
    timer=0;if(disposed)return;
    if(pinned()){sync();return;}
    apply(false);
   },idleMs);
  }
  function sync(){if(!disposed&&Boolean(pinned())!==lastPinned)wake();}
  const mouse=event=>!event.pointerType||event.pointerType==='mouse';
  listen(surface,'pointermove',event=>{
   if(!mouse(event))return;
   hovered=controls.contains(event.target);wake();
  },{passive:true});
  listen(controls,'pointerenter',event=>{if(mouse(event)){hovered=true;wake();}},{passive:true});
  listen(controls,'pointerleave',event=>{if(mouse(event)){hovered=false;sync();}},{passive:true});
  listen(surface,'pointerdown',event=>{
   keyboard=false;pressed=controls.contains(event.target);
   if(!mouse(event))hovered=false;
   wake();
  },{capture:true,passive:true});
  const release=event=>{
   if(!pressed&&!surface.contains(event.target))return;
   pressed=false;wake();
  };
  listen(doc,'pointerup',release,{passive:true});
  listen(doc,'pointercancel',release,{passive:true});
  listen(surface,'pointerleave',()=>{hovered=false;sync();},{passive:true});
  listen(doc,'keydown',event=>{
   if(surface.isConnected===false||(!surface.contains(event.target)&&event.target!==doc.body&&event.target!==doc.documentElement))return;
   keyboard=true;wake();
  },true);
  listen(controls,'focusin',wake);
  listen(controls,'focusout',()=>view.queueMicrotask(sync));
  listen(controls,'input',wake);
  listen(doc,'visibilitychange',()=>{hovered=false;pressed=false;wake();});
  wake();
  return Object.freeze({sync,wake,dispose(){
   if(disposed)return;
   disposed=true;clear();listeners.forEach(remove=>remove());
   delete controls.dataset.controlsVisibility;controls.inert=previousInert;
   if(previousAria===null)controls.removeAttribute('aria-hidden');else controls.setAttribute('aria-hidden',previousAria);
  }});
 }
 window.YorollPlaybackChrome=Object.freeze({attach});
})();
