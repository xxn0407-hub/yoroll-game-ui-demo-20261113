'use strict';
const data=window.YOROLL_REPORT;
const $=s=>document.querySelector(s);
const pages=data.pages;
let index=Math.max(0,pages.findIndex(p=>p.id===location.hash.slice(1)));
if(!location.hash)index=pages.findIndex(p=>p.id==='settings');
let mode='wipe';
let replay=0;
$('#page-list').innerHTML=pages.map((p,i)=>`<button data-page="${p.id}"><small>${String(i+1).padStart(2,'0')}</small>${p.name}</button>`).join('');
$('#proportion-table').innerHTML=data.proportions.map(row=>`<tr>${row.map(cell=>`<td>${cell}</td>`).join('')}</tr>`).join('');
$('#scope-notes').innerHTML=data.notes.map(note=>`<li>${note}</li>`).join('');
function updatePage(){
 const page=pages[index];
 $('#page-name').textContent=page.name;
 $('#page-kind').textContent=page.kind;
 $('#page-count').textContent=`${String(index+1).padStart(2,'0')} / ${pages.length}`;
 $('#change').textContent=page.change;$('#ratio').textContent=page.ratio;$('#motion').textContent=page.motion;$('#interaction').textContent=page.interaction;
 $('#after-image').src=`comparison/after/${page.id}.jpg?v=tree-soft-edges-20261113`;
 $('#after-image').alt=page.name+'修改后';
 $('#before-image').hidden=!page.before;
 $('#no-before').hidden=Boolean(page.before);
 if(page.before){$('#before-image').src=`comparison/before/${page.before}`;$('#before-image').alt=page.name+'原版实际截图';}
 else $('#before-image').removeAttribute('src');
 $('#before-note').textContent=page.kind==='沿用已定方案'?'沿用本聊天之前已确认的封面构图与素材。':'该状态未在这次线上预览中观察到。新版提供可操作的补充动效示例。';
 $('#image-note').textContent=mode==='motion'?'当前为可操作的实时动效。页面内可以继续导航，点击重播可回到所选页面。':page.before?'原版来自线上实际截图；新版为本地浏览器截图。底图部分不同，对比重点为 UI 占比、层级与位置。':'左侧保留来源说明；右侧展示本轮方案。点击「播放动效」体验完整入场。';
 $('#open-prototype').href=`index.html?page=${page.id}&revision=tree-soft-edges-20261113`;
 document.querySelectorAll('[data-page]').forEach(button=>{if(button.dataset.page===page.id)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
 history.replaceState(null,'','#'+page.id);
 if(mode==='motion')loadMotion();
}
function loadMotion(){const page=pages[index];$('#motion-frame').src=`index.html?page=${page.id}&capture=1&revision=tree-soft-edges-20261113&replay=${++replay}`;}
function setMode(value){
 mode=value;$('#comparison').dataset.mode=mode;
 document.querySelectorAll('button[data-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===mode)));
 $('.still-stage').hidden=mode==='motion';$('.motion-stage').hidden=mode!=='motion';
 $('#slider-row').hidden=mode!=='wipe';$('#replay-motion').hidden=mode!=='motion';
 if(mode!=='motion')$('#motion-frame').removeAttribute('src');
 updatePage();
}
function setSplit(value){$('#after-layer').style.clipPath=`inset(0 0 0 ${value}%)`;$('#wipe-handle').style.left=value+'%';}
$('#wipe-slider').addEventListener('input',event=>setSplit(event.target.value));
let draggingSplit=false;
const stillStage=$('.still-stage');
function pointerSplit(event){const bounds=stillStage.getBoundingClientRect();const value=Math.max(0,Math.min(100,(event.clientX-bounds.left)/bounds.width*100));$('#wipe-slider').value=String(value);setSplit(value);}
stillStage.addEventListener('pointerdown',event=>{if(mode!=='wipe')return;event.preventDefault();draggingSplit=true;stillStage.setPointerCapture(event.pointerId);pointerSplit(event);});
stillStage.addEventListener('pointermove',event=>{if(draggingSplit)pointerSplit(event);});
stillStage.addEventListener('pointerup',()=>{draggingSplit=false;});
stillStage.addEventListener('pointercancel',()=>{draggingSplit=false;});
document.querySelectorAll('button[data-mode]').forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.mode)));
$('#page-list').addEventListener('click',event=>{const button=event.target.closest('[data-page]');if(button){index=pages.findIndex(p=>p.id===button.dataset.page);updatePage();}});
$('#prev').addEventListener('click',()=>{index=(index-1+pages.length)%pages.length;updatePage();});
$('#next').addEventListener('click',()=>{index=(index+1)%pages.length;updatePage();});
$('#replay-motion').addEventListener('click',loadMotion);
$('#fit-toggle').addEventListener('click',()=>{const fit=$('#comparison').classList.toggle('fit-stage');$('#fit-toggle').setAttribute('aria-pressed',String(fit));});
$('#safe-toggle').addEventListener('click',()=>{const visible=$('#comparison').classList.toggle('show-safe');$('#safe-toggle').setAttribute('aria-pressed',String(visible));});
window.addEventListener('hashchange',()=>{const next=pages.findIndex(p=>p.id===location.hash.slice(1));if(next>=0&&next!==index){index=next;updatePage();}});
updatePage();
