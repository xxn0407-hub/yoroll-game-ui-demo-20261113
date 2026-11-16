# Yoroll 玩法 UI 接口预览

入口：`/playtests/`。目录按原配置的 9 个章节组织，包含 74 个主节点、20 个支线节点和 34 类 QTE。原始配置保存在 `data/`，章节文件保持原字节内容，来源与 SHA-256 见 `data/source-manifest.json`。

本页用于网页交互评审和原玩法 UI 接入。它没有包含原 Unity 程序。数独、收纳消除、五子棋、中国象棋、国际象棋、赛车、篮球和台球使用 UI 状态预览，合法操作、AI、物理和计分继续由原引擎负责。其他类型提供网页交互实现，供确认操作和视觉反馈；原工程接入时仍应以原引擎的判定为准。

## 体验入口

- 单项体验：选择卡片，再按“开始体验”。自动准备该节点前置的属性和材料，便于独立评审。
- 连续体验：从当前章节起点建立新一轮状态，按原 next、choice、next_node_map 前进。
- 继续上次体验：恢复本浏览器保存的数值、物品、访问记录与当前主片段。正在进行的 QTE 和支线重新开始，不序列化媒体或原引擎内部状态。
- 上一片段：回看片段，保留已发生的访问和数值；同一轮不会重复发放节点奖励。
- 右下角“预览”：切换场景、重播、查看进行中／成功／失败反馈。预览状态不写入流程进度。
- 语音：只有明确点击麦克风才申请权限；也可输入答案。外部网页游戏只有明确点击“进入航行”才创建 iframe。

## 原生玩法适配器

### 手机横竖屏与游戏方向

手机自动启用独立布局，桌面保留原尺寸。横竖屏旋转、浏览器工具栏高度和安全区变化会重新计算可用区域；横屏压缩重复标题，竖屏将菜单、选择、操作与播放控制分区排列。手机视觉统一收至上一版的 80%，常用控件通过透明子区域保留至少 44px 的点击范围。密集棋盘可放大并拖动浏览，输入坐标仍由原棋盘元素计算。手机与桌面共享新版声音路由，反馈和结算规则保持原实现。

设备方向与游戏内容方向分别处理。游戏方向依次取 `node.screenOrientation`、章节 `meta.screenOrientation`、`game.screenOrientation`，支持 `Landscape` 与 `Portrait`。原配置目前为横屏，竖屏手机会完整保留其交互坐标平面；画面外的背景继续铺满视口。后续竖屏游戏使用 1080×1920 参考坐标，横屏为 1920×1080，节奏目标的 Y 轴仍由底向上。热点和对应媒体使用同一个等比显示区域。

宿主也可在开始新节点前调用 `YorollGameplayUI.setOrientation('Portrait')`。原引擎的 `start(request)` 增加 `orientation` 与 `referenceSize`，应按这些值设置 canvas 和输入映射，而不是按手机物理方向改变游戏规则。嵌入目标会随布局变化，原引擎通过 ResizeObserver 监听 `getRenderTarget(sessionId)` 的尺寸即可。不要用横屏素材替代竖屏素材来验证构图；当前没有提供真实竖屏游戏，本轮验证的是布局、方向接口和坐标映射。

桌面浏览器可用 `/playtests/?layout=mobile` 检查手机布局；此参数仅控制 UI 预览，不更改游戏方向。`layout=desktop` 强制桌面布局。生产链接不需要这些参数。

在文档脚本加载后接入 `window.YorollGameplayUI`。`start` 每次收到新的 `sessionId`。异步回传必须携带它；离开、重播或完成后的旧回调被拒绝。

```js
const ui = window.YorollGameplayUI;
const detach = ui.attach({
  start(request) {
    // 可选：const target = ui.getRenderTarget(request.sessionId);
    // 原 3D 玩法可将 canvas 挂入 target，再回传 {renderMode:'embedded'}。
    // {sessionId, type, nodeId, chapterId, config, state, muted:true,
    //  hostMuted, audioPolicy, orientation, referenceSize}
    // 关闭原引擎的 UI / 操作音；统一交给宿主。不要同时播放旧声音。
    originalEngine.start(request.config, {
      onState(state) { ui.update(request.sessionId, state); },
      onResult(score) { ui.complete(request.sessionId, score); },
      onSound(event) { ui.playSound(request.sessionId, event); }
    });
  },
  action(event) {
    // {sessionId, type, nodeId, action, payload}
    originalEngine.handleUIAction(event.action, event.payload);
  },
  pause({sessionId, paused}) { originalEngine.setPaused(paused); },
  setMuted({sessionId, muted}) { originalEngine.setMuted(muted); },
  // 旧的 audio(detail) 仅作为没有 setMuted 时的兼容回调。
  stop({sessionId}) { originalEngine.stop(); }
});

// 离开宿主时
detach();
```

这里的 `originalEngine` 是接入方提供的实例，不是本预览内置的引擎。

### 统一声音接口

玩法使用 `ethereal-gameplay-20261116`，素材与来源见 [AUDIO.md](AUDIO.md)。`start` 的 `muted` 固定为 `true`，要求引擎关闭旧音轨；`hostMuted` 表示玩家的总开关，`audioPolicy.uiSfx === 'host'` 表示新的操作音由宿主负责。引擎收到这些字段后必须实际关闭旧声音，不能只保留字段。

操作意图由网页控件自动发出一声；引擎可为真实的命中、发现、落子等判定回传 `ui.playSound(sessionId, event)`。事件仅接受本地语义名称，不接受 URL、音高或音量参数。不要为同一次 UI 按下再回传一声相同的音效。允许的名称为 `tap`、`hold`、`release`、`swipe`、`trace`、`reveal`、`item`、`combine`、`place`、`turn`、`invalid`、`rhythm-hit`、`rhythm-miss`、`focus`。成功／失败由 `complete()` 统一触发，避免重复结算。离开、重播、结算后的旧 session，以及暂停期间的声音请求都被拒绝。

### UI 输出

| 类型 | action | payload |
|---|---|---|
| 数独 | select / number | `{index}` / `{index,value}` |
| 棋类 | select / move | `{index}` / `{from,to}` |
| 收纳消除 | select | `{index}` |
| 赛车 | left / right / brake / throttle | `{phase:'press'}` |
| 篮球 | aim-left / aim-right / shoot | `{phase:'press'}` |
| 台球 | aim / shoot | `{power}` |

`index` 从 0 开始，棋盘按行优先。输入只是 UI 意图，必须由引擎验证，UI 不替引擎决定合法落子或得分。

也会广播 `yoroll:gameplay-start`、`yoroll:gameplay-action`、`yoroll:gameplay-pause`、`yoroll:gameplay-audio`、`yoroll:gameplay-stop` CustomEvent，事件数据在 `detail`。选择适配器或事件桥其中一条路处理，避免同一次操作执行两遍。

### 引擎输入

```js
ui.update(sessionId, {
  connected: true,
  title: '你的回合',
  message: '已连接原玩法引擎',
  hud: {'剩余次数': 4, '得分': 120}, // 可选，由引擎控制标签和数值
  aimAngle: 15, // 可选，台球瞄准角度（度）
  balls: [{x: .25, y: .58, visible: true}], // 可选，台球归一化位置
  renderMode: 'ui', // ui 保留新版棋盘；embedded 显示 getRenderTarget 内的原引擎画面
  cells: [], // 可选，棋盘完整状态，行优先；五子棋 0空/1黑/2白
  speed: 128, // 可选，赛车
  rank: 3
});
ui.complete(sessionId, 1);
```

`update`、`complete` 返回布尔值。`complete` 只接受当前配置 next_node_map 中存在的有限数值，且每个 session 只处理一次。示例中多数结果为 0/1；区域选择仍使用原配置的多个结果值。得分通过原映射决定下一节点；立即结算和等待片尾分别处理。

`getSession()` 返回当前引擎会话的副本；`getState()` 返回当前网页流程状态的副本。不要修改它们来替代状态回传。

## 独立网页游戏

保留原 `web_game_url`、允许来源、关卡、start JSON、加载超时和关闭设置。提供以下**新 UI 桥接协议**；原航行项目需实现适配，不宣称它当前已支持此协议。

```js
// iframe -> 宿主
parent.postMessage({
  namespace: 'yoroll-gameplay', version: 1, type: 'ready', payload: {}
}, HOST_ORIGIN);

parent.postMessage({
  namespace: 'yoroll-gameplay', version: 1,
  type: 'result', payload: {score: 1}
}, HOST_ORIGIN);
```

宿主发出 `start`（payload 为 gameType、level、start）、`pause`、`resume`、`mute`（payload.muted）、`stop`。宿主同时验证精确 `event.origin`、`event.source === iframe.contentWindow`、命名空间和版本。禁止使用 `*` 放宽来源。iframe load 只代表文档加载完成，不代表游戏已准备好；游戏主动 ready 后会再收到 start，应按幂等方式初始化。跨域 iframe 是否允许嵌入仍由原站响应头决定。

外部游戏的 `start` / `mute` 中 `muted` 同样固定为 `true`，并携带 `hostMuted` 与 `audioPolicy`；加载后还会收到 `configure-audio`。外部游戏应关闭旧声音，通过下面的消息请求宿主声音：

```js
parent.postMessage({namespace:'yoroll-gameplay',version:1,type:'sound',
  payload:{event:'reveal'}}, hostOrigin);
```

消息只接受已配置 origin 与当前 iframe 的真实窗口，且暂停或离开后不播放。iframe 不再获得自动播放权限。但浏览器不能强制关闭一个跨域页面在用户点击后自行播放的声音；该页面仍须实现上述关闭旧音频的桥接协议。当前预览没有修改跨域游戏的源码。

## 生命周期与音频

- 暂停原因独立记录：手动、弹窗、预览面板、支线、页面失焦／隐藏。关闭一个原因不会解除其他原因。
- 媒体、交互计时和延时结算随当前预览一起暂停；恢复后继续。
- 倍速独立于 QTE 的真实时间，临时慢放与基础倍速相乘。
- 重叠节奏目标各自判定，短目标结束不会取消仍在长按的目标慢放。
- 操作、手势、线索、道具、棋盘、节奏命中及成功／失败统一使用新的本地玩法音库。主界面已确认的音库文件保持原字节内容。
- 参考 MP4 的原音轨始终静音，擦除、窥探等辅助视频也不例外。声音开关开启时不会解除这些素材的静音。
- 图音示例改用本地重新制作的一次性尾音，保留原来的 12 秒画面时间轴，不引入循环 BGM。
- 新声音与主界面共用一个 AudioContext、SFX 音量、总开关和失焦暂停门控；连续输入限流、旧尾音让位，结算后自然衰减至静音。
- 适配器必须响应 pause/stop，自行停止原引擎的音频和输入；宿主无法直接控制跨域 iframe 或 Unity 引擎内部的声音。

## 验证

```sh
node --test playtests/tests/*.test.cjs
```

测试覆盖原配置完整性、条件与访问解锁、两套配方差异、立即／片尾结算、手势与描摹判定、图音末帧、支线组合、节奏重叠与容错、独立暂停原因、过期回调和消息来源验证。浏览器另检查 34 类页面渲染及代表性操作。原 Unity 子游戏、跨域语音服务和网页游戏的完整业务联调仍需对应工程／服务。
