import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=process.argv[2];
if(!root)throw new Error('Pass the prototype directory.');
const context=vm.createContext({window:{}});
vm.runInContext(fs.readFileSync(path.join(root,'story-tree.js'),'utf8'),context);
const tree=context.window.YorollStoryTree;
const graph=tree.create({name:'当前章节',cover:'chapter.webp'});
const checks=[];
function check(name,run){run();checks.push(name);}
const route=(id,previous)=>tree.choosePath(graph,id,previous).join('>');

check('Future branches remain connected while active routes only use unlocked nodes',()=>{
 const reached=new Set();
 const walk=(id,ancestors=[])=>{
  assert(!ancestors.includes(id),'Cycle in story graph');
  reached.add(id);
  for(const [from,to] of graph.edges)if(from===id)walk(to,[...ancestors,id]);
 };
 walk('01');
 for(const node of graph.nodes){
  assert(reached.has(node.id),'Disconnected story fragment');
  const ids=Array.from(tree.choosePath(graph,node.id));
  if(!tree.canPlay(node)){assert.equal(ids.length,0);continue;}
  assert.equal(ids[0],'01');assert.equal(ids.at(-1),node.id);
  assert(ids.every(id=>tree.canPlay(graph.nodes.find(n=>n.id===id))));
  for(let i=1;i<ids.length;i++)assert(graph.edges.some(([a,b])=>a===ids[i-1]&&b===ids[i]));
 }
});
check('A converging route retains the branch the user selected',()=>{
 assert.equal(route('06',['01','04']),'01>03>06');
 assert.equal(route('06',['01','03']),'01>03>06');
 assert.equal(route('05',['01','02']),'01>02>05');
 assert.equal(route('05',['01','03']),'01>03>05');
 assert.equal(route('09',['01','02','05']),'01>02>05>09');
 assert.equal(route('09',['01','03','06']),'01>03>06>09');
});
check('Changing branches removes the previous branch from the active route',()=>{
 assert.equal(route('07',['01','02','05']),'');
 assert.equal(route('05',['01','03','06']),'01>03>05');
 assert.equal(route('03',['01','04','06']),'01>03');
 assert.equal(route('01',['01','04','07']),'01');
});
check('Directional navigation follows connected nodes and the chosen return route',()=>{
 assert.equal(tree.nextNode(graph,'03','ArrowRight',['01','03']),'06');
 assert.equal(tree.nextNode(graph,'06','ArrowLeft',['01','04','06']),'03');
 assert.equal(tree.nextNode(graph,'03','ArrowUp'),'02');
 assert.equal(tree.nextNode(graph,'03','ArrowDown'),'03');
 assert.equal(tree.nextNode(graph,'02','ArrowUp'),'02');
 assert.equal(tree.nextNode(graph,'09','ArrowRight'),'09');
 assert.equal(tree.nextNode(graph,'03','Home'),'01');
 assert.equal(tree.nextNode(graph,'02','End'),'09');
});
check('Each chapter gets fresh preview data and keeps its own main fragment',()=>{
 const other=tree.create({name:'另一个章节',cover:'other.webp'});
 assert.equal(other.nodes.find(n=>n.id==='03').name,'另一个章节');
 assert.equal(graph.nodes.find(n=>n.id==='03').name,'当前章节');
 assert.equal(other.nodes.find(n=>n.id==='03').cover,'other.webp');
});
check('Extended endings remain visible but cannot be selected before exploration',()=>{
 assert.equal(graph.nodes.length,28);
 for(const id of ['25','26','27','28']){
  assert(graph.edges.some(([,to])=>to===id));
  assert.equal(tree.canPlay(graph.nodes.find(n=>n.id===id)),false);
  assert.equal(tree.choosePath(graph,id).length,0);
 }
 let current='03';
 for(let i=0;i<5;i++)current=tree.nextNode(graph,current,'ArrowRight');
 assert.equal(current,'09');
});
check('Reveal brings a selected fragment into view on both axes',()=>{
 const viewport={width:1257,height:724};
 for(const node of graph.nodes){
  const camera=tree.revealPosition(graph,node,viewport);
  assert(camera.x>=0&&camera.x<=graph.layout.width-viewport.width);
  assert(camera.y>=0&&camera.y<=graph.layout.height-viewport.height);
  assert(node.x>=camera.x&&node.x+tree.layout.nodeWidth<=camera.x+viewport.width);
  assert(node.y>=camera.y&&node.y+tree.layout.nodeHeight<=camera.y+viewport.height);
  const stable=tree.revealPosition(graph,node,viewport,camera);
  assert.equal(stable.x,camera.x);assert.equal(stable.y,camera.y);
 }
 const last=graph.nodes.at(-1);
 const exact=tree.revealPosition(graph,last,{width:tree.layout.nodeWidth,height:tree.layout.nodeHeight});
 assert.equal(exact.x,last.x);assert.equal(exact.y,last.y);
});
check('Every fragment has a percentage and unexplored fragments have zero progress',()=>{
 for(const node of graph.nodes){
  assert(Number.isInteger(node.progress)&&node.progress>=0&&node.progress<=100);
  assert.equal(node.locked,!node.explored);
  assert.equal(tree.canPlay(node),node.progress>0);
 }
 assert.equal(graph.nodes.find(n=>n.id==='01').progress,100);
 assert.equal(graph.nodes.find(n=>n.id==='03').progress,22);
 assert.equal(tree.canPlay(undefined),false);
});
check('All keyboard navigation targets are playable, including Home and End',()=>{
 for(const node of graph.nodes.filter(tree.canPlay)){
  for(const key of ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End']){
   const id=tree.nextNode(graph,node.id,key,tree.choosePath(graph,node.id));
   assert(tree.canPlay(graph.nodes.find(n=>n.id===id)),`${key} selected locked fragment ${id}`);
  }
 }
});
check('Branch density varies, merges exist, and short branches can end early',()=>{
 const counts=graph.layers.map(layer=>layer.length);
 assert(new Set(counts).size>=4);assert(Math.max(...counts)>3);
 assert(graph.nodes.some(n=>graph.edges.filter(([from])=>from===n.id).length>=4));
 assert(graph.nodes.some(n=>graph.edges.filter(([,to])=>to===n.id).length>=3));
 const leaves=graph.nodes.filter(n=>!graph.edges.some(([from])=>from===n.id));
 assert(Math.min(...leaves.map(n=>n.column))<Math.max(...leaves.map(n=>n.column)));
});
check('Automatic layout keeps the approved card size and never overlaps nodes',()=>{
 assert.equal(graph.layout.nodeWidth,340);assert.equal(graph.layout.nodeHeight,191.25);
 for(const a of graph.nodes){
  assert(a.x>=0&&a.y>=0&&a.x+340<=graph.layout.width&&a.y+191.25<=graph.layout.height);
  for(const b of graph.nodes){
   if(a.id===b.id)continue;
   assert(a.x+340<=b.x||b.x+340<=a.x||a.y+191.25<=b.y||b.y+191.25<=a.y,`Overlapping fragments ${a.id} and ${b.id}`);
  }
 }
 for(const [from,to] of graph.edges){
  const a=graph.nodes.find(n=>n.id===from),b=graph.nodes.find(n=>n.id===to);
  assert(a.x+340<b.x,'A connection should flow forward between cards.');
 }
});
check('Layout supports an eight-way split without fixed row slots',()=>{
 const nodes=[{id:'root'},...Array.from({length:8},(_,i)=>({id:`child-${i}`})),{id:'merge'}];
 const edges=nodes.slice(1,-1).flatMap(n=>[['root',n.id],[n.id,'merge']]);
 const fan=tree.arrange(nodes,edges);
 assert.equal(fan.layers[1].length,8);
 assert(fan.layout.height>8*tree.layout.nodeHeight);
 assert.equal(new Set(fan.nodes.filter(n=>n.column===1).map(n=>n.y)).size,8);
 assert.throws(()=>tree.arrange([{id:'a'},{id:'b'}],[['a','b'],['b','a']]),/acyclic/);
 assert.throws(()=>tree.arrange([{id:'a'}],[['a','missing']]),/missing/);
});
check('Route selection handles many merges while retaining the chosen path',()=>{
 const nodes=[{id:'root',explored:true,locked:false}],edges=[];
 let previous=['root'];const preferred=['root'];
 for(let depth=0;depth<20;depth++){
  const pair=[`a-${depth}`,`b-${depth}`];
  for(const id of pair){nodes.push({id,explored:true,locked:false});for(const from of previous)edges.push([from,id]);}
  preferred.push(pair[1]);previous=pair;
 }
 const merged=tree.arrange(nodes,edges);
 assert.equal(tree.choosePath(merged,previous[1],preferred).join('>'),preferred.join('>'));
});
console.log(JSON.stringify({passed:checks.length,checks},null,2));
