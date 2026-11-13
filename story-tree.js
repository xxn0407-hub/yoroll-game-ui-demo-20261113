'use strict';
// Local preview routes, independent of the online game's chapter data.
window.YorollStoryTree = (() => {
 const layout = {width:1230,height:724,nodeWidth:340,nodeHeight:191.25};
 function create(chapter){
  const nodes = [
   {id:'01',column:0,row:1,name:'整装待发',cover:'assets/garage.jpg',route:'故事起点',explored:true,description:'离开车库之前，最后确认车辆与路线。下一段旅程由你选择。'},
   {id:'02',column:1,row:0,name:'雨夜近道',cover:'assets/chapter-night.webp',route:'雨夜支线',explored:true,description:'穿过城市的雨幕，沿着灯光寻找一条更快的近道。'},
   {id:'03',column:1,row:1,name:chapter.name,cover:chapter.cover,route:'主线',explored:true,description:'沿着熟悉的主路出发，在下一个路口决定前进的方向。'},
   {id:'04',column:1,row:2,name:'港口支线',cover:'assets/chapter-harbor.webp',route:'港口支线',explored:false,description:'绕行旧港，跟随远处的车灯，探索另一条通往终点的路线。'},
   {id:'05',column:2,row:0,name:'山路出口',cover:'assets/chapter-mountain.webp',route:'路线终点',explored:true,description:'雨夜近道与主路在山口相遇。晨光中，新的旅程即将展开。'},
   {id:'06',column:2,row:1,name:'赛道汇合',cover:'assets/garage.jpg',route:'路线汇合',explored:true,description:'来自主路与港口的车流在这里汇合，继续驶向共同的目标。'},
   {id:'07',column:2,row:2,name:'远港灯火',cover:'assets/chapter-harbor.webp',route:'支线终点',explored:false,description:'沿港口路线抵达海岸，在远处的灯火下发现另一段故事。'}
  ].map(node=>({...node,x:[20,445,870][node.column],y:[24,266.375,508.75][node.row]}));
  const edges = [['01','02'],['01','03'],['01','04'],['02','05'],['03','05'],['03','06'],['04','06'],['04','07']];
  return {nodes,edges};
 }
 function pathsTo(graph,id){
  if(!graph.nodes.some(node=>node.id===id))return [];
  const parents=graph.edges.filter(edge=>edge[1]===id).map(edge=>edge[0]);
  return parents.length?parents.flatMap(parent=>pathsTo(graph,parent).map(path=>[...path,id])):[[id]];
 }
 function choosePath(graph,id,previous=[]){
  let best=[],bestScore=-1;
  for(const path of pathsTo(graph,id)){
   let score=0;
   while(score<path.length&&score<previous.length&&path[score]===previous[score])score++;
   if(score>bestScore){best=path;bestScore=score;}
  }
  return best;
 }
 function nextNode(graph,id,key,path=[]){
  const node=graph.nodes.find(item=>item.id===id);
  if(!node)return id;
  if(key==='Home')return graph.nodes[0].id;
  if(key==='End')return graph.nodes.at(-1).id;
  if(key==='ArrowUp'||key==='ArrowDown'){
   const direction=key==='ArrowUp'?-1:1;
   return graph.nodes.filter(item=>item.column===node.column&&(item.row-node.row)*direction>0)
    .sort((a,b)=>Math.abs(a.row-node.row)-Math.abs(b.row-node.row))[0]?.id||id;
  }
  const targetIndex=key==='ArrowRight'?1:key==='ArrowLeft'?0:-1;
  if(targetIndex<0)return id;
  const ids=graph.edges.filter(edge=>edge[1-targetIndex]===id).map(edge=>edge[targetIndex]);
  const previous=path[path.indexOf(id)-1];
  if(key==='ArrowLeft'&&ids.includes(previous))return previous;
  return graph.nodes.filter(item=>ids.includes(item.id))
   .sort((a,b)=>Math.abs(a.row-node.row)-Math.abs(b.row-node.row))[0]?.id||id;
 }
 function linkPath(from,to){
  const sx=from.x+layout.nodeWidth,sy=from.y+layout.nodeHeight/2;
  const ex=to.x,ey=to.y+layout.nodeHeight/2,mx=(sx+ex)/2;
  if(sy===ey)return `M ${sx} ${sy} H ${ex}`;
  const sign=Math.sign(ey-sy),r=16;
  return `M ${sx} ${sy} H ${mx-r} Q ${mx} ${sy} ${mx} ${sy+sign*r} V ${ey-sign*r} Q ${mx} ${ey} ${mx+r} ${ey} H ${ex}`;
 }
 return {layout,create,choosePath,nextNode,linkPath};
})();
