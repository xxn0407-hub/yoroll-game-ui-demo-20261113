(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.YorollPlaySession=api;})(globalThis,function(){
 'use strict';
 class Clock {
  constructor(){this.time=0;this.pauses=new Set();}
  pause(reason){this.pauses.add(reason);}
  resume(reason){this.pauses.delete(reason);}
  advance(dt){if(!this.pauses.size)this.time+=Math.max(0,Math.min(dt,.1));return this.time;}
  get paused(){return this.pauses.size>0;}
 }
 class Gate {
  constructor(){this.serial=0;this.active=null;}
  begin(type,nodeId){return this.active={sessionId:`qte-${++this.serial}`,type,nodeId,settled:false};}
  accept(sessionId){return !!this.active&&this.active.sessionId===sessionId&&!this.active.settled;}
  settle(sessionId){if(!this.accept(sessionId))return false;this.active.settled=true;return true;}
  stop(){this.active=null;}
 }
 function validWebMessage(event,origin,source){return !!source&&event.origin===origin&&event.source===source&&event.data?.namespace==='yoroll-gameplay'&&event.data.version===1;}
 function returnFromSide(record,completed){const viewed=new Set(record.viewed||[]);if(completed)viewed.add(record.pointId);return {parent:record.parent,viewed:Array.from(viewed),allowSkip:record.allowSkip};}
 return {Clock,Gate,validWebMessage,returnFromSide};
});
