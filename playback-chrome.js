(function(){
 'use strict';
 // Both players share idle timing and input ownership; revealing controls never consumes a tap.
 function attach({surface,controls,isPlaying,keepVisible=()=>false,onHide=()=>{},idleMs=2800}){
  const groups=Array.isArray(controls)?controls:[controls];
  const doc=groups[0].ownerDocument,view=doc.defaultView,listeners=[];
  const previous=groups.map(group=>({group,aria:group.getAttribute('aria-hidden'),inert:group.inert}));
  const contains=target=>groups.some(group=>group.contains(target));
  let timer=0,disposed=false,visible=true,pressed=false,keyboard=false,lastPinned,lastPointer=null;
  function listen(target,type,fn,options){target.addEventListener(type,fn,options);listeners.push(()=>target.removeEventListener(type,fn,options));}
  function clear(){view.clearTimeout(timer);timer=0;}
  function pinned(){return doc.hidden||!isPlaying()||keepVisible()||pressed||(keyboard&&contains(doc.activeElement));}
  function apply(show){
   if(visible===show&&groups.every(group=>group.dataset.controlsVisibility))return;
   visible=show;
   groups.forEach(group=>{group.dataset.controlsVisibility=show?'visible':'hidden';group.inert=!show;group.setAttribute('aria-hidden',String(!show));});
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
  const move=event=>{
   if(!mouse(event))return;
   // Browser hit-testing can redispatch pointer events when fading UI moves under a stationary mouse.
   if(Number.isFinite(event.clientX)&&Number.isFinite(event.clientY)){
    if(lastPointer&&lastPointer.x===event.clientX&&lastPointer.y===event.clientY)return;
    lastPointer={x:event.clientX,y:event.clientY};
   }
   wake();
  };
  listen(surface,'pointermove',move,{passive:true});
  groups.forEach(group=>listen(group,'pointerenter',move,{passive:true}));
  listen(surface,'pointerdown',event=>{
   keyboard=false;pressed=contains(event.target);wake();
  },{capture:true,passive:true});
  const release=event=>{
   if(!pressed&&!surface.contains(event.target))return;
   pressed=false;wake();
  };
  listen(doc,'pointerup',release,{passive:true});
  listen(doc,'pointercancel',release,{passive:true});
  listen(doc,'keydown',event=>{
   if(surface.isConnected===false||(!surface.contains(event.target)&&event.target!==doc.body&&event.target!==doc.documentElement))return;
   keyboard=true;wake();
  },true);
  groups.forEach(group=>{
   listen(group,'focusin',wake);
   listen(group,'focusout',()=>view.queueMicrotask(sync));
   listen(group,'input',wake);
  });
  listen(doc,'visibilitychange',()=>{pressed=false;lastPointer=null;wake();});
  wake();
  return Object.freeze({sync,wake,dispose(){
   if(disposed)return;
   disposed=true;clear();listeners.forEach(remove=>remove());
   previous.forEach(({group,aria,inert})=>{
    delete group.dataset.controlsVisibility;group.inert=inert;
    if(aria===null)group.removeAttribute('aria-hidden');else group.setAttribute('aria-hidden',aria);
   });
  }});
 }
 window.YorollPlaybackChrome=Object.freeze({attach});
})();
