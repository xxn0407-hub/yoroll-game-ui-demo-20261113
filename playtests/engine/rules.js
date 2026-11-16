(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.YorollPlayRules=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const clone=value=>JSON.parse(JSON.stringify(value));
 const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,value));
 const nodeKey=(chapter,id)=>`${chapter}/${id}`;
 const amount=value=>Number(value&&typeof value==='object'?(value.value??value.count??0):value)||0;
 function initialState(game){
  return {version:1,stats:Object.fromEntries((game.statConfigs||[]).map(stat=>[stat.id,stat.initialValue||0])),characters:Object.fromEntries((game.characterConfigs||[]).map(character=>[character.characterId,{...character.initStats}])),items:Object.fromEntries((game.itemConfigs||[]).map(item=>[item.itemId,item.initialCount||0])),visited:[],applied:[],completed:[],history:[],records:{}};
 }
 function applyEffects(state,source,game,ledgerKey){
  if(ledgerKey&&state.applied.includes(ledgerKey))return [];
  const changes=[];
  const limits=Object.fromEntries((game.statConfigs||[]).map(stat=>[stat.id,stat.maxValue??100]));
  const changeStat=(target,key,value,character)=>{
   const before=target[key]||0,after=clamp(before+amount(value),0,limits[key]??100);
   target[key]=after;
   if(after!==before)changes.push({type:'stat',id:key,character,delta:after-before,value:after});
  };
  for(const [key,value] of Object.entries({...source.statEffects,...source.statEffectConfigs}))changeStat(state.stats,key,value);
  const actors=new Set([...Object.keys(source.characterEffects||{}),...Object.keys(source.characterEffectConfigs||{})]);
  for(const actor of actors){
   const target=state.characters[actor]||(state.characters[actor]={});
   for(const [key,value] of Object.entries({...source.characterEffects?.[actor],...source.characterEffectConfigs?.[actor]}))changeStat(target,key,value,actor);
  }
  for(const [key,value] of Object.entries({...source.itemEffects,...source.itemEffectConfigs})){
   const before=state.items[key]||0,after=Math.max(0,before+amount(value));
   state.items[key]=after;
   if(after!==before)changes.push({type:'item',id:key,delta:after-before,value:after});
  }
  if(ledgerKey)state.applied.push(ledgerKey);
  return changes;
 }
 function conditionMet(condition,state){
  const actor=state.characters[condition.character_name]||{};
  switch(Number(condition.condition_type)){
   case 1001:return (actor.favor||0)>=condition.favor;
   case 1002:return (actor.favor||0)<=condition.favor;
   case 1003:return (actor.favor||0)>(state.characters[condition.other_character_name]?.favor||0);
   case 3001:return (state.items[condition.item_id]||0)>=(condition.item_count??1);
   case 4001:return state.visited.includes(nodeKey(condition.chapter_id,condition.node_id));
   default:return false;
  }
 }
 const conditionsMet=(conditions,state)=>(conditions||[]).every(condition=>conditionMet(condition,state));
 function choicesFor(node,state){
  return (node.choices||[]).map((choice,index)=>({...choice,index,enabled:conditionsMet(choice.conditions,state)})).filter(choice=>choice.enabled||!choice.hide_on_condition_fail);
 }
 function choose(node,index,state){
  const choice=choicesFor(node,state).find(choice=>choice.index===index);
  if(!choice?.enabled)return null;
  return {next:choice.next,immediate:choice.immediate_settle===true,index};
 }
 function qteOutcome(node,score){
  const qte=node.qte||{},key=String(score),next=qte.next_node_map?.[key];
  return {score:Number(score),next,immediate:qte.next_node_immediate_settle?.[key]===true,retry:!next};
 }
 function recordVisit(state,chapter,id){
  const key=nodeKey(chapter,id);
  if(!state.visited.includes(key))state.visited.push(key);
 }
 function canUse(state,option){return (state.items[option.item_id]||0)>=(option.required_count??1);}
 function useItem(state,option){
  if(!canUse(state,option))return false;
  if(option.consume_on_use===true)state.items[option.item_id]-=option.required_count??1;
  return true;
 }
 function ingredientCounts(inputs){
  if(!Array.isArray(inputs))return {...inputs};
  const counts={};for(const id of inputs)counts[id]=(counts[id]||0)+1;return counts;
 }
 function canCraft(state,recipe){return Object.entries(ingredientCounts(recipe.inputs)).every(([id,count])=>(state.items[id]||0)>=count);}
 function craft(state,recipe){
  if(!canCraft(state,recipe))return false;
  const inputs=ingredientCounts(recipe.inputs);
  if(recipe.consumeInputs!==false)for(const [id,count] of Object.entries(inputs))state.items[id]-=count;
  const outputs=recipe.outputItemId?{[recipe.outputItemId]:recipe.outputCount??1}:ingredientCounts(recipe.outputs||[]);
  for(const [id,count] of Object.entries(outputs))state.items[id]=(state.items[id]||0)+count;
  return true;
 }
 function matchesRecipe(selected,recipe){
  const a=ingredientCounts(selected),b=ingredientCounts(recipe.inputs);
  return Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(key=>a[key]===b[key]);
 }
 function inCircle(point,target){return Math.hypot(point.x-target.x,point.y-target.y)<=target.radius;}
 function inRect(point,target){return Math.abs(point.x-target.x)<=target.width/2&&Math.abs(point.y-target.y)<=target.height/2;}
 function swipeMatches(start,end,{direction='any',minDistance=0,angleTolerance=30}={}){
  const dx=end.x-start.x,dy=end.y-start.y,length=Math.hypot(dx,dy);
  if(length<minDistance)return false;
  if(direction==='any')return true;
  const angle=Math.atan2(dy,dx)*180/Math.PI,target={right:0,down:90,left:180,up:-90}[direction];
  if(target===undefined)return false;
  const distance=Math.abs(((angle-target+540)%360)-180);
  return distance<=angleTolerance;
 }
 function patternPoints(config){
  if(config.pattern==='custom')return (config.custom_points||[]).map(value=>{const [x,y]=value.split(',').map(Number);return {x,y};});
  const [cx,cy]=(config.center||'.5,.5').split(',').map(Number),count=config.sample_count||300,petals=config.petal_count||5,outer=config.outer_radius||.3,inner=config.inner_radius||.1,power=config.petal_power||1.4;
  return Array.from({length:count},(_,i)=>{const angle=-Math.PI/2+i/count*Math.PI*2,r=inner+(outer-inner)*Math.pow(Math.abs(Math.cos((angle+Math.PI/2)*petals/2)),power);return {x:cx+Math.cos(angle)*r,y:cy+Math.sin(angle)*r};});
 }
 function resample(points,count=300){
  if(points.length<2)return points;
  const closed=[...points,points[0]],lengths=[0];
  for(let i=1;i<closed.length;i++)lengths.push(lengths[i-1]+Math.hypot(closed[i].x-closed[i-1].x,closed[i].y-closed[i-1].y));
  const total=lengths.at(-1);let segment=1;
  return Array.from({length:count},(_,i)=>{const distance=i/count*total;while(segment<lengths.length-1&&lengths[segment]<distance)segment++;const t=(distance-lengths[segment-1])/(lengths[segment]-lengths[segment-1]||1),a=closed[segment-1],b=closed[segment];return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};});
 }
 function traceMetrics(trace,template,tolerance=.032){
  if(!trace.length||!template.length)return {accuracy:0,coverage:0};
  const close=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<=tolerance;
  return {accuracy:trace.filter(point=>template.some(target=>close(point,target))).length/trace.length,coverage:template.filter(target=>trace.some(point=>close(point,target))).length/template.length};
 }
 function traceResult(trace,config){
  const template=resample(patternPoints(config)),metrics=traceMetrics(trace,template,config.tolerance??.032);
  return {...metrics,retry:metrics.coverage<(config.minimum_progress??.25),success:metrics.accuracy>=(config.accuracy_threshold??.7)&&metrics.coverage>=(config.coverage_threshold??.75)};
 }
 function mediaFrameAt(images,time,duration){
  if(!images?.length)return -1;
  let elapsed=0;
  for(let i=0;i<images.length;i++){elapsed+=Number(images[i].duration)||0;if(time<elapsed)return i;}
  return images.length-1;
 }
 function peekDanger(time,windows){return (windows||[]).some(window=>time>=window.start&&time<window.end);}
 function sceneResult(viewed,config){
  const ids=new Set(viewed);
  for(const rule of config.completionConditions||[])if(rule.requiredPointIds.every(id=>ids.has(id)))return rule.result;
  return ids.size>=(config.completionThreshold??Infinity)?1:null;
 }
 function rageValue(value,node){return Math.max(0,value+(node.rage_delta||0));}
 function rhythmNoteEnd(note){
  const action=['OSUHoldNote','OSUFightNote','OSUMashNote'].includes(note.noteType)?Number(note.floatParam)||0:0;
  return Number(note.perfectTime)+Math.max(Number(note.duration)||0,action);
 }
 function activeNotes(notes,time,resolved=new Set()){
  return notes.filter((note,index)=>!resolved.has(index)&&time>=note.perfectTime-(note.duration||0)&&time<=rhythmNoteEnd(note));
 }
 function rhythmResult(beatmap,judgments,targetScore=80){
  const notes=beatmap.notes||[],misses=judgments.filter(value=>!value).length,score=notes.length?judgments.reduce((a,b)=>a+(b||0),0)/notes.length:0;
  const limit=Number(beatmap.maxMistakes??-1);
  return {score,misses,failedEarly:limit>=0&&misses>limit,success:beatmap.mode==='qte'?(limit<0||misses<=limit):score>=targetScore};
 }
 function validateGraph(chapters){
  const errors=[];
  for(const chapter of chapters){
   const nodes=[...chapter.nodes,...(chapter.side_nodes||[])],ids=new Set(nodes.map(node=>node.id));
   if(!ids.has(chapter.meta.startNodeId))errors.push(`Unknown start: ${chapter.meta.startNodeId}`);
   for(const node of nodes){
    const next=[node.next,...(node.choices||[]).map(choice=>choice.next),...Object.values(node.qte?.next_node_map||{})].filter(Boolean);
    for(const id of next)if(!ids.has(id))errors.push(`${node.id} -> ${id}`);
   }
  }
  return errors;
 }
 return {clone,clamp,nodeKey,amount,initialState,applyEffects,conditionMet,conditionsMet,choicesFor,choose,qteOutcome,recordVisit,canUse,useItem,ingredientCounts,canCraft,craft,matchesRecipe,inCircle,inRect,swipeMatches,patternPoints,resample,traceMetrics,traceResult,mediaFrameAt,peekDanger,sceneResult,rageValue,rhythmNoteEnd,activeNotes,rhythmResult,validateGraph};
});
