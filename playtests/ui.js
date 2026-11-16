(function(){
 'use strict';
 const paths={
  back:'<path d="M20.5 .5 4 12l16.5 11.5L14.7 12Z" fill="currentColor" stroke="none"/>',
  arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',play:'<path d="m9 5 11 7-11 7Z"/>',pause:'<path d="M9 5v14M16 5v14"/>',
  volume:'<path d="m11 4-5 4H2v8h4l5 4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',mute:'<path d="m11 4-5 4H2v8h4l5 4Z"/><path d="m16 9 6 6m0-6-6 6"/>',
  check:'<path d="m4 12 5 5L20 6"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',chevron:'<path d="m6 9 6 6 6-6"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  replay:'<path d="M5 8a8 8 0 1 1-.3 8M5 3v5h5"/>',hand:'<path d="M8 12V5a2 2 0 0 1 4 0v7-4a2 2 0 0 1 4 0v5-2a2 2 0 0 1 4 0v5c0 4-3 6-7 6-3 0-4-1-6-4l-3-4a2 2 0 0 1 3-2l3 3"/>',
  target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/>',
  eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  grid:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18m6-18v18M3 9h18M3 15h18"/>',
  book:'<path d="M12 5C7 2 3 4 3 4v15s4-2 9 1c5-3 9-1 9-1V4s-4-2-9 1Zm0 0v15"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  bag:'<rect x="4" y="7" width="16" height="14" rx="3"/><path d="M8 7V5a4 4 0 0 1 8 0v2M4 14h16m-10 0v3h4v-3"/>',
  flask:'<path d="M9 3h6m-5 0v6l-6 9a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-9V3M7 15h10"/>',
  leaf:'<path d="M20 3C9 2 2 8 5 16s16 3 15-13ZM5 20 16 8m-7 5 5 1"/>',
  rope:'<path d="M8 5c6-7 12 5 4 7S0 20 8 21c7 1 12-7 8-9S2 7 8 5Z"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6m10-6v6M3 11h18m-13 5h2m4 0h2"/>',
  heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  wave:'<path d="M2 12h3l3-8 4 16 4-13 3 5h3"/>',
  car:'<path d="m5 8 2-5h10l2 5 2 2v8H3v-8ZM3 10h18M6 14h2m8 0h2M5 18v3m14-3v3"/>',
  ball:'<circle cx="12" cy="12" r="9"/><path d="M4 5c6 4 10 8 15 14M19 5C13 9 9 13 5 19M3 11c7 3 12 3 18 0M12 3c-3 6-3 12 0 18"/>',
  chess:'<path d="m8 3 7 1 4 5-4 3-3-2-4 7h9l2 4H4l2-4 1-6-3-3Z"/>',
  mic:'<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10a7 7 0 0 0 14 0m-7 7v5m-4 0h8"/>',
  scissor:'<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8 8 13 13M8 16 21 3"/>',
  compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6Z"/>',
  camera:'<rect x="3" y="6" width="18" height="15" rx="2"/><path d="m8 6 2-3h4l2 3"/><circle cx="12" cy="13" r="4"/>',
  star:'<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>'
 };
 const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const icon=(name,extra='')=>`<svg viewBox="0 0 24 24" aria-hidden="true" ${extra}>${paths[name]||paths.compass}</svg>`;
 const button=(label,action,{primary=false,small=false,iconName='',data='',disabled=false}={})=>`<button class="btn${primary?' btn-primary btn-glass':''}${small?' btn-small':''}" data-suite="${action}" ${data} ${disabled?'disabled':''}>${iconName?icon(iconName):''}<span>${escape(label)}</span></button>`;
 const modes={
  choice:['剧情抉择','在叙事中做出选择','compass'],basic:['叙事推进','观看片段，记录数值与道具','play'],end:['章节结算','延续故事的下一步','star'],
  choice_area:['区域选择','点击画面中的目标区域','target'],scene_choice:['方向调查','选择一个调查方向','compass'],click:['目标点击','把握目标出现的时机','target'],longpress:['持续长按','按住目标，稳定完成操作','hand'],swipe:['方向滑动','沿指定方向滑动','arrow'],swipeerase:['连续擦除','反复滑动，扫去遮挡','hand'],paper_cutting:['剪纸描摹','沿轮廓描摹并闭合轨迹','scissor'],balance:['保持平衡','交替按住与松开，稳定指针','wave'],insight:['洞察扫描','移动视线，寻找隐藏的线索','eye'],insight_scratch:['擦除揭示','擦去表层，揭示另一幅画面','hand'],tencent_voice:['语音口令','说出正确的下一句','mic'],investigation:['阴阳调查','记录异常，整理照片与线索','camera'],sceneclickvideo:['场景线索','调查物件，观看关联片段','eye'],videochoiceloop:['线索回看','查看支线，回到调查现场','book'],peek:['短暂窥探','避开危险时段，观察另一面','eye'],ragemeter:['情绪交锋','用不同的回应改变对方的情绪','wave'],dating_calendar:['约会日历','在日期中回看彼此的记忆','calendar'],use_item:['使用道具','选择或拖拽合适的道具','bag'],scene_search:['场景探索','切换场景与阴阳层，采集材料','compass'],craft_bench:['配方合成','组合材料，得到新的物品','flask'],dial_lock:['密码转盘','转动字轮，寻找正确组合','lock'],puzzle:['画面拼图','拖动碎片，复原完整画面','grid'],sudoku:['数独','填入数字，完成方格挑战','grid'],tileslot:['收纳消除','将相同花色的牌放进收纳槽','grid'],gomoku:['五子棋','落子对弈，连成五子','grid'],ChineseChessQTE:['中国象棋','与对手展开一局棋战','chess'],ChessQTE:['国际象棋','选择棋子，规划下一步','chess'],shoot2:['瞄准射击','把握有限的射击机会','target'],whack_mole:['目标追击','点击出现的目标，避免漏击','target'],carracing:['赛车竞速','保持节奏，争取目标名次','car'],BasketballQTE:['篮球投射','完成一次稳定的投篮','ball'],PoolQTE:['台球对局','观察角度，选择击球力度','ball'],rhythm:['节奏交互','跟随节拍完成点击与滑动','wave'],web_game:['航行冒险','进入独立的航行小游戏','compass']
 };
 const nativeTypes=new Set(['sudoku','tileslot','gomoku','ChineseChessQTE','ChessQTE','carracing','BasketballQTE','PoolQTE']);
 const typeOf=node=>node.qte?.type||(node.choices?'choice':node.is_end?'end':'basic');
 const modeOf=node=>modes[typeOf(node)]||['叙事互动','跟随线索继续前行','compass'];
 const shortTitle=node=>(node.title?.includes(' · ')?node.title.split(' · ').slice(1).join(' · '):node.title)||modeOf(node)[0];
 window.YorollPlayUI={escape,icon,button,modes,nativeTypes,typeOf,modeOf,shortTitle};
})();
