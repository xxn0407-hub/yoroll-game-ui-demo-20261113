'use strict';
// Presentation and interaction prototype. All saves, settings and results stay local.
const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));
const frame = $('#game-frame');
const screen = $('#screen');
const scene = $('#scene');
const modalRoot = $('#modal-root');
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const params = new URLSearchParams(location.search);
const uiSound = window.YorollSound;
if(params.has('capture'))document.body.classList.add('capture');
const pages = [
 ['splash','启动'],['home','默认首页'],['cover','封面首页'],['chapters','章节选择'],
 ['tree','剧情树'],['saves','切换存档'],['settings','设置'],['logout','退出登录'],
 ['gameplay','游戏内'],['pause','暂停'],['choice','限时选择'],['qte','QTE'],['result','章节结果'],['exit','退出确认']
];
const pageNames = Object.fromEntries(pages);
const icons = {
 back:'<path d="m14 5-7 7 7 7"/>', arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',
 'back-filled':'<path d="M20.5 .5 4 12l16.5 11.5L14.7 12Z" fill="currentColor" stroke="none"/>',
 chevron:'<path d="m6 9 6 6 6-6"/>', close:'<path d="m6 6 12 12M18 6 6 18"/>',
 settings:'<path d="m9 3 .8-1h4.4l.8 1 .6 2 1.7 1 2.1-.4 2.2 3.8-1.3 1.7v2l1.3 1.7-2.2 3.8-2.1-.4-1.7 1-.6 2-.8 1H9l-.8-1-.6-2-1.7-1-2.1.4-2.2-3.8 1.3-1.7v-2L1.6 9.5l2.2-3.8 2.1.4 1.7-1Z" transform="translate(1 1) scale(.91)"/><circle cx="12" cy="12" r="3.3"/>',
 user:'<path d="M19 21v-2a7 7 0 0 0-14 0v2M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z"/>',
 tree:'<path d="M5 4v16M5 7h9m-9 10h9m0-10v10m0-5h6"/><circle cx="20" cy="12" r="1.5"/>',
 play:'<path d="m8 4 12 8-12 8Z"/>', pause:'<path d="M8 4v16m8-16v16"/>',
 'play-circle':'<circle cx="12" cy="12" r="9"/><path d="m10 8 4 4-4 4"/>',
 lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
 check:'<path d="m4 12 5 5L20 6"/>', trash:'<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
 replay:'<path d="M5 8a8 8 0 1 1-.3 8M5 3v5h5"/>', volume:'<path d="m11 4-5 4H2v8h4l5 4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
 'volume-off':'<path d="m11 4-5 4H2v8h4l5 4Z"/><path d="m16 9 6 6m0-6-6 6"/>'
};
const icon = (name,extra='') => `<svg viewBox="0 0 24 24" aria-hidden="true" ${extra}>${icons[name]||icons.arrow}</svg>`;
const button = (label,action,kind='',iconName='') => `<button class="btn ${kind}" data-action="${action}">${iconName?icon(iconName):''}<span>${label}</span></button>`;
const goButton = (label,route,kind='',iconName='') => `<button class="btn ${kind}" data-route="${route}">${iconName?icon(iconName):''}<span>${label}</span></button>`;
let currentPage = 'home';
let previousPage = 'home';
let sceneKey = '';
let transitionId = 0;
let enterAnimations = new Set();
let timers = new Set();
let modalPreviousFocus = null;
let confirmAction = null;
let choicePaused = false;
let playbackPaused = false;
let playbackStoryNode = null;
let qteDone = false;
let audioMuted = uiSound.isMuted();
let signedIn = true;
let savedToastAnimation;
const initialSlots = [ {chapter:'第 1 章',scene:'race-start-2',date:'演示存档',progress:22},null,null ];
const slots = initialSlots.map(v=>v?{...v}:null);
let activeSlot=0;
const saveProgress=()=>slots[activeSlot]?.progress||0;
const sceneLabel=save=>save?.scene==='race-start-2'?'蓄势待发':'起跑之前';
const settingState = {master:100,video:100,sfx:100,music:100,language:'跟随系统'};
const settingsRows = [['master','主音量'],['video','视频音量'],['sfx','音效音量'],['music','音乐音量']];
function syncSoundControls(){
 audioMuted=uiSound.isMuted();
 $$('[data-action="toggle-preview-audio"]').forEach(button=>{button.textContent=document.documentElement.dataset.audioPreviewPaused==='true'?'继续声音':'暂停声音';});
 $$('[data-action="sound-toggle"]').forEach(button=>{
  button.setAttribute('aria-pressed',String(!audioMuted));
  const label=button.querySelector('[data-sound-label]');
  const text=button.closest('.review-panel')?(audioMuted?'声音已关闭':'声音已开启'):(audioMuted?'关闭':'开启');
  if(label&&label.textContent!==text)label.textContent=text;
  if(button.classList.contains('sound-toggle-button')){
   button.title=audioMuted?'声音已关闭，点击开启':'关闭全部声音';
   if(button.dataset.muted!==String(audioMuted)){button.dataset.muted=String(audioMuted);button.innerHTML=icon(audioMuted?'volume-off':'volume');}
  }
 });
 $$('[data-action="audition-sound"]').forEach(button=>{button.disabled=audioMuted||settingState.master===0||settingState.sfx===0;});
 $$('[data-action="restart-music"]').forEach(button=>{button.disabled=audioMuted||settingState.master===0||settingState.music===0||['gameplay','pause','choice','qte','result'].includes(currentPage);});
 const status=$('#sound-status');
 if(status){const state=document.documentElement.dataset.audioState;const text=audioMuted?'全部声音已关闭':settingState.master===0||settingState.sfx===0?'界面音量为零':state==='unavailable'?'声音暂不可用':state==='locked'?'首次点击后启用声音':state==='loading'?'声音准备中':'Hover · 点击 · 页面切换';if(status.textContent!==text)status.textContent=text;}
 const musicStatus=$('#music-status');
 if(musicStatus){const phase=document.documentElement.dataset.musicPhase;const text=audioMuted?'全部声音已关闭':Number(document.documentElement.dataset.musicGain)===0?'开场音量为零':phase==='opening'?'开场音 · 播放中':phase==='fading'?'开场音 · 渐弱中':phase==='ended'?'开场音 · 已结束':phase==='paused'?'开场音 · 已暂停':phase==='loading'?'开场音 · 准备中':phase==='unavailable'?'开场音 · 暂不可用':phase==='locked'?(document.documentElement.dataset.musicResumeAvailable==='true'?'点击后继续开场音':'首次点击后播放开场音'):'开场音 · 未播放';if(musicStatus.textContent!==text)musicStatus.textContent=text;}
}
function applySoundLevels(){uiSound.setLevels({master:settingState.master/100,sfx:settingState.sfx/100,isMuted:audioMuted});window.YorollMusic.setLevels({master:settingState.master/100,music:settingState.music/100});syncSoundControls();}
function toggleInterfaceSound(){audioMuted=!audioMuted;applySoundLevels();if(!audioMuted)uiSound.play('click');toast(audioMuted?'全部声音已关闭':'声音已开启');}
document.addEventListener('ui-audio-state',syncSoundControls);
document.addEventListener('home-music-state',syncSoundControls);
// Demonstration chapters for interaction testing, separate from the online Race data.
const CHAPTER_PREVIEWS = [
 {name:'起跑之前',cover:'assets/garage.jpg',progress:22,position:'50% center'},
 {name:'雨夜出发',cover:'assets/chapter-night.webp',progress:64,position:'50% center'},
 {name:'山路晨光',cover:'assets/chapter-mountain.webp',progress:100,position:'50% center'},
 {name:'港湾暗线',cover:'assets/chapter-harbor.webp',progress:0,position:'50% center'},
 {name:'城市回响',cover:'assets/chapter-night.webp',progress:35,position:'35% center'},
 {name:'回到车库',cover:'assets/garage.jpg',progress:0,position:'62% center'},
 {name:'雾中弯道',cover:'assets/chapter-mountain.webp',progress:0,position:'62% center'},
 {name:'远港灯火',cover:'assets/chapter-harbor.webp',progress:0,position:'38% center'},
 {name:'最后一班雨',cover:'assets/chapter-night.webp',progress:0,position:'65% center'},
 {name:'引擎再响',cover:'assets/garage.jpg',progress:0,position:'30% center'},
 {name:'翻越山脊',cover:'assets/chapter-mountain.webp',progress:0,position:'35% center'},
 {name:'向终点驶去',cover:'assets/chapter-harbor.webp',progress:0,position:'65% center'}
];
let selectedChapter = 0;
let chapterSwitchId = 0;
let chapterInfoMotion = null;
let chapterControlsCleanup = null;
let chapterRailMove = null;
let chapterRailLeft = 0;
let ignoreChapterClickUntil = 0;
const activeChapter = () => ({...CHAPTER_PREVIEWS[selectedChapter],number:selectedChapter+1});
const chapterProgress = () => selectedChapter===0?saveProgress():activeChapter().progress;
function chapterInfoMarkup(){const chapter=activeChapter();return `<div class="eyebrow" data-enter="chapter-copy">CHAPTER ${String(chapter.number).padStart(2,'0')}</div><h2 data-enter="chapter-copy">第 ${chapter.number} 章</h2><p class="chapter-desc" data-enter="chapter-copy">${chapter.name}</p><div class="small-progress" data-enter="chapter-copy"><span style="width:${chapterProgress()}%"></span></div>`;}
function timeout(fn,ms){const id=setTimeout(()=>{timers.delete(id);fn();},ms);timers.add(id);return id;}
function track(animation,release=true){
 enterAnimations.add(animation);
 if(release)animation.finished.then(()=>{enterAnimations.delete(animation);animation.cancel();}).catch(()=>{});
 return animation;
}
function animate(element,keyframes,timing,release=true){
 if(!element)return null;
 if(motionPreference.matches)return null;
 return track(element.animate(keyframes,{fill:'both',...timing}),release);
}
function enter(element,{x=0,y=18,scale=1,delay=0,duration=620,blur=0}={}){
 return animate(element,[{opacity:0,transform:`translate3d(${x}px,${y}px,0) scale(${scale})`,filter:`blur(${blur}px)`},{opacity:1,transform:'translate3d(0,0,0) scale(1)',filter:'blur(0px)'}],{duration,delay,easing:'cubic-bezier(.16,1,.3,1)'});
}
function cancelPageMotion(){
 treeSwitchId++;treeDetailMotion=null;treeRouteMotions.clear();
 for(const animation of enterAnimations)animation.cancel();
 enterAnimations.clear();
 for(const timer of timers)clearTimeout(timer);
 timers.clear();
}
function unit(value){return frame.clientWidth/1920*value;}
function footer(left='',right='<span><span class="keycap">Esc</span> 返回</span>'){
 return `<footer class="page-footer" data-enter="footer"><div>${left}</div><div class="key-hints">${right}</div></footer>`;
}
function pageHeading(title,back='home',meta=''){
 return `<div class="back-heading" data-enter="heading"><button class="icon-button back-button" data-route="${back}" aria-label="返回">${icon('back-filled')}</button><h1>${title}</h1></div>${meta?`<div class="page-meta" data-enter="meta">${meta}</div>`:''}`;
}
function soundButton(){
 return `<button class="icon-button sound-toggle-button" data-action="sound-toggle" data-muted="${audioMuted}" aria-label="声音开关" aria-pressed="${!audioMuted}" title="${audioMuted?'声音已关闭，点击开启':'关闭全部声音'}">${icon(audioMuted?'volume-off':'volume')}</button>`;
}
function header(){
 return `<header class="topbar"><button class="brand" data-route="home" aria-label="Yoroll 首页" data-enter="brand"><img src="assets/yoroll-logo.png" alt="yoroll"></button><div class="header-actions"><div data-enter="header">${soundButton()}</div><div data-enter="header"><button class="icon-button" data-route="settings" aria-label="设置">${icon('settings')}</button></div><div data-enter="header"><button class="account" data-action="logout" aria-label="账号"><span class="avatar">${icon('user')}</span><span>${signedIn?'演示玩家':'未登录'}</span></button></div></div></header>`;
}
function homeView(cover=false){
 return `${header()}<nav class="home-menu" aria-label="游戏菜单">${[[saveProgress()>0?'继续游戏':'开始游戏','gameplay'],['章节选择','chapters'],['切换存档','saves'],['退出','exit']].map(([label,route])=>`<div data-enter="menu"><button data-route="${route}">${label}<span class="menu-mark">${icon('arrow')}</span></button></div>`).join('')}</nav>${cover?'<div class="cover-wordmark" data-enter="wordmark"><img src="wall/assets/nocturne-logo.webp" alt="Nocturne"></div>':''}`;
}
function splashView(){return `<div class="splash-logo" data-enter="splash-logo"><img src="assets/yoroll-logo.png" alt="yoroll"></div><button class="splash-start" data-route="home" data-enter="splash-start"><span>点击任意位置开始</span></button><div class="splash-copy" data-enter="footer">YOROLL · INTERACTIVE STORIES</div>`;}
function chaptersView(){
 const chapterCards=CHAPTER_PREVIEWS.map((chapter,index)=>{
  const number=index+1;
  const selected=index===selectedChapter;
  const progress=index===0?saveProgress():chapter.progress;
  return `<div class="chapter-cell" data-enter="chapter-card"><button class="chapter-card ${selected?'is-selected':''}" data-chapter-index="${index}" aria-pressed="${selected}" tabindex="${selected?0:-1}" aria-label="第 ${number} 章，${chapter.name}"><img src="${chapter.cover}" alt="" draggable="false" style="object-position:${chapter.position}"><span class="chapter-progress" aria-label="章节进度 ${progress}%">${progress}%</span><span class="card-label">第 ${number} 章</span></button></div>`;
 }).join('');
 return `${pageHeading('章节选择','home','CHAPTERS')}
 <div class="chapter-summary"><section class="chapter-info">${chapterInfoMarkup()}</section><div class="chapter-actions"><div data-enter="action">${goButton('剧情树','tree','','tree')}</div><div data-enter="action">${goButton(chapterProgress()>0?'继续游戏':'开始游戏','gameplay','btn-primary','play-circle')}</div></div></div>
 <div class="chapter-strip" aria-label="章节列表">${chapterCards}</div><button class="chapter-rail-arrow chapter-rail-arrow-left" data-action="chapter-scroll-left" aria-label="向左滚动章节">${icon('back')}</button><button class="chapter-rail-arrow chapter-rail-arrow-right" data-action="chapter-scroll-right" aria-label="向右滚动章节">${icon('back')}</button>
 ${footer(`<div class="chapter-browse-meta"><span id="chapter-count">${String(selectedChapter+1).padStart(2,'0')} / ${CHAPTER_PREVIEWS.length}</span><span>拖动或滚轮浏览</span></div>`, '<span><span class="keycap">←</span><span class="keycap">→</span> 切换章节</span><span><span class="keycap">Enter</span> 开始</span><span><span class="keycap">Esc</span> 返回</span>')}<div class="sr-only" id="chapter-announcement" role="status" aria-live="polite"></div>`;
}
function dropChapterLayer(image){
 for(const animation of [...enterAnimations])if(animation.effect?.target===image){enterAnimations.delete(animation);animation.cancel();}
 image.remove();
}
function settleChapterBackdrop(){
 if(!sceneKey.startsWith('chapter-'))return;
 const chapter=activeChapter();
 let current=scene.querySelector(`img[data-chapter-index="${selectedChapter}"]`);
 if(!current){current=new Image();current.src=chapter.cover;current.alt='';current.className='chapter-background';current.dataset.chapterIndex=String(selectedChapter);current.style.objectPosition=chapter.position;scene.append(current);}
 const pose=getComputedStyle(current).transform;
 current.style.opacity='1';
 current.style.transform=pose==='none'?'scale(1.025)':pose;
 for(const image of Array.from(scene.querySelectorAll('img')))if(image!==current)dropChapterLayer(image);
 for(const animation of [...enterAnimations])if(animation.effect?.target===current){enterAnimations.delete(animation);animation.cancel();}
 sceneKey=`chapter-${selectedChapter}`;
}
function disposeChapterControls(){
 chapterSwitchId++;
 if(chapterInfoMotion){enterAnimations.delete(chapterInfoMotion);chapterInfoMotion.cancel();chapterInfoMotion=null;}
 chapterControlsCleanup?.();chapterControlsCleanup=null;chapterRailMove=null;
 settleChapterBackdrop();
}
async function switchChapterBackdrop(chapter,direction,request){
 const image=new Image();image.src=chapter.cover;image.alt='';image.decoding='async';image.className='chapter-background';image.dataset.chapterIndex=String(selectedChapter);image.style.objectPosition=chapter.position;image.style.opacity='0';
 try{await image.decode();}catch{return;}
 if(request!==chapterSwitchId||currentPage!=='chapters')return;
 scene.append(image);sceneKey=`chapter-${selectedChapter}`;
 if(motionPreference.matches){image.style.opacity='1';for(const old of Array.from(scene.querySelectorAll('img')))if(old!==image)dropChapterLayer(old);return;}
 const fade=animate(image,[{opacity:0},{opacity:1}],{duration:620,easing:'cubic-bezier(.22,.68,.25,1)'},false);
 animate(image,[{transform:`translate3d(${unit(direction*10)}px,0,0) scale(1.04)`},{transform:'translate3d(0,0,0) scale(1.025)'}],{duration:1400,easing:'cubic-bezier(.16,1,.3,1)'},false);
 try{await fade.finished;}catch{return;}
 image.style.opacity='1';enterAnimations.delete(fade);fade.cancel();
 if(request===chapterSwitchId&&currentPage==='chapters')for(const old of Array.from(scene.querySelectorAll('img')))if(old!==image)dropChapterLayer(old);
}
async function switchChapterInfo(direction,request){
 const info=$('.chapter-info');if(!info)return;
 const style=getComputedStyle(info);const opening={opacity:style.opacity,transform:style.transform};
 if(chapterInfoMotion){enterAnimations.delete(chapterInfoMotion);chapterInfoMotion.cancel();}
 if(!motionPreference.matches){
  chapterInfoMotion=animate(info,[opening,{opacity:0,transform:`translate3d(${unit(-direction*10)}px,0,0)`}],{duration:130,easing:'ease-out'},false);
  try{await chapterInfoMotion.finished;}catch{return;}
 }
 if(request!==chapterSwitchId||currentPage!=='chapters')return;
 info.innerHTML=chapterInfoMarkup();
 const outgoing=chapterInfoMotion;
 chapterInfoMotion=enter(info,{x:unit(direction*14),y:0,duration:460});
 if(outgoing){enterAnimations.delete(outgoing);outgoing.cancel();}
 if(chapterInfoMotion)try{await chapterInfoMotion.finished;}catch{}
}
async function selectChapter(index,{focus=false}={}){
 if(currentPage!=='chapters'||index<0||index>=CHAPTER_PREVIEWS.length)return;
 if(index===selectedChapter){uiSound.play('chapter',{level:.38,throttle:220});if(focus)$(`.chapter-card[data-chapter-index="${index}"]`)?.focus({preventScroll:true});return;}
 const direction=index>selectedChapter?1:-1;
 selectedChapter=index;
 uiSound.play('chapter',{level:.62,throttle:220});
 const chapter=activeChapter();const request=++chapterSwitchId;
 frame.dataset.chapter=String(chapter.number);frame.dataset.chapterTransition='changing';
 $$('.chapter-card').forEach((card,i)=>{const active=i===index;card.classList.toggle('is-selected',active);card.setAttribute('aria-pressed',String(active));card.tabIndex=active?0:-1;});
 $('#chapter-count').textContent=`${String(chapter.number).padStart(2,'0')} / ${CHAPTER_PREVIEWS.length}`;
 $('.chapter-actions [data-route="gameplay"] span').textContent=chapterProgress()>0?'继续游戏':'开始游戏';
 $('#chapter-announcement').textContent=`已选择第 ${chapter.number} 章，${chapter.name}`;
 if(focus)$(`.chapter-card[data-chapter-index="${index}"]`)?.focus({preventScroll:true});
 chapterRailMove?.(0,index);
 await Promise.all([switchChapterInfo(direction,request),switchChapterBackdrop(chapter,direction,request)]);
 if(request===chapterSwitchId&&currentPage==='chapters')frame.dataset.chapterTransition='ready';
}
function bindChapterRail(){
 const strip=$('.chapter-strip');if(!strip)return;
 const controller=new AbortController();const options={signal:controller.signal};
 let drag=null;let motionFrame=0;let wheelTarget=null;
 const maximum=()=>Math.max(0,strip.scrollWidth-strip.clientWidth);
 const clamp=value=>Math.max(0,Math.min(maximum(),value));
 const step=()=>unit(297);
 const update=()=>{chapterRailLeft=strip.scrollLeft;$('.chapter-rail-arrow-left').disabled=strip.scrollLeft<=1;$('.chapter-rail-arrow-right').disabled=strip.scrollLeft>=maximum()-1;};
 const stop=()=>{cancelAnimationFrame(motionFrame);motionFrame=0;strip.classList.remove('is-scrolling');};
 function scrollTo(left,duration=440){
  stop();const from=strip.scrollLeft;const to=clamp(left);
  if(motionPreference.matches||Math.abs(to-from)<1){strip.scrollLeft=to;wheelTarget=null;update();return;}
  strip.classList.add('is-scrolling');const start=performance.now();
  const tick=now=>{if(!strip.isConnected)return;const t=Math.min(1,(now-start)/duration);strip.scrollLeft=from+(to-from)*(1-(1-t)**4);update();if(t<1)motionFrame=requestAnimationFrame(tick);else{motionFrame=0;wheelTarget=null;strip.classList.remove('is-scrolling');update();}};
  motionFrame=requestAnimationFrame(tick);
 }
 chapterRailMove=(direction,index)=>{
  if(index!==undefined){const cell=strip.children[index];const margin=unit(18);if(cell.offsetLeft<strip.scrollLeft+margin)scrollTo(cell.offsetLeft-margin);else if(cell.offsetLeft+cell.offsetWidth>strip.scrollLeft+strip.clientWidth-margin)scrollTo(cell.offsetLeft+cell.offsetWidth-strip.clientWidth+margin);}
  else scrollTo(strip.scrollLeft+direction*step()*3);
 };
 strip.scrollLeft=clamp(chapterRailLeft);update();
 strip.addEventListener('scroll',update,{...options,passive:true});
 strip.addEventListener('dragstart',event=>event.preventDefault(),options);
 strip.addEventListener('wheel',event=>{
  if(Math.abs(event.deltaX)>Math.abs(event.deltaY)||event.shiftKey)return;
  event.preventDefault();wheelTarget=clamp((wheelTarget??strip.scrollLeft)+event.deltaY*.95);scrollTo(wheelTarget,330);
 },{...options,passive:false});
 strip.addEventListener('pointerdown',event=>{
  if(event.button!==0||event.pointerType!=='mouse')return;
  stop();wheelTarget=null;drag={id:event.pointerId,startX:event.clientX,startLeft:strip.scrollLeft,lastX:event.clientX,lastTime:event.timeStamp,velocity:0,moved:false};
 },options);
 strip.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.id)return;
  const distance=event.clientX-drag.startX;
  if(!drag.moved&&Math.abs(distance)>6){drag.moved=true;strip.classList.add('is-dragging');strip.setPointerCapture(event.pointerId);}
  if(!drag.moved)return;
  event.preventDefault();const elapsed=Math.max(1,event.timeStamp-drag.lastTime);drag.velocity=Math.max(-2,Math.min(2,(drag.lastX-event.clientX)/elapsed));drag.lastX=event.clientX;drag.lastTime=event.timeStamp;
  strip.scrollLeft=clamp(drag.startLeft-distance);update();
 },options);
 function endDrag(event){
  if(!drag||event.pointerId!==undefined&&event.pointerId!==drag.id)return;
  const finished=drag;drag=null;strip.classList.remove('is-dragging');
  if(strip.hasPointerCapture(finished.id))strip.releasePointerCapture(finished.id);
  if(finished.moved){ignoreChapterClickUntil=performance.now()+100;const velocity=event.timeStamp-finished.lastTime>100?0:finished.velocity;scrollTo(Math.round(clamp(strip.scrollLeft+velocity*180)/step())*step(),520);}
 }
 strip.addEventListener('pointerup',endDrag,options);strip.addEventListener('pointercancel',endDrag,options);window.addEventListener('blur',endDrag,options);
 chapterControlsCleanup=()=>{stop();controller.abort();strip.classList.remove('is-dragging');};
}
const storyTree = window.YorollStoryTree;
const storyStates = new Map();
let treeSwitchId = 0;
let treeDetailMotion = null;
const treeRouteMotions = new Map();
function currentStoryState(){
 if(!storyStates.has(selectedChapter))storyStates.set(selectedChapter,{node:'03',path:['01','03']});
 return storyStates.get(selectedChapter);
}
function storyDetailMarkup(node){
 return `<div class="eyebrow">片段 ${node.id} / 07</div><h2>${node.name}</h2><div class="tree-node-meta"><span>${node.route}</span><span>${node.explored?'已探索':'未探索'}</span></div><p>${node.description}</p>${button('从此处开始','restart-node','btn-small','play')}`;
}
function treeView(){
 const chapter=activeChapter(),graph=storyTree.create(chapter),state=currentStoryState();
 const {layout}=storyTree;
 const selected=graph.nodes.find(node=>node.id===state.node);
 const edges=graph.edges.map(([from,to])=>{
  const active=state.path.some((id,index)=>id===from&&state.path[index+1]===to);
  const a=graph.nodes.find(node=>node.id===from),b=graph.nodes.find(node=>node.id===to);
  const d=storyTree.linkPath(a,b),key=`${from}-${to}`;
  return `<path class="tree-link" d="${d}" pathLength="1" data-enter="tree-connection" data-tree-depth="${b.column}"/><path class="tree-route ${active?'is-active':''}" d="${d}" pathLength="1" data-tree-route="${key}"/>`;
 }).join('');
 const nodes=graph.nodes.map(node=>{
  const active=node.id===state.node,onRoute=state.path.includes(node.id);
  return `<div class="tree-node-cell" style="--node-x:${node.x};--node-y:${node.y}" data-enter="node" data-tree-depth="${node.column}" data-tree-row="${node.row}"><button class="tree-node ${active?'is-selected':''} ${onRoute?'is-route':''} ${node.explored?'':'is-unexplored'}" data-story-node="${node.id}" aria-pressed="${active}" tabindex="${active?0:-1}" aria-label="片段 ${node.id}，${node.name}，${node.explored?'已探索':'未探索'}，可重玩"><img src="${node.cover}" alt="" draggable="false"><span class="node-selection" aria-hidden="true"></span><div class="node-info"><span class="node-number">${node.id}_</span><strong>${node.name}</strong></div></button></div>`;
 }).join('');
 return `${pageHeading('剧情树','chapters',`CHAPTER ${String(chapter.number).padStart(2,'0')}`)}<div class="tree-layout"><div class="tree-graph" role="group" aria-label="第 ${chapter.number} 章的剧情分支"><div class="tree-board"><div class="tree-column-label" style="--column-x:20">起点</div><div class="tree-column-label" style="--column-x:445">分支</div><div class="tree-column-label" style="--column-x:870">汇合 / 结局</div><svg class="tree-connections" viewBox="0 0 ${layout.width} ${layout.height}" aria-hidden="true"><path class="tree-origin-line" d="M 4 362 H 20"/>${edges}</svg><div class="tree-root" data-enter="tree-line"></div>${nodes}</div></div><aside class="tree-detail" data-enter="detail"><div class="tree-detail-content">${storyDetailMarkup(selected)}</div></aside></div>${footer('<div class="tree-legend"><span><i class="legend-dot visited"></i> 已探索</span><span><i class="legend-dot"></i> 未探索</span><span><i class="legend-route"></i> 当前路线</span></div>','<span><span class="keycap">↑ ↓ ← →</span> 切换片段</span><span><span class="keycap">Enter</span> 从此处开始</span><span><span class="keycap">Esc</span> 返回</span>')}<div class="sr-only" id="tree-announcement" role="status" aria-live="polite"></div>`;
}
function updateStoryRoute(path){
 $$('.tree-route').forEach(line=>{
  const active=path.some((id,index)=>`${id}-${path[index+1]}`===line.dataset.treeRoute);
  const wasActive=line.classList.contains('is-active');
  line.classList.toggle('is-active',active);
  if(active===wasActive)return;
  for(const animation of [...enterAnimations])if(animation.effect?.target===line){enterAnimations.delete(animation);animation.cancel();}
  const previous=treeRouteMotions.get(line);
  if(previous){enterAnimations.delete(previous);previous.cancel();treeRouteMotions.delete(line);}
  if(!active||motionPreference.matches)return;
  const motion=animate(line,[{strokeDashoffset:1,opacity:0},{strokeDashoffset:0,opacity:1}],{duration:540,easing:'cubic-bezier(.22,.68,.25,1)'});
  treeRouteMotions.set(line,motion);
  motion?.finished.then(()=>{if(treeRouteMotions.get(line)===motion)treeRouteMotions.delete(line);}).catch(()=>{});
 });
}
async function switchStoryDetail(node,request){
 const detail=$('.tree-detail-content');if(!detail)return;
 const style=getComputedStyle(detail),pose={opacity:style.opacity,transform:style.transform};
 if(treeDetailMotion){enterAnimations.delete(treeDetailMotion);treeDetailMotion.cancel();treeDetailMotion=null;}
 if(!motionPreference.matches){
  treeDetailMotion=animate(detail,[pose,{opacity:0,transform:`translate3d(${unit(-8)}px,0,0)`}],{duration:100,easing:'ease-out'},false);
  try{await treeDetailMotion.finished;}catch{return;}
 }
 if(request!==treeSwitchId||currentPage!=='tree')return;
 detail.innerHTML=storyDetailMarkup(node);
 const outgoing=treeDetailMotion;
 treeDetailMotion=enter(detail,{x:unit(12),y:0,duration:420});
 if(outgoing){enterAnimations.delete(outgoing);outgoing.cancel();}
 if(treeDetailMotion)try{await treeDetailMotion.finished;}catch{return;}
 if(request===treeSwitchId&&currentPage==='tree'){frame.dataset.treeTransition='ready';treeDetailMotion=null;}
}
function selectStoryNode(id,{focus=false}={}){
 if(currentPage!=='tree')return;
 const graph=storyTree.create(activeChapter()),node=graph.nodes.find(item=>item.id===id);
 if(!node)return;
 const state=currentStoryState();
 if(state.node===id){if(focus)$(`[data-story-node="${id}"]`)?.focus({preventScroll:true});return;}
 state.node=id;state.path=storyTree.choosePath(graph,id,state.path);
 const request=++treeSwitchId;
 frame.dataset.treeNode=id;frame.dataset.treeTransition='changing';
 uiSound.play('chapter',{level:.5,throttle:220});
 $$('.tree-node').forEach(card=>{
  const selected=card.dataset.storyNode===id;
  card.classList.toggle('is-selected',selected);card.classList.toggle('is-route',state.path.includes(card.dataset.storyNode));
  card.setAttribute('aria-pressed',String(selected));card.tabIndex=selected?0:-1;
 });
 updateStoryRoute(state.path);
 if(focus)$(`[data-story-node="${id}"]`)?.focus({preventScroll:true});
 $('#tree-announcement').textContent=`已选择片段 ${id}，${node.name}，${node.route}`;
 switchStoryDetail(node,request);
}
function restartStoryNode(){
 const node=storyTree.create(activeChapter()).nodes.find(item=>item.id===currentStoryState().node);
 openModal({title:'从这个片段重新开始？',message:`将进入第 ${activeChapter().number} 章 · 片段 ${node.id}「${node.name}」。当前进度会先保留。`,confirm:'开始片段',onConfirm:()=>{playbackStoryNode={...node,chapter:selectedChapter};go('gameplay');toast(`已进入片段 ${node.id} · ${node.name}`);}});
}

function saveView(){
 return `${pageHeading('切换存档','home','SAVE FILES')}<section class="saves-layout"><div class="section-line" data-enter="section"><span>选择一个故事进度</span><span>本机存档 · ${slots.filter(Boolean).length} / 3</span></div><div class="saves-grid">${slots.map((save,index)=>`<div class="save-shell" data-enter="save"><button class="save-card ${index===activeSlot?'selected':''} ${save?'':'empty-save'}" data-action="save-${index}" aria-label="存档位 ${index+1}${save?'，'+save.chapter+'，'+sceneLabel(save):'，空档位'}">${save?`<div class="save-cover"><img src="assets/garage.jpg" alt=""><span class="save-slot">SAVE 0${index+1}</span>${index===activeSlot?'<span class="save-active">当前存档</span>':''}</div><div class="save-info"><h2>${save.chapter}</h2><p>${sceneLabel(save)}</p><div class="save-bottom"><span>${save.date}</span><strong>${save.progress}%</strong></div></div>`:`<div><span class="plus">＋</span><small>空档位 0${index+1}</small><p class="empty-note">开始一段新的故事</p></div>`}</button>${save?`<button class="delete-save" data-action="delete-${index}" aria-label="删除存档位 ${index+1}">${icon('trash')}</button>`:''}</div>`).join('')}</div></section>${footer('选择进度，继续故事')}`;
}
function settingsView(){
 return `${pageHeading('设置',previousPage==='pause'?'pause':'home','SETTINGS')}
 <section class="settings-layout"><div class="section-caption" data-enter="section">音频</div><div class="setting-group">
 ${settingsRows.map(([key,label])=>`<label class="setting-row" data-enter="setting"><span>${label}</span><input class="range" type="range" min="0" max="100" value="${settingState[key]}" data-setting="${key}" style="--value:${settingState[key]}%" aria-label="${label}"><output>${settingState[key]}%</output></label>`).join('')}
 <div class="setting-row sound-setting" data-enter="setting"><span>全部声音</span><div class="sound-controls"><button class="sound-state-button" data-action="sound-toggle" aria-label="全部声音" aria-pressed="${!audioMuted}"><span class="sound-indicator"></span><span data-sound-label>${audioMuted?'关闭':'开启'}</span></button><button class="sound-audition" data-action="audition-sound">${icon('volume')}试听音效</button></div></div></div>
 <div class="section-caption" data-enter="section">通用</div><div class="setting-row language" data-enter="setting"><span>语言</span><div class="select-wrap"><button class="select-button" id="language-select" aria-expanded="false" aria-haspopup="listbox"><span>${settingState.language}</span>${icon('chevron')}</button><div class="select-options" id="language-options" role="listbox" aria-label="语言" hidden>${['跟随系统','简体中文','English','日本語'].map(label=>`<button role="option" aria-selected="${label===settingState.language}" data-language="${label}">${label}${label===settingState.language?icon('check'):''}</button>`).join('')}</div></div></div><p class="settings-note" data-enter="footer">主音量控制整体 · 音效与音乐分别调节</p></section>${footer(button('恢复默认','reset-settings','btn-small'),'<span><span class="keycap">Esc</span> 返回</span>')}`;
}
function playbackLabel(){return playbackStoryNode?.chapter===selectedChapter?`片段 ${playbackStoryNode.id} · ${playbackStoryNode.name}`:activeChapter().name;}
function hud(){const chapter=activeChapter();return `<div class="game-hud"><div class="hud-scene" data-enter="heading">第 ${chapter.number} 章 <span>·</span> ${playbackLabel()}</div><div class="hud-actions"><div data-enter="header">${soundButton()}</div><div data-enter="header"><button class="icon-button" data-route="pause" aria-label="暂停">${icon('pause')}</button></div></div></div>`;}
function gameplayView(){return `${hud()}<div class="subtitle" data-enter="subtitle"><span class="speaker">车手</span><span id="subtitle-text">准备好了，就出发吧。</span></div><div class="playback-bar" data-enter="footer"><div class="playback-status"><button class="play-control" data-action="playback" aria-label="${playbackPaused?'继续播放':'暂停播放'}">${icon(playbackPaused?'play':'pause')}<span>${playbackPaused?'已暂停':'播放中'}</span></button><div class="playback-track"><span id="play-progress"></span></div></div><button class="play-control" data-route="choice">继续 ${icon('arrow')}</button></div>`;}
function pauseView(){return `${pageHeading('暂停','gameplay')}<nav class="pause-menu"><div class="eyebrow" data-enter="pause">STORY PAUSED</div><h1 data-enter="pause">片刻停留</h1><div class="pause-list">${[['继续游戏','gameplay'],['剧情树','tree'],['切换存档','saves'],['设置','settings'],['返回主菜单','home']].map(([label,route])=>`<div data-enter="pause"><button data-route="${route}">${label}${icon('arrow')}</button></div>`).join('')}</div></nav>${footer(`第 ${activeChapter().number} 章 · ${playbackLabel()}`,'<span><span class="keycap">Esc</span> 继续游戏</span>')}`;}
function choiceView(){return `${hud()}<section class="choice-panel"><div class="eyebrow" data-enter="choice-title">做出你的选择</div><h2 data-enter="choice-title">前面的路，由你决定。</h2><div class="choice-options">${['全力加速，抢占内线','稳住节奏，等待机会'].map((label,index)=>`<div data-enter="choice"><button class="choice-option" data-action="choice-${index}"><span class="choice-number">0${index+1}</span><span>${label}</span><span class="choice-arrow">${icon('arrow')}</span></button></div>`).join('')}</div><div data-enter="choice-time"><div class="choice-time"><span id="choice-progress"></span></div><div class="choice-meta"><span>限时选择</span><button class="time-toggle" data-action="choice-timer" aria-pressed="false">暂停计时</button></div></div></section>${footer('','<span><span class="keycap">1</span> / <span class="keycap">2</span> 选择</span><span><span class="keycap">Esc</span> 暂停</span>')}`;}
function qteView(){return `${hud()}<div class="subtitle qte-subtitle" data-enter="subtitle"><span class="speaker">把握时机</span>在弯道前完成换挡。</div><div class="qte-widget" data-enter="qte"><div class="qte-ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="56"/><circle id="qte-progress" cx="60" cy="60" r="56"/></svg><button class="qte-key" data-action="qte-hit" aria-label="完成换挡，按 E">E</button></div><div class="qte-label">换挡</div><div class="qte-tip">按下 E 或点击</div></div>${footer('','<span><span class="keycap">E</span> 换挡</span><span><span class="keycap">Esc</span> 暂停</span>')}`;}
function resultView(){return `${pageHeading('章节结果','chapters','CHAPTER COMPLETE')}<section class="result-layout"><div class="eyebrow" data-enter="result">CHAPTER ${String(activeChapter().number).padStart(2,'0')} / COMPLETE</div><h1 data-enter="result">顺利抵达</h1><p data-enter="result">每一次选择，都让故事走向不同的远方。</p><dl class="result-stats"><div data-enter="result"><dt>章节进度</dt><dd><span data-count="100">100</span>%</dd></div><div data-enter="result"><dt>关键选择</dt><dd>02</dd></div><div data-enter="result"><dt>完成评级</dt><dd>A</dd></div></dl><div class="result-actions"><div data-enter="action">${goButton('查看剧情树','tree','','tree')}</div><div data-enter="action">${goButton('返回章节','chapters','btn-primary','arrow')}</div></div></section>${footer('')}`;}
const renders={splash:splashView,home:()=>homeView(),cover:()=>homeView(true),chapters:chaptersView,tree:treeView,saves:saveView,settings:settingsView,logout:()=>homeView(),gameplay:gameplayView,pause:pauseView,choice:choiceView,qte:qteView,result:resultView,exit:()=>homeView()};
function setScene(page){
 const fragment=['gameplay','pause','choice','qte','result'].includes(page)&&playbackStoryNode?.chapter===selectedChapter?playbackStoryNode:null;
 const key=fragment?`story-${selectedChapter}-${fragment.id}`:['home','exit','saves','profile','settings','logout'].includes(page)?'wall':page==='cover'?'cover':`chapter-${selectedChapter}`;
 if(key!==sceneKey){
  sceneKey=key;
  if(key==='wall'){scene.className='scene scene-wall';scene.innerHTML='<iframe src="wall/index.html?clean" title="默认海报动态背景" tabindex="-1" aria-hidden="true"></iframe>';}
  else if(key==='cover'){scene.className='scene';scene.innerHTML='<img src="wall/assets/nocturne-cover.webp" alt="">';}
  else{const chapter=activeChapter(),image=fragment||chapter;scene.className='scene';scene.innerHTML=`<img class="chapter-background" data-chapter-index="${selectedChapter}" src="${image.cover}" alt="" style="object-position:${image.position||'50% center'}">`;}
 }
 frame.classList.remove('tree-backdrop','settings-backdrop','saves-backdrop','profile-backdrop');
 if(['tree','settings','saves','profile','pause'].includes(page))frame.classList.add((page==='pause'?'tree':page)+'-backdrop');
}
function animateScene(){
 const image=scene.querySelector(':scope > img');
 if(!image)return;
 const amount=currentPage==='cover' ? .035 : .025;
 const pose=getComputedStyle(image).transform;
 const startScale=image.classList.contains('chapter-background')&&pose!=='none'?new DOMMatrixReadOnly(pose).a:1;
 const frames=Array.from({length:121},(_,i)=>{const t=i/120;const progress=t**3*(35+t*(-105+t*(126+t*(-70+15*t))));return {offset:t,transform:`scale(${startScale+(1+amount-startScale)*progress})`};});
 animate(image,frames,{duration:3600,easing:'linear'},false);
}
function enterPage(){
 const reduced=motionPreference.matches;
 if(reduced)return;
 $$('[data-enter="brand"]').forEach(el=>enter(el,{y:0,delay:20,duration:550}));
 $$('[data-enter="header"]').reverse().forEach((el,i)=>enter(el,{x:unit(24),y:0,delay:45+i*65,duration:500}));
 $$('[data-enter="menu"]').forEach((el,i)=>enter(el,{y:unit(-22),delay:50+i*65,duration:560}));
 $$('[data-enter="heading"]').forEach(el=>enter(el,{x:unit(-18),y:0,delay:30,duration:560}));
 $$('[data-enter="meta"]').forEach(el=>enter(el,{x:unit(18),y:0,delay:90,duration:580}));
 const groups={ 'chapter-copy':[140,65], 'chapter-card':[300,45], action:[310,65], section:[140,60], setting:[160,42], save:[170,65], profile:[150,55], pause:[100,50], 'choice-title':[130,70],choice:[260,70], 'choice-time':[430,40],result:[140,60] };
 for(const [name,[delay,step]] of Object.entries(groups))$$(`[data-enter="${name}"]`).forEach((el,i)=>enter(el,{y:unit(18),delay:delay+i*step,duration:650}));
 $$('[data-enter="tree-line"]').forEach(el=>enter(el,{y:0,delay:140,duration:550}));
 $$('[data-enter="tree-connection"]').forEach(el=>animate(el,[{strokeDashoffset:1,opacity:0},{strokeDashoffset:0,opacity:1}],{duration:650,delay:180+Number(el.dataset.treeDepth)*80,easing:'cubic-bezier(.22,.68,.25,1)'}));
 $$('.tree-route.is-active').forEach(el=>animate(el,[{strokeDashoffset:1,opacity:0},{strokeDashoffset:0,opacity:1}],{duration:680,delay:250,easing:'cubic-bezier(.22,.68,.25,1)'}));
 $$('[data-enter="node"]').forEach(el=>enter(el,{y:unit(20),scale:.99,delay:180+Number(el.dataset.treeDepth)*85+Number(el.dataset.treeRow)*20,duration:680}));
 $$('[data-enter="detail"]').forEach(el=>enter(el,{x:unit(20),y:0,delay:310,duration:720}));
 $$('[data-enter="footer"]').forEach(el=>enter(el,{y:unit(8),delay:320,duration:620}));
 $$('[data-enter="subtitle"]').forEach(el=>enter(el,{y:unit(12),delay:250,duration:680}));
 $$('[data-enter="qte"]').forEach(el=>enter(el,{y:unit(14),scale:.94,delay:280,duration:650,blur:2}));
 $$('[data-enter="splash-logo"]').forEach(el=>enter(el,{y:unit(10),scale:.97,duration:1500,blur:3}));
 $$('[data-enter="splash-start"]').forEach(el=>enter(el,{y:unit(10),delay:600,duration:1100}));
 $$('[data-enter="wordmark"]').forEach(el=>enter(el,{y:unit(18),scale:.975,blur:5,delay:200,duration:1600}));
 animateScene();
}
async function go(page,{replace=false,skipExit=false}={}){
 if(!renders[page])page='home';
 const id=++transitionId;
 const old=currentPage;
 cancelPendingHover();
 if(screen.children.length&&page!==old)uiSound.play('transition',{level:.85,delay:.03});
 closeModal(true);
 if(!skipExit&&!motionPreference.matches&&screen.children.length){
  screen.setAttribute('aria-busy','true');
  const exit=screen.animate([{opacity:1,transform:'translate3d(0,0,0)'},{opacity:0,transform:`translate3d(0,${unit(-8)}px,0)`}],{duration:150,easing:'cubic-bezier(.4,0,1,1)',fill:'both'});
  try{await exit.finished;}catch{}
  exit.cancel();
 }
 if(id!==transitionId)return;
 if(old==='chapters')disposeChapterControls();
 cancelPageMotion();
 previousPage=old;
 if(page==='gameplay'&&['home','cover','chapters','splash'].includes(old))playbackStoryNode=null;
 currentPage=page;
 frame.dataset.page=page;
 frame.dataset.chapter=String(selectedChapter+1);frame.dataset.chapterTransition='ready';
 frame.dataset.entryState='entering';
 screen.innerHTML=renders[page]();
 screen.setAttribute('aria-busy','false');
 screen.setAttribute('aria-label',pageNames[page]);
 setScene(page);
 document.title=`${pageNames[page]} · Yoroll UI 动效改版`;
 const url=new URL(location.href);url.searchParams.set('page',page);
 if(replace)history.replaceState({page},'',url);else history.pushState({page},'',url);
 $$('#review-pages button').forEach(b=>{if(b.dataset.route===page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 window.YorollMusic.setScene(page);
 enterPage();
 timeout(()=>{frame.dataset.entryState='ready';},motionPreference.matches?0:page==='cover'?1900:page==='splash'?1800:page==='result'?1600:page==='chapters'?1600:1100);
 bindPageControls();
 if(page==='exit')timeout(showExit,180);
 if(page==='logout')timeout(showLogout,180);
 if(page==='choice')startChoiceTimer();
 if(page==='qte')startQte();
 if(page==='gameplay')startPlayback();
 if(page==='result')animateCounters();
 $('#review-panel').hidden=true;$('#review-toggle').setAttribute('aria-expanded','false');
}
function bindPageControls(){
 if(currentPage==='chapters')bindChapterRail();
 if(currentPage==='tree'){frame.dataset.treeNode=currentStoryState().node;frame.dataset.treeTransition='ready';}
 applySoundLevels();
 $$('.range').forEach(input=>input.addEventListener('input',()=>{settingState[input.dataset.setting]=Number(input.value);input.style.setProperty('--value',`${input.value}%`);input.parentElement.querySelector('output').textContent=`${input.value}%`;applySoundLevels();uiSound.play('hover',{level:.45,throttle:180});}));
 $('#language-select')?.addEventListener('click',()=>{
  const options=$('#language-options');options.hidden=!options.hidden;
  $('#language-select').setAttribute('aria-expanded',String(!options.hidden));
  if(!options.hidden){enter(options,{y:-7,duration:240});options.querySelector('[aria-selected="true"]')?.focus();}
 });
}
let choiceAnimation;
function startChoiceTimer(){
 choicePaused=false;
 const bar=$('#choice-progress');
 if(!bar)return;
 // Timed interactions stay timed when reduced-motion is enabled.
 choiceAnimation=track(bar.animate([{transform:'scaleX(1)'},{transform:'scaleX(0)'}],{duration:16000,delay:800,easing:'linear',fill:'both'}),false);
 choiceAnimation.finished.then(()=>{if(currentPage==='choice')choose(1,true);}).catch(()=>{});
}
let qteAnimation;
function startQte(){
 qteDone=false;
 const circle=$('#qte-progress');if(!circle)return;
 qteAnimation=track(circle.animate([{strokeDashoffset:'0'},{strokeDashoffset:'352'}],{duration:8000,delay:700,easing:'linear',fill:'both'}),false);
 qteAnimation.finished.then(()=>{if(currentPage==='qte'&&!qteDone){qteDone=true;toast('再来一次，把握下一个时机');timeout(()=>go('qte',{skipExit:true}),1400);}}).catch(()=>{});
}
function choose(index,timedOut=false){
 if(currentPage!=='choice')return;
 uiSound.play(timedOut?'select':'confirm');
 choiceAnimation?.pause();
 $$('.choice-option').forEach(b=>{b.disabled=true;});
 const selected=$$('.choice-option')[index];
 animate(selected,[{background:'#263731d9',borderColor:'#e3ddc6a3'},{background:'#d8c7a52e',borderColor:'#e3ddc6a3'}],{duration:340,easing:'ease-out'},false);
 toast(timedOut?'已沿当前路线继续':'选择已记录');
 timeout(()=>go('qte'),650);
}
function qteHit(){
 if(currentPage!=='qte'||qteDone)return;
 uiSound.play('success');
 qteDone=true;qteAnimation?.pause();
 const button=$('.qte-key');button.innerHTML=icon('check');button.disabled=true;
 $('.qte-label').textContent='换挡成功';$('.qte-tip').textContent='继续前进';
 animate($('.qte-widget'),[{transform:'scale(.97)'},{transform:'scale(1)'}],{duration:450,easing:'cubic-bezier(.16,1,.3,1)'});
 timeout(()=>go('result'),1100);
}
let playAnimation;
function startPlayback(){
 const progress=$('#play-progress');if(!progress)return;
 playAnimation=track(progress.animate([{width:'12%'},{width:'100%'}],{duration:24000,easing:'linear',fill:'both'}),false);
 if(playbackPaused)playAnimation.pause();
 playAnimation.finished.then(()=>{if(currentPage==='gameplay')go('choice');}).catch(()=>{});
}
function animateCounters(){
 $$('[data-count]').forEach(el=>{
  const target=Number(el.dataset.count);if(motionPreference.matches){el.textContent=String(target);return;}
  const start=performance.now()+320;
  function tick(now){if(currentPage!=='result'||!el.isConnected)return;const t=Math.max(0,Math.min(1,(now-start)/1100));el.textContent=String(Math.round(target*(1-(1-t)**4)));if(t<1)requestAnimationFrame(tick);}
  requestAnimationFrame(tick);
 });
}
function toast(message){
 const el=$('#toast');el.innerHTML=icon('check')+`<span>${message}</span>`;
 savedToastAnimation?.cancel();
 savedToastAnimation=el.animate([{opacity:0,transform:'translateY(8px)',offset:0},{opacity:1,transform:'translateY(0)',offset:.12},{opacity:1,transform:'translateY(0)',offset:.78},{opacity:0,transform:'translateY(-4px)',offset:1}],{duration:2600,fill:'both',easing:'ease'});
}
function openModal({title,message,confirm='确认',onConfirm,eyebrow='CONFIRM',danger=false}){
 closeModal(true);
 uiSound.play('open',{level:.8});
 modalPreviousFocus=document.activeElement;
 confirmAction=onConfirm;
 modalRoot.innerHTML=`<div class="modal-scrim"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-message"><div class="eyebrow">${eyebrow}</div><h2 id="modal-title">${title}</h2><p id="modal-message">${message}</p><div class="modal-actions">${button('取消','modal-cancel','btn-small')}${button(confirm,'modal-confirm',`btn-small ${danger?'':'btn-primary'}`)}</div></section></div>`;
 screen.inert=true;
 enter($('.modal-scrim'),{y:0,duration:220});
 enter($('.modal'),{y:unit(16),scale:.99,duration:420});
 $('.modal [data-action="modal-cancel"]').focus({preventScroll:true});
}
async function closeModal(immediate=false){
 if(!modalRoot.firstElementChild){screen.inert=false;return;}
 if(!immediate)uiSound.play('back');
 const node=modalRoot.firstElementChild;
 confirmAction=null;
 if(!immediate&&!motionPreference.matches){const a=node.animate([{opacity:1},{opacity:0}],{duration:150,fill:'both'});await a.finished.catch(()=>{});}
 if(node.isConnected)node.remove();
 screen.inert=false;
 if(!immediate&&modalPreviousFocus?.isConnected)modalPreviousFocus.focus({preventScroll:true});
}
function showExit(){openModal({title:'离开当前故事？',message:'当前进度已保存在本地。你可以随时回来继续。',confirm:'退出',eyebrow:'LEAVE STORY',onConfirm:()=>{go('splash');}});}
function saveAction(index){
 if(!slots[index])openModal({title:`启用存档位 ${index+1}？`,message:'新的故事将从第 1 章开始。现有存档会保留。',confirm:'开始新故事',onConfirm:()=>{slots[index]={chapter:'第 1 章',scene:'race-start-1',date:'刚刚',progress:0};activeSlot=index;selectedChapter=0;chapterRailLeft=0;go('chapters');toast('新的本地演示存档已建立');}});
 else if(index===activeSlot){uiSound.play('click',{level:.75});toast('已在使用这个存档');}
 else openModal({title:'切换到这个存档？',message:`将从${slots[index].chapter}的进度继续。`,confirm:'切换存档',onConfirm:()=>{activeSlot=index;go('saves',{skipExit:true});toast('已切换存档');}});
}
function deleteAction(index){openModal({title:'删除这个存档？',message:'删除后将无法从这个存档继续。其他存档不受影响。',confirm:'删除存档',danger:true,onConfirm:()=>{slots[index]=null;go('saves',{skipExit:true});toast('本地演示存档已删除');}});}
function showLogout(){openModal({title:'退出当前账号？',message:'退出后，当前设备上的故事进度仍会保留。',confirm:'退出登录',eyebrow:'ACCOUNT',onConfirm:()=>{signedIn=false;go('home');toast('已退出账号');}});}
const actions={
 'logout':()=>{if(signedIn)showLogout();else openModal({title:'登录以同步故事进度',message:'使用演示账号，继续体验你的故事。',confirm:'体验演示账号',eyebrow:'ACCOUNT',onConfirm:()=>{signedIn=true;go('home');toast('欢迎回来');}});},
 'chapter-scroll-left':()=>chapterRailMove?.(-1),
 'chapter-scroll-right':()=>chapterRailMove?.(1),
 'restart-node':restartStoryNode,
 'reset-settings':()=>{Object.assign(settingState,{master:100,video:100,sfx:100,music:100,language:'跟随系统'});audioMuted=false;applySoundLevels();uiSound.play('confirm');go('settings',{skipExit:true});toast('已恢复默认设置');},
 'modal-cancel':()=>closeModal(),
 'modal-confirm':()=>{const fn=confirmAction;closeModal(true);fn?.();},
 'choice-0':()=>choose(0),'choice-1':()=>choose(1),
 'choice-timer':()=>{choicePaused=!choicePaused;if(choicePaused)choiceAnimation?.pause();else choiceAnimation?.play();const b=$('[data-action="choice-timer"]');b.textContent=choicePaused?'继续计时':'暂停计时';b.setAttribute('aria-pressed',String(choicePaused));},
 'qte-hit':qteHit,
 'mute':toggleInterfaceSound,
 'sound-toggle':toggleInterfaceSound,
 'audition-sound':()=>uiSound.audition(),
 'restart-music':()=>{uiSound.setPreviewPaused(false);window.YorollMusic.replayOpening();},
 'toggle-preview-audio':()=>uiSound.setPreviewPaused(document.documentElement.dataset.audioPreviewPaused!=='true'),
 'playback':()=>{playbackPaused=!playbackPaused;if(playbackPaused)playAnimation?.pause();else playAnimation?.play();const b=$('[data-action="playback"]');b.innerHTML=icon(playbackPaused?'play':'pause')+`<span>${playbackPaused?'已暂停':'播放中'}</span>`;b.setAttribute('aria-label',playbackPaused?'继续播放':'暂停播放');}
};
// Only deliberate controls sound; scrolling and dragging stay quiet.
let keyboardFocusSound=false;
let hoverSoundTimer=0;
let hoveredSoundControl=null;
const soundControl=target=>target.closest('button,a,input[type="range"]');
const hoverLevel=control=>control.matches('.chapter-card,.tree-node') ? .48 : .68;
function cancelPendingHover(){clearTimeout(hoverSoundTimer);hoverSoundTimer=0;hoveredSoundControl=null;}
document.addEventListener('pointerdown',()=>{keyboardFocusSound=false;cancelPendingHover();},{capture:true});
document.addEventListener('keydown',event=>{keyboardFocusSound=event.key==='Tab';cancelPendingHover();},{capture:true});
document.addEventListener('pointerover',event=>{
 const control=soundControl(event.target);
 if(!control||control.disabled||control.getAttribute('aria-disabled')==='true'||event.buttons||control.contains(event.relatedTarget)||$('.chapter-strip.is-dragging'))return;
 if(control.closest('#screen')&&frame.dataset.entryState!=='ready')return;
 if(control.closest('.chapter-strip')&&performance.now()<ignoreChapterClickUntil)return;
 cancelPendingHover();hoveredSoundControl=control;
 hoverSoundTimer=setTimeout(()=>{hoverSoundTimer=0;if(hoveredSoundControl===control&&control.isConnected&&control.matches(':hover')&&!document.hidden)uiSound.play('hover',{level:hoverLevel(control)});},70);
});
document.addEventListener('pointerout',event=>{if(hoveredSoundControl&&hoveredSoundControl.contains(event.target)&&!hoveredSoundControl.contains(event.relatedTarget))cancelPendingHover();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelPendingHover();});
document.addEventListener('focusin',event=>{const control=soundControl(event.target);if(keyboardFocusSound&&control&&!control.disabled)uiSound.play('hover',{level:hoverLevel(control)});});
document.addEventListener('click',event=>{
 const control=event.target.closest('button,a');
 if(!control||control.disabled||control.getAttribute('aria-disabled')==='true')return;
 if(control.hasAttribute('data-route')){if(control.dataset.route===currentPage)uiSound.play('click',{level:.75});return;}
 if(control.matches('.chapter-card,.tree-node,[data-action="mute"],[data-action="sound-toggle"],[data-action="audition-sound"],[data-action="restart-music"],[data-action="modal-cancel"],[data-action="qte-hit"],[data-action="choice-0"],[data-action="choice-1"],[data-action="reset-settings"],[data-action="logout"],[data-action="restart-node"],[data-action^="delete-"],[data-action^="save-"],#replay'))return;
 uiSound.play(control.dataset.action==='modal-confirm'?'confirm':control.hasAttribute('data-language')?'select':'click',{level:.9});
},{capture:true});
document.addEventListener('click',event=>{
 const storyCard=event.target.closest('[data-story-node]');
 if(storyCard){selectStoryNode(storyCard.dataset.storyNode);return;}
 const chapterCard=event.target.closest('.chapter-card[data-chapter-index]');
 if(chapterCard){if(performance.now()<ignoreChapterClickUntil){event.preventDefault();return;}selectChapter(Number(chapterCard.dataset.chapterIndex));return;}
 const route=event.target.closest('[data-route]');if(route){go(route.dataset.route);return;}
 const lang=event.target.closest('[data-language]');if(lang){settingState.language=lang.dataset.language;$('#language-select span').textContent=settingState.language;$('#language-options').hidden=true;$('#language-select').setAttribute('aria-expanded','false');$('#language-select').focus();$$('[data-language]').forEach(b=>b.setAttribute('aria-selected',String(b===lang)));return;}
 const action=event.target.closest('[data-action]');if(action){const name=action.dataset.action;if(name.startsWith('save-'))saveAction(Number(name.slice(5)));else if(name.startsWith('delete-'))deleteAction(Number(name.slice(7)));else actions[name]?.();return;}
 if(event.target.classList.contains('modal-scrim'))closeModal();
 if(currentPage==='splash'&&!event.target.closest('.review-panel,.review-toggle'))go('home');
 if(!event.target.closest('.select-wrap')&&$('#language-options')){$('#language-options').hidden=true;$('#language-select').setAttribute('aria-expanded','false');}
});
document.addEventListener('keydown',event=>{
 if(modalRoot.firstElementChild){
  if(event.key==='Escape'){event.preventDefault();closeModal();return;}
  if(event.key==='Tab'){const focusables=Array.from(modalRoot.querySelectorAll('button'));const first=focusables[0],last=focusables[focusables.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
  return;
 }
 if(event.target.matches('input,select'))return;
 if(event.key==='Escape'){
  event.preventDefault();
  if(!$('#review-panel').hidden){uiSound.play('back');$('#review-panel').hidden=true;$('#review-toggle').setAttribute('aria-expanded','false');return;}
  if($('#language-options')&&!$('#language-options').hidden){uiSound.play('back');$('#language-options').hidden=true;$('#language-select').setAttribute('aria-expanded','false');return;}
  if(currentPage==='pause')go('gameplay');else if(['gameplay','choice','qte'].includes(currentPage))go('pause');else if(currentPage==='tree'||currentPage==='result')go('chapters');else if(currentPage==='settings'&&previousPage==='pause')go('pause');else if(currentPage!=='home')go('home');else showExit();
 }
 if(currentPage==='splash'&&(event.key==='Enter'||event.key===' ')){event.preventDefault();go('home');}
 if(currentPage==='tree'&&!event.metaKey&&!event.ctrlKey){
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)){
   event.preventDefault();const state=currentStoryState();selectStoryNode(storyTree.nextNode(storyTree.create(activeChapter()),state.node,event.key,state.path),{focus:true});return;
  }
  if(event.key==='Enter'&&(!event.target.closest('button,a')||event.target.closest('.tree-node'))){event.preventDefault();restartStoryNode();return;}
 }
 if(currentPage==='chapters'&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)&&!event.metaKey&&!event.ctrlKey){event.preventDefault();const index=event.key==='Home'?0:event.key==='End'?CHAPTER_PREVIEWS.length-1:Math.max(0,Math.min(CHAPTER_PREVIEWS.length-1,selectedChapter+(event.key==='ArrowRight'?1:-1)));selectChapter(index,{focus:true});return;}
 if(currentPage==='chapters'&&event.key==='Enter'&&(!event.target.closest('button')||event.target.closest('.chapter-card'))){event.preventDefault();go('gameplay');}
 if(currentPage==='choice'&&(event.key==='1'||event.key==='2'))choose(Number(event.key)-1);
 if(currentPage==='qte'&&event.key.toLowerCase()==='e')qteHit();
 if(event.key.toLowerCase()==='r'&&!event.target.closest('button'))replay();
});
function replay(){if(['home','cover','splash'].includes(currentPage)){uiSound.setPreviewPaused(false);window.YorollMusic.replayOpening();}else uiSound.play('transition',{level:.7});if(currentPage==='chapters')disposeChapterControls();cancelPageMotion();const image=scene.querySelector(':scope > img');if(image)image.style.transform='scale(1)';screen.innerHTML=renders[currentPage]();enterPage();bindPageControls();if(currentPage==='choice')startChoiceTimer();if(currentPage==='qte')startQte();if(currentPage==='gameplay')startPlayback();if(currentPage==='result')animateCounters();if(currentPage==='exit')showExit();if(currentPage==='logout')showLogout();if(sceneKey==='wall')scene.querySelector('iframe')?.contentWindow.location.reload();}
$('#review-pages').innerHTML=pages.map(([id,name],i)=>`<button data-route="${id}"><small>${String(i+1).padStart(2,'0')}</small>${name}</button>`).join('');
$('#review-toggle').addEventListener('click',()=>{const p=$('#review-panel');p.hidden=!p.hidden;$('#review-toggle').setAttribute('aria-expanded',String(!p.hidden));if(!p.hidden)enter(p,{x:8,y:8,duration:260});});
$('#review-close').addEventListener('click',()=>{$('#review-panel').hidden=true;$('#review-toggle').setAttribute('aria-expanded','false');});
$('#replay').addEventListener('click',()=>{replay();$('#review-panel').hidden=true;$('#review-toggle').setAttribute('aria-expanded','false');});
window.addEventListener('popstate',()=>go(new URLSearchParams(location.search).get('page')||'home',{replace:true,skipExit:true}));
document.addEventListener('visibilitychange',()=>{
 for(const a of enterAnimations){if(a.playState==='finished'||a.playState==='idle')continue;if(document.hidden)a.pause();else if(!(a===choiceAnimation&&choicePaused)&&!(a===playAnimation&&playbackPaused))a.play();}
});
async function startPreview(){
 const page=params.get('page')||'home';
 frame.dataset.entryState='preparing';
 try{await window.YorollMusic.prepareEntry(page);}catch{}
 go(page,{replace:true,skipExit:true});
}
startPreview();
