'use strict';
// Local preview routes, independent of the online game's chapter data.
window.YorollStoryTree = (() => {
 const layout = {width:2930,height:724,nodeWidth:340,nodeHeight:191.25};
 const previewProgress={'01':100,'02':64,'03':22,'05':100,'06':35,'09':12};
 function create(chapter){
  const nodes = [
   {id:'01',column:0,row:1,name:'整装待发',cover:'assets/garage.jpg',route:'故事起点',explored:true,description:'离开车库之前，最后确认车辆与路线。下一段旅程由你选择。'},
   {id:'02',column:1,row:0,name:'雨夜近道',cover:'assets/chapter-night.webp',route:'雨夜支线',explored:true,description:'穿过城市的雨幕，沿着灯光寻找一条更快的近道。'},
   {id:'03',column:1,row:1,name:chapter.name,cover:chapter.cover,route:'主线',explored:true,description:'沿着熟悉的主路出发，在下一个路口决定前进的方向。'},
   {id:'04',column:1,row:2,name:'港口支线',cover:'assets/chapter-harbor.webp',route:'港口支线',explored:false,description:'绕行旧港，跟随远处的车灯，探索另一条通往终点的路线。'},
   {id:'05',column:2,row:0,name:'山路出口',cover:'assets/chapter-mountain.webp',route:'山路支线',explored:true,description:'雨夜近道与主路在山口相遇。晨光中，新的旅程即将展开。'},
   {id:'06',column:2,row:1,name:'赛道汇合',cover:'assets/garage.jpg',route:'路线汇合',explored:true,description:'来自主路与港口的车流在这里汇合，继续驶向共同的目标。'},
   {id:'07',column:2,row:2,name:'远港灯火',cover:'assets/chapter-harbor.webp',route:'港口支线',explored:false,description:'沿港口路线抵达海岸，在远处的灯火下发现另一段故事。'},
   {id:'08',column:3,row:0,name:'破晓来电',cover:'assets/chapter-mountain.webp',route:'山路支线',explored:false,description:'山口传来一通新的联络，指引你穿过晨雾，寻找下一处集合点。'},
   {id:'09',column:3,row:1,name:'黎明关口',cover:'assets/garage.jpg',route:'路线汇合',explored:true,description:'山路与赛道在黎明前相遇。在关口停留片刻，决定接下来的方向。'},
   {id:'10',column:3,row:2,name:'穿城而过',cover:'assets/chapter-night.webp',route:'城市支线',explored:false,description:'沿着城市边缘继续前进，穿过灯光与车流，追上远处的同伴。'},
   {id:'11',column:4,row:0,name:'云上弯道',cover:'assets/chapter-mountain.webp',route:'山路汇合',explored:false,description:'车道沿山势缓缓抬升，云层之间，一条新的路线出现在眼前。'},
   {id:'12',column:4,row:1,name:'旧站重逢',cover:'assets/garage.jpg',route:'路线汇合',explored:false,description:'在旧站与同伴重新会合。短暂停留之后，旅程仍会继续。'},
   {id:'13',column:4,row:2,name:'海岸信号',cover:'assets/chapter-harbor.webp',route:'海岸支线',explored:false,description:'海岸传来一束新的信号，沿着码头边缘，驶向另一段未知的故事。'},
   {id:'14',column:5,row:0,name:'追向晨光',cover:'assets/chapter-mountain.webp',route:'山路汇合',explored:false,description:'山路与旧站的路线在晨光里相遇。保持自己的节奏，驶向最后的山口。'},
   {id:'15',column:5,row:1,name:'最后的约定',cover:'assets/chapter-night.webp',route:'路线汇合',explored:false,description:'来自旧站和海岸的线索在这里交汇。做出选择，完成最后的约定。'},
   {id:'16',column:5,row:2,name:'潮汐之间',cover:'assets/chapter-harbor.webp',route:'海岸支线',explored:false,description:'潮水慢慢退去，沿海的道路重新出现。跟随信号，靠近旅程的尽头。'},
   {id:'17',column:6,row:0,name:'群山之后',cover:'assets/chapter-mountain.webp',route:'主线结局',explored:false,description:'穿过群山，迎来清晨的第一束光。所有选择，终于在这里得到回应。'},
   {id:'18',column:6,row:1,name:'一起出发',cover:'assets/garage.jpg',route:'汇合结局',explored:false,description:'熟悉的车库里，同伴已经等候多时。新的故事，将从这里再次开始。'},
   {id:'19',column:6,row:2,name:'灯火尽头',cover:'assets/chapter-harbor.webp',route:'支线结局',explored:false,description:'沿着最后一盏灯抵达海岸，在安静的潮声中，留住这一路的回忆。'}
  ].map(node=>({...node,progress:previewProgress[node.id]||0,locked:!node.explored,x:20+425*node.column,y:[24,266.375,508.75][node.row]}));
  const edges = [['01','02'],['01','03'],['01','04'],['02','05'],['03','05'],['03','06'],['04','06'],['04','07'],['05','08'],['05','09'],['06','09'],['06','10'],['07','10'],['08','11'],['09','11'],['09','12'],['10','12'],['10','13'],['11','14'],['12','14'],['12','15'],['13','15'],['13','16'],['14','17'],['15','17'],['15','18'],['16','18'],['16','19']];
  return {nodes,edges};
 }
 function pathsTo(graph,id){
  if(!graph.nodes.some(node=>node.id===id))return [];
  const parents=graph.edges.filter(edge=>edge[1]===id).map(edge=>edge[0]);
  return parents.length?parents.flatMap(parent=>pathsTo(graph,parent).map(path=>[...path,id])):[[id]];
 }
 function choosePath(graph,id,previous=[]){
  if(!canPlay(graph.nodes.find(node=>node.id===id)))return [];
  let best=[],bestScore=-1;
  for(const path of pathsTo(graph,id)){
   if(!path.every(step=>canPlay(graph.nodes.find(node=>node.id===step))))continue;
   let score=0;
   while(score<path.length&&score<previous.length&&path[score]===previous[score])score++;
   if(score>bestScore){best=path;bestScore=score;}
  }
  return best;
 }
 function nextNode(graph,id,key,path=[]){
  const available=graph.nodes.filter(canPlay),node=available.find(item=>item.id===id);
  if(!node)return available[0]?.id||id;
  if(key==='Home')return available[0].id;
  if(key==='End')return available.at(-1).id;
  if(key==='ArrowUp'||key==='ArrowDown'){
   const direction=key==='ArrowUp'?-1:1;
   return available.filter(item=>item.column===node.column&&(item.row-node.row)*direction>0)
    .sort((a,b)=>Math.abs(a.row-node.row)-Math.abs(b.row-node.row))[0]?.id||id;
  }
  const targetIndex=key==='ArrowRight'?1:key==='ArrowLeft'?0:-1;
  if(targetIndex<0)return id;
  const ids=graph.edges.filter(edge=>edge[1-targetIndex]===id).map(edge=>edge[targetIndex]);
  const previous=path[path.indexOf(id)-1];
  if(key==='ArrowLeft'&&ids.includes(previous)&&available.some(item=>item.id===previous))return previous;
  return available.filter(item=>ids.includes(item.id))
   .sort((a,b)=>Math.abs(a.row-node.row)-Math.abs(b.row-node.row))[0]?.id||id;
 }
 function linkPath(from,to){
  const sx=from.x+layout.nodeWidth,sy=from.y+layout.nodeHeight/2;
  const ex=to.x,ey=to.y+layout.nodeHeight/2,mx=(sx+ex)/2;
  if(sy===ey)return `M ${sx} ${sy} H ${ex}`;
  const sign=Math.sign(ey-sy),r=16;
  return `M ${sx} ${sy} H ${mx-r} Q ${mx} ${sy} ${mx} ${sy+sign*r} V ${ey-sign*r} Q ${mx} ${ey} ${mx+r} ${ey} H ${ex}`;
 }
 function revealOffset(node,viewportWidth,current,margin=28){
  margin=Math.min(margin,Math.max(0,(viewportWidth-layout.nodeWidth)/2));
  const max=Math.max(0,layout.width-viewportWidth);
  let next=current;
  if(node.x<current+margin)next=node.x-margin;
  else if(node.x+layout.nodeWidth>current+viewportWidth-margin)next=node.x+layout.nodeWidth-viewportWidth+margin;
  return Math.max(0,Math.min(max,next));
 }
 function canPlay(node){return Boolean(node&&node.explored&&node.locked===false);}
 return {layout,create,choosePath,nextNode,linkPath,revealOffset,canPlay};
})();
