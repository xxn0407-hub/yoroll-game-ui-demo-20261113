(function(root,factory){
 'use strict';
 const helpers=factory();
 if(typeof module==='object'&&module.exports){module.exports=helpers;return;}
 const doc=root.document,html=doc.documentElement,query=new URLSearchParams(root.location.search);
 const preview=query.get('layout');
 let mobile=false,unit=1,orientation='landscape',pending=false;
 const managed=new Map(),zoomBoards=new Set();
 function sync(){
  const width=root.innerWidth,height=root.innerHeight;
  mobile=helpers.isPhone({preview,width,height,mobile:root.navigator.userAgentData?.mobile,userAgent:root.navigator.userAgent,coarse:root.matchMedia('(pointer:coarse)').matches});
  const screenType=preview==='mobile'?'':root.screen?.orientation?.type;
  orientation=mobile&&screenType?helpers.orientationOf(screenType):preview!=='mobile'&&mobile&&typeof root.orientation==='number'?(Math.abs(root.orientation)%180===90?'landscape':'portrait'):width<height?'portrait':'landscape';
  unit=helpers.designUnit(width,height,orientation);
  html.classList.toggle('mobile-ui',mobile);html.dataset.uiOrientation=orientation;
  if(mobile){
   html.style.setProperty('--mobile-unit',`${unit}px`);
   const visible=root.visualViewport;
   html.style.setProperty('--app-height',`${Math.round(visible&&visible.scale===1?visible.height:height)}px`);
   html.style.setProperty('--visual-top',`${Math.round(root.visualViewport?.offsetTop||0)}px`);
   html.dataset.keyboardOpen=String(!!visible&&visible.scale===1&&visible.height<height*.75&&doc.activeElement?.matches('input:not([type=range]),textarea'));
  }else{
   html.style.removeProperty('--mobile-unit');html.style.removeProperty('--app-height');html.style.removeProperty('--visual-top');
   for(const record of managed.values())restore(record);managed.clear();zoomBoards.clear();
  }
  queue();
  root.dispatchEvent(new CustomEvent('yoroll:layout-change',{detail:{mobile,orientation,width,height,unit}}));
 }
 function withPreview(value){
  if(preview!=='mobile'&&preview!=='desktop')return value;
  const target=new URL(value,root.location.href);target.searchParams.set('layout',preview);
  return target.origin===root.location.origin?target.pathname+target.search+target.hash:value;
 }
 function restore(record){
  const {element,style,wrap,controls}=record;
  if(!element.isConnected)return;
  if(style===null)element.removeAttribute('style');else element.setAttribute('style',style);
  if(wrap?.isConnected){wrap.replaceWith(element);controls?.remove();}
 }
 function measureStage(element){
  const stage=element.closest('.suite-native-preview')||element.closest('.suite-playbody');
  return {width:stage?.clientWidth||root.innerWidth-32,height:stage?.clientHeight||root.innerHeight-200};
 }
 function fit(record){
  const {element,reference,zoom=1,wrap}=record;if(!element.isConnected)return;
  const stage=wrap?{width:wrap.clientWidth,height:wrap.clientHeight}:measureStage(element);
  const reserve=element.matches('.suite-paper')?40:0;
  const availableHeight=Math.max(40,stage.height-reserve);
  const base=Math.min(stage.width,availableHeight*reference.width/reference.height),width=zoom>1?Math.max(base*zoom,record.minZoomWidth||0):base;
  element.style.width=`${width}px`;element.style.height=`${width*reference.height/reference.width}px`;
  element.style.setProperty('--p',`${width/reference.width}px`);
  if(record.label){const text=zoom>1?'缩小棋盘':'放大棋盘';if(record.label.textContent!==text)record.label.textContent=text;}
 }
 function registerFit(element,reference,zoomable=false){
  if(managed.has(element))return;
  const record={element,reference,style:element.getAttribute('style'),zoom:1};managed.set(element,record);
  if(zoomable){
   record.minZoomWidth=46*(element.matches('.suite-gomoku')?15:element.matches('.suite-xiangqi')?9:element.matches('.suite-sudoku')?6:8);
   const wrap=doc.createElement('div');wrap.className='mobile-board-viewport';wrap.setAttribute('aria-label','棋盘，可拖动浏览');
   element.replaceWith(wrap);wrap.append(element);record.wrap=wrap;
   const controls=doc.createElement('button');controls.className='mobile-board-zoom';controls.type='button';controls.setAttribute('aria-label','放大棋盘');controls.setAttribute('aria-pressed','false');
   controls.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6M7 10h6m-3-3v6"/></svg><span>放大棋盘</span>';
   wrap.after(controls);record.controls=controls;record.label=controls.querySelector('span');
   controls.addEventListener('click',()=>{
    record.zoom=record.zoom===1?2:1;wrap.classList.toggle('is-zoomed',record.zoom>1);fit(record);
    controls.setAttribute('aria-pressed',String(record.zoom>1));controls.setAttribute('aria-label',record.zoom>1?'缩小棋盘':'放大棋盘');
    wrap.scrollLeft=Math.max(0,(element.offsetWidth-wrap.clientWidth)/2);wrap.scrollTop=Math.max(0,(element.offsetHeight-wrap.clientHeight)/2);
    root.YorollSound?.play('click',{level:.35});
   });
   zoomBoards.add(record);
  }
  fit(record);
 }
 function scan(){
  pending=false;if(!mobile)return;
  for(const [element,record] of managed)if(!element.isConnected){managed.delete(element);zoomBoards.delete(record);}
  const fits=[['.suite-gomoku',590,590,true],['.suite-sudoku',540,540,true],['.suite-chess-board',590,590,true],['.suite-xiangqi',530,590,true],['.suite-paper',660,660,false],['.suite-race-scene',970,535,false],['.suite-basket-court',800,510,false],['.suite-pool',900,475,false]];
  for(const [selector,width,height,zoomable] of fits)doc.querySelectorAll(selector).forEach(element=>registerFit(element,{width,height},zoomable));
  for(const record of managed.values())fit(record);
 }
 function queue(){if(pending)return;pending=true;root.requestAnimationFrame(scan);}
 function reveal(element){if(mobile&&element)element.scrollIntoView({behavior:root.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'nearest',inline:'center'});}
 function ready(){
  new MutationObserver(records=>{if(records.some(record=>[...record.addedNodes,...record.removedNodes].some(node=>node.nodeType===1)))queue();}).observe(doc.body,{childList:true,subtree:true});
  doc.addEventListener('click',event=>{
   const anchor=event.target.closest('a[href]');if(anchor&&mobile&&preview==='mobile'&&!anchor.hasAttribute('target'))anchor.href=withPreview(anchor.getAttribute('href'));
  },{capture:true});
  doc.addEventListener('focusin',event=>{if(mobile&&event.target.matches('input:not([type=range]),textarea'))root.setTimeout(()=>{sync();event.target.scrollIntoView({behavior:'smooth',block:'center'});},180);});
  doc.addEventListener('focusout',()=>{if(mobile)root.requestAnimationFrame(sync);});
  sync();
 }
 root.YorollLayout=Object.freeze({...helpers,get isMobile(){return mobile;},get orientation(){return orientation;},get unit(){return unit;},withPreview,reveal});
 sync();
 root.addEventListener('resize',sync,{passive:true});root.visualViewport?.addEventListener('resize',sync,{passive:true});
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 function orientationOf(value,fallback='landscape'){
  if(value&&typeof value==='object'&&value.width&&value.height)return value.width<value.height?'portrait':'landscape';
  const normalized=String(value||'').toLowerCase();
  if(/portrait|vertical|9\s*[:/]\s*16/.test(normalized))return 'portrait';
  if(/landscape|horizontal|16\s*[:/]\s*9/.test(normalized))return 'landscape';
  return fallback;
 }
 function isPhone({preview,width,height,mobile,userAgent='',coarse=false}){
  if(preview==='desktop')return false;if(preview==='mobile')return true;
  return mobile===true||/iPhone|iPod|Android.*Mobile|Windows Phone/i.test(userAgent)||(mobile!==false&&coarse&&Math.min(width,height)<=820&&Math.max(width,height)<=1400);
 }
 function designUnit(width,height,orientation){return orientation==='portrait'?Math.min(.82,Math.max(.68,width/540)):Math.min(.82,Math.max(.64,height/610));}
 function referenceSize(orientation){return orientationOf(orientation)==='portrait'?{width:1080,height:1920}:{width:1920,height:1080};}
 function normalizePoint(x,y,orientation){const frame=referenceSize(orientation);return {x:x/frame.width,y:1-y/frame.height};}
 function fitPlane(width,height,orientation){const frame=referenceSize(orientation),scale=Math.min(width/frame.width,height/frame.height);return {width:frame.width*scale,height:frame.height*scale};}
 return {orientationOf,isPhone,designUnit,referenceSize,normalizePoint,fitPlane};
});
