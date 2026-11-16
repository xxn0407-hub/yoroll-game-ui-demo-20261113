(function(){
 'use strict';
 const sound=window.YorollSound,revision='ethereal-gameplay-20261116';
 const cues={
  start:{channel:'gameplay-start',throttle:700,replace:true},
  focus:{channel:'hover',throttle:300},tap:{throttle:100},
  hold:{channel:'gameplay-gesture',throttle:350,replace:true},
  release:{channel:'gameplay-gesture',throttle:180,replace:true},
  swipe:{throttle:220},trace:{channel:'gameplay-gesture',throttle:400,replace:true},reveal:{throttle:450},item:{throttle:240},
  combine:{throttle:650},place:{throttle:120},turn:{throttle:200},
  invalid:{throttle:650},'rhythm-hit':{throttle:85},'rhythm-miss':{throttle:500},
  success:{channel:'gameplay-result',throttle:650,replace:true},
  failure:{channel:'gameplay-result',throttle:650,replace:true}
 };
 const scriptRoot=new URL('./',document.currentScript.src);
 sound.registerCues(Object.fromEntries(Object.entries(cues).map(([event,options])=>[
  `game-${event}`,{...options,channel:options.channel||'gameplay-action',
   file:new URL(`assets/audio/${event}.wav?v=${revision}`,scriptRoot).href}
 ])));
 const channels=['gameplay-action','gameplay-gesture','gameplay-result','gameplay-start'];
 const policy=Object.freeze({theme:revision,uiSfx:'host',builtInUiSfx:false,referenceMediaAudio:false});
 let lastAction=-Infinity,lastResult=-Infinity;
 function clear({keepResult=false}={}){channels.filter(channel=>!keepResult||channel!=='gameplay-result').forEach(channel=>sound.stopChannel(channel));sound.stopChannel('hover',.04);lastAction=-Infinity;if(!keepResult)lastResult=-Infinity;}
 function play(event,options={}){
  if(!Object.hasOwn(cues,event))return false;
  if(event==='start'&&performance.now()-lastResult<1200)return false;
  const isResult=event==='success'||event==='failure';
  if(isResult){for(const channel of ['gameplay-action','gameplay-gesture','gameplay-start'])sound.stopChannel(channel,.09);}
  // Board moves, gesture points and simultaneous notes must not build a chord.
  const action=(cues[event].channel||'gameplay-action')==='gameplay-action';
  const now=performance.now();
  if(action&&now-lastAction<75)return false;
  const played=sound.play(`game-${event}`,{level:options.level??1});
  if(played&&action)lastAction=now;
  if(played&&isResult)lastResult=now;
  if(played)document.documentElement.dataset.gameplayAudioLastEvent=event;
  return played;
 }
 function syncMedia(media){
  const themed=media.dataset.audioPolicy==='theme-media';
  const routed=themed&&sound.routeMedia(media);
  const muted=!themed||!routed||sound.isMuted();
  if(media.muted!==muted)media.muted=muted;
  const volume=themed?1:0;
  if(media.volume!==volume)media.volume=volume;
 }
 function protectMedia(media,{themed=false}={}){
  media.dataset.audioPolicy=themed?'theme-media':'reference-silent';
  syncMedia(media);
  media.addEventListener('volumechange',()=>syncMedia(media));
  return media;
 }
 function sync(){document.querySelectorAll('audio[data-audio-policy],video[data-audio-policy]').forEach(syncMedia);}
 document.addEventListener('ui-audio-state',sync);
 document.documentElement.dataset.gameplayAudioRevision=revision;
 window.YorollPlayAudio=Object.freeze({revision,policy,play,clear,protectMedia,sync,
  events:Object.freeze(Object.keys(cues)),inputEvents:Object.freeze(Object.keys(cues).filter(event=>!['start','success','failure'].includes(event))),
  imageAudio:new URL(`assets/audio/image-audio.wav?v=${revision}`,scriptRoot).href});
})();
