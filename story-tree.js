'use strict';
// Local preview routes, independent of the online game's chapter data.
window.YorollStoryTree = (() => {
 const layout = {nodeWidth:340,nodeHeight:191.25,columnGap:85,rowGap:64,paddingX:40,paddingY:56};
 const previewProgress={'01':100,'02':64,'03':22,'05':100,'06':35,'09':12};
 function create(chapter){
  const nodes = [
   {id:'01',name:'整装待发',cover:'assets/garage.jpg',route:'故事起点',explored:true,description:'离开车库之前，最后确认车辆与路线。下一段旅程由你选择。'},
   {id:'02',name:'雨夜近道',cover:'assets/chapter-night.webp',route:'雨夜支线',explored:true,description:'穿过城市的雨幕，沿着灯光寻找一条更快的近道。'},
   {id:'03',name:chapter.name,cover:chapter.cover,route:'主线',explored:true,description:'沿着熟悉的主路出发，在下一个路口决定前进的方向。'},
   {id:'04',name:'港口支线',cover:'assets/chapter-harbor.webp',route:'港口支线',explored:false,description:'绕行旧港，跟随远处的车灯，探索另一条通往终点的路线。'},
   {id:'05',name:'山路出口',cover:'assets/chapter-mountain.webp',route:'山路支线',explored:true,description:'雨夜近道与主路在山口相遇。晨光中，新的旅程即将展开。'},
   {id:'06',name:'赛道汇合',cover:'assets/garage.jpg',route:'路线汇合',explored:true,description:'来自主路与港口的车流在这里汇合，继续驶向共同的目标。'},
   {id:'07',name:'远港灯火',cover:'assets/chapter-harbor.webp',route:'港口支线',explored:false,description:'沿港口路线抵达海岸，在远处的灯火下发现另一段故事。'},
   {id:'08',name:'破晓来电',cover:'assets/chapter-mountain.webp',route:'山路支线',explored:false,description:'山口传来一通新的联络，指引你穿过晨雾，寻找下一处集合点。'},
   {id:'09',name:'黎明关口',cover:'assets/garage.jpg',route:'路线汇合',explored:true,description:'山路与赛道在黎明前相遇。在关口停留片刻，决定接下来的方向。'},
   {id:'10',name:'穿城而过',cover:'assets/chapter-night.webp',route:'城市支线',explored:false,description:'沿着城市边缘继续前进，穿过灯光与车流，追上远处的同伴。'},
   {id:'11',name:'云上弯道',cover:'assets/chapter-mountain.webp',route:'山路汇合',explored:false,description:'车道沿山势缓缓抬升，云层之间，一条新的路线出现在眼前。'},
   {id:'12',name:'旧站重逢',cover:'assets/garage.jpg',route:'路线汇合',explored:false,description:'在旧站与同伴重新会合。短暂停留之后，旅程仍会继续。'},
   {id:'13',name:'海岸信号',cover:'assets/chapter-harbor.webp',route:'海岸支线',explored:false,description:'海岸传来一束新的信号，沿着码头边缘，驶向另一段未知的故事。'},
   {id:'14',name:'追向晨光',cover:'assets/chapter-mountain.webp',route:'山路汇合',explored:false,description:'山路与旧站的路线在晨光里相遇。保持自己的节奏，驶向最后的山口。'},
   {id:'15',name:'最后的约定',cover:'assets/chapter-night.webp',route:'路线汇合',explored:false,description:'来自旧站和海岸的线索在这里交汇。做出选择，完成最后的约定。'},
   {id:'16',name:'潮汐之间',cover:'assets/chapter-harbor.webp',route:'海岸支线',explored:false,description:'潮水慢慢退去，沿海的道路重新出现。跟随信号，靠近旅程的尽头。'},
   {id:'17',name:'群山之后',cover:'assets/chapter-mountain.webp',route:'主线结局',explored:false,description:'穿过群山，迎来清晨的第一束光。所有选择，终于在这里得到回应。'},
   {id:'18',name:'再度汇合',cover:'assets/garage.jpg',route:'路线汇合',explored:false,description:'熟悉的车库里，同伴已经等候多时。新的故事，将从这里再次开始。'},
   {id:'19',name:'灯火回响',cover:'assets/chapter-harbor.webp',route:'海岸支线',explored:false,description:'沿着海岸继续前进，远处的灯光正在回应你的选择。'},
   {id:'20',name:'山口回声',cover:'assets/chapter-mountain.webp',route:'山路支线',explored:false,description:'一个新的信号从山口传来，带你走向另一条未知的路。'},
   {id:'21',name:'隧道迷光',cover:'assets/chapter-night.webp',route:'隧道支线',explored:false,description:'穿过隧道，短暂消失的光再次出现。这里藏着另一种可能。'},
   {id:'22',name:'旧港线索',cover:'assets/chapter-harbor.webp',route:'港口支线',explored:false,description:'旧港留下了一条线索，沿着它继续寻找失散的同伴。'},
   {id:'23',name:'无声追逐',cover:'assets/chapter-night.webp',route:'城市支线',explored:false,description:'车灯掠过寂静的街道，一场新的追逐悄然开始。'},
   {id:'24',name:'第二次选择',cover:'assets/garage.jpg',route:'路线汇合',explored:false,description:'来自不同道路的线索在这里相遇。再一次决定故事的方向。'},
   {id:'25',name:'向海而生',cover:'assets/chapter-harbor.webp',route:'海岸结局',explored:false,description:'沿着这条路抵达海岸，听见属于自己的答案。'},
   {id:'26',name:'黎明以后',cover:'assets/chapter-mountain.webp',route:'山路结局',explored:false,description:'山间的晨光照亮前路，这一路的选择终于有了回应。'},
   {id:'27',name:'长路同行',cover:'assets/garage.jpg',route:'汇合结局',explored:false,description:'同伴再次聚在一起，下一段旅程会由你们共同书写。'},
   {id:'28',name:'最后一盏灯',cover:'assets/chapter-harbor.webp',route:'支线结局',explored:false,description:'抵达最后一盏灯下，在安静的潮声中留住旅途的回忆。'}
  ].map(node=>({...node,progress:previewProgress[node.id]||0,locked:!node.explored}));
  const edges = [['01','02'],['01','03'],['01','04'],['02','05'],['03','06'],['03','05'],['04','06'],['05','08'],['05','09'],['05','20'],['06','07'],['06','09'],['06','10'],['08','11'],['20','11'],['09','11'],['09','12'],['10','12'],['11','13'],['11','14'],['11','21'],['11','15'],['12','15'],['12','16'],['12','22'],['13','17'],['14','17'],['21','18'],['15','18'],['16','19'],['22','19'],['18','23'],['18','24'],['19','24'],['23','25'],['23','26'],['24','27'],['24','28']];
  return arrange(nodes,edges);
 }
 function arrange(source,edges){
  const ids=new Set(source.map(node=>node.id));
  if(ids.size!==source.length)throw new Error('Duplicate story fragment ID.');
  const parents=new Map(source.map(n=>[n.id,[]])),children=new Map(source.map(n=>[n.id,[]]));
  for(const [from,to] of edges){
   if(!ids.has(from)||!ids.has(to))throw new Error('Story connection references a missing fragment.');
   children.get(from).push(to);parents.get(to).push(from);
  }
  const pending=new Map(source.map(n=>[n.id,parents.get(n.id).length]));
  const ranks=new Map(source.map(n=>[n.id,0])),queue=source.filter(n=>!pending.get(n.id)).map(n=>n.id);
  for(let cursor=0;cursor<queue.length;cursor++){
   const id=queue[cursor];
   for(const child of children.get(id)){
    ranks.set(child,Math.max(ranks.get(child),ranks.get(id)+1));
    pending.set(child,pending.get(child)-1);if(!pending.get(child))queue.push(child);
   }
  }
  if(queue.length!==source.length)throw new Error('Story connections must be acyclic.');
  const layers=Array.from({length:Math.max(0,...ranks.values())+1},()=>[]);
  for(const node of source)layers[ranks.get(node.id)].push(node.id);
  const positions=new Map();
  const refresh=()=>layers.forEach(layer=>layer.forEach((id,i)=>positions.set(id,layer.length===1?.5:i/(layer.length-1))));
  refresh();
  // Alternating barycentric sweeps keep related branches close at splits and merges.
  for(let pass=0;pass<4;pass++){
   for(const direction of [1,-1]){
    const ordered=direction===1?layers.slice(1):layers.slice(0,-1).reverse();
    const neighbors=direction===1?parents:children;
    for(const layer of ordered){
     const previous=new Map(layer.map((id,i)=>[id,i]));
     const score=id=>{const related=neighbors.get(id);return related.length?related.reduce((sum,n)=>sum+positions.get(n),0)/related.length:positions.get(id);};
     layer.sort((a,b)=>score(a)-score(b)||previous.get(a)-previous.get(b));refresh();
    }
   }
  }
  const tallest=Math.max(1,...layers.map(layer=>layer.length));
  const height=tallest*layout.nodeHeight+(tallest-1)*layout.rowGap+layout.paddingY*2;
  const width=(layers.length-1)*(layout.nodeWidth+layout.columnGap)+layout.nodeWidth+layout.paddingX*2;
  const geometry=new Map();
  layers.forEach((layer,column)=>{
   const span=layer.length*layout.nodeHeight+Math.max(0,layer.length-1)*layout.rowGap;
   layer.forEach((id,row)=>geometry.set(id,{column,row,layerSize:layer.length,x:layout.paddingX+column*(layout.nodeWidth+layout.columnGap),y:(height-span)/2+row*(layout.nodeHeight+layout.rowGap)}));
  });
  return {nodes:source.map(node=>({...node,...geometry.get(node.id)})),edges,layers,layout:{...layout,width,height}};
 }

 function choosePath(graph,id,previous=[]){
  if(!canPlay(graph.nodes.find(node=>node.id===id)))return [];
  const parents=new Map(graph.nodes.map(n=>[n.id,[]]));
  for(const [from,to] of graph.edges)parents.get(to).push(from);
  const best=new Map();
  const score=path=>{let count=0;while(count<path.length&&count<previous.length&&path[count]===previous[count])count++;return count;};
  for(const node of [...graph.nodes].sort((a,b)=>a.column-b.column)){
   if(!canPlay(node))continue;
   const incoming=parents.get(node.id);
   if(!incoming.length){best.set(node.id,[node.id]);continue;}
   let path=[],value=-1;
   for(const parent of incoming){
    if(!best.has(parent))continue;
    const candidate=[...best.get(parent),node.id],rank=score(candidate);
    if(rank>value){path=candidate;value=rank;}
   }
   if(path.length)best.set(node.id,path);
  }
  return best.get(id)||[];
 }

 function nextNode(graph,id,key,path=[]){
  const available=graph.nodes.filter(canPlay).sort((a,b)=>a.column-b.column||a.y-b.y),node=available.find(item=>item.id===id);
  if(!node)return available[0]?.id||id;
  if(key==='Home')return available[0].id;
  if(key==='End')return available.at(-1).id;
  if(key==='ArrowUp'||key==='ArrowDown'){
   const direction=key==='ArrowUp'?-1:1;
   return available.filter(item=>item.column===node.column&&(item.y-node.y)*direction>0)
    .sort((a,b)=>Math.abs(a.y-node.y)-Math.abs(b.y-node.y))[0]?.id||id;
  }
  const targetIndex=key==='ArrowRight'?1:key==='ArrowLeft'?0:-1;
  if(targetIndex<0)return id;
  const ids=graph.edges.filter(edge=>edge[1-targetIndex]===id).map(edge=>edge[targetIndex]);
  const previous=path[path.indexOf(id)-1];
  if(key==='ArrowLeft'&&ids.includes(previous)&&available.some(item=>item.id===previous))return previous;
  return available.filter(item=>ids.includes(item.id))
   .sort((a,b)=>Math.abs(a.y-node.y)-Math.abs(b.y-node.y)||ids.indexOf(a.id)-ids.indexOf(b.id))[0]?.id||id;
 }
 function linkPath(from,to){
  const sx=from.x+layout.nodeWidth,sy=from.y+layout.nodeHeight/2;
  const ex=to.x,ey=to.y+layout.nodeHeight/2;
  const lane=from.layerSize>1?.25+.5*from.row/(from.layerSize-1):.5,mx=sx+(ex-sx)*lane;
  if(sy===ey)return `M ${sx} ${sy} H ${ex}`;
  const sign=Math.sign(ey-sy),r=16;
  return `M ${sx} ${sy} H ${mx-r} Q ${mx} ${sy} ${mx} ${sy+sign*r} V ${ey-sign*r} Q ${mx} ${ey} ${mx+r} ${ey} H ${ex}`;
 }
 function revealPosition(graph,node,viewport,current={x:0,y:0},{center=false,margin=28}={}){
  const axis=(start,size,visible,offset,total)=>{
   const inset=Math.min(margin,Math.max(0,(visible-size)/2));
   let next=offset;
   if(center)next=start+(size-visible)/2;
   else if(start<offset+inset)next=start-inset;
   else if(start+size>offset+visible-inset)next=start+size-visible+inset;
   return Math.max(0,Math.min(Math.max(0,total-visible),next));
  };
  return {x:axis(node.x,layout.nodeWidth,viewport.width,current.x,graph.layout.width),y:axis(node.y,layout.nodeHeight,viewport.height,current.y,graph.layout.height)};
 }

 function canPlay(node){return Boolean(node&&node.explored&&node.locked===false);}
 return {layout,create,arrange,choosePath,nextNode,linkPath,revealPosition,canPlay};
})();
