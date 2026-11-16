(function(){
 'use strict';
 const {icon,escape:e}=window.YorollPlayUI;
 function mount(c){
  const {body,type,q}=c;let selected=-1,engineState={};
  const cells=(count,render)=>Array.from({length:count},(_,i)=>render(i)).join('');
  const button=(i,label,cls='')=>`<button class="${cls}" data-native-cell="${i}" aria-label="${e(label||`位置 ${i+1}`)}">${label||''}</button>`;
  let content='';
  if(type==='sudoku'){
   const givens=[1,0,0,4,0,6,0,5,6,0,2,0,2,0,4,0,6,0,0,6,0,2,0,4,3,0,5,6,0,0,0,1,0,0,4,5];
   content=`<div class="suite-sudoku">${cells(36,i=>button(i,givens[i]||''))}</div><div class="suite-number-pad">${cells(6,i=>`<button data-native-number="${i+1}">${i+1}</button>`)}</div>`;
  }else if(type==='gomoku'){
   const initial={112:1,113:2,97:1,128:2,96:1,111:2};
   content=`<div class="suite-gomoku"><svg viewBox="0 0 560 560">${cells(15,i=>`<path d="M${i*40} 0v560M0 ${i*40}h560"/>`)}</svg><div class="suite-gomoku-grid">${cells(225,i=>`<button class="suite-gomoku-cell" data-native-cell="${i}" data-stone="${initial[i]||0}" aria-label="第 ${Math.floor(i/15)+1} 行，第 ${i%15+1} 列"></button>`)}</div></div>`;
  }else if(type==='ChessQTE'){
   const back=['♜','♞','♝','♛','♚','♝','♞','♜'];
   content=`<div class="suite-chess-board" style="grid-template-columns:repeat(8,1fr)">${cells(64,i=>button(i,i<8?back[i]:i<16?'♟':i>=56?['♖','♘','♗','♕','♔','♗','♘','♖'][i-56]:i>=48?'♙':'',`suite-chess-cell ${(Math.floor(i/8)+i)%2?'is-dark':''} ${i<16?'is-black':''}`))}</div>`;
  }else if(type==='ChineseChessQTE'){
   const pieces={0:'車',1:'馬',2:'象',3:'士',4:'將',5:'士',6:'象',7:'馬',8:'車',19:'砲',25:'砲',27:'卒',29:'卒',31:'卒',33:'卒',35:'卒',54:'兵',56:'兵',58:'兵',60:'兵',62:'兵',64:'炮',70:'炮',81:'车',82:'马',83:'相',84:'仕',85:'帅',86:'仕',87:'相',88:'马',89:'车'};
   content=`<div class="suite-xiangqi">${cells(90,i=>button(i,pieces[i]?`<span class="suite-xiangqi-piece ${i<45?'is-black':''}">${pieces[i]}</span>`:''))}</div>`;
  }else if(type==='tileslot'){
   const symbols=['✧','❀','♧','☾','♢','✿'];
   content=`<div class="suite-tiles">${cells(24,i=>button(i,symbols[(i*7+Math.floor(i/7))%6],'suite-tile'))}</div><div class="suite-tile-slot" aria-label="收纳槽"></div>`;
  }else if(type==='carracing'){
   content=`<div class="suite-race-scene"><div class="suite-race-sun"></div><div class="suite-race-road"></div><div class="suite-race-car"></div><div class="suite-race-instruments"><div class="suite-race-speed"><span data-engine-speed>128</span><small>KM/H</small></div><div class="suite-race-rank"><span data-engine-rank>03</span><small> / 08</small></div></div></div><div class="suite-number-pad"><button data-engine-control="left" aria-label="向左">←</button><button data-engine-control="brake">减速</button><button data-engine-control="throttle">加速</button><button data-engine-control="right" aria-label="向右">→</button></div>`;
  }else if(type==='BasketballQTE'){
   content=`<div class="suite-basket-court"><div class="suite-basket-board"></div><div class="suite-basket-ring"></div><div class="suite-basket-ball">${icon('ball')}</div><div class="suite-court-lines"></div></div><div class="suite-number-pad"><button data-engine-control="aim-left">←</button><button data-engine-control="shoot" class="suite-native-shoot">投篮</button><button data-engine-control="aim-right">→</button></div>`;
  }else if(type==='PoolQTE'){
   content=`<div class="suite-pool">${cells(6,i=>`<i class="pool-hole" style="left:${[0,50,100,0,50,100][i]}%;top:${i<3?0:100}%"></i>`)}<i class="suite-pool-ball is-cue" style="left:25%;top:58%"></i>${cells(9,i=>`<i class="suite-pool-ball" style="left:${62+(i%3)*4}%;top:${41+Math.floor(i/3)*7}%;--ball-hue:${i*31}"></i>`)}<div class="suite-pool-aim"></div></div><div class="suite-shot-power"><label for="pool-power">击球力度</label><input id="pool-power" type="range" min="0" max="100" value="40">${window.YorollPlayUI.button('击球','engine-shot',{small:true,primary:true})}</div>`;
  }
  body.innerHTML=`<div class="suite-native"><div class="suite-native-stage"><div class="suite-native-title">${e(({sudoku:`目标 ${q.sudoku_target_score?.toLocaleString()} 分`,gomoku:'五子棋 · 你的回合',ChineseChessQTE:'中国象棋 · 你的回合',ChessQTE:'国际象棋 · 你的回合',tileslot:`第 ${q.tileslot_level_index} 关`,carracing:`目标：前 ${q.required_rank} 名`,BasketballQTE:`投篮机会  ${q.shoot_count}`,PoolQTE:'台球对局 · 瞄准'})[type])}</div><div class="suite-native-preview" data-engine-preview>${content}</div><div class="suite-engine-mount" data-engine-mount hidden></div><div class="suite-native-hud" data-engine-hud></div><div class="suite-native-notice" data-engine-notice>界面预览 · 等待原玩法引擎接入</div></div></div>`;
  function action(name,payload){if(!c.active())return;const connected=c.engineAction(name,payload);if(!connected)c.status('操作已预览，原玩法规则由引擎接入',false);}
  function selectCell(el){const i=Number(el.dataset.nativeCell);if(!c.active())return;
   if(['ChessQTE','ChineseChessQTE','gomoku'].includes(type)&&selected>=0){action('move',{from:selected,to:i});}else action('select',{index:i});
   body.querySelectorAll('.is-selected').forEach(x=>x.classList.remove('is-selected'));el.classList.add('is-selected');selected=i;
  }
  c.on(body,'click',ev=>{
   const cell=ev.target.closest('[data-native-cell]');if(cell)selectCell(cell);
   const number=ev.target.closest('[data-native-number]');if(number&&selected>=0)action('number',{index:selected,value:Number(number.dataset.nativeNumber)});
   const control=ev.target.closest('[data-engine-control]');if(control)action(control.dataset.engineControl,{phase:'press'});
  });
  c.on(body,'input',ev=>{if(ev.target.id==='pool-power')action('aim',{power:Number(ev.target.value)});});
  return {action(name){if(name==='engine-shot')action('shoot',{power:Number(body.querySelector('#pool-power').value)});},update(state){
   engineState={...engineState,...state};const notice=body.querySelector('[data-engine-notice]');notice.textContent=state.connected===false?'界面预览 · 等待原玩法引擎接入':state.message||'已连接原玩法引擎';
   for(const key of ['speed','rank']){const el=body.querySelector(`[data-engine-${key}]`);if(el&&state[key]!==undefined)el.textContent=state[key];}
   if(Array.isArray(state.cells))body.querySelectorAll('[data-native-cell]').forEach((el,i)=>{if(type==='gomoku')el.dataset.stone=state.cells[i]||0;else el.textContent=state.cells[i]??'';});
   if(state.title)body.querySelector('.suite-native-title').textContent=state.title;
   if(state.renderMode){const embedded=state.renderMode==='embedded';body.querySelector('[data-engine-preview]').hidden=embedded;body.querySelector('[data-engine-mount]').hidden=!embedded;body.querySelector('.suite-native-stage').classList.toggle('is-embedded',embedded);}
   if(state.hud&&typeof state.hud==='object'){const hud=body.querySelector('[data-engine-hud]');hud.replaceChildren();for(const [label,value] of Object.entries(state.hud)){const cell=document.createElement('span');cell.textContent=`${label}　${value}`;hud.append(cell);}}
   if(state.aimAngle!==undefined){const aim=body.querySelector('.suite-pool-aim');if(aim)aim.style.rotate=`${Number(state.aimAngle)||0}deg`;}
   if(Array.isArray(state.balls))body.querySelectorAll('.suite-pool-ball').forEach((ball,i)=>{const pose=state.balls[i];if(pose){ball.style.left=`${Math.max(0,Math.min(1,Number(pose.x)||0))*100}%`;ball.style.top=`${Math.max(0,Math.min(1,Number(pose.y)||0))*100}%`;ball.hidden=pose.visible===false;}});
  }};
 }
 window.YorollPlayNative={mount};
})();
