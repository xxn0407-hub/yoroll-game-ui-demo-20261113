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
 assert.equal(graph.nodes.length,19);
 for(const id of ['17','18','19']){
  assert(graph.edges.some(([,to])=>to===id));
  assert.equal(tree.canPlay(graph.nodes.find(n=>n.id===id)),false);
  assert.equal(tree.choosePath(graph,id).length,0);
 }
 let current='03';
 for(let i=0;i<5;i++)current=tree.nextNode(graph,current,'ArrowRight');
 assert.equal(current,'09');
});
check('Reveal keeps visible nodes steady and brings offscreen nodes fully into view',()=>{
 const first=graph.nodes[0],last=graph.nodes.at(-1);
 assert.equal(tree.revealOffset(graph.nodes.find(n=>n.id==='03'),1257,0),0);
 for(const node of graph.nodes){
  const left=tree.revealOffset(node,1257,0);
  assert(left>=0&&left<=tree.layout.width-1257);
  assert(node.x>=left&&node.x+tree.layout.nodeWidth<=left+1257);
 }
 assert.equal(tree.revealOffset(first,1257,tree.layout.width-1257),0);
 assert.equal(tree.revealOffset(last,340,0),last.x);
 assert.equal(tree.revealOffset(last,tree.layout.width,0),0);
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
console.log(JSON.stringify({passed:checks.length,checks},null,2));
