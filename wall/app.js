/* Platform-provided 3:4 artwork already includes each game's title. */
const POSTERS = [
  {key:'cover-040',src:'assets/covers/cover-040.webp'},
  {key:'cover-041',src:'assets/covers/cover-041.webp'},
  {key:'cover-042',src:'assets/covers/cover-042.webp'},
  {key:'cover-043',src:'assets/covers/cover-043.webp'},
  {key:'cover-044',src:'assets/covers/cover-044.webp'},
  {key:'cover-046',src:'assets/covers/cover-046.webp'},
  {key:'cover-047',src:'assets/covers/cover-047.webp'},
  {key:'cover-049',src:'assets/covers/cover-049.webp'},
  {key:'cover-186',src:'assets/covers/cover-186.webp'},
  {key:'cover-187',src:'assets/covers/cover-187.webp'},
  {key:'cover-188',src:'assets/covers/cover-188.webp'},
  {key:'cover-190',src:'assets/covers/cover-190.webp'},
  {key:'cover-191',src:'assets/covers/cover-191.webp'},
  {key:'cover-192',src:'assets/covers/cover-192.webp'},
  {key:'cover-193',src:'assets/covers/cover-193.webp'}
];
const root = document.documentElement;
const experience = document.querySelector('#experience');
const gallery = document.querySelector('#gallery');
const arrival = document.querySelector('#arrival');
const entryTrack = document.querySelector('#entry-track');
const coverScene = document.querySelector('#cover-scene');
const coverImage = document.querySelector('#cover-image');
const coverLogo = document.querySelector('#cover-logo');
const coverLogoImage = document.querySelector('#cover-logo-image');
const backgroundButtons = Array.from(document.querySelectorAll('button[data-background-mode]'));
const backgroundConfig = window.YOROLL_BACKGROUND_CONFIG || {};
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const replayButton = document.querySelector('#replay');
const pauseButton = document.querySelector('#pause');
const settings = document.querySelector('#settings');
const settingsToggle = document.querySelector('#settings-toggle');
const announcement = document.querySelector('#announcement');
const menuLabels = Array.from(document.querySelectorAll('.menu-label'));
const headerActionEntries = Array.from(document.querySelectorAll('.header-action-entry'));
const CARD_WIDTH = 216;
const CARD_HEIGHT = 288;
const COLUMN_STEP = CARD_WIDTH + 20;
const ROW_STEP = CARD_HEIGHT + 24;
const POSTER_ORDER = [0,9,4,2,7,12,5,10,3,13,1,14,8,6,11];
const COLUMN_HEADS = [.12,1.1,.43,1.72,.02,1.36,.78,2.1,.29,1.58,.92,.06];
const FLIGHT_DURATION = 2200;
const ENTRY_DURATION = FLIGHT_DURATION+300;
const COVER_DURATION = 3600;
const COVER_SCALE = 1.035;
const ENTRY_STAGGER = 520;
const ENTRY_EASING = 'cubic-bezier(.42, 0, .22, 1)';
const SURFACE_STEPS = 96;
let gridShape = '';
const posterEntries = [];
const entryAnimations = [];
// Use the same transform at rest and at the end of the entrance. Retaining
// its compositor animation avoids a layer teardown as the cards settle.
const CARD_REST_TRANSFORM = 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)';
const GALLERY_REST_TRANSFORM = 'translate(-50%, -50%) rotateX(0deg) rotateY(0deg) rotateZ(0deg) scale(var(--scene-scale))';
const ARRIVAL_REST_TRANSFORM = 'translate3d(0px, 0px, 0px) scale(1)';
let paused = reducedMotion.matches;
const previewParams = new URLSearchParams(location.search);
let backgroundMode = previewParams.has('default')?'default':
  (previewParams.has('cover')||backgroundConfig.cover?.src?'cover':'default');
let backgroundRequest = 0;
const clean = previewParams.has('clean');
let immersive = previewParams.has('background') || clean;
experience.classList.toggle('clean',clean);
experience.dataset.entryDirection='bottom';
let replayTimer = null;

function fillGallery(){
  // Keep the accepted surface size. Individual column heads and lengths vary,
  // while a shared coverage band guarantees full bleed at the landing pose.
  const columns = Math.ceil(experience.clientWidth / COLUMN_STEP) + 2;
  const rows = Math.ceil(experience.clientHeight / ROW_STEP) + 2;
  const nextShape = `${columns}:${rows}`;
  if(nextShape === gridShape)return;
  gridShape = nextShape;
  const width = columns*COLUMN_STEP - 20;
  const height = rows*ROW_STEP - 24;
  gallery.style.width = `${width}px`;
  gallery.style.height = `${height}px`;
  const coverageHeight = (rows-2)*ROW_STEP;
  const coverageTop = (height-coverageHeight)/2;
  const coverageBottom = coverageTop+coverageHeight+120;
  posterEntries.length = 0;
  const fragment = document.createDocumentFragment();
  for(let c=0;c<columns;c++){
    const head = coverageTop-120-COLUMN_HEADS[c%COLUMN_HEADS.length]*ROW_STEP;
    const count = Math.ceil((coverageBottom-head-CARD_HEIGHT)/ROW_STEP)+1;
    for(let r=0;r<count;r++){
      const poster = POSTERS[POSTER_ORDER[(c+r*2+Math.floor(r/2))%POSTER_ORDER.length]];
      const index = posterEntries.length;
      const x = c*COLUMN_STEP;
      const y = head+r*ROW_STEP;
      const slot = document.createElement('div');
      slot.className = 'poster-slot';
      slot.dataset.column=String(c);
      slot.style.setProperty('--x', `${x}px`);
      slot.style.setProperty('--y', `${y}px`);
      // Slots stay in one grid; their reveals follow a shared flexible surface.
      slot.style.setProperty('--z', '0px');
      slot.style.setProperty('--luminance', String(.84+((c+r*3)%5)*.035));
      slot.style.setProperty('--float-duration', `${8.5+(index%5)*1.4}s`);
      slot.style.setProperty('--float-delay', `${-index*1.3}s`);
      const reveal = document.createElement('div');reveal.className='poster-reveal';
      const floater = document.createElement('div');floater.className='poster-float';
      const card = document.createElement('div');card.className='poster';card.dataset.key=poster.key;
      const img = new Image();img.src=poster.src;img.alt='';img.width=810;img.height=1080;img.decoding='async';img.draggable=false;
      card.append(img);floater.append(card);reveal.append(floater);slot.append(reveal);fragment.append(slot);
      const centerX = x+CARD_WIDTH/2;
      const centerY = y+CARD_HEIGHT/2;
      posterEntries.push({element:reveal,surface:card,x:centerX,y:centerY,width,height});
    }
  }
  gallery.replaceChildren(fragment);
}
new ResizeObserver(()=>{if(backgroundMode==='default')fillGallery();}).observe(experience);

function surfacePhase(y,height){
  return Math.max(0,Math.min(1,y/height));
}

function smoothProgress(value){
  const t = Math.max(0,Math.min(1,value));
  return t*t*t*(t*(t*6-15)+10);
}

function entranceProgress(progress){
  // Preserve the original pace until 66%, then append a C2-continuous tail.
  const time = progress*ENTRY_DURATION;
  const join = FLIGHT_DURATION*.66;
  if(time<=join)return time/FLIGHT_DURATION;
  if(progress>=1)return 1;
  const tail = ENTRY_DURATION-join;
  const t = (time-join)/tail;
  const velocity = tail/(FLIGHT_DURATION*.34);
  const eased = velocity*t+(10-6*velocity)*t**3+(-15+8*velocity)*t**4+(6-3*velocity)*t**5;
  return .66+.34*eased;
}

function bezierProgress(progress,x1,y1,x2,y2){
  if(progress<=0||progress>=1)return progress;
  let low=0,high=1;
  for(let i=0;i<18;i++){
    const t=(low+high)/2;
    const x=3*(1-t)**2*t*x1+3*(1-t)*t*t*x2+t**3;
    if(x<progress)low=t;else high=t;
  }
  const t=(low+high)/2;
  return 3*(1-t)**2*t*y1+3*(1-t)*t*t*y2+t**3;
}

function sampleSurface(x,y,progress,width,height){
  const remaining = 1-smoothProgress(progress);
  const u = x-width/2;
  const v = y-height/2;
  // Keep one stable convex shape. Moving the crest or delaying its geometry
  // by row makes each card pitch several times as the bend passes through it.
  const crest = height*.03;
  const along = (v-crest+u*.08)/(height*.42);
  const across = u/(width*.7);
  const dome = Math.exp(-along*along-.3*across*across);
  // One continuous rise/fall curve: the crest rolls over without a flat pause.
  // The cubic tail has zero velocity and acceleration at the flat ending.
  const bend = (1-progress)**3*(.55+1.65*progress+20.4*progress**2);
  const lift = bend*dome;
  return [x+u*.009*lift,y+90*remaining-24*lift,-720*remaining+400*lift];
}

function normalize(vector){
  const length = Math.hypot(...vector);
  return vector.map(value=>value/length);
}

function cross(a,b){
  return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
}

function surfaceTransform({x,y,width,height},progress){
  if(progress===1)return CARD_REST_TRANSFORM;
  const point = sampleSurface(x,y,progress,width,height);
  const left = sampleSurface(x-1,y,progress,width,height);
  const right = sampleSurface(x+1,y,progress,width,height);
  const top = sampleSurface(x,y-1,progress,width,height);
  const bottom = sampleSurface(x,y+1,progress,width,height);
  // Each rigid card lies tangent to the same continuously sampled surface.
  // Neighboring normals therefore change smoothly in both grid directions.
  const horizontal = normalize(right.map((value,index)=>value-left[index]));
  const vertical = bottom.map((value,index)=>value-top[index]);
  const normal = normalize(cross(horizontal,vertical));
  const upright = normalize(cross(normal,horizontal));
  const matrix = [
    ...horizontal,0,...upright,0,...normal,0,
    point[0]-x,point[1]-y,point[2],1
  ];
  return `matrix3d(${matrix.map(value=>Number(value.toFixed(6))).join(',')})`;
}

function animateEntry() {
  entryAnimations.splice(0).forEach(animation => animation.cancel());
  clearTimeout(replayTimer);
  replayButton.disabled = true;
  if (reducedMotion.matches) {
    showUiEntries();
    replayButton.disabled = false;
    return;
  }
  if(backgroundMode==='cover'){
    // Ease into the push, then give the final third a long settling tail.
    // This curve reaches zero velocity and acceleration at both ends.
    const zoomFrames=Array.from({length:121},(_,index)=>{
      const offset=index/120;
      const progress=offset**3*(35+offset*(-105+offset*(126+offset*(-70+15*offset))));
      return {offset,transform:`scale(${1+(COVER_SCALE-1)*progress})`,opacity:.82+.18*progress};
    });
    const zoom=coverImage.animate(zoomFrames,
      {duration:COVER_DURATION,easing:'linear',fill:'both'});
    entryAnimations.push(zoom);
    if(!coverLogo.hidden){
      const logoEntry=coverLogo.animate([
        {opacity:0,transform:'translate3d(0, 18px, 0) scale(.975)',filter:'blur(5px)'},
        {opacity:1,transform:'translate3d(0, 0, 0) scale(1)',filter:'blur(0px)'}
      ],{duration:1600,delay:200,easing:'cubic-bezier(.16, 1, .3, 1)',fill:'both'});
      entryAnimations.push(logoEntry);
    }
    animateUiGroup(menuLabels);
    animateUiGroup(headerActionEntries,'right');
    entryAnimations.forEach(animation=>{animation.pause();animation.currentTime=0;});
    syncEntryPlayback();
    replayTimer=window.setTimeout(()=>{replayButton.disabled=false;},COVER_DURATION+120);
    announcement.textContent='正在重播封面入场动画';
    return;
  }
  // One camera projects the cards on a shared convex surface. The two-stage
  // bend preserves flexibility without sending repeated rolls through the grid.
  const samples=Array.from({length:SURFACE_STEPS+1},(_,index)=>{
    const offset=index/SURFACE_STEPS;
    const progress=entranceProgress(offset);
    return {offset,progress,
      flight:bezierProgress(progress,.32,.1,.25,1),
      orientation:bezierProgress(progress,.42,0,.22,1),
      screen:bezierProgress(progress,.22,.65,.25,1)};
  });
  const motionTiming={duration:ENTRY_DURATION,easing:'linear',fill:'both'};
  const flight=arrival.animate(samples.map(({offset,flight:progress})=>({offset,
    transform:offset===1?ARRIVAL_REST_TRANSFORM:`translate3d(0px, ${300*(1-progress)}px, ${-1440*(1-progress)}px) scale(${.82+.18*progress})`
  })),motionTiming);
  if(paused)flight.pause();
  entryAnimations.push(flight);
  const tilt = Number(document.querySelector('#depth').value);
  const orientation=gallery.animate(samples.map(({offset,orientation:progress})=>({offset,
    transform:offset===1?GALLERY_REST_TRANSFORM:`translate(-50%, -50%) rotateX(${(-tilt-16)*(1-progress)}deg) rotateY(0deg) rotateZ(0deg) scale(var(--scene-scale))`
  })),motionTiming);
  if(paused)orientation.pause();
  entryAnimations.push(orientation);
  posterEntries.forEach(entry=>{
    const {element,surface,y,height} = entry;
    const wave = surfacePhase(y,height);
    const delay = 30+wave*ENTRY_STAGGER;
    const poses=samples.map(({progress,offset})=>({transform:surfaceTransform(entry,progress),offset}));
    const animation=element.animate(poses,motionTiming);
    const appearance=surface.animate([
      {opacity:.12,filter:'blur(6px)',offset:0},
      {opacity:.52,filter:'blur(2.5px)',offset:.35},
      {opacity:1,filter:'blur(0px)',offset:.72},
      {opacity:1,filter:'blur(0px)',offset:1}
    ],{duration:FLIGHT_DURATION-delay,delay,easing:ENTRY_EASING,fill:'both'});
    if(paused){animation.pause();appearance.pause();}
    entryAnimations.push(animation,appearance);
  });
  // Both UI groups share timing; the header settles in from the right.
  // Separate wrappers leave each button's hover/press transforms independent.
  animateUiGroup(menuLabels);
  animateUiGroup(headerActionEntries,'right');
  // Position the *projected* opening poses outside the viewport, rather than
  // guessing a world-space X offset that perspective could shrink back inside.
  // Prepare all tracks at t=0 in one task so the opening pose never flashes.
  entryAnimations.forEach(animation=>{animation.pause();animation.currentTime=0;});
  const openingBounds = posterEntries.map(({element})=>element.getBoundingClientRect());
  const openingTop = Math.min(...openingBounds.map(bounds=>bounds.top));
  const startY = Math.max(0,experience.clientHeight+32-openingTop);
  const screenEntry=entryTrack.animate(samples.map(({offset,screen:progress})=>({offset,
    transform:`translate3d(0px, ${startY*(1-progress)}px, 0px)`
  })),motionTiming);
  screenEntry.pause();
  screenEntry.currentTime=0;
  entryAnimations.push(screenEntry);
  syncEntryPlayback();
  replayTimer = window.setTimeout(()=>{replayButton.disabled=false;},ENTRY_DURATION+120);
  announcement.textContent='正在重播下方升入动画';
}

function animateUiGroup(elements,direction='top'){
  const ordered=direction==='right'?[...elements].reverse():elements;
  const start=direction==='right'?'translate3d(26px, 0, 0)':'translate3d(0, -26px, 0)';
  ordered.forEach((element,index)=>{
    const animation=element.animate([
      {opacity:0,transform:start},
      {opacity:1,transform:'translate3d(0, 0, 0)'}
    ],{duration:460,delay:40+index*70,easing:'cubic-bezier(.22, .68, .25, 1)',fill:'both'});
    if(paused)animation.pause();
    entryAnimations.push(animation);
  });
}

function showUiEntries(){
  [...menuLabels,...headerActionEntries,coverLogo].forEach(element=>{
    element.style.opacity='1';element.style.transform='translate3d(0, 0, 0)';
  });
  coverLogo.style.filter='blur(0px)';
}

function updatePause() {
  experience.classList.toggle('paused',paused);
  pauseButton.setAttribute('aria-pressed', String(paused));
  pauseButton.setAttribute('aria-label', paused?'继续动态':'暂停动态');
  pauseButton.title=paused?'继续动态':'暂停动态';
  pauseButton.querySelector('span').textContent=paused?'继续':'暂停';
  syncEntryPlayback();
}
function syncEntryPlayback(){
  // Finished entrances stay in their final pose. Calling play() on a finished
  // animation would restart the entrance when resuming or returning to the tab.
  entryAnimations.forEach(animation=>{
    if(animation.playState==='finished'||animation.playState==='idle')return;
    if(paused||document.hidden)animation.pause();else animation.play();
  });
}
function updateImmersive(){
  experience.classList.toggle('immersive',immersive);
  document.querySelector('.main-menu').inert=immersive;
}
function closeSettings(){settings.hidden=true;settingsToggle.setAttribute('aria-expanded','false');}

async function changeBackground(requestedMode,writeUrl=true){
  const request=++backgroundRequest;
  let nextMode=requestedMode;
  let hasLogo=false;
  if(nextMode==='cover'){
    const cover=backgroundConfig.cover?.src?backgroundConfig.cover:backgroundConfig.previewCover;
    try{
      if(!cover?.src)throw new Error('No cover configured');
      coverImage.src=cover.src;
      coverImage.style.objectPosition=cover.position||'center center';
      coverImage.style.transformOrigin=cover.position||'center center';
      await coverImage.decode();
    }catch{
      nextMode='default';
    }
    if(nextMode==='cover'&&cover?.logo?.src){
      try{
        coverLogoImage.src=cover.logo.src;
        coverLogoImage.alt=cover.logo.alt||'';
        await coverLogoImage.decode();
        hasLogo=true;
      }catch{
        hasLogo=false;
      }
    }
  }
  if(nextMode==='default'){
    fillGallery();
    await Promise.allSettled(Array.from(gallery.querySelectorAll('img'),image=>image.decode()));
  }
  if(request!==backgroundRequest)return;
  backgroundMode=nextMode;
  coverScene.hidden=nextMode!=='cover';
  coverLogo.hidden=nextMode!=='cover'||!hasLogo;
  entryTrack.hidden=nextMode==='cover';
  experience.classList.toggle('cover-mode',nextMode==='cover');
  experience.dataset.background=nextMode;
  backgroundButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.backgroundMode===nextMode)));
  if(writeUrl){
    const url=new URL(location.href);
    url.searchParams.delete('cover');url.searchParams.delete('default');
    if(nextMode==='cover')url.searchParams.set('cover','');
    else if(backgroundConfig.cover?.src)url.searchParams.set('default','');
    history.replaceState(null,'',url);
  }
  experience.classList.add('ready');
  document.querySelector('#loading').setAttribute('aria-hidden','true');
  if(paused){showUiEntries();}else animateEntry();
  updatePause();updateImmersive();
}

backgroundButtons.forEach(button=>button.addEventListener('click',()=>{
  if(paused&&!reducedMotion.matches){paused=false;updatePause();}
  changeBackground(button.dataset.backgroundMode);
}));

replayButton.addEventListener('click',()=>{if(paused){paused=false;updatePause();}animateEntry();});
pauseButton.addEventListener('click',()=>{paused=!paused;updatePause();});
settingsToggle.addEventListener('click',()=>{settings.hidden=!settings.hidden;settingsToggle.setAttribute('aria-expanded',String(!settings.hidden));});
document.querySelector('#settings-close').addEventListener('click',()=>{closeSettings();settingsToggle.focus({preventScroll:true});});
document.addEventListener('pointerdown',event=>{if(!settings.hidden&&!settings.contains(event.target)&&!settingsToggle.contains(event.target))closeSettings();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeSettings();if(immersive&&!clean){immersive=false;updateImmersive();settingsToggle.focus({preventScroll:true});}}});

document.querySelector('#depth').addEventListener('input',event=>{root.style.setProperty('--angle',`${event.target.value}deg`);document.querySelector('#depth-value').textContent=`${event.target.value}°`;});
document.querySelector('#depth').addEventListener('change',()=>{if(paused){paused=false;updatePause();}animateEntry();});
document.querySelector('#brightness').addEventListener('input',event=>{root.style.setProperty('--poster-brightness',String(event.target.value/100));document.querySelector('#brightness-value').textContent=`${event.target.value}%`;});
document.addEventListener('visibilitychange',()=>{experience.classList.toggle('inactive',document.hidden);syncEntryPlayback();});
reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches){paused=true;updatePause();}});

async function initialize(){
  await changeBackground(backgroundMode,false);
}
initialize();
