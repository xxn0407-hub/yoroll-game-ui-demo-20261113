'use strict';
// Short original PCM assets; all playback stays local to this prototype.
window.YorollSound = (() => {
 const revision = 'chapter-ethereal-20261113';
 const names = ['hover','click','select','chapter','back','transition','open','confirm','success'];
 const buffers = new Map();
 const voices = new Set();
 const lastPlayed = new Map();
 const counts = {};
 const mixGain = .5;
 let context, output, compressor, activityGate, loading, contextChange, activityPoll;
 let activated = false, available = true, muted = false, volume = 1;
 let autoplayRequested=false, autoplayState='idle', autoplayAttempt=null, activation='none';
 let loadFailed = false, lastCue = '', total = 0, previewId = 0;
 let pageAway=false, focusLost=!document.hasFocus(), lastDocumentFocus=document.hasFocus();
 let ownsAudio=true, previewPaused=false, lastActivity;
 const ownerId=`${Date.now()}-${Math.random()}`;
 let audioChannel;
 try{audioChannel=new BroadcastChannel('yoroll-ui-preview-audio');}catch{}
 const bytes = new Map(names.map(name => [name,fetch(`assets/audio/ui-${name}.wav?v=${revision}`)
  .then(response => {if(!response.ok)throw new Error('Audio asset unavailable');return response.arrayBuffer();})
  .catch(() => null)]));

 function publish(){
  const state = !available?'unavailable':!activated?'locked':loadFailed?'unavailable':buffers.size<names.length?'loading':context?.state==='running'?'ready':'suspended';
  Object.assign(document.documentElement.dataset,{
   audioRevision:revision,audioState:state,audioMuted:String(muted),audioGain:String(Number(((muted?0:volume)*mixGain).toFixed(4))),
   audioEntryRevision:'entry-autoplay-20261113',audioAutoplay:autoplayState,audioActivation:activation,
   audioLastCue:lastCue,audioPlayCount:String(total),audioCounts:JSON.stringify(counts),
   audioDecoded:String(buffers.size),audioVoices:String(voices.size),
   audioLifecycleRevision:'preview-pause-20261111',audioPreviewActive:String(isActive()),
   audioPreviewFocused:String(document.hasFocus()),audioPreviewOwner:String(ownsAudio),audioPreviewPaused:String(previewPaused)
  });
  document.dispatchEvent(new CustomEvent('ui-audio-state',{detail:{state,muted,volume}}));
 }
 function isActive(){return !previewPaused&&!pageAway&&!document.hidden&&!focusLost&&document.hasFocus()&&ownsAudio;}
 function setPreviewPaused(value){
  previewPaused=Boolean(value);
  if(!previewPaused){focusLost=!document.hasFocus();claimAudio();}
  syncActivity();
 }
 function claimAudio(){
  if(pageAway||document.hidden||!document.hasFocus())return;
  ownsAudio=true;
  audioChannel?.postMessage({type:'claim',ownerId});
 }
 function syncActivity(){
  const active=isActive();
  if(active!==lastActivity){
   lastActivity=active;
   if(!active)stopAll(true);
   if(activityGate){
    const now=context.currentTime;
    activityGate.gain.cancelScheduledValues(now);
    activityGate.gain.setValueAtTime(0,now);
    if(active)activityGate.gain.linearRampToValueAtTime(1,now+.06);
   }
   document.dispatchEvent(new CustomEvent('preview-audio-activity',{detail:{active}}));
   publish();
  }
  if(!context||contextChange||context.state==='closed')return;
  if(active&&activated&&context.state!=='running'){
   contextChange=context.resume().catch(()=>{}).finally(()=>{contextChange=null;if(!isActive())syncActivity();publish();});
  }else if(!active&&context.state!=='suspended'){
   contextChange=context.suspend().catch(()=>{}).finally(()=>{contextChange=null;if(isActive())syncActivity();publish();});
  }
 }
 function pollActivity(){
  const focused=document.hasFocus();
  if(focused!==lastDocumentFocus){
   lastDocumentFocus=focused;focusLost=!focused;
   if(focused&&activated)claimAudio();
   if(focused&&autoplayState==='deferred')prepareAutoplay();
  }
  syncActivity();
 }
 function watchActivity(){if(!activityPoll)activityPoll=setInterval(pollActivity,250);}
 if(audioChannel)audioChannel.onmessage=event=>{
  if(event.data?.type==='claim'&&event.data.ownerId!==ownerId){ownsAudio=false;syncActivity();}
 };
 function stopVoice(voice,immediate=false,fade=.1){
  if(voice.stopping&&!immediate)return;
  voice.stopping=true;
  const now=context.currentTime;
  voice.gain.gain.cancelScheduledValues(now);
  voice.gain.gain.setValueAtTime(voice.gain.gain.value,now);
  if(immediate)voice.gain.gain.setValueAtTime(0,now);
  else voice.gain.gain.linearRampToValueAtTime(0,now+fade);
  try{voice.source.stop(immediate?now:now+fade+.005);}catch{}
 }
 function suppressHover(){for(const voice of voices)if(voice.channel==='hover')stopVoice(voice,false,.025);}
 function duckTail(voice,{level=.28,seconds=.035}={}){
  if(voice.ducked||voice.stopping)return;
  voice.ducked=true;
  const now=context.currentTime;
  voice.gain.gain.cancelScheduledValues(now);
  voice.gain.gain.setTargetAtTime(voice.gain.gain.value*level,now,seconds);
 }
 function stopAll(immediate=false){previewId++;for(const voice of voices)stopVoice(voice,immediate);}
 function setLevels({master=1,sfx=1,isMuted=false}={}){
  const nextVolume=Math.max(0,Math.min(1,Number(master)||0))*Math.max(0,Math.min(1,Number(sfx)||0));
  muted=Boolean(isMuted);volume=nextVolume;
  if(output){const now=context.currentTime;output.gain.cancelScheduledValues(now);output.gain.setTargetAtTime(muted?0:volume*mixGain,now,.008);}
  if(muted||volume===0)stopAll();
  publish();
 }
 function ensureContext(){
  if(context)return;
  const AudioEngine=window.AudioContext||window.webkitAudioContext;
  if(!AudioEngine){available=false;publish();return;}
  try{
   context=new AudioEngine({latencyHint:'interactive'});
   output=context.createGain();output.gain.value=muted?0:volume*mixGain;
   compressor=context.createDynamicsCompressor();compressor.threshold.value=-14;compressor.knee.value=8;
   compressor.ratio.value=3;compressor.attack.value=.003;compressor.release.value=.16;
   activityGate=context.createGain();activityGate.gain.value=isActive()?1:0;
   output.connect(compressor);compressor.connect(activityGate);activityGate.connect(context.destination);
   context.addEventListener('statechange',()=>{if(context.state==='running'&&autoplayRequested&&!activated)finishAutoplay();if(!isActive())syncActivity();publish();});
   loading=Promise.all(names.map(async name=>{
    const data=await bytes.get(name);
    if(!data){loadFailed=true;return;}
    try{buffers.set(name,await context.decodeAudioData(data));}catch{loadFailed=true;}
   })).then(publish);
  }catch{available=false;}
  publish();
 }
 function finishAutoplay(){
  if(activated)return context?.state==='running';
  if(!context||context.state!=='running'||!isActive()){
   if(context?.state==='running')syncActivity();
   return false;
  }
  activated=true;activation='autoplay';autoplayState='allowed';claimAudio();syncActivity();publish();
  return true;
 }
 async function prepareAutoplay(){
  autoplayRequested=true;
  if(activated)return context?.state==='running';
  if(!previewPaused&&!pageAway&&!document.hidden&&!focusLost&&document.hasFocus())claimAudio();
  if(!isActive()){autoplayState='deferred';publish();return false;}
  if(autoplayAttempt)return autoplayAttempt;
  ensureContext();
  if(!context){autoplayState='unavailable';publish();return false;}
  watchActivity();autoplayState='checking';publish();
  // A blocked resume may stay pending. Keep it separate from gesture resumes,
  // and never hold the page entrance waiting for browser permission.
  const resume=context.resume().then(finishAutoplay).catch(()=>false);
  autoplayAttempt=Promise.race([resume,new Promise(resolve=>setTimeout(()=>resolve(false),120))])
   .then(allowed=>{
    if(!activated)autoplayState=isActive()?'blocked':'deferred';
    publish();return Boolean(allowed&&activated&&context.state==='running');
   }).finally(()=>{autoplayAttempt=null;});
  return autoplayAttempt;
 }
 async function unlock(){
  if(!activated){activation='gesture';if(autoplayRequested)autoplayState='gesture';}
  activated=true;focusLost=false;lastDocumentFocus=document.hasFocus();claimAudio();ensureContext();watchActivity();syncActivity();
  if(!context)return;
  try{await contextChange;await loading;}catch{}
  publish();
 }
 function play(name,{level=1,delay=0,sequence=false,throttle}={}){
  if(!names.includes(name)||!activated||!available||muted||volume===0||!isActive())return false;
  const requested=performance.now();
  const interval=throttle??(name==='hover'?180:name==='transition'?220:55);
  if(requested-(lastPlayed.get(name)??-Infinity)<interval)return false;
  if(!sequence&&name==='transition'&&['confirm','open','success'].some(cue=>requested-(lastPlayed.get(cue)??-Infinity)<180))return false;
  lastPlayed.set(name,requested);
  if(name==='select')suppressHover();
  const run=()=>{
   if(!context||context.state!=='running'||muted||volume===0||!isActive()||!buffers.has(name))return false;
   if(performance.now()-requested>200)return false; // Never replay stale interactions after a slow load.
   const channel=name==='hover'?'hover':name==='chapter'?'chapter':['transition','open','back'].includes(name)?'navigation':name==='success'?'result':'control';
   if(!sequence){
    previewId++;
    for(const voice of voices){
     if(voice.sequence)stopVoice(voice);
     else if(channel==='chapter'&&voice.channel==='hover')duckTail(voice,{level:.6,seconds:.09});
     else if(channel==='chapter'&&voice.channel==='chapter')duckTail(voice,{level:.2,seconds:.11});
     else if(voice.channel===channel||(channel!=='hover'&&voice.channel==='hover'))duckTail(voice);
    }
   }
   const active=[...voices].filter(voice=>!voice.stopping);
   if(active.length>=6)stopVoice(active[0]);
   const source=context.createBufferSource();source.buffer=buffers.get(name);
   const gain=context.createGain();gain.gain.value=Math.max(0,Math.min(1,level));
   source.connect(gain);gain.connect(output);
   const voice={source,gain,channel,sequence,stopping:false,ducked:false};voices.add(voice);
   source.onended=()=>{voices.delete(voice);source.disconnect();gain.disconnect();publish();};
   source.start(context.currentTime+Math.max(0,delay));
   lastCue=name;total++;counts[name]=(counts[name]||0)+1;publish();
   return true;
  };
  if(!buffers.has(name)||context?.state!=='running'){
   syncActivity();Promise.all([loading,contextChange]).then(run).catch(()=>{});
   return false;
  }
  return run();
 }
 async function audition(){
  stopAll();const request=previewId;
  await unlock();
  if(request!==previewId||muted||volume===0||!isActive())return;
  play('hover',{sequence:true,delay:.06,throttle:0,level:.68});
  play('click',{sequence:true,delay:1.4,throttle:0,level:.9});
  play('transition',{sequence:true,delay:3.1,throttle:0,level:.85});
 }
 document.addEventListener('pointerdown',unlock,{capture:true});
 document.addEventListener('keydown',event=>{if(!event.metaKey&&!event.ctrlKey&&!event.altKey)unlock();},{capture:true});
 document.addEventListener('visibilitychange',pollActivity);
 window.addEventListener('blur',()=>{focusLost=true;lastDocumentFocus=document.hasFocus();syncActivity();});
 window.addEventListener('focus',()=>{focusLost=false;lastDocumentFocus=document.hasFocus();if(activated)claimAudio();if(autoplayState==='deferred')prepareAutoplay();syncActivity();});
 window.addEventListener('pagehide',()=>{pageAway=true;syncActivity();clearInterval(activityPoll);activityPoll=0;});
 window.addEventListener('pageshow',()=>{pageAway=false;focusLost=!document.hasFocus();if(activated){claimAudio();watchActivity();}syncActivity();});
 syncActivity();
 publish();
 return {play,unlock,prepareAutoplay,setLevels,audition,stopAll,suppressHover,isActive,setPreviewPaused,getRouting:()=>context&&compressor?{context,destination:compressor}:null};
})();
