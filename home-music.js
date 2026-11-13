'use strict';
window.YorollMusic = (() => {
 const revision='opening-fade-20261111';
 const menuPages=new Set(['splash','home','cover','chapters','tree','saves','settings','logout','exit']);
 const openingPages=new Set(['splash','home','cover']);
 const positionKey=`yoroll-opening-position:${revision}`;
 let scene='home',wanted=false,master=1,music=1;
 let context,bus,buffer,plan,preload,decoding,voice=null;
 let loadFailed=false,leaveTimer=0,ticker=0,starts=0,openingStarts=0;
 let hasStarted=false,hasFinished=false,forceOpening=false,resumePosition=0,lastCheckpointAt=0;
 function readPosition(){
  try{const saved=JSON.parse(localStorage.getItem(positionKey));return saved?.revision===revision&&!saved.completed&&Number.isFinite(saved.position)&&saved.position>=0?saved:null;}catch{return null;}
 }
 const savedPosition=readPosition();
 let restoredFromStorage=Boolean(savedPosition);
 if(savedPosition){hasStarted=true;resumePosition=savedPosition.position;}
 const clamp=value=>Math.max(0,Math.min(1,Number(value)||0));
 const duration=()=>plan?.durationSeconds??10;
 const tailSeconds=()=>Math.max(0,Math.min(duration(),plan?.fadeOutSeconds??3));
 function tailEnvelope(position){
  if(position>=duration())return 0;
  const length=tailSeconds(),begin=duration()-length;
  if(!length||position<=begin)return 1;
  const progress=(position-begin)/length;
  return clamp(1-progress**3*(10+progress*(-15+6*progress)));
 }
 function scheduleTail(parameter,start,offset){
  parameter.value=tailEnvelope(offset);
  const begin=Math.max(offset,duration()-tailSeconds()),remaining=duration()-begin;
  if(!tailSeconds()||remaining<=0)return;
  const curve=new Float32Array(129);
  for(let i=0;i<curve.length;i++)curve[i]=tailEnvelope(begin+remaining*i/(curve.length-1));
  parameter.setValueCurveAtTime(curve,start+begin-offset,remaining);
 }
 function timelineOf(current){return Math.min(duration(),current.offset+Math.max(0,context.currentTime-current.startedAt));}
 function savePosition(position,completed=false){
  try{localStorage.setItem(positionKey,JSON.stringify({revision,position,completed,savedAt:Date.now()}));}catch{}
 }
 function checkpoint(force=false){
  if(!voice||!plan||!force&&!window.YorollSound.isActive())return;
  const now=Date.now();if(!force&&now-lastCheckpointAt<1000)return;
  lastCheckpointAt=now;savePosition(timelineOf(voice));
 }
 function publish(){
  checkpoint();
  let phase='off';
  if(wanted&&loadFailed)phase='unavailable';
  else if(wanted&&hasFinished&&!voice)phase='ended';
  else if(wanted&&(!context||document.documentElement.dataset.audioState==='locked'))phase='locked';
  else if(wanted&&!buffer)phase='loading';
  else if(voice)phase=!wanted?'fading':!window.YorollSound.isActive()||context.state!=='running'?'paused':tailSeconds()&&timelineOf(voice)>=duration()-tailSeconds()?'fading':'opening';
  else if(wanted)phase=hasStarted?'paused':'ready';
  const gain=master*music*(plan?.musicMixGain??.24);
  const position=voice?timelineOf(voice):hasFinished?duration():resumePosition;
  Object.assign(document.documentElement.dataset,{
   musicRevision:revision,musicPhase:phase,musicGain:String(Number(gain.toFixed(4))),
   musicStarts:String(starts),musicOpeningStarts:String(openingStarts),musicLoopCount:'0',
   musicPosition:String(Number(position.toFixed(3))),musicPlaybackPosition:String(Number(position.toFixed(3))),
   musicIntroSeconds:String(duration()),musicLoopSeconds:'0',musicLoopEnabled:'false',
   musicResumeAvailable:String(restoredFromStorage&&!hasFinished),
   musicTailFadeSeconds:String(tailSeconds()),musicTailGain:String(Number(tailEnvelope(position).toFixed(5)))
  });
  document.dispatchEvent(new CustomEvent('home-music-state',{detail:{phase,gain}}));
 }
 function holdGain(parameter,now){const value=parameter.value;parameter.cancelScheduledValues(now);parameter.setValueAtTime(value,now);}
 function setLevels({master:nextMaster=1,music:nextMusic=1}={}){
  master=clamp(nextMaster);music=clamp(nextMusic);
  if(bus){const now=context.currentTime;bus.gain.cancelScheduledValues(now);bus.gain.setTargetAtTime(master*music*(plan?.musicMixGain??.24),now,.035);}
  publish();
 }
 function ensureRouting(){
  if(context)return true;
  const routing=window.YorollSound.getRouting();
  if(!routing)return false;
  context=routing.context;bus=context.createGain();bus.gain.value=master*music*(plan?.musicMixGain??.24);bus.connect(routing.destination);
  context.addEventListener('statechange',()=>{maybeStart();publish();});
  return true;
 }
 function load(){
  if(!preload){
   preload=Promise.all([
    fetch(`music-spec.json?v=${revision}`).then(response=>{if(!response.ok)throw new Error('Opening plan unavailable');return response.json();}),
    fetch(`assets/audio/home-opening.wav?v=${revision}`).then(response=>{if(!response.ok)throw new Error('Opening unavailable');return response.arrayBuffer();})
   ]).then(([config,data])=>{plan=config;setLevels({master,music});return data;});
   preload.catch(()=>{loadFailed=true;publish();});
  }
  if(ensureRouting()&&!decoding){
   decoding=preload.then(data=>context.decodeAudioData(data)).then(decoded=>{
    if(decoded.duration+1/decoded.sampleRate<duration())throw new Error('Opening is shorter than its plan');
    buffer=decoded;maybeStart();publish();
   }).catch(()=>{loadFailed=true;publish();});
  }
 }
 function clearTicker(){clearInterval(ticker);ticker=0;}
 function finishVoice(current){
  if(voice!==current)return;
  checkpoint(true);resumePosition=timelineOf(current);current.stopping=true;voice=null;clearTicker();
  try{current.source.stop();}catch{}
 }
 function fadeOut(){
  if(!voice)return;
  clearTimeout(leaveTimer);
  const current=voice,now=context.currentTime;
  holdGain(current.gain.gain,now);current.gain.gain.linearRampToValueAtTime(0,now+.65);
  leaveTimer=setTimeout(()=>{leaveTimer=0;if(!wanted&&voice===current){finishVoice(current);publish();}},670);
 }
 function maybeStart(){
  if(!wanted||!window.YorollSound.isActive()||!buffer||!ensureRouting()||context.state!=='running')return;
  clearTimeout(leaveTimer);leaveTimer=0;
  if(voice&&!forceOpening){const now=context.currentTime;holdGain(voice.gain.gain,now);voice.gain.gain.setTargetAtTime(1,now,.15);return;}
  if(hasFinished&&!forceOpening)return;
  if(!hasStarted&&!forceOpening&&!openingPages.has(scene))return;
  if(starts===0&&!forceOpening){const latest=readPosition();if(latest&&latest.position<duration()){hasStarted=true;restoredFromStorage=true;resumePosition=latest.position;}}
  const offset=forceOpening?0:resumePosition;
  if(offset>=duration()){hasFinished=true;savePosition(duration(),true);publish();return;}
  if(voice){
   const previous=voice,now=context.currentTime;previous.stopping=true;
   holdGain(previous.gain.gain,now);previous.gain.gain.linearRampToValueAtTime(0,now+.12);
   try{previous.source.stop(now+.13);}catch{}
  }
  forceOpening=false;hasStarted=true;hasFinished=false;
  const source=context.createBufferSource();source.buffer=buffer;source.loop=false;
  const gain=context.createGain(),tailGain=context.createGain(),start=context.currentTime+.03;
  gain.gain.value=0;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(1,start+.7);
  scheduleTail(tailGain.gain,start,offset);
  source.connect(gain);gain.connect(tailGain);tailGain.connect(bus);
  const current={source,gain,tailGain,offset,startedAt:start,stopping:false};voice=current;
  source.onended=()=>{
   source.disconnect();gain.disconnect();tailGain.disconnect();
   if(voice===current&&!current.stopping){
    voice=null;hasFinished=true;resumePosition=duration();restoredFromStorage=false;clearTicker();savePosition(duration(),true);
   }
   publish();
  };
  source.start(start,offset);starts++;if(offset===0)openingStarts++;
  checkpoint(true);if(!ticker)ticker=setInterval(publish,250);publish();
 }
 function setScene(page){
  scene=page;wanted=menuPages.has(page);
  if(wanted){load();maybeStart();}else fadeOut();
  publish();
 }
 async function prepareEntry(page){
  if(!openingPages.has(page))return false;
  const attempt=window.YorollSound.prepareAutoplay();
  load();
  const allowed=await attempt;
  // Decode before the entrance where possible; a slow connection must not
  // leave the page waiting indefinitely on an audio asset.
  if(allowed&&decoding)await Promise.race([decoding,new Promise(resolve=>setTimeout(resolve,1000))]);
  return allowed;
 }
 function replayOpening(){
  forceOpening=true;hasFinished=false;resumePosition=0;restoredFromStorage=false;
  if(wanted){load();maybeStart();}publish();
 }
 document.addEventListener('ui-audio-state',()=>{if(wanted){load();maybeStart();}publish();});
 document.addEventListener('preview-audio-activity',event=>{if(!event.detail.active)checkpoint(true);else maybeStart();publish();});
 window.addEventListener('pagehide',()=>checkpoint(true));
 publish();
 return {setScene,setLevels,replayOpening,prepareEntry};
})();
