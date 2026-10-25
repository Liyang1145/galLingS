
'use strict';
/* ========== 基础工具 ========== */
const $ = s => document.querySelector(s);
const W = 1280, H = 720;
const uid = () => Math.random().toString(36).slice(2, 10);
const clone = o => JSON.parse(JSON.stringify(o));

/* ========== 悬停提示：简略 / 默认 / 详细 ========== */
// [名称, 快捷键, 一句话(默认档), 详细说明(详细档)]
const TIPS = {
  new:['新建','','清空当前项目','清空所有台词与素材，从空白项目开始。会先询问确认。'],
  open:['打开','Ctrl+O','打开项目文件','读取之前保存的 .json 项目文件，素材也在文件里。'],
  save:['保存','Ctrl+S','下载项目文件','把台词、画面和素材打包成一个 .json 文件。工具也会自动保存在浏览器里。'],
  export:['导出脚本','','导出剧情脚本','把项目转成文本脚本（.txt），以后给自研引擎读取。'],
  import:['导入素材','','导入图片或音频','自动分类：带透明区域的图片当立绘，不透明的当背景。也可以直接把图片拖进舞台或侧栏。'],
  undo:['撤销','Ctrl+Z','撤销上一步',''],
  redo:['重做','Ctrl+Y','恢复撤销的操作',''],
  batch:['批量台词','Ctrl+B','一次粘贴多句','每行一句，“名字：内容”会自动分出说话人。全部沿用当前画面，适合画面不变的长段对话。'],
  link:['向后联动','L','修改画面时同步后续相同画面','开启时，调整背景或立绘会同时作用于后面画面完全相同的台词，直到画面变化为止。关闭则只改当前这句。'],
  dlg:['对话框','Tab','半透明 / 隐藏 / 显示','切换编辑时对话框的样子。半透明时鼠标移上去会变清晰。'],
  play:['播放预览','F5','从当前句开始播放','全屏按游戏效果播放，点击或空格继续，Esc 退出。'],
  settings:['设置','','提示详细程度等',''],
  side:['剪切板','','展开 / 收起侧栏',''],
  fold:['折叠','','折叠这一栏',''],
  secBg:['背景','','最近用过的背景','点击：设为当前背景。拖到舞台：同样效果。最近使用的排在最前。'],
  secCh:['立绘','','最近用过的立绘','点击：加到舞台。拖到舞台空白处：放在那里。拖到已有立绘上：替换它（换表情/差分），位置大小不变。'],
  impBg:['导入背景','','导入为背景',''],
  impCh:['导入立绘','','导入为立绘',''],
  flip:['翻转','F','左右镜像',''],
  front:['置前','PgUp','移到最前面','立绘重叠时，让它挡住别人。'],
  back:['置后','PgDn','移到最后面',''],
  del:['移除','Delete','从画面移除',''],
  card:['文本','←/→','点击跳到这一节','左右拖动：只移动这句文字，画面留在原地。黄边 = 新章节。Alt+Shift+↑/↓ 连画面一起移动，Ctrl+D 复制这一节。'],
  clip:['片段','Delete','拖边缘延长/缩短，拖中间移动','往右拖右边缘 = 把这段画面复制到后面几节；往回拖 = 从那些节里去掉。按住 Alt 拖中间 = 复制一份。Ctrl+C / Ctrl+V 复制粘贴到播放头。把侧栏素材拖到片段中间 = 从那一节起换掉（换表情、换背景），拖到片段开头 = 整段换。'],
  ruler:['播放头','Home/End','点击或拖动定位到某一节',''],
  trkHide:['隐藏轨道','','编辑时暂时不显示','只影响编辑预览，不影响播放和导出。'],
  trkLock:['锁定轨道','','防止误改',''],
  chNew:['新角色轨','','把立绘拖到这里','拖进来的角色会自动有自己的一条轨道。'],
  zoom:['缩放','Ctrl+滚轮','每一节显示多宽',''],
  fitTl:['全部显示','','把所有节缩放到一屏',''],
  tlSplit:['调整高度','','上下拖动',''],
  laneText:['文本轨','','每一格是一节（一句台词）',''],
  laneBg:['场景轨','','背景图',''],
  laneBgm:['音乐轨','','背景音乐，拖长 = 延续到后面',''],
  laneSe:['音效轨','','只在那一节播一次',''],
  laneAmb:['环境音轨','','循环的环境声（海浪、集市…），拖长 = 延续到后面','剧本写 @amb 名字 vol=0.6；换声音时 1 秒交叉淡化。'],
  laneAmb2:['环境音轨 2','','第二层环境声，和第一层同时响','剧本写 @amb2 名字 vol=0.4，比如店里底噪 + 风铃。'],
  amb:['环境音','','从这句开始循环的环境声','改这里会同时改后面沿用同一个环境音的句子。右边是音量。'],
  laneCh:['立绘轨','','这个角色的立绘；换表情会切成新片段',''],
  addLine:['新台词','Enter','接着当前画面写下一句','在对话框里按 Enter 也一样：画面原样保留，直接写下一句。Shift+Enter 换行。'],
  thumb:['素材','','点击使用，拖动放置',''],
  props:['本句设置','P','标签、转场、音乐、音效、选项、跳转','给当前这句台词设置播放效果和分支。音乐会一直延续到被换掉或停止为止。'],
  secAu:['音频','','音乐和音效','导入时自动分类：20 秒以上算音乐（循环播放），更短的算音效（播一次）。点击：用在当前句。'],
  impAu:['导入音频','','导入音乐或音效',''],
  auItem:['音频','','点击用在当前句','音乐从这一句开始播放，直到换曲或停止；音效只在这一句播一次。右侧 ▶ 试听。'],
  label:['标签','','给这句起个名字','选项和跳转靠标签找到目的地，比如“结局A”。'],
  trans:['转场','','画面变化时的效果','淡入 / 硬切 / 黑场 / 闪白。只有画面和上一句不同时才生效。'],
  bgm:['音乐','','从这句开始的背景音乐','改这里会同时改后面沿用同一首音乐的句子。'],
  se:['音效','','这句播放一次的音效',''],
  choice:['选项','','玩家在这句后做选择','每个选项跳到一个标签。有选项时播放会停下来等玩家选。'],
  jump:['跳转','','这句之后跳到某个标签','右边可以写条件，条件成立才跳，比如“好感 >= 3”。留空表示一定跳。'],
  chapter:['章节','','从这句开始新章节','填了名字，顶栏的章节菜单就能直接跳到这里。'],
  fx:['瞬时特效','','这一节出现时播一次','〰震动 💥爆炸(剧震+白闪) ⚪白闪 🔴受击红闪 👁眨眼/醒来 🔍冲击推近。选中后会立刻在舞台上预览一次。'],
  fxPlay:['预览特效','','再播一次',''],
  mood:['持续氛围','','一直持续，直到换掉','🌀神志不清（忽明忽暗+模糊+摇晃）🕯忽明忽暗 ⚡闪烁 🌫模糊 〽摇晃 🎞回忆 🌑昏暗 ❤危险心跳。新的一节会沿用；在时间轴 🌫 轨上拖边缘可以延长或缩短。'],
  wait:['停留秒数','','到时间自动下一节','没有文字的“演出节”默认停 2 秒，并自动隐藏对话框；有台词时对话框自动回来。有文字的节填了也会自动前进。'],
  plugins:['插件','','导入 / 管理插件','插件能给编辑器和导出的游戏加功能（比如 GalAgent：结局后和角色聊天、让角色用工具做事）。项目里的插件随导出的游戏一起带走；玩家也能在游戏开始界面的“插件”里自己导入。'],
  theme:['界面风格','','对话框、名字牌、选项的样子','6 套预设（默认/和风/少女/科幻/复古/极简），可以再细调颜色、透明度、字号、圆角、字体，或用一张图片当对话框。'],
  ending:['结局','','这一句之后进入结局','填上结局名后，玩家看完这一句会出现结局画面并回到标题；结局会记入“鉴赏 → 结局”。'],
  cgMark:['标记为 CG','','玩家看过后可在鉴赏里回看','名字以 CG_ 开头的背景自动算 CG。'],
  folder:['项目文件夹','','素材存成文件 / 导出游戏文件夹','需要 Chrome 或 Edge。项目文件夹里是 project.json 和 assets 素材文件，可以直接用资源管理器换图。'],
  sprAnim:['立绘动画','','入场 / 退场 / 动作',''],
  sprIn:['入场方式','','角色第一次出现时',''],
  sprOut:['退场方式','','角色离开画面时',''],
  sprLook:['外观效果','','黑影、回忆、发光……','从这一句开始一直保持，直到改回“原样”。游戏里改回时会慢慢变回来，适合“先是黑影、后来揭晓真身”。'],
  sprAct:['动作','','只在这一节做一次','⤴ 跳一下（开心、吃惊）〰 发抖（生气、害怕）⤵ 点头。'],
  voice:['配音','','这一句的语音','名字以“vo_”“配音_”或“角色名_”开头的短音频，导入时会自动归为配音。播放到下一句会自动停；自动模式会等配音说完。'],
  laneVo:['配音轨','','每句一段语音',''],
  auType:['音频类型','','点一下切换 音乐/音效/配音',''],
  pcSet:['设置','','音量、文字速度、快进',''],
  laneMood:['氛围轨','','持续效果，拖边缘延长',''],
  laneFx:['特效轨','','只在那一节播一次',''],
  setv:['变量修改','','走到这句时改变量','例：好感 += 1；见过面 = true。多条用分号隔开。变量在 🧮 里定义。'],
  ctime:['限时选项','','秒数 / 超时默认','填秒数后，播放时选项下方出现一条慢慢缩短的线，时间到就自动选右边那一项（比如“沉默”）。空着＝不限时。剧本写法：@timeout 15 -> 标签。'],
  choiceIf:['条件 / 效果','','左：满足才显示；右：选了之后改变量','条件例：好感 >= 3 && 见过面。效果例：好感 += 2。'],
  agent:['角色扮演 Agent','','这句之后让玩家和角色自由对话','播放到这句时出现输入框，由 AI 扮演所选角色回应。在 ⚙ 里选“模拟”或填你自己的接口地址。'],
  agentChar:['扮演的角色 / 回合数','','回合数到了自动结束','角色的设定在 👤 里写。'],
  agentGoal:['场景目标','','告诉 AI 这段对话要达成什么','例：让玩家说出今天迟到的原因。AI 判断达成后会结束对话。'],
  agentExit:['结束后去哪','','对话结束后跳到的标签','留空就接着下一句。'],
  vars:['变量','','好感度、旗标等','定义游戏里要记住的数值，比如“好感”初始 0。条件和效果里直接写名字使用。'],
  chars:['角色','','名字颜色和人物设定','名字颜色会用在对话框；人物设定会交给 Agent 扮演时参考。'],
  check:['检查','','找出剧本里的问题','找丢失素材、写错的标签、条件语法错误、永远走不到的台词等。点问题可直接跳过去。'],
  chSel:['章节','','跳到某一章',''],
  saveWarn:['自动保存失败','','浏览器空间可能满了','请马上用 💾 下载项目文件备份。'],
  game:['导出游戏','','生成可直接玩的网页','导出一个独立的 .html 文件，带标题画面、存读档，双击就能玩，可以发给别人。'],
  expr:['表情','E','换同一角色的其他表情','把立绘命名为“角色_表情”，比如 小红_笑.png、小红_哭.png，就会自动归为一组。'],
  exprItem:['表情','','点击替换',''],
  pcLog:['回看','滚轮↑','看之前的对话',''],
  pcAuto:['自动','A','自动播放',''],
  pcSkip:['快进','按住 Ctrl','快速跳过，遇到选项停下',''],
  pcSave:['存档','',' 6 个存档位',''],
  pcLoad:['读档','','',''],
  pcExit:['退出','Esc','',''],
  pinEnd:['结束对话','','跳过剩下的自由对话',''],
  soulTab:['手账','','她记得的事、收集、悄悄话、规矩','剧情里你说过的话、她的小动作、约定都会记在这里；悄悄话可以写一句给她，她会回。'],
  soulSend:['写给她','Enter','','']
};

/* ========== 项目数据 ========== */
// 每句台词 = 说话人 + 文字 + 画面快照 + 播放属性
//   bgm：此句时正在播的音乐（会被下一句继承）；se：只在此句播一次的音效
//   amb / amb2：此句时正在循环的环境音（两层，会被下一句继承），ambv / amb2v 是各自音量 0~1
//   trans 转场 / fx 镜头特效 / label 标签 / chapter 章节 / set 变量修改
//   choices 选项[{text,target,cond,set}] / jump + jumpIf 条件跳转 / agent 角色扮演
const LINE_DEFAULTS = { label: '', chapter: '', trans: 'fade', fx: '', mood: '', wait: 0, acts: {}, voice: null, se: null, set: '', choices: [], ctime: 0, cdef: '', jump: '', jumpIf: '', agent: null, bgm: null, amb: null, ambv: 0.6, amb2: null, amb2v: 0.6, ending: '' };
function mkLine(from) {
  const l = clone(LINE_DEFAULTS);
  l.id = uid(); l.text = '';
  if (from) { l.speaker = from.speaker; l.bg = from.bg; l.sprites = clone(from.sprites); l.bgm = from.bgm ?? null; l.mood = from.mood || ''; l.amb = from.amb ?? null; l.ambv = from.ambv ?? 0.6; l.amb2 = from.amb2 ?? null; l.amb2v = from.amb2v ?? 0.6; }
  else { l.speaker = ''; l.bg = null; l.sprites = []; }
  return l;
}
function normLine(l) {
  const n = Object.assign(clone(LINE_DEFAULTS), { id: uid(), speaker: '', text: '', bg: null, sprites: [] }, l);
  n.choices = (n.choices || []).map(c => Object.assign({ text: '', target: '', cond: '', set: '' }, c));
  return n;
}
/* 动效表：[值, 图标, 名称] */
/* —— 界面图标：Lucide (ISC 许可) 的 SVG 矢量图标，任意缩放都清晰；颜色跟随文字颜色 —— */
const ICON = {"puzzle":"<path d=\"M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z\"/>","upload":"<path d=\"M12 3v12\"/><path d=\"m17 8-5-5-5 5\"/><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"/>","hourglass":"<path d=\"M5 22h14\"/><path d=\"M5 2h14\"/><path d=\"M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22\"/><path d=\"M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2\"/>","activity":"<path d=\"M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2\"/>","arrow-down":"<path d=\"M12 5v14\"/><path d=\"m19 12-7 7-7-7\"/>","arrow-down-to-line":"<path d=\"M12 17V3\"/><path d=\"m6 11 6 6 6-6\"/><path d=\"M19 21H5\"/>","arrow-left":"<path d=\"m12 19-7-7 7-7\"/><path d=\"M19 12H5\"/>","arrow-right":"<path d=\"M5 12h14\"/><path d=\"m12 5 7 7-7 7\"/>","arrow-up":"<path d=\"m5 12 7-7 7 7\"/><path d=\"M12 19V5\"/>","bell":"<path d=\"M10.268 21a2 2 0 0 0 3.464 0\"/><path d=\"M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326\"/>","blend":"<circle cx=\"15\" cy=\"9\" r=\"7\"/><circle cx=\"9\" cy=\"15\" r=\"7\"/>","bomb":"<circle cx=\"11\" cy=\"13\" r=\"9\"/><path d=\"M14.35 4.65 16.3 2.7a2.41 2.41 0 0 1 3.4 0l1.6 1.6a2.4 2.4 0 0 1 0 3.4l-1.95 1.95\"/><path d=\"m22 2-1.5 1.5\"/>","book-open":"<path d=\"M12 5v16\"/><path d=\"M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z\"/>","bot":"<path d=\"M12 8V4H8\"/><rect width=\"16\" height=\"12\" x=\"4\" y=\"8\" rx=\"2\"/><path d=\"M2 14h2\"/><path d=\"M20 14h2\"/><path d=\"M15 13v2\"/><path d=\"M9 13v2\"/>","bring-to-front":"<rect x=\"8\" y=\"8\" width=\"8\" height=\"8\" rx=\"2\"/><path d=\"M4 10a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2\"/><path d=\"M14 20a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2\"/>","chevron-down":"<path d=\"m6 9 6 6 6-6\"/>","chevron-right":"<path d=\"m9 18 6-6-6-6\"/>","chevrons-down":"<path d=\"m7 6 5 5 5-5\"/><path d=\"m7 13 5 5 5-5\"/>","chevrons-up":"<path d=\"m17 11-5-5-5 5\"/><path d=\"m17 18-5-5-5 5\"/>","circle-check":"<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"m16 9-5.5 5.5L8 12\"/>","circle-play":"<path d=\"M9 9.003a1 1 0 0 1 1.517-.859l4.997 2.997a1 1 0 0 1 0 1.718l-4.997 2.997A1 1 0 0 1 9 14.996z\"/><circle cx=\"12\" cy=\"12\" r=\"10\"/>","clapperboard":"<path d=\"m12.296 3.464 3.02 3.956\"/><path d=\"M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3z\"/><path d=\"M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/><path d=\"m6.18 5.276 3.1 3.899\"/>","cloud-fog":"<path d=\"M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242\"/><path d=\"M16 17H7\"/><path d=\"M17 21H9\"/>","contrast":"<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 18a6 6 0 0 0 0-12v12z\"/>","corner-down-right":"<path d=\"m15 10 5 5-5 5\"/><path d=\"M4 4v7a4 4 0 0 0 4 4h12\"/>","door-open":"<path d=\"M10 21H2\"/><path d=\"M10 3H7a2 2 0 00-2 2v16\"/><path d=\"M14 12h.01\"/><path d=\"M19 21V5a2 2 0 00-1.675-1.974l-6.163-1.013A1 1 0 0010 3v18a1 1 0 001.124.992z\"/><path d=\"M22 21h-3\"/>","eye":"<path d=\"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>","eye-off":"<path d=\"M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49\"/><path d=\"M14.084 14.158a3 3 0 0 1-4.242-4.242\"/><path d=\"M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143\"/><path d=\"m2 2 20 20\"/>","fast-forward":"<path d=\"M12 6a2 2 0 0 1 3.414-1.414l6 6a2 2 0 0 1 0 2.828l-6 6A2 2 0 0 1 12 18z\"/><path d=\"M2 6a2 2 0 0 1 3.414-1.414l6 6a2 2 0 0 1 0 2.828l-6 6A2 2 0 0 1 2 18z\"/>","file-code":"<path d=\"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z\"/><path d=\"M14 2v5a1 1 0 0 0 1 1h5\"/><path d=\"M10 12.5 8 15l2 2.5\"/><path d=\"m14 12.5 2 2.5-2 2.5\"/>","file-plus":"<path d=\"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z\"/><path d=\"M14 2v5a1 1 0 0 0 1 1h5\"/><path d=\"M9 15h6\"/><path d=\"M12 18v-6\"/>","film":"<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"/><path d=\"M7 3v18\"/><path d=\"M3 7.5h4\"/><path d=\"M3 12h18\"/><path d=\"M3 16.5h4\"/><path d=\"M17 3v18\"/><path d=\"M17 7.5h4\"/><path d=\"M17 16.5h4\"/>","flag":"<path d=\"M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528\"/>","flame":"<path d=\"M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4\"/>","flip-horizontal-2":"<path d=\"M10 12H8\"/><path d=\"M16 12h-2\"/><path d=\"M22 12h-2\"/><path d=\"M4 12H2\"/><path d=\"M7.298 20.288A1 1 0 008 22h8a1 1 0 00.703-1.712l-3.991-3.99a1 1 0 00-1.424-.001z\"/><path d=\"M7.298 3.712A1 1 0 018 2h8a1 1 0 01.703 1.712l-3.991 3.99a1 1 0 01-1.424.001z\"/>","folder":"<path d=\"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z\"/>","folder-open":"<path d=\"m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2\"/>","folder-plus":"<path d=\"M12 10v6\"/><path d=\"M9 13h6\"/><path d=\"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z\"/>","folder-tree":"<path d=\"M20 10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2.5a1 1 0 0 1-.8-.4l-.9-1.2A1 1 0 0 0 15 3h-2a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1Z\"/><path d=\"M20 21a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1h-2.9a1 1 0 0 1-.88-.55l-.42-.85a1 1 0 0 0-.92-.6H13a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1Z\"/><path d=\"M3 5a2 2 0 0 0 2 2h3\"/><path d=\"M3 3v13a2 2 0 0 0 2 2h3\"/>","gamepad-2":"<line x1=\"6\" x2=\"10\" y1=\"11\" y2=\"11\"/><line x1=\"8\" x2=\"8\" y1=\"9\" y2=\"13\"/><line x1=\"15\" x2=\"15.01\" y1=\"12\" y2=\"12\"/><line x1=\"18\" x2=\"18.01\" y1=\"10\" y2=\"10\"/><path d=\"M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z\"/>","heart-pulse":"<path d=\"M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5\"/><path d=\"M3.22 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27\"/>","image":"<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" ry=\"2\"/><circle cx=\"9\" cy=\"9\" r=\"2\"/><path d=\"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21\"/>","image-plus":"<path d=\"M16 5h6\"/><path d=\"M19 2v6\"/><path d=\"M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5\"/><path d=\"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21\"/><circle cx=\"9\" cy=\"9\" r=\"2\"/>","link":"<path d=\"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71\"/><path d=\"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71\"/>","list-checks":"<path d=\"M13 5h8\"/><path d=\"M13 12h8\"/><path d=\"M13 19h8\"/><path d=\"m3 17 2 2 4-4\"/><path d=\"m3 7 2 2 4-4\"/>","lock":"<rect width=\"18\" height=\"11\" x=\"3\" y=\"11\" rx=\"2\" ry=\"2\"/><path d=\"M7 11V7a5 5 0 0 1 10 0v4\"/>","log-out":"<path d=\"m16 17 5-5-5-5\"/><path d=\"M21 12H9\"/><path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4\"/>","message-square":"<path d=\"M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z\"/>","message-square-off":"<path d=\"M19 19H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.7.7 0 0 1 2 21.286V5a2 2 0 0 1 1.184-1.826\"/><path d=\"m2 2 20 20\"/><path d=\"M8.656 3H20a2 2 0 0 1 2 2v11.344\"/>","message-square-text":"<path d=\"M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z\"/><path d=\"M7 11h10\"/><path d=\"M7 15h6\"/><path d=\"M7 7h8\"/>","mic":"<path d=\"M12 19v3\"/><path d=\"M19 10v2a7 7 0 0 1-14 0v-2\"/><rect x=\"9\" y=\"2\" width=\"6\" height=\"13\" rx=\"3\"/>","minus":"<path d=\"M5 12h14\"/>","moon":"<path d=\"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401\"/>","move-horizontal":"<path d=\"m18 8 4 4-4 4\"/><path d=\"M2 12h20\"/><path d=\"m6 8-4 4 4 4\"/>","music":"<path d=\"M9 18V5l12-2v13\"/><circle cx=\"6\" cy=\"18\" r=\"3\"/><circle cx=\"18\" cy=\"16\" r=\"3\"/>","palette":"<path d=\"M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z\"/><circle cx=\"13.5\" cy=\"6.5\" r=\".5\" fill=\"currentColor\"/><circle cx=\"17.5\" cy=\"10.5\" r=\".5\" fill=\"currentColor\"/><circle cx=\"6.5\" cy=\"12.5\" r=\".5\" fill=\"currentColor\"/><circle cx=\"8.5\" cy=\"7.5\" r=\".5\" fill=\"currentColor\"/>","panel-left-close":"<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"/><path d=\"M9 3v18\"/><path d=\"m16 15-3-3 3-3\"/>","panel-left-open":"<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"/><path d=\"M9 3v18\"/><path d=\"m14 9 3 3-3 3\"/>","person-standing":"<circle cx=\"12\" cy=\"5\" r=\"1\"/><path d=\"m9 20 3-6 3 6\"/><path d=\"m6 8 6 2 6-2\"/><path d=\"M12 10v4\"/>","play":"<path d=\"M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z\"/>","plus":"<path d=\"M5 12h14\"/><path d=\"M12 5v14\"/>","redo-2":"<path d=\"m15 14 5-5-5-5\"/><path d=\"M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13\"/>","save":"<path d=\"M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z\"/><path d=\"M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7\"/><path d=\"M7 3v4a1 1 0 0 0 1 1h7\"/>","scissors":"<circle cx=\"6\" cy=\"6\" r=\"3\"/><path d=\"M8.12 8.12 12 12\"/><path d=\"M20 4 8.12 15.88\"/><circle cx=\"6\" cy=\"18\" r=\"3\"/><path d=\"M14.8 14.8 20 20\"/>","scroll-text":"<path d=\"M15 12h-5\"/><path d=\"M15 8h-5\"/><path d=\"M19 17V5a2 2 0 0 0-2-2H4\"/><path d=\"M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3\"/>","send-to-back":"<rect x=\"14\" y=\"14\" width=\"8\" height=\"8\" rx=\"2\"/><rect x=\"2\" y=\"2\" width=\"8\" height=\"8\" rx=\"2\"/><path d=\"M7 14v1a2 2 0 0 0 2 2h1\"/><path d=\"M14 7h1a2 2 0 0 1 2 2v1\"/>","settings":"<path d=\"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>","siren":"<path d=\"M7 18v-6a5 5 0 1 1 10 0v6\"/><path d=\"M5 21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2z\"/><path d=\"M21 12h1\"/><path d=\"M18.5 4.5 18 5\"/><path d=\"M2 12h1\"/><path d=\"M12 2v1\"/><path d=\"m4.929 4.929.707.707\"/><path d=\"M12 12v6\"/>","smartphone":"<rect width=\"14\" height=\"20\" x=\"5\" y=\"2\" rx=\"2\" ry=\"2\"/><path d=\"M12 18h.01\"/>","smile":"<path d=\"M15 10V9\"/><path d=\"M16.472 15a6 6 0 01-8.943 0\"/><path d=\"M9 10V9\"/><circle cx=\"12\" cy=\"12\" r=\"10\"/>","sparkle":"<path d=\"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z\"/>","split":"<path d=\"M16 3h5v5\"/><path d=\"M8 3H3v5\"/><path d=\"M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3\"/><path d=\"m15 9 6-6\"/>","square":"<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"/>","square-dashed":"<path d=\"M5 3a2 2 0 0 0-2 2\"/><path d=\"M19 3a2 2 0 0 1 2 2\"/><path d=\"M21 19a2 2 0 0 1-2 2\"/><path d=\"M5 21a2 2 0 0 1-2-2\"/><path d=\"M9 3h1\"/><path d=\"M9 21h1\"/><path d=\"M14 3h1\"/><path d=\"M14 21h1\"/><path d=\"M3 9v1\"/><path d=\"M21 9v1\"/><path d=\"M3 14v1\"/><path d=\"M21 14v1\"/>","stethoscope":"<path d=\"M11 2v2\"/><path d=\"M5 2v2\"/><path d=\"M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1\"/><path d=\"M8 15a6 6 0 0 0 12 0v-3\"/><circle cx=\"20\" cy=\"10\" r=\"2\"/>","sun":"<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2\"/><path d=\"M12 20v2\"/><path d=\"m4.93 4.93 1.41 1.41\"/><path d=\"m17.66 17.66 1.41 1.41\"/><path d=\"M2 12h2\"/><path d=\"M20 12h2\"/><path d=\"m6.34 17.66-1.41 1.41\"/><path d=\"m19.07 4.93-1.41 1.41\"/>","tag":"<path d=\"M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z\"/><circle cx=\"7.5\" cy=\"7.5\" r=\".5\" fill=\"currentColor\"/>","target":"<circle cx=\"12\" cy=\"12\" r=\"10\"/><circle cx=\"12\" cy=\"12\" r=\"6\"/><circle cx=\"12\" cy=\"12\" r=\"2\"/>","timer":"<line x1=\"10\" x2=\"14\" y1=\"2\" y2=\"2\"/><line x1=\"12\" x2=\"15\" y1=\"14\" y2=\"11\"/><circle cx=\"12\" cy=\"14\" r=\"8\"/>","tornado":"<path d=\"M21 4H3\"/><path d=\"M18 8H6\"/><path d=\"M19 12H9\"/><path d=\"M16 16h-6\"/><path d=\"M11 20H9\"/>","trash-2":"<path d=\"M10 11v6\"/><path d=\"M14 11v6\"/><path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6\"/><path d=\"M3 6h18\"/><path d=\"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"/>","triangle-alert":"<path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/>","undo-2":"<path d=\"M9 14 4 9l5-5\"/><path d=\"M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11\"/>","user":"<path d=\"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2\"/><circle cx=\"12\" cy=\"7\" r=\"4\"/>","user-plus":"<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><line x1=\"19\" x2=\"19\" y1=\"8\" y2=\"14\"/><line x1=\"22\" x2=\"16\" y1=\"11\" y2=\"11\"/>","users":"<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"/><path d=\"M16 3.128a4 4 0 0 1 0 7.744\"/><path d=\"M22 21v-2a4 4 0 0 0-3-3.87\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/>","variable":"<path d=\"M8 21s-4-3-4-9 4-9 4-9\"/><path d=\"M16 3s4 3 4 9-4 9-4 9\"/><line x1=\"15\" x2=\"9\" y1=\"9\" y2=\"15\"/><line x1=\"9\" x2=\"15\" y1=\"9\" y2=\"15\"/>","vibrate":"<path d=\"m2 8 2 2-2 2 2 2-2 2\"/><path d=\"m22 8-2 2 2 2-2 2 2 2\"/><rect width=\"8\" height=\"14\" x=\"8\" y=\"5\" rx=\"1\"/>","volume-2":"<path d=\"M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z\"/><path d=\"M16 9a5 5 0 0 1 0 6\"/><path d=\"M19.364 18.364a9 9 0 0 0 0-12.728\"/>","wand-sparkles":"<path d=\"m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72\"/><path d=\"m14 7 3 3\"/><path d=\"M5 6v4\"/><path d=\"M19 14v4\"/><path d=\"M10 2v2\"/><path d=\"M7 8H3\"/><path d=\"M21 16h-4\"/><path d=\"M11 3H9\"/>","waves":"<path d=\"M2 12q2.5 2 5 0t5 0 5 0 5 0\"/><path d=\"M2 19q2.5 2 5 0t5 0 5 0 5 0\"/><path d=\"M2 5q2.5 2 5 0t5 0 5 0 5 0\"/>","x":"<path d=\"M18 6 6 18\"/><path d=\"m6 6 12 12\"/>","zap":"<path d=\"M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z\"/>","zoom-in":"<circle cx=\"11\" cy=\"11\" r=\"8\"/><line x1=\"21\" x2=\"16.65\" y1=\"21\" y2=\"16.65\"/><line x1=\"11\" x2=\"11\" y1=\"8\" y2=\"14\"/><line x1=\"8\" x2=\"14\" y1=\"11\" y2=\"11\"/>","book-heart":"<path d=\"M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20\"/><path d=\"M8.62 9.8A2.25 2.25 0 1 1 12 6.836a2.25 2.25 0 1 1 3.38 2.966l-2.626 2.856a.998.998 0 0 1-1.507 0z\"/>","brain":"<path d=\"M12 18V5\"/><path d=\"M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4\"/><path d=\"M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5\"/><path d=\"M17.997 5.125a4 4 0 0 1 2.526 5.77\"/><path d=\"M18 18a4 4 0 0 0 2-7.464\"/><path d=\"M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517\"/><path d=\"M6 18a4 4 0 0 1-2-7.464\"/><path d=\"M6.003 5.125a4 4 0 0 0-2.526 5.77\"/>","feather":"<path d=\"M14.086 18.412A2 2 0 0112.67 19H5v-7.672a2 2 0 01.586-1.414L11.75 3.75a6 6 0 118.49 8.49z\"/><path d=\"M16 8 2 22\"/><path d=\"M17.488 15H9\"/>","list-ordered":"<path d=\"M11 5h10\"/><path d=\"M11 12h10\"/><path d=\"M11 19h10\"/><path d=\"M4 4h1v5\"/><path d=\"M4 9h2\"/><path d=\"M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02\"/>","send":"<path d=\"M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z\"/><path d=\"m21.854 2.147-10.94 10.939\"/>","eraser":"<path d=\"M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21\"/><path d=\"m5.082 11.09 8.828 8.828\"/>","plug":"<path d=\"M12 22v-5\"/><path d=\"M15 8V2\"/><path d=\"M17 8a1 1 0 0 1 1 1v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1z\"/><path d=\"M9 8V2\"/>"};
const ic = n => `<svg class="svi" viewBox="0 0 24 24" aria-hidden="true">${ICON[n] || ''}</svg>`;
function hydrateIcons(root) { (root || document).querySelectorAll('i[data-ic]').forEach(e => { e.outerHTML = ic(e.dataset.ic); }); }
hydrateIcons();
// 说明文字里的符号 → 对应 SVG 图标（提示框用）
const EMO_IC = {'💾':'save','📂':'folder-open','📁':'folder-tree','🎮':'gamepad-2','🧮':'variable','👤':'users','⚙':'settings','▶':'play','〰':'vibrate','💥':'bomb','⚪':'sun','🔴':'siren','👁':'eye','🔍':'zoom-in','🌀':'tornado','🕯':'flame','⚡':'zap','🌫':'cloud-fog','〽':'waves','🎞':'film','🌑':'moon','❤':'heart-pulse','⤴':'chevrons-up','⤵':'chevrons-down'};
const emoIc = h => h.replace(/💾|📂|📁|🎮|🧮|👤|⚙|▶|〰|💥|⚪|🔴|👁|🔍|🌀|🕯|⚡|🌫|〽|🎞|🌑|❤|⤴|⤵/gu, m => ic(EMO_IC[m]));
const FX = [['shake', 'vibrate', '震动'], ['quake', 'bomb', '爆炸'], ['flash', 'sun', '白闪'], ['redflash', 'siren', '受击红闪'], ['blink', 'eye', '眨眼/醒来'], ['zoom', 'zoom-in', '冲击推近'], ['whip', 'move-horizontal', '横甩(白闪+甩镜)']];
const MOODS = [['dizzy', 'tornado', '神志不清'], ['flicker', 'flame', '忽明忽暗'], ['strobe', 'zap', '闪烁(灯光故障)'], ['blur', 'cloud-fog', '模糊'], ['sway', 'waves', '摇晃'], ['gray', 'film', '回忆(黑白)'], ['dark', 'moon', '昏暗'], ['danger', 'heart-pulse', '危险心跳'], ['underwater', 'waves', '水下(静态淡蓝滤镜+声音发闷)'], ['slowmo', 'hourglass', '慢动作(推近+褪色+静音)']];
const fxName = v => FX.find(x => x[0] === v); const moodName = v => MOODS.find(x => x[0] === v);
/* 立绘动画表 */
const SPR_IN = [['', 'blend', '淡入'], ['left', 'arrow-right', '从左滑入'], ['right', 'arrow-left', '从右滑入'], ['up', 'arrow-up', '从下升起'], ['pop', 'sparkle', '弹出'], ['none', 'square', '直接出现']];
const SPR_OUT = [['', 'blend', '淡出'], ['left', 'arrow-left', '向左退场'], ['right', 'arrow-right', '向右退场'], ['down', 'arrow-down', '向下沉'], ['none', 'square-dashed', '直接消失']];
// 立绘外观（持续效果）：[名字, 图标, 中文名, CSS 滤镜]。从设置的那句开始一直保持，直到改回“原样”；改回时会慢慢过渡（揭晓效果）
const LOOKS = [
  ['', '○', '原样', ''],
  ['shadow', '●', '黑影', 'brightness(0)'],
  ['mystery', '◐', '神秘', 'brightness(.12) contrast(1.3) drop-shadow(0 0 8px rgba(140,170,255,.75))'],
  ['dark', '◑', '暗处', 'brightness(.45) saturate(.7)'],
  ['gray', '◌', '回忆', 'grayscale(1) contrast(.9)'],
  ['sepia', '▤', '旧照片', 'sepia(.85) contrast(.95)'],
  ['night', '☾', '夜晚', 'brightness(.7) sepia(.4) hue-rotate(180deg) saturate(1.3)'],
  ['red', '◆', '危险', 'sepia(1) saturate(5) hue-rotate(-50deg) brightness(.75)'],
  ['blur', '≈', '模糊', 'blur(6px)'],
  ['ghost', '◇', '幽灵', 'opacity(.45) drop-shadow(0 0 10px rgba(200,230,255,.8))'],
  ['glow', '✧', '发光', 'drop-shadow(0 0 12px rgba(255,255,255,.9)) brightness(1.08)']
];
const lookCss = v => (LOOKS.find(x => x[0] === v) || LOOKS[0])[3];
const lookOk = v => !v || v === 'none' || LOOKS.some(x => x[0] === v);
// A scene supplies a gentle default grade; each sprite can inherit, disable or override it.
// Keep this separate from positions and dramatic looks so artist edits remain literal.
const SCENE_FIT_LIMITS = { brightness: [.6, 1.2, 1], saturation: [.65, 1.2, 1], warmth: [-1, 1, 0] };
function sceneFitValues(value) {
  const out = {};
  Object.entries(SCENE_FIT_LIMITS).forEach(([key, [min, max, fallback]]) => {
    const n = value?.[key]; out[key] = typeof n === 'number' && Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  });
  return out;
}
function sceneFitFor(sprite, line) {
  const override = sprite?.sceneFit, mode = ['off', 'custom'].includes(override?.mode) ? override.mode : 'inherit';
  const value = mode === 'custom' ? override : mode === 'off' ? null : A(line?.bg)?.sceneFit;
  return { mode, ...sceneFitValues(value) };
}
function sceneFitCss(value) {
  const { brightness, saturation, warmth } = sceneFitValues(value), filters = [];
  if (brightness !== 1) filters.push(`brightness(${brightness})`);
  if (saturation !== 1) filters.push(`saturate(${saturation})`);
  // Large hue rotations change the blue character design. Keep temperature deliberately subtle.
  if (warmth > 0) filters.push(`sepia(${+(warmth * .16).toFixed(4)})`);
  else if (warmth < 0) filters.push(`hue-rotate(${+(warmth * 6).toFixed(3)}deg)`);
  return filters.join(' ');
}
function spriteFilterCss(sprite, line) {
  return [sceneFitCss(sceneFitFor(sprite, line)), lookCss(sprite?.look)].filter(Boolean).join(' ');
}
const SPR_ACT = [['jump', 'chevrons-up', '跳一下'], ['shake', 'vibrate', '发抖/生气'], ['nod', 'chevrons-down', '点头'], ['lean', 'chevrons-right', '探身'], ['flinch', 'vibrate', '怔住/退缩'], ['settle', 'chevrons-down', '坐稳']];
const isPause = l => !l.text && !l.choices.length && !l.agent;     // 没有文字 = 演出节
const labels = () => [...new Set(P.lines.map(l => l.label).filter(Boolean))];
const labelIndex = name => P.lines.findIndex(l => l.label === name);
function blank() {
  return { v: 3, id: uid(), title: '', assets: {}, recent: { bg: [], ch: [], au: [] }, lines: [mkLine()], cur: 0,
           vars: [], chars: [], plugins: [],
           settings: { tip: 'brief', ghost: 0.55, speed: 30, link: true, dlg: 'ghost', vbgm: 0.25, vse: 0.8, vamb: 0.8, vvo: 1, autoMul: 1, skipRead: true, focus: true, agentProvider: 'mock', agentUrl: '', pluginData: {}, bw: 110, tlh: 260, trk: { hide: {}, lock: {} } } };
}
const VN_VERSION = '0.20.0';
const studioEditor = !!window.VN_EDITOR || new URLSearchParams(location.search).get('editor') === '1';
const gameMode = !!window.VN_GAME && !studioEditor; // 同一作品可显式进入编辑模式
// 被 galLingS 的作品页嵌着玩（网址带 ?host=gallings，且同源）：灵枢自动连 galLingS，手账可以停靠到外面的侧栏
const HOSTED = (() => { try { return gameMode && new URLSearchParams(location.search).get('host') === 'gallings' && parent !== window && !!parent.document; } catch (e) { return false; } })();
const headless = !!window.VN_HEADLESS;       // 命令行（无界面）模式：给 AI / 脚本调用
const ORIGINAL_HTML = gameMode ? '' : '<!doctype html>\n' + document.documentElement.outerHTML; // 仅编辑器/命令行导出需要快照
let P = blank();
let selUid = null;
const L = () => P.lines[P.cur];
const A = id => P.assets[id];
const charOf = name => P.chars.find(c => c.name === name);
// 表情组：素材名“角色_表情”
const splitName = n => { const m = String(n).match(/^(.+?)[_\-—](.+)$/); return m ? [m[1], m[2]] : [String(n), '']; };
const charKey = a => a.character || splitName(a.name)[0];
const siblings = id => { const k = charKey(A(id)); return Object.values(P.assets).filter(a => a.type === 'ch' && charKey(a) === k); };
const exprNames = name => Object.values(P.assets).filter(a => a.type === 'ch' && charKey(a) === name).map(a => splitName(a.name)[1] || '默认');

/* ========== 小型表达式：条件与变量修改（不用 eval，安全） ========== */
// 支持：数字、"文字"、变量名(可中文)、true/false、+ - * /、== != > < >= <=、&& || !、括号
function tokenize(src) {
  const re = /\s*(\d+(?:\.\d+)?|"[^"]*"|'[^']*'|[A-Za-z_\u4e00-\u9fff][\w\u4e00-\u9fff]*|>=|<=|==|!=|&&|\|\||[-+*/()<>!])/y;
  const s = String(src).trim(), out = [];
  while (re.lastIndex < s.length) {
    const m = re.exec(s);
    if (!m) throw new Error('看不懂：' + s.slice(re.lastIndex));
    out.push(m[1]);
  }
  return out;
}
const truthy = v => !(v === 0 || v === false || v === '' || v == null);
const toNum = v => typeof v === 'number' ? v : v === true ? 1 : (v === false || v == null || v === '') ? 0 : (isNaN(+v) ? v : +v);
function evalExpr(src, vars) {
  if (!src || !String(src).trim()) return true;
  const t = tokenize(src); let i = 0;
  const peek = () => t[i], next = () => t[i++];
  const or = () => { let v = and(); while (peek() === '||') { next(); const r = and(); v = truthy(v) || truthy(r); } return v; };
  const and = () => { let v = not(); while (peek() === '&&') { next(); const r = not(); v = truthy(v) && truthy(r); } return v; };
  const not = () => { if (peek() === '!') { next(); return !truthy(not()); } return cmp(); };
  const cmp = () => {
    const v = add(), op = peek();
    if (!['==', '!=', '>', '<', '>=', '<='].includes(op)) return v;
    next(); const a = toNum(v), b = toNum(add());
    return op === '==' ? a == b : op === '!=' ? a != b : op === '>' ? a > b : op === '<' ? a < b : op === '>=' ? a >= b : a <= b;
  };
  const add = () => { let v = mul(); while (peek() === '+' || peek() === '-') { const op = next(), r = mul(); v = op === '+' ? ((typeof v === 'string' && isNaN(+v)) || (typeof r === 'string' && isNaN(+r)) ? '' + v + r : toNum(v) + toNum(r)) : toNum(v) - toNum(r); } return v; };
  const mul = () => { let v = unary(); while (peek() === '*' || peek() === '/') { const op = next(), r = toNum(unary()); v = op === '*' ? toNum(v) * r : (r ? toNum(v) / r : 0); } return v; };
  const unary = () => { if (peek() === '-') { next(); return -toNum(unary()); } return atom(); };
  const atom = () => {
    const k = next();
    if (k === undefined) throw new Error('表达式不完整');
    if (k === '(') { const v = or(); if (next() !== ')') throw new Error('缺少右括号'); return v; }
    if (/^\d/.test(k)) return +k;
    if (/^["']/.test(k)) return k.slice(1, -1);
    if (k === 'true') return true;
    if (k === 'false') return false;
    if (/^[A-Za-z_\u4e00-\u9fff]/.test(k)) return Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : 0;
    throw new Error('多余的符号：' + k);
  };
  const v = or();
  if (i < t.length) throw new Error('多余的内容：' + t.slice(i).join(' '));
  return v;
}
const IDENT = /^[A-Za-z_\u4e00-\u9fff][\w\u4e00-\u9fff]*$/;
function parseSet(src) {
  return String(src || '').split(/[;；\n]/).map(x => x.trim()).filter(Boolean).map(st => {
    const m = st.match(/^([A-Za-z_\u4e00-\u9fff][\w\u4e00-\u9fff]*)\s*(\+=|-=|=)\s*(.+)$/);
    if (!m) throw new Error('看不懂：' + st);
    evalExpr(m[3], {});             // 只检查语法
    return { name: m[1], op: m[2], expr: m[3] };
  });
}
function runSet(src, vars, allowed) {
  parseSet(src).forEach(({ name, op, expr }) => {
    if (allowed && !allowed.includes(name)) return;         // Agent 只能改已定义的变量
    const v = evalExpr(expr, vars), old = toNum(vars[name] ?? 0);
    vars[name] = op === '=' ? v : op === '+=' ? (+old || 0) + (+toNum(v) || 0) : (+old || 0) - (+toNum(v) || 0);
  });
}
const cond = (src, vars) => { try { return truthy(evalExpr(src, vars)); } catch (e) { console.warn(e); return false; } };
const safeSet = (src, vars, allowed) => { try { runSet(src, vars, allowed); } catch (e) { console.warn(e); } };
function exprError(src, isSet) { try { isSet ? parseSet(src) : evalExpr(src, {}); return ''; } catch (e) { return e.message; } }
function exprIdents(src, isSet) {
  try {
    const parts = isSet ? parseSet(src).flatMap(p => [p.name, ...tokenize(p.expr)]) : tokenize(src || '');
    return parts.filter(k => IDENT.test(k) && k !== 'true' && k !== 'false');
  } catch (e) { return []; }
}
const parseLit = v => { const s = String(v ?? '').trim(); if (s === 'true') return true; if (s === 'false') return false; if (s !== '' && !isNaN(+s)) return +s; return s; };
function initVars() { const o = {}; P.vars.forEach(v => { o[v.name] = parseLit(v.init); }); return o; }


// 手动光色也划分关联画面，避免后续调位置覆盖已单独打磨的镜头。
function visKey(l) {
  return JSON.stringify([l.bg, l.sprites.map(s => [s.asset, Math.round(s.x), Math.round(s.y), Math.round(s.h), !!s.flip, sceneFitFor(s,l)])]);
}
// 当前修改会影响哪些句子
function affected() {
  if (!P.settings.link) return [P.cur];
  const k = visKey(L()), out = [P.cur];
  for (let i = P.cur - 1; i >= 0 && visKey(P.lines[i]) === k; i--) out.unshift(i);      // 往前：同一段画面
  for (let i = P.cur + 1; i < P.lines.length && visKey(P.lines[i]) === k; i++) out.push(i);
  return out;
}
const selIndex = () => L().sprites.findIndex(s => s.uid === selUid);

/* ========== 撤销 / 重做 ========== */
let hist = [], redoS = [];
const snapState = () => JSON.stringify({ lines: P.lines, cur: P.cur, theme: P.settings.theme ?? null, cover: P.settings.cover ?? null });
let batching = 0;   // >0 时处于批量命令中：不重复记撤销点、不重复刷新
function snapshot() { if (batching) return; hist.push(snapState()); if (hist.length > 150) hist.shift(); redoS = []; }
function restore(s) {
  const o = JSON.parse(s); P.lines = o.lines; P.cur = Math.min(o.cur, P.lines.length - 1); selUid = null;
  if ('theme' in o) { if (o.theme) P.settings.theme = o.theme; else delete P.settings.theme; }
  if ('cover' in o) { if (o.cover) P.settings.cover = o.cover; else delete P.settings.cover; }
  changed();
}
function undo() { if (hist.length) { redoS.push(snapState()); restore(hist.pop()); } }
function redo() { if (redoS.length) { hist.push(snapState()); restore(redoS.pop()); } }

// 统一的画面修改入口：先记撤销点，再对受影响的句子逐一执行
function edit(fn) { snapshot(); const idx = affected(); idx.forEach(i => fn(P.lines[i])); changed(); }

/* ========== 自动保存（浏览器 IndexedDB） ========== */
const dbP = new Promise(res => {
  try {
    const r = indexedDB.open('vnstudio', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result); r.onerror = () => res(null);
  } catch (e) { res(null); }
});
async function idbSet(k, v) {
  if (studioEditor) k = 'art-editor:' + (window.VN_GAME?.id || 'new') + ':' + k;
  const d = await dbP; if (!d) return false;
  return new Promise(r => {
    try { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => r(true); t.onerror = t.onabort = () => r(false); }
    catch (e) { r(false); }
  });
}
async function idbGet(k) {
  if (studioEditor) k = 'art-editor:' + (window.VN_GAME?.id || 'new') + ':' + k;
  const d = await dbP; if (!d) return null;
  return new Promise(r => { try { const q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => r(q.result); q.onerror = () => r(null); } catch (e) { r(null); } });
}
let saveT;
// 自动保存：图片/音频（体积大）每个只存一次，平时只存很小的剧本数据
const savedAssets = new Set();
let saving = false, saveAgain = false;
function autosave() {
  if (gameMode || headless || window.VN_PREVIEW_ONLY) return;
  clearTimeout(saveT);
  saveT = setTimeout(flushSave, 600);
}
async function flushSave() {
  if (DIR) return flushFolder();
  if (saving) { saveAgain = true; return; }
  saving = true;
  let ok = true;
  for (const a of Object.values(P.assets)) {
    if (savedAssets.has(a.id)) continue;
    if (await idbSet('asset:' + a.id, a.src)) savedAssets.add(a.id); else ok = false;
  }
  if (!(await idbSet('project2', JSON.stringify(P, (k, v) => k === 'src' ? undefined : v)))) ok = false;   // 素材存不下也先保住剧本
  $('#saveWarn').style.display = ok ? 'none' : 'inline-flex';
  saving = false;
  if (saveAgain) { saveAgain = false; flushSave(); }
}
async function loadAutosave() {
  const meta = await idbGet('project2');
  if (meta) {
    const o = JSON.parse(meta);
    for (const a of Object.values(o.assets || {})) { a.src = (await idbGet('asset:' + a.id)) || ''; if (a.src) savedAssets.add(a.id); }
    return o;
  }
  const old = await idbGet('project');          // v0.1/v0.2 的旧格式
  return old ? JSON.parse(old) : null;
}

/* ========== 项目文件夹：素材是真正的文件，不再塞进浏览器 ========== */
// 结构：项目文件夹/project.json + assets/bg|ch|bgm|se|vo/文件
// project.json 里每个素材只记路径（a.file）；打开时读文件，生成临时网址（blob:）给画面用
let DIR = null;
const fsOK = () => typeof window.showDirectoryPicker === 'function';
const EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg', 'audio/mpeg': '.mp3', 'audio/ogg': '.ogg', 'audio/wav': '.wav', 'audio/x-wav': '.wav', 'audio/mp4': '.m4a', 'audio/aac': '.aac' };
const safeName = n => String(n || 'asset').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60);
async function subDir(dir, parts, create) { for (const p of parts) dir = await dir.getDirectoryHandle(p, { create }); return dir; }
async function fsWrite(dir, rel, data) {
  const parts = rel.split('/'), name = parts.pop();
  const fh = await (await subDir(dir, parts, true)).getFileHandle(name, { create: true });
  const w = await fh.createWritable(); await w.write(data); await w.close();
}
async function fsRead(dir, rel) { const parts = rel.split('/'), name = parts.pop(); return (await (await subDir(dir, parts, false)).getFileHandle(name)).getFile(); }
const srcBlob = async src => (await fetch(src)).blob();
const blobToData = b => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
// 给素材分一个不重复的文件路径
function assetPath(a, blob, used) {
  const ext = (a.file && a.file.match(/\.[^./]+$/)?.[0]) || EXT[blob.type] || (a.type === 'bg' || a.type === 'ch' ? '.png' : '.mp3');
  let base = `assets/${a.type}/${safeName(a.name)}`, p = base + ext, k = 2;
  while (used.has(p)) p = `${base}_${k++}${ext}`;
  used.add(p); return p;
}
const writtenFiles = new Set();        // 这次打开后已经写进文件夹的素材 id
const projJson = o => JSON.stringify(o, (k, v) => (k === 'src' && typeof v === 'string' && (v.startsWith('blob:'))) ? undefined : v, 1);
async function flushFolder() {
  if (saving) { saveAgain = true; return; }
  saving = true; let ok = true;
  try {
    const used = new Set(Object.values(P.assets).map(a => a.file).filter(Boolean));
    for (const a of Object.values(P.assets)) {
      if (a.file && (writtenFiles.has(a.id) || !a.src || a.src.startsWith('blob:'))) { writtenFiles.add(a.id); continue; }
      const blob = await srcBlob(a.src);
      if (!a.file) a.file = assetPath(a, blob, used);
      await fsWrite(DIR, a.file, blob);
      a.src = URL.createObjectURL(blob); writtenFiles.add(a.id);     // 内存里不再留大段 base64
    }
    const o = Object.assign({}, P, { assets: Object.fromEntries(Object.entries(P.assets).map(([k, a]) => [k, a.file ? Object.assign({}, a, { src: undefined }) : a])) });
    await fsWrite(DIR, 'project.json', projJson(o));
  } catch (e) { console.warn(e); ok = false; }
  $('#saveWarn').style.display = ok ? 'none' : 'inline-flex';
  saving = false;
  if (saveAgain) { saveAgain = false; flushFolder(); }
}
async function openFolder(dir) {
  const o = JSON.parse(await (await fsRead(dir, 'project.json')).text());
  if (!o || !Array.isArray(o.lines)) throw new Error('project.json 格式不对');
  const missing = [];
  for (const a of Object.values(o.assets || {})) {
    if (!a.file) continue;
    try { a.src = URL.createObjectURL(await fsRead(dir, a.file)); } catch (e) { a.src = ''; missing.push(a.file); }
  }
  DIR = dir; writtenFiles.clear(); Object.values(o.assets || {}).forEach(a => a.file && writtenFiles.add(a.id));
  loadProject(o); idbSet('folder', dir); renderButtons();
  if (missing.length) alert('这些素材文件找不到了：\n' + missing.slice(0, 10).join('\n'));
}
async function pickFolder() { return window.showDirectoryPicker({ mode: 'readwrite' }); }
async function folderMenu() {
  if (!fsOK()) return alert('项目文件夹需要用 Chrome 或 Edge 打开本工具。\n其他浏览器可以继续用“保存”按钮存成单个文件。');
  const box = modal(`<div id="folderMenu"><div class="opt">
    ${DIR ? `<small>当前项目文件夹：${ic('folder')} ${esc(DIR.name)}（自动保存到这里）</small>` : '<small>现在项目存在浏览器里。存成文件夹后，图片和音乐都是普通文件，项目再大也不卡。</small>'}
    <button data-f="open">${ic('folder-open')} 打开项目文件夹</button>
    <button data-f="save">${ic('folder-plus')} ${DIR ? '另存为新的项目文件夹' : '把当前项目存成文件夹'}</button>
    <button data-f="game">${ic('gamepad-2')} 导出游戏文件夹<br><small>index.html + 素材文件，双击即玩，也能打包成 exe</small></button>
    ${DIR ? '<button data-f="close">' + ic('log-out') + ' 回到浏览器存储</button>' : ''}</div></div>`, null);
  box.querySelectorAll('[data-f]').forEach(b => b.onclick = async () => {
    const f = b.dataset.f; closeModal();
    try {
      if (f === 'open') { const d = await pickFolder(); await openFolder(d); }
      if (f === 'save') {
        const d = await pickFolder();
        try { await d.getFileHandle('project.json'); if (!confirm('这个文件夹里已经有 project.json，覆盖它？')) return; } catch (e) {}
        // 素材要写进新文件夹：先换回完整数据
        for (const a of Object.values(P.assets)) if (a.src?.startsWith('blob:')) { a.src = await blobToData(await srcBlob(a.src)); }
        Object.values(P.assets).forEach(a => delete a.file);
        DIR = d; writtenFiles.clear(); await flushFolder(); idbSet('folder', d); renderButtons();
        alert('已存到文件夹 ' + d.name + '，之后会自动保存到这个文件夹。');
      }
      if (f === 'game') await exportGameFolder();
      if (f === 'close') {
        for (const a of Object.values(P.assets)) if (a.src?.startsWith('blob:')) { a.src = await blobToData(await srcBlob(a.src)); delete a.file; }
        DIR = null; idbSet('folder', null); savedAssets.clear(); renderButtons(); flushSave();
      }
    } catch (e) { if (e.name !== 'AbortError') alert('操作失败：' + e.message); }
  });
}
// 导出游戏文件夹：index.html（播放器）+ game.js（剧本）+ assets/（素材原文件）
async function exportGameFolder() {
  const problems = runCheck().filter(([, m]) => !m.startsWith('空台词') && !m.includes('走不到'));
  if (problems.length && !confirm(`检查发现 ${problems.length} 个问题，仍然导出？`)) return openCheck();
  const d = await pickFolder();
  const project = studioEditor ? window.VNArtLibrary.playableProject() : P;
  const source = studioEditor ? await window.VNArtLibrary.sourceForExport() : undefined;
  const used = new Set(), assets = {};
  for (const a of Object.values(project.assets)) {
    if (!a.src) continue;
    const blob = await srcBlob(a.src), p = a.file && !used.has(a.file) ? (used.add(a.file), a.file) : assetPath(a, blob, used);
    await fsWrite(d, p, blob);
    assets[a.id] = Object.assign({}, a, { src: p, file: undefined });
  }
  const files = gameFolderFiles(assets, source, project);
  for (const [name, text] of Object.entries(files)) await fsWrite(d, name, text);
  alert(`已导出到文件夹 ${d.name}\n双击里面的 index.html 就能玩。`);
}
// 导出文件夹里的两个文本文件（命令行也用这个）
function gameFolderFiles(assets, source, project) {
  const src = source || window.VN_SOURCE_HTML || ORIGINAL_HTML;
  const data = JSON.stringify(Object.assign({}, project || P, { recent: undefined, cur: 0, assets })).replace(/</g, '\\u003c');
  const extTag = '<script src="game.js"><\/script>';
  if (src.includes(extTag)) return { 'index.html': src, 'game.js': '// 由 VN Studio 导出\nwindow.VN_GAME = ' + data + ';\n' };
  const pTag = '<script src="player.js"><\/script>', pIdx = src.indexOf(pTag);
  if (pIdx >= 0) return { 'index.html': src.slice(0, pIdx) + extTag + '\n' + src.slice(pIdx), 'game.js': '// 由 VN Studio 导出\nwindow.VN_GAME = ' + data + ';\n' };
  const marker = '<script>\n\'use strict\';', i = src.indexOf(marker);
  if (i < 0) throw new Error('找不到播放器代码');
  const html = src.slice(0, i) + '<script src="game.js"><\/script>\n' + src.slice(i);
  return { 'index.html': html, 'game.js': '// 由 VN Studio 导出\nwindow.VN_GAME = ' + data + ';\n' };
}
// 单文件导出/保存前：把临时网址换回完整数据，保证文件能单独打开
async function inlineAll() { for (const a of Object.values(P.assets)) if (a.src?.startsWith('blob:')) a._inline = await blobToData(await srcBlob(a.src)); }
const withInline = () => Object.assign({}, P, { assets: Object.fromEntries(Object.entries(P.assets).map(([k, a]) => [k, a._inline ? Object.assign({}, a, { src: a._inline, _inline: undefined }) : a])) });

/* ========== 素材导入 ========== */
const readFile = f => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
const loadImg = src => new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = src; });
// 有透明像素 → 立绘；完全不透明 → 背景
function hasAlpha(img) {
  const c = document.createElement('canvas'); c.width = c.height = 48;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0, 48, 48);
  const d = x.getImageData(0, 0, 48, 48).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 245) return true;
  return false;
}
const shelf = t => (t === 'bgm' || t === 'se' || t === 'vo') ? 'au' : t;   // 素材类型 → 侧栏哪一栏
const audioDuration = src => new Promise(r => { const a = new Audio(); a.preload = 'metadata'; a.onloadedmetadata = () => r(a.duration || 0); a.onerror = () => r(0); a.src = src; });
function touchRecent(id) {
  const arr = P.recent[shelf(A(id).type)], i = arr.indexOf(id);
  if (i >= 0) arr.splice(i, 1);
  arr.unshift(id);
}
const guessVoice = name => /^(vo|voice|cv|语音|配音)[_\-\s]/i.test(name) || P.chars.some(c => c.name && name.startsWith(c.name + '_'));
async function importFiles(files, type) {
  const ids = [];
  for (const f of files) {
    if (f.type.startsWith('audio/')) {
      if (type && type !== 'au') continue;
      const src = await readFile(f);
      const dur = await audioDuration(src);
      const name = f.name.replace(/\.[^.]+$/, '');
      // 20 秒以上 = 音乐；名字像“vo_…”“配音_…”或“角色名_…” = 配音；其余 = 音效（点图标可以改）
      const t = dur >= 20 ? 'bgm' : guessVoice(name) ? 'vo' : 'se';
      let id = Object.values(P.assets).find(a => a.name === name && a.type === t && a.src.length === src.length)?.id;
      if (!id) { id = uid(); P.assets[id] = { id, type: t, name, src, dur }; }
      touchRecent(id); ids.push(id); continue;
    }
    if (!f.type.startsWith('image/') || type === 'au') continue;
    const src = await readFile(f);
    let img; try { img = await loadImg(src); } catch (e) { continue; }
    const name = f.name.replace(/\.[^.]+$/, '');
    // 同名同类型视为同一素材，直接复用
    const t = type || (hasAlpha(img) ? 'ch' : 'bg');
    let id = Object.values(P.assets).find(a => a.name === name && a.type === t && a.src.length === src.length)?.id;
    if (!id) { id = uid(); P.assets[id] = { id, type: t, name, src, w: img.naturalWidth, h: img.naturalHeight }; }
    touchRecent(id); ids.push(id);
  }
  renderSide(); autosave();
  return ids;
}

/* ========== 使用素材 ========== */
const SLOTS = [640, 380, 900, 220, 1060];
function addSprite(id, x) {
  const a = A(id);
  const h = a.w > a.h ? 360 : 660;
  if (x == null) x = SLOTS[L().sprites.length % SLOTS.length];
  const s = { uid: uid(), asset: id, x, y: H, h, flip: false };
  edit(l => l.sprites.push(clone(s)));
  selUid = s.uid; touchRecent(id); changed();
}
function setBg(id) { touchRecent(id); edit(l => { l.bg = id; }); }
function replaceSprite(si, id) { touchRecent(id); edit(l => { if (l.sprites[si]) l.sprites[si].asset = id; }); }
// 音乐：从当前句往后，凡是沿用同一首（或同样无音乐）的句子一起换
function setBgm(id) {
  if (id) touchRecent(id);
  snapshot();
  const old = L().bgm;
  for (let i = P.cur; i < P.lines.length && P.lines[i].bgm === old; i++) P.lines[i].bgm = id;
  changed();
}
// 环境音：和音乐一样，从当前句往后，凡是沿用同一个（同音量）环境音的句子一起换
function setAmb(f, id, v) {
  if (id) touchRecent(id);
  snapshot();
  const fv = f + 'v', old = L()[f], ov = L()[fv]; v = v ?? ov ?? 0.6;
  for (let i = P.cur; i < P.lines.length && P.lines[i][f] === old && P.lines[i][fv] === ov; i++) { P.lines[i][f] = id; P.lines[i][fv] = v; }
  changed();
}
function setVoice(id) { if (id) touchRecent(id); snapshot(); L().voice = (L().voice === id ? null : id); changed(); }
function setSe(id) { if (id) touchRecent(id); snapshot(); L().se = (L().se === id ? null : id); changed(); }
function useAsset(id, x) {
  const t = A(id).type;
  if (t === 'bg') return setBg(id);
  if (t === 'bgm') return setBgm(id);
  if (t === 'se') return setSe(id);
  if (t === 'vo') return setVoice(id);
  addSprite(id, x);
}

/* ========== 渲染 ========== */
// 背景图地址放进 CSS 时要加引号：占位图的地址里有括号，不加引号浏览器会认错
const cssUrl = u => `url("${String(u).replace(/["\\\n]/g, c => '\\' + c)}")`;
const stage = $('#stage'), layer = $('#layer'), bgEl = $('#bgEl');
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const stillMotion = () => motionPreference.matches;
const spriteDecodeCache = new Map();
function warmSprite(a) {
  if (spriteDecodeCache.has(a.src)) return spriteDecodeCache.get(a.src);
  const image = new Image(); image.decoding = 'async'; image.src = a.src;
  const entry = { image, ready: false };
  entry.promise = image.decode().then(() => { entry.ready = true; return entry; }, () => null);
  spriteDecodeCache.set(a.src, entry);
  // A handful of upcoming poses, rather than decoding the entire art library.
  while (spriteDecodeCache.size > 6) spriteDecodeCache.delete(spriteDecodeCache.keys().next().value);
  return entry;
}
function warmUpcomingSprites(index) {
  if (RT.skip) return;
  const seen = new Set();
  for (const line of P.lines.slice(index + 1, index + 9)) {
    for (const s of line.sprites) {
      const a = A(s.asset); if (!a || seen.has(a.src)) continue;
      seen.add(a.src); warmSprite(a); if (seen.size >= 3) return;
    }
  }
}
function clearStageShot() {
  bgEl._shot?.cancel(); bgEl._shot = null; bgEl._shotKey = null;
  bgEl.style.scale = ''; bgEl.style.transformOrigin = ''; bgEl.style.willChange = '';
}
function stageShot(line, editable) {
  const shot = A(line.bg)?.shot;
  if (editable || RT.skip || stillMotion() || !Array.isArray(shot?.focus)) { clearStageShot(); return; }
  if (bgEl._shotKey === line.bg) return;
  clearStageShot(); bgEl._shotKey = line.bg;
  bgEl.style.transformOrigin = `${shot.focus[0] * 100}% ${shot.focus[1] * 100}%`;
  bgEl.style.willChange = 'scale';
  const zoom = Math.max(1, Math.min(1.04, shot.scale));
  const anim = bgEl.animate([{ scale: '1' }, { scale: String(zoom) }],
    { duration: Math.max(600, Math.min(3000, shot.ms)), easing: 'cubic-bezier(.2,.65,.3,1)', fill: 'forwards' });
  bgEl._shot = anim;
  anim.finished.then(() => {
    if (bgEl._shot !== anim) return;
    bgEl.style.scale = String(zoom); anim.cancel(); bgEl._shot = null; bgEl.style.willChange = '';
  }, () => {});
}
function renderStage(line, editable) {
  const backdrop=A(line.bg);stage.dataset.light=backdrop?.lighting||(/夜/.test(backdrop?.name||'')?'night':'');
  const dim = /night|underwater/.test(stage.dataset.light) || /dark|underwater/.test(line.mood || '');
  const reading = dim && (backdrop?.sceneFit?.warmth || 0) > .25 ? 'warm' : dim ? 'dim' : 'day';
  if (stage.dataset.reading !== reading) stage.dataset.reading = reading;stage.dataset.library=backdrop?.libraryAsset?'true':'false';
  bgEl.style.backgroundSize=backdrop?.view?.size||'';bgEl.style.backgroundPosition=backdrop?.view?.position||'';
  const hideBg = editable && hiddenLane('bg');
  stage.dataset.mood = (editable && hiddenLane('mood')) ? '' : (line.mood || '');
  bgEl.style.backgroundImage = line.bg && A(line.bg) && !hideBg ? cssUrl(A(line.bg).src) : '';
  stageShot(line, editable);
  $('#empty').style.display = (!line.bg && !line.sprites.length && editable) ? 'flex' : 'none';
  if (!editable) { renderPlaySprites(line); placeBar(); return; }
  layer.innerHTML = '';
  line.sprites.forEach(s => {
    const a = A(s.asset); if (!a) return;
    if (editable && hiddenLane('ch:' + charKey(a))) return;
    const img = document.createElement('img');
    img.src = a.src; img.draggable = false; img.dataset.uid = s.uid;
    img.className = 'spr' + (editable && s.uid === selUid ? ' sel' : '');
    placeSprite(img, s, line);
    layer.appendChild(img);
  });
  placeBar();
}
// 播放时的立绘：同一个角色复用同一张图，所以换位置会“走过去”，换表情不会闪；新角色播入场，离开的播退场
function renderPlaySprites(line) {
  const fast = RT.skip || stillMotion();
  layer.querySelectorAll('.pose-ghost').forEach(el => el.remove());
  const have = new Map([...layer.querySelectorAll('img.spr:not(.leaving)')].map(el => [el.dataset.ck, el]));
  const speaker = line.speaker, keep = new Set();
  const focus = P.settings.focus !== false && line.text && line.sprites.some(s => A(s.asset) && charKey(A(s.asset)) === speaker);
  line.sprites.forEach((s, z) => {
    const a = A(s.asset); if (!a) return;
    const ck = charKey(a); keep.add(ck);
    let el = have.get(ck);
    if (!el) {
      el = document.createElement('img'); el.draggable = false; el.dataset.ck = ck; el.className = 'spr';
      el.decoding = 'async'; placeSprite(el, s, line); layer.appendChild(el);
    } else {
      el.classList.toggle('anim', !fast);
    }
    el.style.zIndex = z; el._out = s.out || 'fade';
    el.classList.toggle('dim', !!focus && ck !== speaker);
    const revision = el._poseRevision = (el._poseRevision || 0) + 1;
    const previous = el.getAttribute('src'), changedPose = previous !== a.src;
    const act = line.acts?.[ck], sameScene = lastShown?.bg === line.bg;
    const commit = () => {
      if (!playing || !el.isConnected || el._poseRevision !== revision) return;
      if (changedPose && previous && !fast && !act && s.poseSwitch === 'soft' && sameScene) {
        const ghost = el.cloneNode(false); ghost.className = 'spr leaving pose-ghost';
        ghost.setAttribute('aria-hidden', 'true'); ghost.style.transition = 'none';
        ghost.style.pointerEvents = 'none'; el.before(ghost);
        ghost.animate([{ opacity: getComputedStyle(el).opacity }, { opacity: 0 }], { duration: 140, easing: 'ease-out' })
          .finished.then(() => ghost.remove(), () => ghost.remove());
      }
      if (changedPose) el.src = a.src;
      el.dataset.asset = a.id; placeSprite(el, s, line);
      if (fast) [...el.classList].filter(c => /^(in|out|act)-/.test(c)).forEach(c => el.classList.remove(c));
      else if (act) sprAnim(el, 'act-' + act);
      else if (!previous && s.in !== 'none') sprAnim(el, 'in-' + (s.in || 'fade'));
    };
    const ready = changedPose && !fast ? warmSprite(a) : null;
    if (ready && !ready.ready) ready.promise.then(commit); else commit();
  });
  have.forEach((el, ck) => {
    if (keep.has(ck)) return;
    if (fast || el._out === 'none') return el.remove();
    el.classList.add('leaving'); sprAnim(el, 'out-' + el._out); setTimeout(() => el.remove(), 650);
  });
}
function sprAnim(el, cls) {
  [...el.classList].forEach(c => { if (/^(in|out|act)-/.test(c)) el.classList.remove(c); });
  void el.offsetWidth; el.classList.add(cls);
}
function placeSprite(img, s, line = playing ? P.lines[RT.idx] : L()) {
  img.style.height = s.h + 'px'; img.style.left = s.x + 'px'; img.style.top = s.y + 'px';
  img.style.transform = `translate(-50%,-100%) scaleX(${s.flip ? -1 : 1})`;
  const lk = lookCss(s.look); if (lk) img.style.setProperty('--lk', lk); else img.style.removeProperty('--lk');
  const light = sceneFitCss(sceneFitFor(s, line)); if (light) img.style.setProperty('--scene-light', light); else img.style.removeProperty('--scene-light');
}
function placeBar() {
  const bar = $('#sprBar'), s = L().sprites.find(s => s.uid === selUid);
  if (!s || playing) { bar.style.display = 'none'; $('#exprPop').style.display = 'none'; $('#animPop').style.display = 'none'; $('#lookPop').style.display = 'none'; return; }
  bar.style.display = 'flex';
  bar.style.left = Math.max(90, Math.min(W - 90, s.x)) + 'px';
  bar.style.top = Math.max(50, s.y - s.h - 6) + 'px';
}
function renderDialog() {
  const l = L();
  if (document.activeElement !== $('#nm')) $('#nm').value = l.speaker;
  if (document.activeElement !== $('#tx')) $('#tx').value = l.text;
  $('#nm').style.color = charOf(l.speaker)?.color || '';
  stage.dataset.dlg = P.settings.dlg;
  document.documentElement.style.setProperty('--ghost', Math.max(.35, Math.min(.95, +(pref('ghost') ?? .55))));
}
/* ========== 多轨时间轴（参考剪辑软件） ========== */
// 横向一格 = 一“节”（一句台词）。上：立绘轨（每个角色一条）；中：文本轨；下：场景、音乐、音效轨。
// 轨道上的“片段” = 连续几节里完全相同的内容。数据仍然按节保存，片段是“看出来”的，所以永远不会和画面对不上。
const TL = { sel: null, clip: null, lastCur: -1 };
const HEAD = 96;
const bw = () => P.settings.bw || 110;
const trk = () => (P.settings.trk = P.settings.trk || { hide: {}, lock: {} });
const locked = id => !!trk().lock?.[id];
const hiddenLane = id => !!trk().hide?.[id];
function laneDefs() {
  const chars = [];
  P.lines.forEach(l => l.sprites.forEach(s => { const a = A(s.asset); if (a && !chars.includes(charKey(a))) chars.push(charKey(a)); }));
  return [
    ...chars.map(k => ({ id: 'ch:' + k, kind: 'ch', ch: k, name: esc(k), h: 44, tip: 'laneCh' })),
    { id: 'chNew', kind: 'chNew', name: ic('user-plus'), h: 22, tip: 'chNew' },
    { id: 'text', kind: 'text', name: ic('message-square'), h: 58, tip: 'laneText' },
    { id: 'vo', kind: 'vo', name: ic('mic'), h: 26, tip: 'laneVo' },
    { id: 'bg', kind: 'bg', name: ic('image'), h: 40, tip: 'laneBg' },
    { id: 'mood', kind: 'mood', name: ic('cloud-fog'), h: 26, tip: 'laneMood' },
    { id: 'fx', kind: 'fx', name: ic('zap'), h: 26, tip: 'laneFx' },
    { id: 'bgm', kind: 'bgm', name: ic('music'), h: 26, tip: 'laneBgm' },
    { id: 'amb', kind: 'amb', name: ic('waves'), h: 26, tip: 'laneAmb' },
    { id: 'amb2', kind: 'amb2', name: ic('waves'), h: 26, tip: 'laneAmb2' },
    { id: 'se', kind: 'se', name: ic('bell'), h: 26, tip: 'laneSe' }
  ];
}
const laneById = id => id.startsWith('ch:') ? { id, kind: 'ch', ch: id.slice(3) } : { id, kind: id };
// 某条轨道在第 t 节的内容
function cellOf(lane, t) {
  const l = P.lines[t]; if (!l) return null;
  if (lane.kind === 'bg') return l.bg ? { key: l.bg, asset: l.bg } : null;
  if (lane.kind === 'bgm') return l.bgm ? { key: l.bgm, asset: l.bgm } : null;
  if (lane.kind === 'amb') return l.amb ? { key: l.amb + '|' + l.ambv, asset: l.amb, v: l.ambv } : null;
  if (lane.kind === 'amb2') return l.amb2 ? { key: l.amb2 + '|' + l.amb2v, asset: l.amb2, v: l.amb2v } : null;
  if (lane.kind === 'se') return l.se ? { key: l.se + '#' + t, asset: l.se } : null;
  if (lane.kind === 'vo') return l.voice ? { key: l.voice + '#' + t, asset: l.voice } : null;
  if (lane.kind === 'mood') return l.mood ? { key: l.mood, asset: l.mood } : null;
  if (lane.kind === 'fx') return l.fx ? { key: l.fx + '#' + t, asset: l.fx } : null;
  if (lane.kind === 'ch') {
    const s = l.sprites.find(s => A(s.asset) && charKey(A(s.asset)) === lane.ch);
    return s ? { key: [s.asset, Math.round(s.x), Math.round(s.y), Math.round(s.h), !!s.flip, s.look || '', JSON.stringify(sceneFitFor(s,l))].join('|'), asset: s.asset, spr: s } : null;
  }
  return null;
}
function clipsOf(lane) {
  const out = []; let cur = null;
  for (let t = 0; t < P.lines.length; t++) {
    const c = cellOf(lane, t);
    if (c && cur && cur.key === c.key && cur.j === t - 1) cur.j = t;
    else { cur = c ? { key: c.key, asset: c.asset, i: t, j: t } : null; if (cur) out.push(cur); }
  }
  return out;
}
const clipAt = (lane, t) => clipsOf(lane).find(c => c.i <= t && t <= c.j);
// 写入 / 清除某条轨道的某一节
function putCell(lane, t, src) {
  const l = P.lines[t]; if (!l) return;
  if (lane.kind === 'bg') l.bg = src ? src.asset : null;
  else if (lane.kind === 'bgm') l.bgm = src ? src.asset : null;
  else if (lane.kind === 'amb') { l.amb = src ? src.asset : null; l.ambv = src?.v ?? l.ambv ?? 0.6; }
  else if (lane.kind === 'amb2') { l.amb2 = src ? src.asset : null; l.amb2v = src?.v ?? l.amb2v ?? 0.6; }
  else if (lane.kind === 'se') l.se = src ? src.asset : null;
  else if (lane.kind === 'vo') l.voice = src ? src.asset : null;
  else if (lane.kind === 'mood') l.mood = src ? src.asset : '';
  else if (lane.kind === 'fx') l.fx = src ? src.asset : '';
  else if (lane.kind === 'ch') {
    const k = l.sprites.findIndex(s => A(s.asset) && charKey(A(s.asset)) === lane.ch);
    if (!src) { if (k >= 0) l.sprites.splice(k, 1); return; }
    const s = clone(src.spr);
    if (k >= 0) l.sprites[k] = s; else l.sprites.push(s);
  }
}
// 拖边缘：往外 = 复制到新覆盖的节（会覆盖那里原来的内容），往里 = 从那些节去掉
function trimClip(lane, c, side, to) {
  to = Math.max(0, Math.min(P.lines.length - 1, to));
  to = side === 'r' ? Math.max(c.i, to) : Math.min(c.j, to);
  if (to === (side === 'r' ? c.j : c.i)) return false;
  snapshot();
  if (side === 'r') {
    const src = cellOf(lane, c.j);
    if (to > c.j) for (let t = c.j + 1; t <= to; t++) putCell(lane, t, src);
    else for (let t = to + 1; t <= c.j; t++) putCell(lane, t, null);
  } else {
    const src = cellOf(lane, c.i);
    if (to < c.i) for (let t = to; t < c.i; t++) putCell(lane, t, src);
    else for (let t = c.i; t < to; t++) putCell(lane, t, null);
  }
  TL.sel = { laneId: lane.id, i: side === 'r' ? c.i : to };
  changed(); return true;
}
// 拖中间：整段搬走（按住 Alt = 复制一份）
function moveClip(lane, c, d, copy) {
  const len = c.j - c.i, ni = Math.max(0, Math.min(P.lines.length - 1 - len, c.i + d));
  if (ni === c.i) return false;
  snapshot();
  const src = cellOf(lane, c.i);
  if (!copy) for (let t = c.i; t <= c.j; t++) putCell(lane, t, null);
  for (let t = ni; t <= ni + len; t++) putCell(lane, t, src);
  TL.sel = { laneId: lane.id, i: ni }; P.cur = ni; changed(); return true;
}
function deleteClip(lane, c) { snapshot(); for (let t = c.i; t <= c.j; t++) putCell(lane, t, null); TL.sel = null; selUid = null; changed(); }
// 文本轨拖动：只挪文字（和它的标签、选项等），画面留在原地
const TEXT_FIELDS = ['id', 'speaker', 'text', 'label', 'chapter', 'choices', 'jump', 'jumpIf', 'set', 'agent', 'wait', 'voice', 'ending'];
function moveText(from, to) {
  to = Math.max(0, Math.min(P.lines.length - 1, to)); if (to === from) return false;
  snapshot();
  const parts = P.lines.map(l => Object.fromEntries(TEXT_FIELDS.map(f => [f, l[f]])));
  const [p] = parts.splice(from, 1); parts.splice(to, 0, p);
  P.lines.forEach((l, k) => Object.assign(l, parts[k]));
  P.cur = to; TL.sel = null; changed(); return true;
}
// 素材拖进时间轴：落在片段上 = 从这一节起换到片段结尾；落在空白 = 只放这一节
function dropAssetAt(id, t, onLane) {
  const a = A(id); if (!a || t < 0 || t >= P.lines.length) return;
  const toAmb = (onLane === 'amb' || onLane === 'amb2') && (a.type === 'se' || a.type === 'bgm');   // 音频拖到环境音轨 = 当环境音用
  const lane = toAmb ? laneById(onLane) : a.type === 'ch' ? laneById('ch:' + charKey(a)) : laneById(a.type);
  if (locked(lane.id)) return;
  touchRecent(id); snapshot();
  const c = !toAmb && (a.type === 'se' || a.type === 'vo') ? null : clipAt(lane, t);
  if (c) {                                          // 从落点到片段结尾换掉（落在开头 = 整段换）
    for (let k = t; k <= c.j; k++) {
      const cell = cellOf(lane, k);
      putCell(lane, k, a.type === 'ch' ? { spr: Object.assign(clone(cell.spr), { asset: id }) } : { asset: id });
    }
  } else if (a.type === 'ch') {
    let ref = null;                                   // 位置参考这个角色最近一次出现
    for (let k = t; k >= 0 && !ref; k--) ref = cellOf(lane, k);
    for (let k = t; k < P.lines.length && !ref; k++) ref = cellOf(lane, k);
    const sp = ref ? Object.assign(clone(ref.spr), { asset: id })
      : { uid: uid(), asset: id, x: SLOTS[P.lines[t].sprites.length % SLOTS.length], y: H, h: a.w > a.h ? 360 : 660, flip: false };
    putCell(lane, t, { spr: sp });
  } else putCell(lane, t, { asset: id });
  P.cur = t; TL.sel = { laneId: lane.id, i: t }; selUid = null; changed();
}
function selectClip(laneId, c, t) {
  TL.sel = { laneId, i: c.i };
  P.cur = Math.max(c.i, Math.min(c.j, t));
  selUid = laneId.startsWith('ch:') ? (cellOf(laneById(laneId), P.cur)?.spr.uid ?? null) : null;
  changed();
}
const selClip = () => { if (!TL.sel) return null; const lane = laneById(TL.sel.laneId), c = clipAt(lane, TL.sel.i); return c ? { lane, c } : null; };
function copyClip() { const s = selClip(); if (s) TL.clip = { lane: s.lane, src: clone(cellOf(s.lane, s.c.i)), len: s.c.j - s.c.i }; }
function pasteClip() {
  const k = TL.clip; if (!k || locked(k.lane.id)) return;
  snapshot();
  const end = Math.min(P.lines.length - 1, P.cur + k.len);
  for (let t = P.cur; t <= end; t++) putCell(k.lane, t, k.src);
  TL.sel = { laneId: k.lane.id, i: P.cur }; changed();
}
// 素材图片做成 CSS 类，时间轴里成百个片段共用一份图片数据
const cssDone = new Set();
function ensureAssetCss() {
  const sh = $('#assetCss').sheet; if (!sh) return;
  for (const a of Object.values(P.assets)) {
    if (cssDone.has(a.id) || (a.type !== 'bg' && a.type !== 'ch') || !a.src || !/^[\w-]+$/.test(a.id)) continue;
    try { sh.insertRule(`.a-${a.id}{background-image:${cssUrl(a.src)}}`, sh.cssRules.length); cssDone.add(a.id); } catch (e) {}
  }
}
function clipHtml(lane, c, w) {
  const a = A(c.asset);
  const sel = TL.sel && TL.sel.laneId === lane.id && c.i <= TL.sel.i && TL.sel.i <= c.j;
  const fxv = lane.kind === 'mood' ? moodName(c.asset) : lane.kind === 'fx' ? fxName(c.asset) : null;
  const name = fxv ? (lane.kind === 'fx' ? '' : fxv[2]) : !a ? '?' : lane.kind === 'ch' ? (splitName(a.name)[1] || a.name) : a.name;
  const im = lane.kind === 'ch' ? `<div class="im a-${c.asset}"></div>` : '';
  const cls = `clip k-${lane.kind}${sel ? ' sel' : ''}${lane.kind === 'bg' ? ' a-' + c.asset : ''}`;
  return `<div class="${cls}" data-i="${c.i}" data-j="${c.j}" data-tip="clip" style="left:${c.i * w + 1}px;width:${(c.j - c.i + 1) * w - 2}px"><div class="hl"></div>${im}<span class="lbl">${fxv ? ic(fxv[1]) + ' ' : ''}${esc(name)}</span><div class="hr"></div></div>`;
}
function textClipHtml(l, i, w) {
  const marks = [];
  if (l.choices.length) marks.push(ic('split') + l.choices.length);
  if (l.jump) marks.push(ic('corner-down-right') + esc(l.jump));
  if (l.set) marks.push(ic('variable'));
  if (l.wait > 0) marks.push(ic('timer') + l.wait);
  if (Object.keys(l.acts || {}).length) marks.push(ic('chevrons-up'));
  if (l.agent) marks.push(ic('bot'));
  const col = charOf(l.speaker)?.color;
  return `<div class="tclip${i === P.cur ? ' cur' : ''}${l.chapter ? ' chap' : ''}" data-i="${i}" data-tip="card" style="left:${i * w + 1}px;width:${w - 2}px">`
    + (isPause(l) ? `<b class="pz" style="color:var(--dim)">${ic('clapperboard')}</b><div class="t" style="color:var(--dim)">${l.wait || 2}s</div>`
      : `<b${col ? ` style="color:${esc(col)}"` : ''}>${esc(l.speaker) || '&nbsp;'}</b><div class="t">${esc(l.text) || '…'}</div>`)
    + (marks.length ? `<div class="ic">${marks.join(' ')}</div>` : '')
    + (P.lines.length > 1 ? '<button class="x">' + ic('x') + '</button>' : '') + '</div>';
}
function renderTimeline() {
  ensureAssetCss();
  const sc = $('#tlScroll'), w = bw(), n = P.lines.length, full = n * w + 60, h = [];
  const head = lane => {
    const hide = (lane.kind === 'ch' || lane.kind === 'bg' || lane.kind === 'mood') ? `<button data-t="hide" data-tip="trkHide" class="${hiddenLane(lane.id) ? 'on' : ''}">${ic('eye-off')}</button>` : '';
    const lock = ['ch', 'bg', 'bgm', 'amb', 'amb2', 'se', 'mood', 'fx', 'vo'].includes(lane.kind) ? `<button data-t="lock" data-tip="trkLock" class="${locked(lane.id) ? 'on' : ''}">${ic('lock')}</button>` : '';
    return `<div class="thead" data-tip="${lane.tip}"><span class="nmx">${lane.name}</span>${hide}${lock}</div>`;
  };
  let ru = '';
  const every = w >= 44 ? 1 : w >= 24 ? 2 : 5;
  for (let i = 0; i < n; i += every) ru += `<div class="tick" style="left:${i * w}px">${i + 1}</div>`;
  P.lines.forEach((l, i) => {
    const t = [l.chapter && ic('book-open') + esc(l.chapter), l.label && ic('tag') + esc(l.label)].filter(Boolean).join(' ');
    if (t) ru += `<div class="mk${l.chapter ? '' : ' lb'}" style="left:${i * w + 2}px">${t}</div>`;
  });
  h.push(`<div class="trow ruler" data-lane="ruler" style="height:30px"><div class="thead"></div><div class="tlane" data-tip="ruler" style="width:${full}px">${ru}</div></div>`);
  for (const lane of laneDefs()) {
    let body = '';
    if (lane.kind === 'text') { P.lines.forEach((l, i) => { body += textClipHtml(l, i, w); }); body += `<div class="tadd" data-tip="addLine" style="left:${n * w + 4}px">${ic('plus')}</div>`; }
    else if (lane.kind !== 'chNew') clipsOf(lane).forEach(c => { body += clipHtml(lane, c, w); });
    h.push(`<div class="trow${lane.kind === 'chNew' ? ' chNew' : ''}${locked(lane.id) ? ' locked' : ''}" data-lane="${esc(lane.id)}" style="height:${lane.h}px">${head(lane)}<div class="tlane" style="width:${full}px">${body}</div></div>`);
  }
  h.push(`<div id="ph" style="left:${HEAD + P.cur * w}px;width:${w}px"></div>`);
  sc.innerHTML = `<div id="tlInner" style="width:${HEAD + full}px">${h.join('')}</div>`;
  $('#tlPos').textContent = `${P.cur + 1} / ${n}`;
  $('#tlZoom').value = w;
  if (TL.lastCur !== P.cur) {                       // 播放头跑出视野时自动跟过去
    TL.lastCur = P.cur;
    const x = HEAD + P.cur * w;
    if (x < sc.scrollLeft + HEAD || x + w > sc.scrollLeft + sc.clientWidth) sc.scrollLeft = Math.max(0, x - sc.clientWidth / 2);
  }
}
// 打字时只刷新当前这一格，长剧本也不卡
function updCurCard() {
  const c = $(`#tlScroll .tclip[data-i="${P.cur}"]`); if (!c || isPause(L()) || c.querySelector('b.pz')) return renderTimeline();
  c.querySelector('b').textContent = L().speaker || '\u00a0';
  c.querySelector('b').style.color = charOf(L().speaker)?.color || '';
  c.querySelector('.t').textContent = L().text || '…';
}
function setZoom(nw, anchorX) {
  const old = bw(), sc = $('#tlScroll');
  nw = Math.max(16, Math.min(280, Math.round(nw))); if (nw === old) return;
  const ax = anchorX ?? sc.clientWidth / 2, beat = (sc.scrollLeft + ax - HEAD) / old;
  P.settings.bw = nw; renderTimeline();
  sc.scrollLeft = Math.max(0, beat * nw + HEAD - ax); autosave();
}
function applyTlh() { $('#app').style.setProperty('--tlh', (P.settings.tlh || 260) + 'px'); fit(); }
let audition = null;
function previewAudio(id, btn) {
  if (audition) { audition.pause(); const same = audition._id === id; audition = null; document.querySelectorAll('.au .pv').forEach(b => b.innerHTML = ic('play')); if (same) return; }
  audition = new Audio(A(id).src); audition._id = id; audition.volume = 0.7; audition.play();
  btn.innerHTML = ic('square'); audition.onended = () => { btn.innerHTML = ic('play'); audition = null; };
}
function renderSide() {
  const ga = $('#gau'); ga.innerHTML = '';
  P.recent.au = (P.recent.au || []).filter(id => A(id));
  P.recent.au.forEach(id => {
    const a = A(id), d = document.createElement('div');
    d.className = 'au'; d.draggable = true; d.dataset.tip = 'auItem';
    const ty = document.createElement('span'); ty.innerHTML = ic({ bgm: 'music', se: 'bell', vo: 'mic' }[a.type] || 'bell'); ty.dataset.tip = 'auType'; ty.style.cursor = 'pointer';
    ty.onclick = e => { e.stopPropagation(); a.type = { bgm: 'se', se: 'vo', vo: 'bgm' }[a.type] || 'se'; renderSide(); changed(); };
    const nm = document.createElement('span'); nm.className = 'nmx'; nm.textContent = a.name;
    const pv = document.createElement('button'); pv.className = 'pv'; pv.innerHTML = ic('play');
    pv.onclick = e => { e.stopPropagation(); previewAudio(id, pv); };
    const x = document.createElement('button'); x.className = 'x'; x.innerHTML = ic('x');
    x.onclick = e => { e.stopPropagation(); P.recent.au.splice(P.recent.au.indexOf(id), 1); renderSide(); autosave(); };
    d.append(ty, nm, pv, x);
    d.onclick = () => useAsset(id);
    d.ondragstart = e => { e.dataTransfer.setData('text/vn-asset', id); };
    ga.appendChild(d);
  });
  for (const t of ['bg', 'ch']) {
    const g = $('#g' + t); g.innerHTML = '';
    P.recent[t] = P.recent[t].filter(id => A(id));
    P.recent[t].forEach(id => {
      const a = A(id);
      const d = document.createElement('div');
      d.className = 'th'; d.draggable = true; d.style.backgroundImage = cssUrl(a.src); d.dataset.tip = 'thumb';
      d.title = '';
      d.onclick = () => useAsset(id);
      d.ondragstart = e => { e.dataTransfer.setData('text/vn-asset', id); e.dataTransfer.effectAllowed = 'copy'; };
      const x = document.createElement('button'); x.className = 'x'; x.innerHTML = ic('x');
      x.onclick = e => { e.stopPropagation(); P.recent[t].splice(P.recent[t].indexOf(id), 1); renderSide(); autosave(); };
      d.appendChild(x);
      if (t === 'bg') { const c = document.createElement('button'); c.className = 'cgb' + (isCG(a) ? ' on' : ''); c.textContent = 'CG'; c.dataset.tip = 'cgMark';
        c.onclick = e => { e.stopPropagation(); a.cg = !isCG(a); renderSide(); changed(); }; d.appendChild(c); }
      g.appendChild(d);
    });
  }
}
function renderButtons() {
  $('#bLink').classList.toggle('on', P.settings.link);
  $('#bFolder').classList.toggle('on', !!DIR); $('#bFolder').dataset.name = DIR ? DIR.name : '';
  $('#bProps').classList.toggle('on', $('#props').classList.contains('open'));
  $('#bDlg').innerHTML = ic({ ghost: 'message-square', hidden: 'message-square-off', show: 'message-square-text' }[P.settings.dlg]);
  $('#bUndo').disabled = !hist.length; $('#bRedo').disabled = !redoS.length;
  const chs = P.lines.map((l, i) => [i, l.chapter]).filter(x => x[1]), cs = $('#chSel');
  cs.style.display = chs.length ? '' : 'none';
  let curCh = -1; chs.forEach(([i]) => { if (i <= P.cur) curCh = i; });
  cs.innerHTML = chs.map(([i, n]) => `<option value="${i}" ${i === curCh ? 'selected' : ''}>${esc(n)}</option>`).join('');
}
function renderChoices(list, live) {
  const box = $('#choices'); box.innerHTML = '';
  box.dataset.side=(playing && (P.lines[RT.idx]?.sprites?.[0]?.x??W/2)<W/2)?'right':'left';box.dataset.many=list.length>4?'true':'false';
  box.className = list.length ? (live ? 'show' : 'show edit') : '';
  list.forEach(c => {
    const b = document.createElement('button'); b.textContent = c.text || '…';
    if (live) b.onclick = e => { e.stopPropagation(); choose(c); };
    box.appendChild(b);
  });
}
const renderChoicesEdit = () => { if (!playing) renderChoices(L().choices, false); };
function render() {
  applyTheme();
  renderStage(L(), true); renderDialog(); renderTimeline(); renderSide(); renderButtons();
  renderChoicesEdit();
  if ($('#props').classList.contains('open') && !$('#props').contains(document.activeElement)) renderProps();
}
function changed() { if (batching) return; render(); autosave(); }

/* ========== 台词操作 ========== */
function goto(i) { P.cur = Math.max(0, Math.min(P.lines.length - 1, i)); selUid = null; TL.sel = null; changed(); }
function continueLine() {   // 画面不变，接着写下一句
  snapshot();
  P.lines.splice(P.cur + 1, 0, mkLine(L()));
  P.cur++; selUid = null; typingSnap = false; changed();
  $('#tx').focus();
}
function moveLine(d) {
  const j = P.cur + d; if (j < 0 || j >= P.lines.length) return;
  snapshot(); [P.lines[P.cur], P.lines[j]] = [P.lines[j], P.lines[P.cur]]; P.cur = j; changed();
}
function duplicateLine() {
  snapshot(); const c = clone(L()); c.id = uid(); c.label = ''; c.chapter = '';
  P.lines.splice(P.cur + 1, 0, c); P.cur++; changed();
}
function deleteLine(i) {
  if (P.lines.length <= 1) return;
  snapshot(); P.lines.splice(i, 1);
  if (P.cur >= P.lines.length) P.cur = P.lines.length - 1;
  else if (i < P.cur) P.cur--;
  changed();
}
function batchInsert(text) {
  const rows = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!rows.length) return;
  snapshot();
  const base = L(), add = [];
  const first = !base.text && !base.speaker;   // 当前句是空的就直接填进去
  rows.forEach(r => {
    const m = r.match(/^([^：:「“"『（(【‘][^：:「“"『（(【‘]{0,15})[：:]\s*(.*)$/);
    const l = mkLine(base);
    l.speaker = m ? m[1].trim() : ''; l.text = m ? m[2] : r;
    add.push(l);
  });
  if (first) { base.speaker = add[0].speaker; base.text = add[0].text; add.shift(); }
  P.lines.splice(P.cur + 1, 0, ...add);
  P.cur += add.length; changed();
}

/* ========== 舞台缩放适配 ========== */
let scale = 1;
function fit() {
  const m = $('#main').getBoundingClientRect(), pad = playing ? 0 : 20;
  // 对齐到整像素：画面宽高、左上角都落在物理像素上。缩放出小数像素时，浏览器每帧都得重新栅格化整块画面，
  // 表现为拖完窗口大小后全局卡顿、打字变慢、按钮高光延迟
  const dpr = devicePixelRatio || 1;
  const w = Math.max(16, Math.floor(Math.min(m.width - pad * 2, (m.height - pad * 2) * W / H) * dpr / 16 + 0.01) * 16) / dpr;  // 16 的倍数 → 高也是整像素
  // fix9：导出的游戏在竖屏里，画面按宽度铺满放在上方，对话框、选项和按钮排在下方（按真实像素排版）
  const vp = gameMode && m.height > m.width * 1.15, ss = stage.style;
  document.body.classList.toggle('vport', vp);
  const wv = vp ? Math.floor(m.width * dpr) / dpr : w;                        // 竖屏铺满整宽，左右不留黑边
  scale = wv / W;
  ss.transform = `scale(${scale})`;
  ss.left = Math.round((m.width - wv) / 2 * dpr) / dpr + 'px';
  ss.setProperty('--u', (1 / scale).toFixed(4) + 'px');                      // 1 个屏幕像素 = 多少画面像素
  ss.setProperty('--ovZ', Math.max(1, .8 / scale).toFixed(3));               // 弹出层放大倍数：正文约 14px 以上
  document.body.classList.toggle('smallstage', gameMode && !vp && scale < .75);
  if (!vp) { ss.height = ''; ss.top = Math.round((m.height - H * scale) / 2 * dpr) / dpr + 'px'; return; }
  const sh = H * scale, ctlH = 104, top = Math.round(Math.min(48, Math.max(0, (m.height - sh - 480) / 3)));
  const dlgTop = top + sh + 16, dlgH = Math.round(Math.max(150, Math.min(240, (m.height - dlgTop - ctlH - 16) * .62)));
  const ctlTop = m.height - ctlH - 6;
  let chTop = dlgTop + dlgH + 10, chH = ctlTop - 8 - chTop;
  if (chH < 150) { chTop = top + 6; chH = dlgTop + dlgH - top - 12; }      // 屏幕太矮：选项盖在画面和对话框上
  ss.top = '0px'; ss.height = Math.ceil(m.height / scale) + 'px';
  const px = v => Math.round(v) + 'px';
  ss.setProperty('--vpZ', (1 / scale).toFixed(4));
  ss.setProperty('--vpTop', (top / scale).toFixed(1) + 'px');
  ss.setProperty('--vpTopPx', px(top)); ss.setProperty('--vpSceneH', px(sh));
  ss.setProperty('--vpDlgTop', px(dlgTop)); ss.setProperty('--vpDlgH', px(dlgH));
  ss.setProperty('--vpCtlOff', px(ctlTop - dlgTop - dlgH));
  ss.setProperty('--vpChTop', px(chTop)); ss.setProperty('--vpChH', px(chH));
}
function toStage(e) { const r = stage.getBoundingClientRect(); return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }; }
window.addEventListener('resize', fit);
// 立绘常比画面高（y=1190），画面里的输入框一获得焦点，浏览器会把整个画面“滚”上去；画面永远不滚
stage.addEventListener('scroll', () => { if (stage.scrollTop || stage.scrollLeft) stage.scrollTop = stage.scrollLeft = 0; });

/* ========== 立绘拖动 / 缩放 ========== */
let drag = null, pinch = null;
const touches = new Map();   // 屏幕上的手指：两根手指捏合 = 缩放选中的立绘
layer.addEventListener('pointerdown', e => {
  if (playing) return;
  if (e.pointerType === 'touch') {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2 && drag) {
      const [a, b] = [...touches.values()], s = L().sprites[drag.si];
      pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, h0: s.h, si: drag.si, idx: drag.idx };
      drag.moved = true; return;
    }
  }
  const img = e.target.closest('.spr');
  if (TL.sel) { TL.sel = null; renderTimeline(); }
  if (!img) { selUid = null; renderStage(L(), true); return; }
  selUid = img.dataset.uid;
  const si = selIndex(), s = L().sprites[si], p = toStage(e);
  snapshot();
  drag = { si, idx: affected(), dx: p.x - s.x, dy: p.y - s.y, moved: false };
  img.setPointerCapture(e.pointerId);
  layer.querySelectorAll('.spr').forEach(el => el.classList.toggle('sel', el === img));
  placeBar();
});
layer.addEventListener('pointermove', e => {
  if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch) {
    if (touches.size < 2) return;
    const [a, b] = [...touches.values()], k = Math.hypot(a.x - b.x, a.y - b.y) / pinch.d0;
    pinch.idx.forEach(i => { const s = P.lines[i].sprites[pinch.si]; if (s) s.h = Math.max(60, Math.min(2400, pinch.h0 * k)); });
    const img = layer.querySelector(`[data-uid="${selUid}"]`); if (img) placeSprite(img, L().sprites[pinch.si]);
    return placeBar();
  }
  if (!drag) return;
  const p = toStage(e);
  let x = p.x - drag.dx, y = p.y - drag.dy;
  const snapX = Math.abs(x - W / 2) < 14; if (snapX) x = W / 2;   // 居中吸附
  if (Math.abs(y - H) < 14) y = H;                                  // 底边吸附
  $('#guide').style.display = snapX ? 'block' : 'none';
  drag.idx.forEach(i => { const s = P.lines[i].sprites[drag.si]; if (s) { s.x = x; s.y = y; } });
  drag.moved = true;
  const img = layer.querySelector(`[data-uid="${selUid}"]`); if (img) placeSprite(img, L().sprites[drag.si]);
  placeBar();
});
const touchEnd = e => {
  touches.delete(e.pointerId);
  if (pinch && touches.size === 0) { pinch = null; if (drag) { drag = null; $('#guide').style.display = 'none'; changed(); } }
};
layer.addEventListener('pointercancel', e => { touchEnd(e); if (drag) { drag = null; $('#guide').style.display = 'none'; changed(); } });
layer.addEventListener('pointerup', e => {
  if (e.pointerType === 'touch') { const wasPinch = !!pinch; touchEnd(e); if (wasPinch) return; }
  if (!drag) return;
  $('#guide').style.display = 'none';
  if (!drag.moved) hist.pop();   // 只是点选，不记撤销
  drag = null; changed();
});
let wheelT = 0;
layer.addEventListener('wheel', e => {
  const img = e.target.closest('.spr'); if (!img || playing) return;
  e.preventDefault();
  selUid = img.dataset.uid;
  const si = selIndex();
  if (Date.now() - wheelT > 600) snapshot();
  wheelT = Date.now();
  const k = e.deltaY < 0 ? 1.05 : 1 / 1.05;
  // 这里不能用 edit()，否则每格滚轮都会记一次撤销
  const idx = affected();
  idx.forEach(i => { const s = P.lines[i].sprites[si]; if (s) s.h = Math.max(60, Math.min(2400, s.h * k)); });
  changed();
}, { passive: false });

function spriteOp(op) {
  const si = selIndex(); if (si < 0) return;
  if (op === 'flip') edit(l => { const s = l.sprites[si]; if (s) s.flip = !s.flip; });
  if (op === 'front') edit(l => { const [s] = l.sprites.splice(si, 1); if (s) l.sprites.push(s); });
  if (op === 'back') edit(l => { const [s] = l.sprites.splice(si, 1); if (s) l.sprites.unshift(s); });
  if (op === 'del') { edit(l => { l.sprites.splice(si, 1); }); selUid = null; changed(); }
  if (op === 'expr') toggleExpr();
  if (op === 'anim') toggleAnim();
  if (op === 'look') toggleLook();
}
/* —— 立绘外观效果（黑影、回忆……） —— */
let lookMode = 'on';   // on = 从这句起（直到角色离场），one = 只这一句
// 把角色 ck 的外观改成 v：从 from 句开始往后，直到这个角色不在画面上为止
function setLookRange(ck, v, from, one) {
  for (let i = from; i < P.lines.length; i++) {
    const t = P.lines[i].sprites.find(x => A(x.asset) && charKey(A(x.asset)) === ck); if (!t) break;
    if (v && v !== 'none') t.look = v; else delete t.look;
    if (one) break;
  }
}
function toggleLook(force) {
  const pop = $('#lookPop');
  if (pop.style.display === 'flex' && !force) { pop.style.display = 'none'; return; }
  $('#animPop').style.display = 'none'; $('#exprPop').style.display = 'none';
  const si = selIndex(); if (si < 0) return;
  const s = L().sprites[si], a = A(s.asset), ck = charKey(a);
  pop.innerHTML = `<div class="sp">范围 <button data-m="on" class="${lookMode === 'on' ? 'on' : ''}">从这句起</button><button data-m="one" class="${lookMode === 'one' ? 'on' : ''}">只这一句</button></div>`;
  LOOKS.forEach(([v, , name, css]) => {
    const d = document.createElement('div');
    const im = document.createElement('b'); im.style.backgroundImage = cssUrl(a.src); im.style.filter = css; d.appendChild(im); d.title = name;
    d.className = (s.look || '') === v ? 'on' : '';
    const lb = document.createElement('i'); lb.textContent = name; d.appendChild(lb);
    d.onclick = e => { e.stopPropagation(); snapshot(); setLookRange(ck, v, P.cur, lookMode === 'one'); changed(); toggleLook(true); };
    pop.appendChild(d);
  });
  pop.querySelectorAll('[data-m]').forEach(b => b.onclick = e => { e.stopPropagation(); lookMode = b.dataset.m; toggleLook(true); });
  pop.style.left = Math.max(210, Math.min(W - 210, s.x)) + 'px';
  pop.style.top = Math.max(60, s.y - s.h + 30) + 'px';
  pop.style.display = 'flex';
}
$('#lookPop').addEventListener('pointerdown', e => e.stopPropagation());
function toggleExpr() {
  const pop = $('#exprPop');
  if (pop.style.display === 'flex') { pop.style.display = 'none'; return; }
  const si = selIndex(); if (si < 0) return;
  const s = L().sprites[si];
  pop.innerHTML = '';
  siblings(s.asset).forEach(a => {
    const d = document.createElement('div');
    d.style.backgroundImage = cssUrl(a.src); d.className = a.id === s.asset ? 'on' : ''; d.dataset.tip = 'exprItem';
    d.onclick = e => { e.stopPropagation(); pop.style.display = 'none'; replaceSprite(si, a.id); };
    pop.appendChild(d);
  });
  pop.style.left = Math.max(320, Math.min(W - 320, s.x)) + 'px';
  pop.style.top = Math.max(60, s.y - s.h + 30) + 'px';
  pop.style.display = 'flex';
}
function toggleAnim(force) {
  const pop = $('#animPop');
  if (pop.style.display === 'flex' && !force) { pop.style.display = 'none'; return; }
  const si = selIndex(); if (si < 0) return;
  const s = L().sprites[si], ck = charKey(A(s.asset)), act = L().acts?.[ck] || '';
  const img = layer.querySelector(`[data-uid="${s.uid}"]`);
  const row = (icon, tip, list, cur, key) => `<div class="row" data-tip="${tip}"><i>${icon}</i>` + list.map(([v, icn, n]) => `<button data-k="${key}" data-v="${v}" class="${cur === v ? 'on' : ''}" title="${n}">${ic(icn)}</button>`).join('') + '</div>';
  pop.innerHTML = row('入', 'sprIn', SPR_IN, s.in || '', 'in') + row('出', 'sprOut', SPR_OUT, s.out || '', 'out') + row('动', 'sprAct', [['', 'minus', '无'], ...SPR_ACT], act, 'act');
  pop.querySelectorAll('button').forEach(b => b.onclick = e => {
    e.stopPropagation(); const k = b.dataset.k, v = b.dataset.v;
    if (k === 'act') { snapshot(); const o = Object.assign({}, L().acts); if (v) o[ck] = v; else delete o[ck]; L().acts = o; changed(); }
    else edit(l => { const t = l.sprites.find(x => x.uid === s.uid) || l.sprites[si]; if (t) { if (v) t[k] = v; else delete t[k]; } });
    const el = layer.querySelector(`[data-uid="${s.uid}"]`);   // 在编辑舞台上预览一次
    if (el && v && v !== 'none') { sprAnim(el, k + '-' + (v || 'fade')); if (k === 'out') setTimeout(() => el.classList.remove('out-' + v), 900); }
    toggleAnim(true);
  });
  pop.style.left = Math.max(140, Math.min(W - 140, s.x)) + 'px';
  pop.style.top = Math.max(60, s.y - s.h + 30) + 'px';
  pop.style.display = 'flex';
}
$('#sprBar').addEventListener('click', e => { const b = e.target.closest('[data-op]'); if (b) spriteOp(b.dataset.op); });
$('#sprBar').addEventListener('pointerdown', e => e.stopPropagation());

/* ========== 拖放：舞台 ========== */
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => e.preventDefault());
stage.addEventListener('drop', async e => {
  e.preventDefault(); if (playing) return;
  const p = toStage(e), aid = e.dataTransfer.getData('text/vn-asset');
  const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('.spr');
  const hitIndex = hit ? L().sprites.findIndex(s => s.uid === hit.dataset.uid) : -1;
  const place = id => {
    if (A(id).type !== 'ch') return useAsset(id);
    if (hitIndex >= 0) return replaceSprite(hitIndex, id);   // 拖到立绘上 = 换差分
    addSprite(id, p.x);
  };
  if (aid) return place(aid);
  const ids = await importFiles([...e.dataTransfer.files]);
  ids.forEach(place);
});
/* 拖放：侧栏分区（按分区类型导入） */
document.querySelectorAll('.sec').forEach(sec => {
  sec.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('Files')) sec.classList.add('drop'); });
  sec.addEventListener('dragleave', () => sec.classList.remove('drop'));
  sec.addEventListener('drop', e => { sec.classList.remove('drop'); if (e.dataTransfer.files.length) importFiles([...e.dataTransfer.files], sec.dataset.type); });
  sec.querySelector('.fold').onclick = () => { sec.classList.toggle('open'); sec.querySelector('.fold').innerHTML = ic(sec.classList.contains('open') ? 'chevron-down' : 'chevron-right'); };
});

/* ========== 对话框输入 ========== */
let typingSnap = false;
['#nm', '#tx'].forEach(sel => {
  const el = $(sel);
  el.addEventListener('focus', () => { typingSnap = false; });
  el.addEventListener('input', () => {
    if (!typingSnap) { snapshot(); typingSnap = true; }
    L()[sel === '#nm' ? 'speaker' : 'text'] = el.value;
    updCurCard(); renderButtons(); autosave();
    if (sel === '#nm') $('#nm').style.color = charOf(el.value)?.color || '';
  });
});
$('#nm').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); $('#tx').focus(); } });
$('#tx').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); continueLine(); }
});

/* ========== 本句设置面板 ========== */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function opts(list, cur, empty) {
  return `<option value="">${empty}</option>` + list.map(([v, t]) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(t)}</option>`).join('');
}
const segBtns = (name, list, cur) => list.map(([v, t]) => `<button data-seg="${name}" data-v="${v}" class="${(cur || '') === v ? 'on' : ''}">${t}</button>`).join('');
function renderProps() {
  const l = L(), pn = $('#props'), ag = l.agent;
  const byType = t => Object.values(P.assets).filter(a => a.type === t).map(a => [a.id, a.name]);
  const labs = labels().map(n => [n, n]);
  const chars = [...new Set([...P.chars.map(c => c.name), ...P.lines.map(x => x.speaker)].filter(Boolean))].map(n => [n, n]);
  pn.innerHTML = `
    <div class="r" data-tip="chapter"><i>${ic('book-open')}</i><input id="pChap" value="${esc(l.chapter)}"></div>
    <div class="r" data-tip="label"><i>${ic('tag')}</i><input id="pLabel" value="${esc(l.label)}"></div>
    <div class="r" data-tip="trans"><i>${ic('wand-sparkles')}</i><div class="seg">${segBtns('trans', [['fade', ic('blend')], ['cut', ic('scissors')], ['black', ic('moon')], ['flash', ic('sun')]], l.trans)}</div></div>
    <div class="r" data-tip="fx"><i>${ic('zap')}</i><select id="pFx" class="fxsel">${opts(FX.map(x => [x[0], x[2]]), l.fx, '—')}</select><button class="play" id="pFxPlay" data-tip="fxPlay">${ic('play')}</button></div>
    <div class="r" data-tip="mood"><i>${ic('cloud-fog')}</i><select id="pMood" class="fxsel">${opts(MOODS.map(x => [x[0], x[2]]), l.mood, '—')}</select></div>
    <div class="r" data-tip="wait"><i>${ic('timer')}</i><input id="pWait" type="number" min="0" max="30" step="0.5" value="${l.wait || ''}" placeholder="${isPause(l) ? '2' : '—'}"></div>
    <div class="r" data-tip="bgm"><i>${ic('music')}</i><select id="pBgm">${opts(byType('bgm'), l.bgm, '—')}</select></div>
    ${[['amb', 'ambv', 'pAmb'], ['amb2', 'amb2v', 'pAmb2']].map(([f, fv, id]) => `<div class="r" data-tip="amb"><i>${ic('waves')}</i><select id="${id}">${opts([...byType('se'), ...byType('bgm')], l[f], '—')}</select><input id="${id}V" type="number" min="0" max="1" step="0.1" value="${l[fv] ?? 0.6}" style="flex:0 0 56px"></div>`).join('')}
    <div class="r" data-tip="se"><i>${ic('bell')}</i><select id="pSe">${opts(byType('se'), l.se, '—')}</select></div>
    <div class="r" data-tip="voice"><i>${ic('mic')}</i><select id="pVo">${opts(byType('vo'), l.voice, '—')}</select></div>
    <div class="r" data-tip="setv"><i>${ic('variable')}</i><input id="pSet" value="${esc(l.set)}"></div>
    <hr>
    ${l.choices.map((c, k) => `
    <div class="r" data-tip="choice"><i>${ic('split')}</i><input data-c="text" data-k="${k}" value="${esc(c.text)}"><select data-c="target" data-k="${k}">${opts(labs, c.target, '→')}</select><button class="mini" data-cx="${k}">${ic('x')}</button></div>
    <div class="r sub" data-tip="choiceIf"><i></i><input data-c="cond" data-k="${k}" value="${esc(c.cond)}" placeholder="条件"><input data-c="set" data-k="${k}" value="${esc(c.set)}" placeholder="效果"></div>`).join('')}
    <div class="r" data-tip="choice"><i>${ic('split')}</i><button class="mini" id="pAddC">${ic('plus')}</button></div>
    ${l.choices.length ? `<div class="r" data-tip="ctime"><i>${ic('hourglass')}</i><input id="pCtime" type="number" min="0" max="120" step="1" value="${l.ctime || ''}" placeholder="不限时" style="width:70px;flex:none"><select id="pCdef">${opts(l.choices.filter(c => c.target).map(c => [c.target, c.text || c.target]), l.cdef, '最后一项')}</select></div>` : ''}
    <div class="r" data-tip="jump"><i>${ic('corner-down-right')}</i><select id="pJump">${opts(labs, l.jump, '—')}</select><input id="pJumpIf" value="${esc(l.jumpIf)}" placeholder="条件"></div>
    <div class="r" data-tip="ending"><i>${ic('flag')}</i><input id="pEnd" value="${esc(l.ending)}" placeholder="结局名"></div>
    <hr>
    <div class="r" data-tip="agent"><i>${ic('bot')}</i><button class="mini" id="pAgent">${ic(ag ? 'square' : 'plus')}</button></div>
    ${ag ? `
    <div class="r" data-tip="agentChar"><i>${ic('user')}</i><select id="pAgChar">${opts(chars, ag.char, '—')}</select><input id="pAgTurns" type="number" min="1" max="50" value="${ag.turns}" style="flex:0 0 56px"></div>
    <div class="r" data-tip="agentGoal"><i>${ic('target')}</i><input id="pAgGoal" value="${esc(ag.goal)}"></div>
    <div class="r" data-tip="agentExit"><i>${ic('door-open')}</i><select id="pAgExit">${opts(labs, ag.exit, '→')}</select></div>` : ''}`;
  let snapped = false;
  const once = () => { if (!snapped) { snapshot(); snapped = true; } };
  const text = (q, fn) => {
    const el = pn.querySelector(q); if (!el) return;
    el.oninput = () => { once(); fn(el.value); renderTimeline(); renderChoicesEdit(); autosave(); };
    el.addEventListener('change', () => { snapped = false; renderButtons(); });
  };
  const pick = (q, fn) => { const el = pn.querySelector(q); if (el) el.onchange = () => { fn(el.value); renderProps(); }; };
  text('#pChap', v => { L().chapter = v.trim(); });
  text('#pLabel', v => { L().label = v.trim(); });
  pn.querySelector('#pLabel').addEventListener('change', () => renderProps());
  text('#pSet', v => { L().set = v; });
  text('#pJumpIf', v => { L().jumpIf = v; });
  text('#pEnd', v => { L().ending = v.trim(); });
  text('#pAgGoal', v => { L().agent.goal = v; });
  text('#pAgTurns', v => { L().agent.turns = Math.max(1, Math.min(50, Math.round(+v) || 1)); });
  pick('#pBgm', v => setBgm(v || null));
  pick('#pAmb', v => setAmb('amb', v || null)); pick('#pAmb2', v => setAmb('amb2', v || null));
  pick('#pAmbV', v => setAmb('amb', L().amb, Math.max(0, Math.min(1, +v || 0)))); pick('#pAmb2V', v => setAmb('amb2', L().amb2, Math.max(0, Math.min(1, +v || 0))));
  pick('#pSe', v => { snapshot(); L().se = v || null; changed(); });
  pick('#pJump', v => { snapshot(); L().jump = v; changed(); });
  pick('#pAgChar', v => { snapshot(); L().agent.char = v; changed(); });
  pick('#pAgExit', v => { snapshot(); L().agent.exit = v; changed(); });
  $('#pFx').onchange = e => { snapshot(); L().fx = e.target.value; changed(); playFx(L().fx); };
  $('#pFxPlay').onclick = () => playFx(L().fx);
  $('#pVo').onchange = e => { snapshot(); L().voice = e.target.value || null; changed(); };
  // 氛围：联动开启时，作用于“同一段画面”的所有节（之后可在时间轴上拖长/缩短）
  $('#pMood').onchange = e => { const v = e.target.value; edit(x => { x.mood = v; }); };
  $('#pWait').onchange = e => { snapshot(); L().wait = Math.max(0, Math.min(30, +e.target.value || 0)); changed(); };
  pn.querySelectorAll('[data-seg]').forEach(b => b.onclick = () => { snapshot(); L()[b.dataset.seg] = b.dataset.v; changed(); renderProps(); });
  pn.querySelectorAll('[data-c]').forEach(el => {
    const k = +el.dataset.k, fld = el.dataset.c;
    if (el.tagName === 'SELECT') el.onchange = () => { snapshot(); L().choices[k][fld] = el.value; changed(); };
    else { el.oninput = () => { once(); L().choices[k][fld] = el.value; renderChoicesEdit(); renderTimeline(); autosave(); }; el.addEventListener('change', () => { snapped = false; }); }
  });
  pn.querySelector('#pCtime')?.addEventListener('change', e => { snapshot(); L().ctime = Math.max(0, Math.min(120, +e.target.value || 0)); changed(); });
  pn.querySelector('#pCdef')?.addEventListener('change', e => { snapshot(); L().cdef = e.target.value; changed(); });
  pn.querySelector('#pAddC').onclick = () => {
    snapshot(); L().choices.push({ text: '', target: '', cond: '', set: '' }); changed(); renderProps();
    pn.querySelector(`[data-c="text"][data-k="${L().choices.length - 1}"]`)?.focus();
  };
  pn.querySelectorAll('[data-cx]').forEach(b => b.onclick = () => { snapshot(); L().choices.splice(+b.dataset.cx, 1); changed(); renderProps(); });
  pn.querySelector('#pAgent').onclick = () => {
    snapshot(); L().agent = L().agent ? null : { char: L().speaker || '', goal: '', turns: 6, exit: '' }; changed(); renderProps();
  };
}
function toggleProps() { $('#props').classList.toggle('open'); if ($('#props').classList.contains('open')) renderProps(); renderButtons(); }

/* ========== 播放用音频 ========== */
// Continuous music and ambience have separate volume controls; action effects are one-shots.
let bgmEl = null, bgmId = null;
const bgmRetiring = new Set(), ambientTracks = new Map(), activeEffects = new Set();
let audioLibraryOpen = false, auditionEl = null, auditionAsset = null, auditionState = null;
let audioFocusPaused = false;
const volume01 = v => Math.max(0, Math.min(1, Number.isFinite(+v) ? +v : 0));
const trackGain = a => volume01(a?.playbackGain ?? 1);
// 氛围压低：水下 = 声音发闷（配乐/环境音降低），慢动作 = 环境声几乎静音
const MOOD_DUCK = { underwater: { mus: .35, amb: .45 }, slowmo: { mus: .5, amb: .15 } };
const moodDuck = () => (playing && MOOD_DUCK[stage?.dataset?.mood]) || { mus: 1, amb: 1 };
let duckKey = '';
const musicVolume = () => volume01(pref('vbgm')) * trackGain(A(bgmId)) * moodDuck().mus;
const ambienceVolume = () => volume01(pref('vamb') ?? .3) * (bgmId ? .75 : 1) * moodDuck().amb;
const effectVolume = () => volume01(pref('vse'));

function fadeVol(el, to, ms, done) {
  cancelAnimationFrame(el._fadeFrame);
  to = volume01(to);
  if (!ms || ms <= 0) { el.volume = to; done?.(); return; }
  const from = el.volume, t0 = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t0) / ms);
    el.volume = volume01(from + (to - from) * k);
    if (k < 1) el._fadeFrame = requestAnimationFrame(step);
    else { el._fadeFrame = 0; done?.(); }
  };
  el._fadeFrame = requestAnimationFrame(step);
}
function seekAudio(el, seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return;
  const seek = () => { if (Number.isFinite(el.duration) && el.duration > 0) el.currentTime = seconds % el.duration; };
  if (el.readyState >= 1) seek();
  else el.addEventListener('loadedmetadata', seek, { once: true });
}
function tryPlayAudio(el) {
  if (!el || audioFocusPaused || document.hidden) return;
  el.play()?.catch?.(() => {});
}
function playBgm(id, fadeOutMs = 600, restoreTime) {
  if (id && !A(id)) id = null;
  if (id === bgmId) {
    if (bgmEl && restoreTime != null) seekAudio(bgmEl, restoreTime);
    if (!id && fadeOutMs === 0) {
      for (const el of bgmRetiring) { fadeVol(el, 0, 0); el.pause(); }
      bgmRetiring.clear();
    }
    return;
  }
  if (bgmEl) {
    const old = bgmEl;
    bgmRetiring.add(old);
    fadeVol(old, 0, fadeOutMs, () => { old.pause(); bgmRetiring.delete(old); });
  }
  bgmId = id; bgmEl = null;
  if (!id) return;
  const el = new Audio(A(id).src);
  el._assetId = id; el.loop = true; el.preload = 'auto'; el.volume = 0;
  bgmEl = el;
  if (restoreTime != null) seekAudio(el, restoreTime);
  tryPlayAudio(el);
  fadeVol(el, musicVolume(), 800);
}
function playAmbience(specs, restore = [], fadeMs = 900) {
  const next = new Map((specs || []).filter(s => A(s.id)).map(s => [s.id, s]));
  for (const [id, track] of ambientTracks) {
    if (!next.has(id)) {
      ambientTracks.delete(id);
      const old = track.el;
      bgmRetiring.add(old);
      fadeVol(old, 0, fadeMs, () => { old.pause(); bgmRetiring.delete(old); });
    }
  }
  for (const [id, spec] of next) {
    let track = ambientTracks.get(id);
    const restored = restore.find(s => s.id === id);
    const gain = volume01(spec.gain ?? 1), target = ambienceVolume() * gain;
    if (track) {
      if (restored) seekAudio(track.el, restored.time);
      if (track.gain !== gain || Math.abs(track.target - target) > .001) fadeVol(track.el, target, 350);
      track.gain = gain; track.target = target;
      continue;
    }
    const el = new Audio(A(id).src);
    el._assetId = id; el.loop = true; el.preload = 'auto'; el.volume = 0;
    track = { id, el, gain, target };
    ambientTracks.set(id, track);
    if (restored) seekAudio(el, restored.time);
    tryPlayAudio(el); fadeVol(el, target, fadeMs);
  }
}
function stopEffects() {
  cancelScheduledEffects();
  for (const el of activeEffects) { el.pause(); el.removeAttribute('src'); el.load(); }
  activeEffects.clear();
}
const scheduledEffects = new Set();
function cancelScheduledEffects() {
  for (const timer of scheduledEffects) clearTimeout(timer);
  scheduledEffects.clear();
}
function scheduleSe(event) {
  const delay = Math.max(0, Math.min(10000, Number(event.delayMs) || 0));
  if (!delay) { playSe(event.id, event.gain ?? 1); return; }
  const timer = setTimeout(() => {
    scheduledEffects.delete(timer);
    if (!RT.skip && playing) playSe(event.id, event.gain ?? 1);
  }, delay);
  scheduledEffects.add(timer);
}
function playSe(id, gain = 1) {
  if (!id || !A(id) || effectVolume() <= 0 || audioFocusPaused || audioLibraryOpen) return;
  if ([...activeEffects].some(el => el._assetId === id && el.currentTime < .4 && !el.paused)) return;
  while (activeEffects.size >= 4) {
    const old = activeEffects.values().next().value;
    old.pause(); activeEffects.delete(old);
  }
  const el = new Audio(A(id).src);
  el._assetId = id; el._gain = gain; el.volume = volume01(effectVolume() * gain);
  activeEffects.add(el);
  el.addEventListener('ended', () => activeEffects.delete(el), { once: true });
  el.addEventListener('error', () => activeEffects.delete(el), { once: true });
  tryPlayAudio(el);
}
function captureAudioState() {
  return { bgm: bgmEl && bgmId ? { id: bgmId, time: bgmEl.currentTime } : null,
    ambience: [...ambientTracks].map(([id, t]) => ({ id, time: t.el.currentTime })) };
}
function applyLineAudio(line, restore, suppressSe = false) {
  cancelScheduledEffects();
  playBgm(line.bgm, line._musicFadeOutMs ?? 600, restore?.bgm?.id === line.bgm ? restore.bgm.time : undefined);
  { const k = playing ? (stage.dataset.mood || '') : ''; if (k !== duckKey) { duckKey = k; if (bgmEl) fadeVol(bgmEl, musicVolume(), 300); } }
  playAmbience(line.ambience || [], restore?.ambience || [], restore ? 250 : 900);
  if (RT.skip) stopEffects();
  else if (!suppressSe) {
    if (line.se) playSe(line.se, line._seGain ?? 1);
    for (const event of line.seEvents || []) scheduleSe(event);
  }
}
function stopAllAudio() {
  playBgm(null, 0);
  playAmbience([], [], 0);
  stopEffects();
  if (voEl) { voEl.pause(); voEl = null; }
  if (auditionEl) { auditionEl.pause(); auditionEl = null; auditionAsset = null; }
}
function refreshAudioVolumes(key) {
  if (bgmEl && key === 'vbgm') fadeVol(bgmEl, musicVolume(), 0);
  if (key === 'vamb') for (const t of ambientTracks.values()) { t.target = ambienceVolume() * t.gain; fadeVol(t.el, t.target, 0); }
  if (key === 'vse') for (const el of activeEffects) el.volume = volume01(effectVolume() * el._gain);
  if (auditionEl && auditionAsset) auditionEl.volume = volume01(pref(auditionAsset.audioCategory === 'music' ? 'vbgm' : auditionAsset.audioCategory === 'ambience' ? 'vamb' : 'vse')) * (auditionAsset.audioCategory === 'music' ? trackGain(auditionAsset) : 1);
}
function resumeGameAudio() {
  if (audioFocusPaused || audioLibraryOpen || !playing || $('#title')?.classList.contains('show')) return;
  if (bgmEl && musicVolume() > 0 && bgmEl.paused) tryPlayAudio(bgmEl);
  for (const t of ambientTracks.values()) if (ambienceVolume() > 0 && t.el.paused) tryPlayAudio(t.el);
}
document.addEventListener('pointerdown', resumeGameAudio, { capture: true });
document.addEventListener('keydown', resumeGameAudio, { capture: true });
document.addEventListener('visibilitychange', () => {
  audioFocusPaused = document.hidden;
  if (audioFocusPaused) {
    if (bgmEl) bgmEl.pause();
    for (const t of ambientTracks.values()) t.el.pause();
    for (const el of bgmRetiring) { cancelAnimationFrame(el._fadeFrame); el.pause(); }
    bgmRetiring.clear(); stopEffects();
    if (auditionEl) auditionEl.pause();
    if (voEl) voEl.pause();
    RT.skip = false; updPctl(); clearTimeout(RT.timer); RT.timer = null;
  } else {
    if (bgmEl) fadeVol(bgmEl, musicVolume(), 0);
    for (const t of ambientTracks.values()) fadeVol(t.el, ambienceVolume() * t.gain, 0);
    if (audioLibraryOpen && auditionEl) tryPlayAudio(auditionEl);
    else { resumeGameAudio(); kick(); }
  }
});

function showAudioLibrary() {
  if (audioLibraryOpen) return;
  clearTimeout(RT.timer); RT.timer = null;
  auditionState = captureAudioState(); audioLibraryOpen = true;
  if (bgmEl) bgmEl.pause();
  for (const t of ambientTracks.values()) t.el.pause();
  for (const el of bgmRetiring) { cancelAnimationFrame(el._fadeFrame); el.pause(); }
  bgmRetiring.clear(); stopEffects();
  const box = $('#paudio'), assets = Object.values(P.assets).filter(a => a.audioCategory);
  const categories = [['music', '配乐'], ['ambience', '环境'], ['effect', '音效']];
  const displayName = a => a.name.replace(/^作者原声[ ·]+/, '').replace(/^(环境|剧情|UI)_/, '').replace(/_/g, ' ');
  const card = a => '<button type="button" data-audio="' + esc(a.id) + '" aria-pressed="false"><span class="track-icon">' + ic(a.audioCategory === 'music' ? 'music' : a.audioCategory === 'ambience' ? 'waves' : 'bell') + '</span><b>' + esc(displayName(a)) + '</b><small>' + (a.dur < 10 ? a.dur.toFixed(1) : Math.round(a.dur)) + ' 秒</small></button>';
  box.innerHTML = '<header class="panel-heading"><small>海风与布丁</small><h2>声音收藏</h2><p>重听一段旋律，或留在熟悉的海风里。</p></header><nav class="audio-tabs" aria-label="声音分类">' + categories.map(([kind, title], i) => '<button type="button" data-kind="' + kind + '" aria-pressed="' + (i === 0) + '">' + title + '</button>').join('') + '</nav><div class="audio-player"><p id="audioNow" role="status" aria-live="polite">选择一段声音开始试听</p><button type="button" id="audioStop" disabled>停止</button></div>' + categories.map(([kind]) => '<section data-audio-panel="' + kind + '"' + (kind === 'music' ? '' : ' hidden') + '><div class="audio-grid">' + assets.filter(a => a.audioCategory === kind && !a.auditionOnly).map(card).join('') + '</div></section>').join('') + '<details class="audio-archive"><summary>素材归档 · 候选试听</summary><p>以下原件暂未用于剧情，可供制作时比较。</p><div class="audio-grid">' + assets.filter(a => a.auditionOnly).map(card).join('') + '</div></details>';
  box.querySelectorAll('[data-kind]').forEach(button => button.onclick = e => {
    e.stopPropagation();
    box.querySelectorAll('[data-kind]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    box.querySelectorAll('[data-audio-panel]').forEach(panel => panel.hidden = panel.dataset.audioPanel !== button.dataset.kind);
  });
  box.querySelectorAll('[data-audio]').forEach(button => button.onclick = e => {
    e.stopPropagation();
    if (auditionEl) auditionEl.pause();
    auditionAsset = A(button.dataset.audio); const selected = auditionAsset, el = new Audio(selected.src); auditionEl = el;
    el.loop = selected.audioCategory !== 'effect'; refreshAudioVolumes();
    const status = box.querySelector('#audioNow'); status.textContent = '正在加载：' + displayName(selected);
    const mark = active => box.querySelectorAll('[data-audio]').forEach(b => { b.classList.toggle('active', active && b === button); b.setAttribute('aria-pressed', String(active && b === button)); });
    mark(true); box.querySelector('#audioStop').disabled = false;
    el.addEventListener('playing', () => { if (auditionEl === el) status.textContent = '正在播放：' + displayName(selected); });
    el.addEventListener('ended', () => { if (auditionEl === el) { status.textContent = '播放完毕：' + displayName(selected); mark(false); box.querySelector('#audioStop').disabled = true; } });
    el.addEventListener('error', () => { if (auditionEl === el) { status.textContent = '这段声音暂时无法播放，请换一段试试。'; mark(false); box.querySelector('#audioStop').disabled = true; } });
    el.play().catch(() => { if (auditionEl === el) status.textContent = '尚未开始播放，请再次点击曲目。'; });
  });
  box.querySelector('#audioStop').onclick = e => {
    e.stopPropagation(); if (auditionEl) auditionEl.pause();
    box.querySelector('#audioNow').textContent = '已停止'; box.querySelector('#audioStop').disabled = true;
    box.querySelectorAll('[data-audio]').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
  };
  addClose(box, closeAudioLibrary); box.classList.add('show');
  box.onclick = e => { e.stopPropagation(); if (e.target === box) { box.classList.remove('show'); closeAudioLibrary(); } };
}

function closeAudioLibrary() {
  if (!audioLibraryOpen) return;
  audioLibraryOpen = false;
  if (auditionEl) { auditionEl.pause(); auditionEl = null; auditionAsset = null; }
  if (!$('#title').classList.contains('show') && playing) {
    applyLineAudio(P.lines[RT.idx], auditionState, true);
    resumeGameAudio(); kick();
  }
  auditionState = null;
}

function showChapterReview() {
  const box = document.getElementById('pchapters');
  const chapters = P.lines.flatMap((line, index) => line.chapter ? [{title:line.chapter, index}] : []);
  box.innerHTML = '<header class="panel-heading"><small>故事的起点</small><h2>章节试阅</h2><p>从该话开头试阅，关系数值从初始状态开始；已有存档保留。</p></header><div class="chapter-grid">' + chapters.map(c => '<button class="chapter-entry" data-chapter="' + c.index + '">' + esc(c.title) + '</button>').join('') + '</div>';
  box.querySelectorAll('[data-chapter]').forEach(button => button.onclick = event => { event.stopPropagation(); startPlay(Number(button.dataset.chapter)); });
  addClose(box); box.classList.add('show');
  box.onclick = event => { event.stopPropagation(); if (event.target === box) box.classList.remove('show'); };
}

// 配音：新的一节开始就停掉上一句
let voEl = null;
// The optional range follows a stable chapter-start ID, including chapter jumps and loads.
function voiceOptionalAt(index) {
  const startId = P.settings.voiceOptionalFromChapterId;
  if (!startId || !Number.isInteger(index)) return false;
  const start = P.lines.findIndex(line => line.id === startId);
  return start >= 0 && index >= start;
}
function voiceEnabledAt(index) {
  return voiceOptionalAt(index) ? pref('voiceLaterChapters') === true : pref('voiceEnabled') !== false;
}
function setVoiceEnabled(enabled) {
  setPref(voiceOptionalAt(RT.idx) ? 'voiceLaterChapters' : 'voiceEnabled', enabled);
}
function playVoice(id, lineIndex) {
  if (voEl) { voEl.pause(); voEl = null; }
  // An explicit backlog listen remains available; automatic line playback passes its index.
  if (Number.isInteger(lineIndex) && !voiceEnabledAt(lineIndex)) return;
  if (!id || !A(id)) return;
  voEl = new Audio(A(id).src); voEl.volume = pref('vvo'); voEl.play()?.catch?.(() => {});
}
/* —— 界面音效（v0.19）：P.settings.uiSe = { 键: 素材id, favorVar, tailVar }，剧本 @uise 设置；音量跟“音效” ——
   choiceShow 选项出现 / choiceConfirm 点选项 / timeoutTick 限时倒计时（循环）/ timeoutSilence 超时 / favorUp favorDown 好感变化 /
   tailfin 尾鳍信号增加 / cg 出现 CG / save 存档 / chapterEnd 话末（下一句是新章节或本句是结局的那句）/ endingNew 第一次达成某结局 */
const UI_SE_KEYS = ['choiceShow', 'choiceConfirm', 'timeoutTick', 'timeoutSilence', 'favorUp', 'favorDown', 'tailfin', 'cg', 'save', 'chapterEnd', 'endingNew', 'btnClick', 'btnHover'];
const uiSe = k => { const u = P.settings.uiSe; return u && u[k] && A(u[k]) ? u[k] : null; };
// fix9：界面音效相对增益（再乘“音效”音量 vse）。btnClick 借用“选项确认”×0.35，btnHover 借用“选项出现”×0.22，“好感下降”×0.75
const UI_SE_GAIN = { btnClick: .35, btnHover: .22, favorDown: .75 };
function playUi(k) { if (!RT.skip) playSe(uiSe(k), UI_SE_GAIN[k] ?? 1); }
// 按钮音：只在游戏界面（舞台里的按钮）；选项、存档格、快进中不响；悬停只认鼠标
const btnSeOn = () => pref('btnSe') !== false;
const BTN_SE_SKIP = '#choices button,#slots .slot';
stage.addEventListener('click', e => {
  if (!playing || !btnSeOn() || !uiSe('btnClick')) return;
  const b = e.target.closest('button'); if (!b || b.disabled || b.closest(BTN_SE_SKIP) || audioLibraryOpen) return;
  playUi('btnClick');
}, true);
let btnSeHover = null;
stage.addEventListener('pointerover', e => {
  if (e.pointerType !== 'mouse' || !playing || !btnSeOn() || !uiSe('btnHover')) return;
  const b = e.target.closest('button'); if (b === btnSeHover) return; btnSeHover = b;
  if (!b || b.disabled || b.closest(BTN_SE_SKIP) || audioLibraryOpen) return;
  playUi('btnHover');
});
let tickEl = null;
function startTick() { stopTick(); const id = uiSe('timeoutTick'); if (!id) return; tickEl = new Audio(A(id).src); tickEl.loop = true; tickEl.volume = pref('vse'); tickEl.play()?.catch?.(() => {}); }
function stopTick() { if (tickEl) { tickEl.pause(); tickEl = null; } }
// 变量变化 → 好感 / 尾鳍音效（读档、开局初始化不算）
function uiVarSe(before, after) {
  const u = P.settings.uiSe; if (!u) return;
  const d = k => (+after[k] || 0) - (+before[k] || 0), fv = u.favorVar || '好感', tv = u.tailVar || '尾鳍';
  if (d(fv) > 0) playUi('favorUp'); else if (d(fv) < 0) playUi('favorDown');
  if (d(tv) > 0) playUi('tailfin');
}

function stopAmb(){playAmbience([]);}
/* —— 玩家偏好：导出的游戏里存在玩家自己的浏览器；编辑器预览时直接改作者默认值 —— */
let PREF = {};
const pref = k => (gameMode && PREF[k] != null) ? PREF[k] : P.settings[k];
function loadPrefs() { if (!gameMode) return; try { PREF = JSON.parse(localStorage.getItem('vnprefs:' + P.id) || '{}'); } catch (e) { PREF = {}; } }
function setPref(k, v) {
  if (gameMode) { PREF[k] = v; try { localStorage.setItem('vnprefs:' + P.id, JSON.stringify(PREF)); } catch (e) {} }
  else { P.settings[k] = v; autosave(); }
  refreshAudioVolumes(k);
  if (k === 'readerScale') applyTheme();
  if (k === 'ghost') { v = Math.max(.35, Math.min(.95, +v || .35)); if (gameMode) PREF[k] = v; else P.settings[k] = v; document.documentElement.style.setProperty('--ghost', v); }
  if (k === 'vvo' && voEl) voEl.volume = v;
  if (playing && ((k === 'voiceLaterChapters' && voiceOptionalAt(RT.idx)) || (k === 'voiceEnabled' && !voiceOptionalAt(RT.idx)))) playVoice(RT.skip ? null : P.lines[RT.idx]?.voice, RT.idx);
}
/* —— 已读记录：所有存档共用，用来“只快进已读” —— */
let READ = new Set(), readT = null;
let readPid = null;
function loadRead() { if (readPid === P.id) return; readPid = P.id; try { READ = new Set(JSON.parse(localStorage.getItem('vnread:' + P.id) || '[]')); } catch (e) { READ = new Set(); } }
function saveRead() { clearTimeout(readT); readT = setTimeout(() => { try { localStorage.setItem('vnread:' + P.id, JSON.stringify([...READ])); } catch (e) {} }, 800); }

/* ========== UI 主题（对话框 / 名字牌 / 选项 / 标题按钮）==========
   P.settings.theme = { preset, box, alpha, text, name, accent, font, size, radius, layout, img }
   原理：画面上所有游戏界面都读 CSS 变量（--dBg 等），换皮 = 改这几个变量 */
const FONTS = { sans: ['黑体', '"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif'], serif: ['宋体', '"Songti SC","SimSun","Noto Serif SC",serif'],
  kai: ['楷体', '"Kaiti SC","KaiTi","STKaiti",serif'], round: ['圆体', '"Yuanti SC","YouYuan","Microsoft YaHei",sans-serif'] };
const THEMES = {
  default: { n: '默认', box: '#0c0f1a', alpha: 0.86, text: '#ffffff', name: '#2b3655', accent: '#7aa2ff', font: 'sans', size: 26, radius: 14, layout: 'float' },
  wafu:    { n: '和风', box: '#2a1b12', alpha: 0.88, text: '#f5ead6', name: '#8c2f23', accent: '#d8a24a', font: 'serif', size: 26, radius: 4, layout: 'float' },
  pastel:  { n: '少女', box: '#fffafc', alpha: 0.86, text: '#5a3a4a', name: '#ff8fb1', accent: '#ff8fb1', font: 'round', size: 26, radius: 26, layout: 'float' },
  scifi:   { n: '科幻', box: '#021018', alpha: 0.78, text: '#bff8ff', name: '#00a3b4', accent: '#36f1ff', font: 'sans', size: 25, radius: 0, layout: 'float' },
  retro:   { n: '复古', box: '#f3e6c4', alpha: 0.95, text: '#3b2a1a', name: '#6b4a2b', accent: '#b5651d', font: 'serif', size: 26, radius: 2, layout: 'float' },
  minimal: { n: '极简', box: '#000000', alpha: 0.5, text: '#ffffff', name: '#000000', accent: '#ffffff', font: 'sans', size: 26, radius: 0, layout: 'wide' }
};
const THEME_KEYS = ['box', 'alpha', 'text', 'name', 'accent', 'font', 'size', 'radius', 'layout', 'img'];
const theme = () => Object.assign({}, THEMES.default, THEMES[P.settings.theme?.preset] || {}, P.settings.theme || {});
const hexA = (h, a) => { h = /^#[0-9a-f]{6}$/i.test(h) ? h : '#000000'; return h + Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0'); };
const isLight = h => { const m = /^#(..)(..)(..)$/.exec(h || ''); if (!m) return false; const [r, g, b] = m.slice(1).map(x => parseInt(x, 16)); return r * .299 + g * .587 + b * .114 > 150; };
function applyTheme() {
  const t = theme(), st = stage.style, preset = P.settings.theme?.preset || 'default';
  const img = t.img && A(t.img) ? A(t.img).src : '';
  const top = hexA(t.box, t.alpha * 0.9), bot = hexA(t.box, Math.min(1, t.alpha * 1.08));
  const v = {
    '--dBg': img ? `url("${img}") center/100% 100%` : t.layout === 'wide' ? `linear-gradient(${hexA(t.box, 0)},${hexA(t.box, t.alpha)} 40%)` : `linear-gradient(${top},${bot})`,
    '--dBorder': img || t.layout === 'wide' ? '0' : preset === 'scifi' ? `1px solid ${t.accent}` : preset === 'wafu' ? `2px solid ${hexA(t.accent, .7)}` : `1px solid ${isLight(t.box) ? '#00000022' : '#ffffff22'}`,
    '--dShadow': preset === 'scifi' ? `0 0 14px ${hexA(t.accent, .45)}` : preset === 'pastel' ? '0 4px 18px #ff8fb144' : 'none',
    '--dRad': t.radius + 'px', '--dSide': t.layout === 'wide' ? '0px' : '60px', '--dBot': t.layout === 'wide' ? '0px' : '28px', '--dH': t.layout === 'wide' ? '220px' : '190px',
    '--nBg': t.layout === 'wide' ? 'transparent' : t.name, '--nFg': t.layout === 'wide' ? t.accent : (isLight(t.name) ? '#222' : '#fff'),
    '--nRad': Math.min(t.radius, 20) + 'px', '--nBorder': t.layout === 'wide' ? '0' : `1px solid ${isLight(t.name) ? '#00000022' : '#ffffff30'}`,
    '--tFg': t.text, '--tSize': (t.size * Math.max(1, Math.min(1.25, +(pref('readerScale') ?? 1)))) + 'px', '--font': (FONTS[t.font] || FONTS.sans)[1],
    '--cBg': hexA(t.box, Math.max(.75, t.alpha)), '--cHover': t.name === '#000000' ? hexA(t.accent, .35) : t.name,
    '--cBorder': preset === 'scifi' ? `1px solid ${t.accent}` : `1px solid ${isLight(t.box) ? '#00000030' : '#ffffff40'}`, '--cRad': Math.min(t.radius, 30) + 'px', '--acc': t.accent
  };
  Object.entries(v).forEach(([k, x]) => st.setProperty(k, x));
  stage.dataset.theme = preset;
}
function openTheme() {
  const before = clone(P.settings.theme || {}), cBefore = P.settings.cover ? clone(P.settings.cover) : null;
  const box = modal('<div id="themeBox"></div>', () => { if (JSON.stringify(before) !== JSON.stringify(P.settings.theme || {}) || JSON.stringify(cBefore) !== JSON.stringify(P.settings.cover || null)) { const now = P.settings.theme; const nowC = P.settings.cover; P.settings.theme = before; P.settings.cover = cBefore || undefined; snapshot(); P.settings.theme = now; P.settings.cover = nowC; changed(); } });
  box.querySelector('[data-a=c]').addEventListener('click', () => { P.settings.theme = before; if (cBefore) P.settings.cover = cBefore; else delete P.settings.cover; applyTheme(); });
  const tb = box.querySelector('#themeBox');
  const imgs = Object.values(P.assets).filter(a => a.type === 'bg' || a.type === 'ch');
  const draw = () => {
    const t = theme(), cur = P.settings.theme?.preset || 'default', cv = P.settings.cover || {};
    const sl = (k, label, min, max, step) => `<div class="row"><span>${label}</span><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${t[k]}"><em style="width:34px;color:var(--dim);font-style:normal">${t[k]}</em></div>`;
    const col = (k, label) => `<label style="display:flex;gap:4px;align-items:center;color:var(--dim)">${label}<input type="color" data-k="${k}" value="${t[k]}"></label>`;
    tb.innerHTML = `<div class="pre">${Object.entries(THEMES).map(([id, p]) => `<div data-p="${id}" class="${cur === id ? 'on' : ''}" style="background-color:${p.box === '#000000' ? '#333' : '#556'}"><b>${p.n}</b><i style="background:${hexA(p.box, p.alpha)};color:${p.text};border-radius:${Math.min(p.radius, 11)}px;font-family:${FONTS[p.font][1]}${p.layout === 'wide' ? ';left:0;right:0;bottom:0' : ''}">你好。</i></div>`).join('')}</div>
      <div class="row"><span>颜色</span>${col('box', '底')}${col('text', '字')}${col('name', '名字牌')}${col('accent', '强调')}</div>
      ${sl('alpha', '不透明', 0, 1, 0.05)}${sl('size', '字号', 18, 36, 1)}${sl('radius', '圆角', 0, 30, 1)}
      <div class="row"><span>字体</span><div class="seg">${Object.entries(FONTS).map(([k, f]) => `<button data-font="${k}" class="${t.font === k ? 'on' : ''}" style="font-family:${f[1]}">${f[0]}</button>`).join('')}</div></div>
      <div class="row"><span>样式</span><div class="seg"><button data-lay="float" class="${t.layout !== 'wide' ? 'on' : ''}">浮动框</button><button data-lay="wide" class="${t.layout === 'wide' ? 'on' : ''}">通栏</button></div></div>
      <div class="row"><span>框图片</span><select data-img>${['<option value="">（不用图片）</option>', ...imgs.map(a => `<option value="${a.id}" ${t.img === a.id ? 'selected' : ''}>${esc(a.name)}</option>`)].join('')}</select></div>
      <div class="row"><span>开始界面</span><select data-cover>${['<option value="">（用第一节背景）</option>', ...imgs.filter(a => a.type === 'bg').map(a => `<option value="${a.id}" ${cv.img === a.id ? 'selected' : ''}>${esc(a.name)}</option>`)].join('')}</select></div>
      ${cv.img ? `<div class="row"><span>菜单</span><div class="seg">${[['left', '左'], ['center', '中'], ['right', '右']].map(([k, n]) => `<button data-cm="${k}" class="${(cv.menu || 'center') === k ? 'on' : ''}">${n}</button>`).join('')}</div><span>标题</span><div class="seg">${[['left', '左上'], ['center', '居中'], ['hide', '不显示']].map(([k, n]) => `<button data-ct="${k}" class="${(cv.title || 'center') === k ? 'on' : ''}">${n}</button>`).join('')}</div><button class="btn" data-cprev title="预览开始界面（Esc 返回）">${ic('play')}</button></div>` : ''}`;
    const set = o => { P.settings.theme = Object.assign({}, P.settings.theme || {}, o); applyTheme(); };
    tb.querySelectorAll('[data-p]').forEach(d => d.onclick = () => { P.settings.theme = { preset: d.dataset.p }; applyTheme(); draw(); });
    tb.querySelectorAll('input[data-k]').forEach(i => i.oninput = () => { set({ [i.dataset.k]: i.type === 'range' ? +i.value : i.value }); if (i.nextElementSibling?.tagName === 'EM') i.nextElementSibling.textContent = i.value; });
    tb.querySelectorAll('[data-font]').forEach(b => b.onclick = () => { set({ font: b.dataset.font }); draw(); });
    tb.querySelectorAll('[data-lay]').forEach(b => b.onclick = () => { set({ layout: b.dataset.lay }); draw(); });
    tb.querySelector('[data-img]').onchange = e => set({ img: e.target.value || undefined });
    tb.querySelector('[data-cover]').onchange = e => { API.setCover(e.target.value ? { img: e.target.value } : null); draw(); };
    tb.querySelectorAll('[data-cm]').forEach(b => b.onclick = () => { API.setCover({ menu: b.dataset.cm }); draw(); });
    tb.querySelectorAll('[data-ct]').forEach(b => b.onclick = () => { API.setCover({ title: b.dataset.ct }); draw(); });
    const pv = tb.querySelector('[data-cprev]'); if (pv) pv.onclick = () => { box.querySelector('[data-a=o]')?.click(); showTitle(); };
  };
  draw();
  // 让对话框在调整时一直可见：弹窗靠右上，不挡对话框；对话框临时完全显示
  const m = $('#modal'), oldDlg = stage.dataset.dlg;
  m.style.background = 'transparent'; m.classList.add('side'); stage.dataset.dlg = 'show';
  const restore = () => { m.style.background = ''; m.classList.remove('side'); stage.dataset.dlg = oldDlg; };
  m._onClose = restore;   // 确定 / 取消 / 点空白 / Esc 都经过 closeModal，统一还原
}

/* —— 周目记录：跨存档、跨周目，玩家电脑上永久保存 ——
   G = { cg:[看过的 CG 素材 id], endings:{结局名: 首次达成时间}, clears: 通关次数, vars:{跨周目变量} } */
let G = null, gPid = null;
const gKey = () => 'vnglobal:' + P.id;
function loadG() { if (gPid === P.id && G) return G; gPid = P.id; try { G = JSON.parse(localStorage.getItem(gKey()) || 'null'); } catch (e) { G = null; } G = Object.assign({ cg: [], endings: {}, clears: 0, vars: {} }, G || {}); return G; }
function saveG() { try { localStorage.setItem(gKey(), JSON.stringify(G)); } catch (e) {} }
function resetG() { G = { cg: [], endings: {}, clears: 0, vars: {} }; gPid = P.id; saveG(); }
const BUILTIN_VARS = ['周目', '结局数'];                 // 只读，剧本里可以直接用在条件里
const isCG = a => !!a && !a.previewExcluded && a.type === 'bg' && (a.cg ?? /^cg[_\-\s]/i.test(a.name || ''));
const allEndings = () => [...new Set(P.lines.map(l => l.ending).filter(Boolean))];
// 开局时：普通变量用初始值；跨周目变量用记住的值；再放进内置变量
function applyGlobals(vars) {
  loadG();
  P.vars.forEach(v => { if (v.global && Object.prototype.hasOwnProperty.call(G.vars, v.name)) vars[v.name] = G.vars[v.name]; });
  vars['周目'] = G.clears + 1; vars['结局数'] = Object.keys(G.endings).length;
  return vars;
}
// 变量改动后：把跨周目变量记下来
function syncGlobals() {
  let ch = false;
  P.vars.forEach(v => { if (v.global && RT.vars[v.name] !== G.vars[v.name]) { G.vars[v.name] = RT.vars[v.name]; ch = true; } });
  if (ch) saveG();
}

/* ========== 运行时：播放预览和导出的游戏共用这一套 ========== */
// RT = 当前一局游戏的状态：走到第几句、变量、回看记录、自动/快进、Agent 对话
const RT = { idx: 0, vars: {}, varsBefore: {}, back: [], auto: false, skip: false, chat: null, timer: null, onTyped: null };
let playing = false, typer = null, full = '', lastShown = null;
function startPlay(fromIdx, state) {
  clearTimeout(progressTimer); progressActive = true;
  playing = true; selUid = null;
  document.activeElement?.blur();
  document.body.classList.add('playing'); stage.classList.remove('hideui'); hideOverlays(); clearTimers(); fit();
  RT.idx = Math.max(0, Math.min(P.lines.length - 1, fromIdx ?? P.cur));
  RT.vars = applyGlobals(state?.vars ? clone(state.vars) : initVars());
  RT.back = state?.back ? clone(state.back) : [];
  RT.hist = [];                             // 走过的句子（←键回上一句用）
  if (state) { const last = RT.back[RT.back.length - 1], l0 = P.lines[RT.idx]; if (last && (last.t === l0.text || last.t === shownText(l0, RT.vars))) RT.back.pop(); }
  RT.auto = RT.skip = false; RT.chat = null; lastShown = null; updPctl();
  CH_AT = null; RT.soul = state?.soul ? clone(state.soul) : soulFresh(); RT.soul.busy = 0;
  { const T = RT.soul.tl || (RT.soul.tl = soulNewTl()); if (state?.soul) { T.anc = [...T.anc, { lineage: T.lin, turn: T.turn }]; T.lin = T.lin.split('.')[0] + '.' + Date.now().toString(36); } }
  SOUL_REV++; soulTabUpd();
  layer.innerHTML = ''; clearStageShot(); loadPrefs(); applyTheme(); loadRead();
  stopEffects(); RT.audioRestore=state?.audio||null; RT.audioSkipEntrySe=!!state;
  VNPlugins.emit('play', { from: RT.idx, loaded: !!state });
  showPlay(true);
}
function stopPlay() {
  if (progressActive) { void saveProgress('exit'); progressActive = false; }
  clearTimeout(progressTimer);
  if (RT.chat && !RT.chat.ending) { RT.chat.ending = true; VNPlugins.emit('chat:end', RT.chat); }
  VNPlugins.emit('stop');
  stopChoiceTimer(); stopAmb(); clearStageShot();
  clearTimers(); stage.classList.remove('nodlg', 'hideui'); playVoice(null); playBgm(null); RT.chat = null; lastShown = null; $('#pin').classList.remove('show');
  $('#soulTab').classList.remove('show'); SOUL_REV++;
  if (gameMode) return showTitle();
  playing = false; document.body.classList.remove('playing'); hideOverlays(); fit(); P.cur = RT.idx; changed();
}
function clearTimers() { clearInterval(typer); typer = null; clearTimeout(RT.timer); RT.timer = null; RT.onTyped = null; }
// 播放一次瞬时特效（预览和游戏共用）
function playFx(fx) {
  const v = $('#veil');
  const veil = (color, cls = 'go') => { v.style.background = color; v.classList.remove('go', 'blink'); void v.offsetWidth; v.classList.add(cls); };
  if (fx === 'shake' || fx === 'zoom') retrigger(stage, fx);
  else if (fx === 'quake') { retrigger(stage, 'quake'); veil('#fff'); }
  else if (fx === 'flash') veil('#fff');
  else if (fx === 'redflash') veil('#c00');
  else if (fx === 'whip') { retrigger(stage, 'whip'); veil('#fff'); }
  else if (fx === 'blink') veil('#000', 'blink');
}
function retrigger(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
function setName(el, name) { el.textContent = name || ''; el.style.color = charOf(name)?.color || ''; }
function showPlay(first) {
  clearTimers();
  // Finished hit effects must not keep overriding later scene transitions.
  stage.classList.remove('fade', 'shake', 'zoom', 'quake', 'whip');
  $('#veil').classList.remove('go', 'blink');
  const l = P.lines[RT.idx], prev = lastShown;
  renderStage(l, false);
  $('#choices').className = ''; $('#pin').classList.remove('show');
  // Pose changes reuse the actor without fading the entire room and dialogue scene.
  if (!first && lastShown && lastShown.bg !== l.bg && !VN_FADE.running()) {
    if (l.trans === 'fade') {
      stage.classList.remove('fade');
      // The animated children need a style flush, even when the stage size is unchanged.
      void getComputedStyle(bgEl).animationName;
      stage.classList.add('fade');
      void getComputedStyle(bgEl).animationName;
    }
    if (l.trans === 'black' || l.trans === 'flash') { const v = $('#veil'); v.style.background = l.trans === 'black' ? '#000' : '#fff'; retrigger(v, 'go'); }
  }
  if (!RT.skip) playFx(l.fx);
  const wasRead = READ.has(l.id); READ.add(l.id); saveRead();
  if (RT.skip && !wasRead && pref('skipRead')) { RT.skip = false; updPctl(); }   // 只快进看过的
  $('#ptx').classList.toggle('read', wasRead && !!l.text);
  playVoice(RT.skip ? null : l.voice, RT.idx);
  stage.classList.toggle('nodlg', isPause(l));
  lastShown = l;
  RT.varsBefore = clone(RT.vars);           // 存档存“进入这句之前”的变量，读档时不会重复加
  (RT.hist || (RT.hist = [])).push({ i: RT.idx, v: clone(RT.varsBefore), b: RT.back.length }); if (RT.hist.length > 500) RT.hist.shift();
  safeSet(l.set, RT.vars); syncGlobals(); soulOnLine(l, RT.varsBefore);
  if (!first) { const vb = RT.varsBefore, va = clone(RT.vars); if (l.se && !RT.skip) setTimeout(() => { if (playing) uiVarSe(vb, va); }, 350); else uiVarSe(vb, va); }   // 本句还有音效：好感/尾鳍声晚一点，不叠在一起
  if (!first && l.bg && l.bg !== prev?.bg && isCG(A(l.bg))) playUi('cg');
  if (!first && l.text && isChapterEnd(RT.idx)) playUi('chapterEnd');
  if (l.bg && isCG(A(l.bg)) && !G.cg.includes(l.bg)) { G.cg.push(l.bg); saveG(); }
  applyLineAudio(l,RT.audioRestore,RT.audioSkipEntrySe); RT.audioRestore=null;RT.audioSkipEntrySe=false;
  setName($('#pnm'), l.speaker);
  const shown = fillVars(l.text);
  if (l.text) { RT.back.push({ s: l.speaker, t: shown, v: l.voice || undefined, h: RT.hist.length - 1 }); if (RT.back.length > 300) RT.back.shift(); }
  VNPlugins.emit('line', { index: RT.idx, line: l, text: shown });
  const stats = pref('showStats') && SAVE_POINT_RE.test(l.text || '') ? statsText() : '';
  typeText(stats ? shown + '　' + stats : shown, () => afterText(l), l.typeMul, l.holdMs);
  warmUpcomingSprites(RT.idx);
  scheduleProgressSave(l);
}
// fix9：好感数值默认不显示；设置里打开后，章末“存档点”句子后面追加当前值
const SAVE_POINT_RE = /^【[^】]*完[^】]*】\s*存档点/;
function statsText(forPanel) {
  if (!playing || !RT.vars || $('#title').classList.contains('show')) return forPanel ? (pref('showStats') ? '开始游戏后显示在每话结尾' : '') : '';
  if (forPanel && !pref('showStats')) return '';
  const u = P.settings.uiSe || {}, c = soulCfg() || {}, fv = u.favorVar || c.aff || '好感', tv = u.tailVar || c.signal || '尾鳍';
  const has = k => Object.prototype.hasOwnProperty.call(RT.vars, k);
  const parts = [has(fv) ? fv + ' ' + RT.vars[fv] : '', has(tv) ? tv + '信号 ' + RT.vars[tv] : ''].filter(Boolean);
  return parts.length ? (forPanel ? '当前：' : '') + '〔' + parts.join(' · ') + '〕' : '';
}
// 台词里写 {好感} 会换成变量当前的值
const fillVars = (t, vars = RT.vars) => String(t || '').replace(/\{([^{}\s]{1,16})\}/g, (m, k) => vars && Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m);
// 某句在“进入前变量 = vars”时实际显示的文字（先执行本句的变量修改）
const shownText = (l, vars) => { const v = clone(vars); safeSet(l.set, v); return fillVars(l.text, v); };
// mul：本句打字速度倍率（>1 更慢）；hold：文字出现前先停多少毫秒（点一下照常直接显示全文）
function typeText(text, done, mul = 1, hold = 0) {
  clearInterval(typer); typer = null;
  full = text || ''; RT.onTyped = done; let n = 0;
  $('#ptx').textContent = '';
  if (!full || RT.skip) return finishTyping();
  const t0 = performance.now() + Math.max(0, Math.min(3000, +hold || 0));
  typer = setInterval(() => { if (performance.now() < t0) return; n++; $('#ptx').textContent = full.slice(0, n); if (n >= full.length) finishTyping(); }, pref('speed') * (+mul > 0 ? Math.min(4, +mul) : 1));
}
function finishTyping() {
  clearInterval(typer); typer = null; $('#ptx').textContent = full;
  const d = RT.onTyped; RT.onTyped = null; d?.();
}
const visibleChoices = l => l.choices.filter(c => cond(c.cond, RT.vars));
// 话末：本句之后进入新章节，或本句就是结局（有选项 / 跳转的句子不算）
const isChapterEnd = i => { const l = P.lines[i]; return !!l && !l.choices.length && !l.jump && !l.agent && (!!l.ending || !!P.lines[i + 1]?.chapter); };
// 限时选项：选项下方一条“退潮线”慢慢缩短，缩到头就自动选“超时默认”那一项（打开菜单/设置时暂停）
function stopChoiceTimer() { clearInterval(RT.ctimer); RT.ctimer = null; stopTick(); }
function startChoiceTimer(l, ch) {
  stopChoiceTimer(); if (!(l.ctime > 0)) return;
  const def = ch.find(c => c.target === l.cdef) || ch[ch.length - 1], idx = RT.idx;
  const bar = document.createElement('div'); bar.className = 'ctimer'; bar.innerHTML = '<i></i>'; $('#choices').appendChild(bar);
  const fill = bar.firstChild, total = l.ctime * 1000; let left = total, t0 = performance.now();
  startTick();
  RT.ctimer = setInterval(() => {
    const now = performance.now(), dt = now - t0; t0 = now;
    if (!playing || RT.idx !== idx) return stopChoiceTimer();
    if (overlayOpen() || document.hidden) { tickEl?.pause(); return; }
    if (tickEl?.paused) tickEl.play()?.catch?.(() => {});
    left -= dt; fill.style.width = Math.max(0, left / total * 100) + '%';
    if (left <= 0) { stopChoiceTimer(); choose(def, true); }
  }, 50);
}
function afterText(l) {
  if (l.agent?.char) return startChat(l);
  const ch = visibleChoices(l);
  if (ch.length) { RT.skip = false; updPctl(); renderChoices(ch, true); playUi('choiceShow'); return startChoiceTimer(l, ch); }
  kick();
}
function kick() {
  clearTimeout(RT.timer); RT.timer = null;
  if (!playing || RT.chat || typer || visibleChoices(P.lines[RT.idx]).length) return;
  const cl = P.lines[RT.idx];
  // 演出节（没文字）或设了停留秒数：到时间自动往下
  if (!overlayOpen() && (isPause(cl) || cl.wait > 0)) { RT.timer = setTimeout(advance, RT.skip ? 60 : (cl.wait > 0 ? cl.wait : 2) * 1000); return; }
  if (RT.skip) RT.timer = setTimeout(advance, 60);
  else if (RT.auto) {                            // 自动：等文字读完，也等配音说完
    const left = voEl && !voEl.paused && voEl.duration ? (voEl.duration - voEl.currentTime) * 1000 + 400 : 0;
    RT.timer = setTimeout(advance, Math.max((1200 + full.length * 60) * pref('autoMul'), left));
  }
}
const overlayOpen = () => !!document.querySelector('.ovl.show');
function showEnding(name) {
  clearTimers(); RT.auto = RT.skip = false; updPctl();
  loadG();
  const first = !G.endings[name];
  if (first) { G.endings[name] = Date.now(); playUi('endingNew'); }
  soulRemember({ type: 'ending', text: name }, 'end:' + name);
  G.clears++; saveG();
  const box = $('#endcard');
  const pbs = VNPlugins.R.endBtns.filter(b => { try { return !b.show || b.show(name); } catch (e) { return false; } });
  box.innerHTML = '<div class="t"></div><div class="n"></div>' + pbs.map((b, k) => `<button class="${b.primary ? 'pb' : ''}" data-pb="${k}">${b.icon ? ic(b.icon) + ' ' : ''}${esc(typeof b.label === 'function' ? b.label(name) : b.label)}</button>`).join('') + '<button data-home>返回标题</button>';
  box.querySelector('.t').textContent = '— ' + name + ' —';
  box.querySelector('.n').textContent = (first ? '新结局达成！' : '') + `  已收集 ${Object.keys(G.endings).length} / ${Math.max(allEndings().length, Object.keys(G.endings).length)}`;
  box.classList.add('show');
  box.onclick = e => {
    e.stopPropagation();
    const pb = e.target.closest('[data-pb]'); if (pb) { try { pbs[+pb.dataset.pb].onClick(name); } catch (er) { console.warn(er); } return; }
    if (e.target.closest('[data-home]')) { box.classList.remove('show'); stopPlay(); }
  };
  VNPlugins.emit('ending', { name, first });
}
// 鉴赏：CG 和结局
function showGallery(tab = 'cg') {
  loadG();
  const box = $('#gallery'), cgs = Object.values(P.assets).filter(isCG), ends = allEndings();
  box.innerHTML = `<h2>鉴赏</h2><div class="tabs"><button data-g="cg" class="${tab === 'cg' ? 'on' : ''}">CG ${cgs.filter(a => G.cg.includes(a.id)).length}/${cgs.length}</button><button data-g="end" class="${tab === 'end' ? 'on' : ''}">结局 ${ends.filter(n => G.endings[n]).length}/${ends.length}</button></div><div class="body"></div><div class="stat"></div>`;
  const body = box.querySelector('.body');
  if (tab === 'cg') {
    body.className = 'body cgs';
    cgs.forEach(a => {
      const d = document.createElement('button'), open = G.cg.includes(a.id); d.type = 'button'; d.disabled = !open; d.setAttribute('aria-label', open ? a.name.replace(/^CG_/, '') : '尚未解锁的画面');
      d.className = 'cg' + (open ? '' : ' lock');
      if (open) { d.style.backgroundImage = cssUrl(a.src); d.onclick = e => { e.stopPropagation(); const v = $('#cgview'); v.style.backgroundImage = cssUrl(a.src); v.classList.add('show'); v.onclick = ev => { ev.stopPropagation(); v.classList.remove('show'); }; }; }
      else d.innerHTML = '<small>尚未解锁</small>';
      body.appendChild(d);
    });
    if (!cgs.length) body.outerHTML = '<div class="stat">还没有 CG</div>';
  } else {
    body.className = 'body ends';
    ends.forEach(n => {
      const d = document.createElement('div'), t = G.endings[n];
      if (t) { d.textContent = n; const sm = document.createElement('small'); sm.textContent = new Date(t).toLocaleDateString(); d.appendChild(sm); }
      else { d.className = 'lock'; d.textContent = '？？？'; }
      body.appendChild(d);
    });
  }
  box.querySelector('.stat').textContent = `通关 ${G.clears} 次`;
  box.querySelectorAll('[data-g]').forEach(b => b.onclick = e => { e.stopPropagation(); showGallery(b.dataset.g); });
  addClose(box); box.classList.add('show');
  box.onclick = e => { e.stopPropagation(); if (e.target === box) box.classList.remove('show'); };
}
function advance() {
  if (!playing || progressLeaving || overlayOpen()) return;
  if (typer) return finishTyping();
  if (RT.chat) {                                  // Agent 对话：结束后才能往下
    if (!RT.chat.ending) return;
    if (RT.chat.onExit) { const f = RT.chat.onExit; RT.chat = null; return f(); }   // 插件开的对话（比如结局后聊天）：交回插件
    const ex = RT.chat.line.agent.exit; RT.chat = null;
    const j = ex ? labelIndex(ex) : -1;
    return goNext(j >= 0 ? j : RT.idx + 1);
  }
  const l = P.lines[RT.idx];
  if (visibleChoices(l).length) return;           // 有选项：必须点选项
  if (l.ending) return showEnding(l.ending);      // 结局：记下来，回标题
  goNext(nextIndex(l));
}
// ←键 / “上一句”按钮：回到刚才那一句，变量和回看记录一起退回
function goBack() {
  if (!playing || overlayOpen() || RT.chat) return;
  if (!RT.hist || RT.hist.length < 2) return;
  stopChoiceTimer(); clearTimers(); RT.auto = RT.skip = false; updPctl();
  RT.hist.pop(); const p = RT.hist.pop();
  RT.idx = p.i; RT.vars = clone(p.v); syncGlobals();
  if (RT.back.length > p.b) RT.back.length = p.b;
  RT.audioSkipEntrySe = true;
  showPlay(false);
}
// 从历史记录中的指定对白恢复当时的变量、回看位置和剧情节点。
function goBackToHistory(h) {
  if (!playing || overlayOpen() || RT.chat || !Number.isInteger(h)) return;
  const p = RT.hist?.[h]; if (!p) return;
  stopChoiceTimer(); clearTimers(); RT.auto = RT.skip = false; updPctl();
  RT.hist.length = h;
  RT.idx = p.i; RT.vars = clone(p.v); syncGlobals();
  if (RT.back.length > p.b) RT.back.length = p.b;
  RT.audioSkipEntrySe = true;
  showPlay(false);
}
function nextIndex(l) {
  if (l.jump && cond(l.jumpIf, RT.vars)) { const j = labelIndex(l.jump); if (j >= 0) return j; }
  return RT.idx + 1;
}
function goNext(i) { if (i >= P.lines.length) return stopPlay(); RT.idx = i; showPlay(false); }
function choose(c, timedOut) {
  stopChoiceTimer();
  const vb = clone(RT.vars); safeSet(c.set, RT.vars); syncGlobals(); soulOnChoice(c, vb, timedOut);
  playUi(timedOut ? 'timeoutSilence' : 'choiceConfirm');
  { const va = clone(RT.vars); setTimeout(() => { if (playing) uiVarSe(vb, va); }, 300); }   // 好感音效晚一点，不和点选声叠在一起
  RT.back.push({ s: '▶', t: timedOut ? c.text + '（时间到）' : c.text });
  VNPlugins.emit('choice', { text: c.text, target: c.target || '', timedOut: !!timedOut });
  const j = c.target ? labelIndex(c.target) : -1;
  goNext(j >= 0 ? j : RT.idx + 1);
}
stage.addEventListener('click', e => {
  if (playing && $('#soul').classList.contains('show') && !e.target.closest('#soul')) return hideSoul();
  if (!playing || e.target.closest('.ovl,#pctl,#pin,#choices,#soulTab')) return;
  if (Date.now() < noClickUntil) return;                                   // 刚做完长按/滑动手势，这次“点击”不算
  if (stage.classList.contains('hideui')) return setHideUI(false);         // 隐藏界面时，点一下只是恢复
  advance();
});
/* —— 触屏手势（只在播放时）：长按=隐藏界面看画面，向下滑=回看 —— */
let noClickUntil = 0, gest = null;
// fix9：画面外的黑边也能点：推进剧情，或在“隐藏界面”时恢复
$('#main').addEventListener('click', e => {
  if (!playing || !gameMode || stage.contains(e.target) || e.target.closest('#props')) return;
  if ($('#soul').classList.contains('show')) return hideSoul();
  if (overlayOpen() || Date.now() < noClickUntil) return;
  if (stage.classList.contains('hideui')) return setHideUI(false);
  advance();
});
function setHideUI(on) { stage.classList.toggle('hideui', on); }
stage.addEventListener('pointerdown', e => {
  if (!playing || e.pointerType === 'mouse' || e.target.closest('.ovl,#pctl,#pin')) return;
  gest = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId };
  gest.timer = setTimeout(() => { if (!gest) return; setHideUI(!stage.classList.contains('hideui')); gest.done = true; navigator.vibrate?.(15); }, 550);
});
stage.addEventListener('pointermove', e => {
  if (!gest || gest.done || e.pointerId !== gest.id) return;
  const dx = e.clientX - gest.x, dy = e.clientY - gest.y;
  if (Math.hypot(dx, dy) > 12) clearTimeout(gest.timer);                  // 手指动了就不是长按
  if (dy > 60 && dy > Math.abs(dx) * 1.5 && !overlayOpen()) {            // 向下滑：打开回看
    clearTimeout(gest.timer); gest.done = true; showBacklog();
  }
});
// 手势做完后手指抬起，浏览器还会补发一次“点击”：只吞掉这一次
['pointerup', 'pointercancel'].forEach(t => stage.addEventListener(t, () => { if (gest) { clearTimeout(gest.timer); if (gest.done) noClickUntil = Date.now() + 350; gest = null; } }));
// 电脑上：右键 / H 键 = 隐藏界面
stage.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (playing && !overlayOpen() && e.pointerType !== 'touch' && !gest) setHideUI(!stage.classList.contains('hideui'));
});
// 每个弹出层右上角一个 ✕（手机上没有 Esc 键）
function addClose(box, after) {
  const x = document.createElement('button'); x.className = 'ovx'; x.type = 'button'; x.setAttribute('aria-label', '返回游戏'); x.title = '返回游戏（Esc）'; x.innerHTML = ic('x');
  x.onclick = e => { e.stopPropagation(); box.classList.remove('show'); after?.(); };
  box.prepend(x);
}
/* —— 手机玩导出的游戏：第一次点击时进全屏并锁横屏；竖屏时提示横过来 —— */
const coarse = () => matchMedia('(pointer:coarse)').matches;
let triedFull = false;
function goFullscreen() {
  if (triedFull || !gameMode || !coarse()) return; triedFull = true;
  const d = document.documentElement, req = d.requestFullscreen || d.webkitRequestFullscreen;
  try { const r = req?.call(d, { navigationUI: 'hide' }); r?.then?.(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch?.(() => {}); } catch (e) {}
}
document.addEventListener('pointerup', goFullscreen);
$('#bPortrait').onclick = () => document.body.classList.add('portraitOk');
['orientationchange', 'fullscreenchange'].forEach(t => window.addEventListener(t, () => setTimeout(fit, 120)));
window.visualViewport?.addEventListener('resize', fit);
stage.addEventListener('wheel', e => {
  if (e.target.closest('#ptx') && $('#ptx').scrollHeight > $('#ptx').clientHeight + 2) return;
  if (playing && e.deltaY < 0 && !overlayOpen()) showBacklog();
});

/* —— 游戏内菜单：回看 / 自动 / 快进 / 存档 / 读档 —— */
function updPctl() {
  document.querySelector('[data-pc=auto]').classList.toggle('on', RT.auto);
  document.querySelector('[data-pc=auto]').setAttribute('aria-pressed', String(RT.auto));
  document.querySelector('[data-pc=skip]').classList.toggle('on', RT.skip);
  document.querySelector('[data-pc=skip]').setAttribute('aria-pressed', String(RT.skip));
}
$('#pctl').addEventListener('click', e => {
  e.stopPropagation();
  const b = e.target.closest('[data-pc]'); if (!b) return;
  const a = b.dataset.pc;
  if (a === 'prev') return goBack();
  if (a === 'log') showBacklog();
  if (a === 'hide') setHideUI(true);
  if (a === 'save' || a === 'load') showSlots(a);
  if (a === 'set') showPrefs();
  if (a === 'exit') return leaveForTitle();
  if (a === 'auto' || a === 'skip') { RT[a] = !RT[a]; RT[a === 'auto' ? 'skip' : 'auto'] = false; if (RT.skip) VN_FADE.cancel(); updPctl(); kick(); }
});
$('#soulTab').addEventListener('click', e => { e.stopPropagation(); if ($('#soul').classList.contains('show')) hideSoul(); else showSoul(); });
function showPrefs() {
  clearTimeout(RT.timer); RT.timer = null;
  const box = $('#psettings');
  const fmt = (k, raw, inv) => { const value=inv ? inv - Number(raw) : Number(raw); if(k==='vbgm'||k==='vse'||k==='vamb'||k==='vvo'||k==='ghost') return Math.round(value*100)+'%'; if(k==='readerScale') return Math.round(value*100)+'%'; if(k==='speed') return Math.round(value)+'ms'; if(k==='autoMul') return value.toFixed(1)+'×'; return String(value); };
  const sl = (k, label, min, max, step, inv) => { const raw=inv ? inv - pref(k) : (pref(k) ?? 1); return `<div class="row"><span>${label}</span><div class="control"><input type="range" min="${min}" max="${max}" step="${step}" data-k="${k}" ${inv ? 'data-inv="' + inv + '"' : ''} value="${raw}"><output data-value="${k}">${fmt(k,raw,inv)}</output></div></div>`; };
  box.innerHTML = `<header class="panel-heading"><small>按自己的节奏</small><h2>声音与阅读</h2></header><div class="rows">
    ${sl('vbgm', ic('music') + ' 音乐', 0, 1, 0.05)}${sl('vse', ic('bell') + ' 音效', 0, 1, 0.05)}${sl('vamb', ic('waves') + ' 环境音', 0, 1, 0.05)}${P.lines.some(l => l.voice) ? sl('vvo', ic('mic') + ' 语音', 0, 1, 0.05) : ''}
    ${P.lines.some(l => l.voice) ? `<div class="row"><span>语音开关</span><button class="tg ${voiceEnabledAt(RT.idx) ? 'on' : ''}" data-tg="voiceEnabled" aria-pressed="${voiceEnabledAt(RT.idx)}">${voiceEnabledAt(RT.idx) ? '已开启' : '已关闭'}</button></div>` : ''}
    ${sl('readerScale', '文字大小', 1, 1.25, 0.05)}${sl('speed', '文字速度', 5, 80, 5, 85)}${sl('autoMul', '自动播放等待', 0.4, 2.5, 0.1)}${sl('ghost', '对话框不透明度', 0.35, 0.95, 0.05)}
    <div class="row"><span>快进</span><button class="tg ${pref('skipRead') ? 'on' : ''}" data-tg="skipRead">只快进已读</button></div>
    ${uiSe('btnClick') || uiSe('btnHover') ? `<div class="row"><span>按钮音效</span><button class="tg ${pref('btnSe') !== false ? 'on' : ''}" data-tg="btnSe" data-def="1">点按 / 悬停时轻响</button></div>` : ''}
    <div class="row stats-row"><span>好感数值</span><button class="tg ${pref('showStats') ? 'on' : ''}" data-tg="showStats">显示（剧透向）</button><small class="dim stats-now">${statsText(true)}</small></div>${soulPrefsHtml()}</div>`;
  const syncSlider = r => { const min=Number(r.min)||0, max=Number(r.max)||1, value=Number(r.value); const pct=max>min ? Math.max(0,Math.min(100,(value-min)/(max-min)*100)) : 0; r.style.setProperty('--slider-pct', pct+'%'); };
  box.querySelectorAll('input[type=range]').forEach(r => { const output=box.querySelector(`output[data-value="${r.dataset.k}"]`); syncSlider(r); if(output) output.textContent=fmt(r.dataset.k,r.value,r.dataset.inv); r.oninput = () => { setPref(r.dataset.k, r.dataset.inv ? +r.dataset.inv - +r.value : +r.value); syncSlider(r); if(output) output.textContent=fmt(r.dataset.k,r.value,r.dataset.inv); }; });
  box.querySelectorAll('[data-tg]').forEach(b => b.onclick = e => { e.stopPropagation(); const cur = b.dataset.tg === 'voiceEnabled' ? voiceEnabledAt(RT.idx) : b.dataset.def ? pref(b.dataset.tg) !== false : !!pref(b.dataset.tg), v = !cur; if (b.dataset.tg === 'voiceEnabled') setVoiceEnabled(v); else setPref(b.dataset.tg, v); b.classList.toggle('on', v); if (b.dataset.tg === 'voiceEnabled') { b.setAttribute('aria-pressed', String(v)); b.textContent = v ? '已开启' : '已关闭'; } if (b.dataset.tg === 'showStats') box.querySelector('.stats-now').textContent = statsText(true); });
  soulPrefsBind(box);
  addClose(box, kick); box.classList.add('show');
  box.onclick = e => { e.stopPropagation(); if (e.target === box) { box.classList.remove('show'); kick(); } };
}
function hideOverlays() { document.querySelectorAll('.ovl').forEach(o => o.classList.remove('show')); }
function showBacklog() {
  const b = $('#backlog'); b.innerHTML = '<header class="panel-heading"><small>走过的片刻</small><h2>对话回看</h2></header>' + (RT.back.length ? '' : '<p>这里会留下已经读过的对话。</p>');
  RT.back.forEach(x => {
    const d = document.createElement('div'); d.className = 'e';
    if (x.s) { const n = document.createElement('b'); if (x.s === '▶') n.innerHTML = ic('chevron-right'); else n.textContent = x.s; d.appendChild(n); }
    d.append(x.t);
    if (x.v && A(x.v)) { const p = document.createElement('button'); p.className = 'vo'; p.innerHTML = ic('volume-2'); p.onclick = e => { e.stopPropagation(); playVoice(x.v); }; d.appendChild(p); }
    if (Number.isInteger(x.h)) {
      const rb = document.createElement('button'); rb.className = 'back'; rb.type = 'button'; rb.textContent = '回退到这里';
      rb.title = '恢复到这句对白开始前的状态';
      rb.onclick = e => { e.stopPropagation(); b.classList.remove('show'); goBackToHistory(x.h); };
      d.appendChild(rb);
    }
    b.appendChild(d);
  });
  addClose(b); b.classList.add('show'); b.scrollTop = b.scrollHeight;
  b.onclick = e => { e.stopPropagation(); if (e.target === b) b.classList.remove('show'); };
}
// 存档缩略图：把背景和立绘画到一张 320×180 的小图上
async function makeThumb(l) {
  try {
    const c = document.createElement('canvas'); c.width = 320; c.height = 180;
    const x = c.getContext('2d'); if (!x) return null;
    const k = 320 / W; x.fillStyle = '#111'; x.fillRect(0, 0, 320, 180);
    const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; setTimeout(() => r(null), 1500); });
    if (l.bg && A(l.bg)) { const i = await load(A(l.bg).src); if (i) { const sc = Math.max(320 / i.width, 180 / i.height); x.drawImage(i, (320 - i.width * sc) / 2, (180 - i.height * sc) / 2, i.width * sc, i.height * sc); } }
    for (const s of l.sprites) {
      const a = A(s.asset); if (!a) continue; const i = await load(a.src); if (!i) continue;
      const h = s.h * k, w = i.width * h / i.height;
      x.save(); x.filter = spriteFilterCss(s, l) || 'none'; x.translate(s.x * k, s.y * k); if (s.flip) x.scale(-1, 1); x.drawImage(i, -w / 2, -h, w, h); x.restore();
    }
    return c.toDataURL('image/jpeg', 0.7);
  } catch (e) { return null; }
}
// 画不了缩略图时（双击打开的文件夹版 / 桌面版，浏览器不让读本地图片的像素），用缩小的画面代替
function miniScene(el, l) {
  if (l.bg && A(l.bg)) el.style.backgroundImage = cssUrl(A(l.bg).src);
  (l.sprites || []).forEach(sp => {
    const a = A(sp.asset); if (!a) return;
    const im = document.createElement('img'); im.src = a.src;
    im.style.cssText = `position:absolute;left:${sp.x / W * 100}%;top:${sp.y / H * 100}%;height:${sp.h / H * 100}%;transform:translate(-50%,-100%)${sp.flip ? ' scaleX(-1)' : ''};pointer-events:none;filter:${spriteFilterCss(sp, l) || 'none'}`;
    el.appendChild(im);
  });
}
const saveKey = () => 'saves:' + P.id;
const recoveryKey = () => 'vncontinue:' + P.id;
let progressActive = false, progressLeaving = false, progressTimer = null, titleProgressToken = 0;
let playerSaveQueue = Promise.resolve(), progressWarned = false;
// Manual slots and the independent auto slot share one serialized read/modify/write.
// Keeping the same key/shape also lets the galcore bridge attach its snapshot.
function updatePlayerSaves(change) {
  const key = saveKey();
  const pending = playerSaveQueue.catch(() => false).then(async () => {
    const saves = (await idbGet(key)) || {};
    change(saves);
    return idbSet(key, saves);
  }).catch(() => false);
  playerSaveQueue = pending;
  return pending;
}
function capturePlayerSave(reason) {
  const l = P.lines[RT.idx];
  return { time: Date.now(), saveId: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2), idx: RT.idx, lineId: l.id, vars: clone(RT.varsBefore || RT.vars),
    back: clone(RT.back.slice(-100)), soul: RT.soul ? clone(RT.soul) : undefined,
    text: l.text || '', bg: l.bg, audio: captureAudioState(), reason };
}
function validPlayerSave(s) {
  return !!s && typeof s === 'object' && typeof s.lineId === 'string' && P.lines.some(l => l.id === s.lineId);
}
function readRecovery() {
  try { const s = JSON.parse(localStorage.getItem(recoveryKey()) || 'null'); return validPlayerSave(s) ? s : null; }
  catch (e) { return null; }
}
function stashProgress(s) {
  try { localStorage.setItem(recoveryKey(), JSON.stringify(s)); return true; }
  catch (e) { return false; }
}
function flushReadRecord() {
  clearTimeout(readT);
  try { localStorage.setItem('vnread:' + P.id, JSON.stringify([...READ])); } catch (e) {}
}
async function saveProgress(reason = 'reading') {
  clearTimeout(progressTimer);
  if (!gameMode || !progressActive || !P.lines[RT.idx]) return true;
  const s = capturePlayerSave(reason), recovery = recoveryKey();
  // Synchronous recovery survives a refresh while IndexedDB is still committing.
  const fallback = stashProgress(s);
  const ok = await updatePlayerSaves(saves => { saves.auto = s; });
  if (ok) {
    // Preserve a newer recovery written while this transaction was in flight.
    try { const current = JSON.parse(localStorage.getItem(recovery) || 'null'); if (current?.saveId === s.saveId) localStorage.removeItem(recovery); } catch (e) {}
  }
  if (ok || fallback) {
    progressWarned = false;
    if (reason === 'chapter' && progressActive && P.lines[RT.idx]?.id === s.lineId) pluginToast('进度已自动保存');
    return true;
  }
  if (!progressWarned) { progressWarned = true; pluginToast('自动保存未成功，请先手动存档'); }
  return false;
}
function scheduleProgressSave(l) {
  if (!gameMode || !progressActive) return;
  clearTimeout(progressTimer);
  const reason = SAVE_POINT_RE.test(l.text || '') ? 'chapter' : l.ending ? 'ending' : l.choices.length ? 'choice' : 'reading';
  if (reason !== 'reading') { void saveProgress(reason); return; }
  // No thumbnail work during play; rapid skipping coalesces into the latest line.
  progressTimer = setTimeout(() => { void saveProgress(); }, 650);
}
async function continueSave() {
  await playerSaveQueue;
  const saves = (await idbGet(saveKey())) || {};
  return [...Object.values(saves), readRecovery()].filter(validPlayerSave).sort((a, b) => b.time - a.time)[0] || null;
}
function loadPlayerSave(s) {
  const i = P.lines.findIndex(l => l.id === s?.lineId);
  if (i >= 0) startPlay(i, s);
}
function startNewGame(ask) {
  if (ask && !confirm('从头开始游戏？自动进度会从新一局重新记录，手动存档会保留。')) return;
  const entry = P.lines.findIndex(l => l.chapter); startPlay(entry >= 0 ? entry : 0);
}
async function leaveForTitle() {
  if (!gameMode) return stopPlay();
  if (progressLeaving) return;
  progressLeaving = true; clearTimeout(RT.timer); RT.timer = null;
  try {
    const ok = await saveProgress('exit');
    flushReadRecord();
    if (!ok && !confirm('进度未能自动保存。仍要返回标题吗？选择取消可留在游戏中手动存档。')) { kick(); return; }
    progressActive = false; stopPlay();
  } finally { progressLeaving = false; }
}
function stashOnLeave(e) {
  if (!gameMode || !progressActive) return;
  clearTimeout(progressTimer); flushReadRecord();
  const ok = stashProgress(capturePlayerSave('close'));
  if (!ok && e.type === 'beforeunload') { e.preventDefault(); e.returnValue = ''; }
}
window.addEventListener('beforeunload', stashOnLeave);
window.addEventListener('pagehide', stashOnLeave);
async function showSlots(mode) {
  clearTimeout(RT.timer); RT.timer = null; RT.auto = RT.skip = false; updPctl();
  await playerSaveQueue;
  const saves = (await idbGet(saveKey())) || {}, box = $('#slots');
  const auto = [saves.auto, readRecovery()].filter(validPlayerSave).sort((a, b) => b.time - a.time)[0];
  VN_FADE.begin(); // 异步读取完成后、真正替换列表前再采样。
  box.innerHTML = '<header class="panel-heading"><small>旅途记录</small><h2>' + (mode === 'save' ? '保存进度' : '读取进度') + '</h2><p>' + (mode === 'save' ? '选一个位置，把这一刻留下。自动进度另行保留，不占手动存档。' : auto || Object.values(saves).some(validPlayerSave) ? '回到上次停下的地方。' : '还没有保存的进度。开始游戏后会自动记录，也可以手动存档。') + '</p></header><div class="grid2"></div>';
  const g = box.querySelector('.grid2');
  if (mode === 'load' && (auto || Object.values(saves).some(validPlayerSave))) {
    const restart = document.createElement('button'); restart.type = 'button'; restart.className = 'save-restart'; restart.textContent = '从头开始';
    restart.onclick = e => { e.stopPropagation(); startNewGame(true); };
    box.querySelector('.panel-heading').appendChild(restart);
  }
  if (mode === 'load' && auto) {
    const resume = document.createElement('button'); resume.className = 'resume-save'; resume.type = 'button';
    const i = P.lines.findIndex(l => l.id === auto.lineId);
    resume.innerHTML = '<b>自动保存 · 继续游戏</b><small>' + esc(chapterAt(i)) + '</small><span>' + esc((auto.text || '').slice(0, 48)) + '</span><time>' + esc(new Date(auto.time).toLocaleString()) + '</time>';
    resume.onclick = e => { e.stopPropagation(); loadPlayerSave(auto); };
    box.insertBefore(resume, g);
  }
  for (let k = 1; k <= 6; k++) {
    const s = saves[k], d = document.createElement('button'); d.type = 'button'; d.className = 'slot' + (s ? '' : ' empty'); d.disabled = !s && mode === 'load';
    if (s?.thumb) d.style.backgroundImage = cssUrl(s.thumb);
    else if (s) miniScene(d, P.lines.find(x => x.id === s.lineId) || { bg: s.bg, sprites: [] });
    const sp = document.createElement('span');
    const savedIndex = s ? P.lines.findIndex(x => x.id === s.lineId) : -1;
    sp.innerHTML = '<b>存档 ' + String(k).padStart(2, '0') + '</b>' + (s ? '<small>' + esc(chapterAt(savedIndex >= 0 ? savedIndex : s.idx)) + '</small><p>' + esc((s.text || '').slice(0, 28)) + '</p><time>' + esc(new Date(s.time).toLocaleString()) + '</time>' : '<small>还没有记录</small>');
    d.appendChild(sp);
    d.onclick = async e => {
      e.stopPropagation();
      if (mode === 'save') {
        if (s && !confirm('覆盖存档 ' + String(k).padStart(2, '0') + '？原进度会被替换。')) return;
        d.disabled = true;
        const l = P.lines[RT.idx], state = capturePlayerSave('manual');
        state.thumb = await makeThumb(l);
        const ok = await updatePlayerSaves(current => { current[k] = state; });
        if (!ok) alert('存档失败：浏览器存储不可用'); else playUi('save');
        showSlots('save');
      } else if (s) {
        // 剧本改过之后，按台词 id 找回原来那句
        const byId = P.lines.findIndex(x => x.id === s.lineId);
        startPlay(byId >= 0 ? byId : s.idx, s);
      }
    };
    g.appendChild(d);
  }
  addClose(box); box.classList.add('show');
  box.onclick = e => { e.stopPropagation(); if (e.target === box) box.classList.remove('show'); };
}
function showTitle() {
  progressActive = false; clearTimeout(progressTimer);
  const progressToken = ++titleProgressToken;
  playing = true; document.body.classList.add('playing'); hideOverlays(); clearTimers(); stopAllAudio(); stopTick(); stopChoiceTimer();
  RT.chat = null; $('#pin').classList.remove('show'); $('#choices').className = ''; $('#soulTab').classList.remove('show');
  const t = $('#title'), first = P.lines[0];
  const cv = P.settings.cover || {}, ca = cv.img && A(cv.img), pos = v => /^(left|center|right|hide)$/.test(v) ? v : 'center';
  t.style.backgroundImage = ca ? '' : first?.bg && A(first.bg) ? cssUrl(A(first.bg).src) : '';
  t.classList.toggle('cover', !!ca); t.classList.toggle('glass', !!ca && cv.style !== 'theme');
  t.style.setProperty('--ty', (cv.ty ?? 186) + 'px');
  loadG();
  const hasGal = Object.values(P.assets).some(isCG) || allEndings().length;
  t.innerHTML = (ca ? `<div class="cbg" style="background-image:${esc(cssUrl(ca.src))}"></div>` : '') + `<h1 class="t-${ca ? pos(cv.title) : 'center'}"></h1><div class="menu m-${ca ? pos(cv.menu) : 'center'}">` + '<button data-t="start">开始游戏</button><button data-t="load">读取进度</button>' + (hasGal ? '<button data-t="gal">鉴赏</button>' : '') + VNPlugins.R.titleBtns.map((b, k) => { try { return !b.show || b.show() ? `<button data-tp="${k}">${esc(b.label)}</button>` : ''; } catch (e) { return ''; } }).join('') + '<button data-t="chapters">章节试阅</button><button data-t="audio">声音收藏</button><button data-t="set">设置</button>' + (P.settings.plgMenu === false ? '' : '<button data-t="plg">插件</button>') + '</div>';
  loadPrefs(); applyTheme();
  t.insertAdjacentHTML('beforeend', '<p class="play-help">点击 / 空格 继续　·　滚轮上翻 回看　·　H 隐藏界面</p>');
  t.querySelector('[data-t=gal]')?.addEventListener('click', e => { e.stopPropagation(); showGallery(); });
  t.querySelector('h1').textContent = P.title || '';
  t.querySelector('[data-t=start]').onclick = e => { e.stopPropagation(); startNewGame(false); };
  continueSave().then(s => {
    if (!s || progressToken !== titleProgressToken || !t.classList.contains('show')) return;
    const button = t.querySelector('[data-t=start]'); button.textContent = '继续游戏';
    button.onclick = e => { e.stopPropagation(); loadPlayerSave(s); };
    const restart = document.createElement('button'); restart.type = 'button'; restart.className = 'restart-link'; restart.textContent = '从头开始';
    restart.onclick = e => { e.stopPropagation(); startNewGame(true); };
    t.querySelector('.play-help')?.appendChild(restart);
  });
  t.querySelector('[data-t=load]').onclick = e => { e.stopPropagation(); showSlots('load'); };
  t.querySelector('[data-t=chapters]').onclick=e=>{e.stopPropagation();showChapterReview();};
  t.querySelector('[data-t=audio]').onclick=e=>{e.stopPropagation();showAudioLibrary();};
  t.querySelector('[data-t=set]').onclick = e => { e.stopPropagation(); showPrefs(); };
  t.querySelector('[data-t=plg]')?.addEventListener('click', e => { e.stopPropagation(); showPluginsOvl(); });
  t.querySelectorAll('[data-tp]').forEach(b => b.onclick = e => { e.stopPropagation(); try { VNPlugins.R.titleBtns[+b.dataset.tp].onClick(); } catch (er) { console.warn(er); } });
  t.onclick = e => e.stopPropagation();
  VNPlugins.emit('title');
  t.classList.add('show'); fit();
}

/* ========== 灵枢手账：游戏内侧边栏（记得的事 / 信号收集 / 悄悄话 / 规矩） ==========
// 剧本是主线；“灵魂层”只负责：记住玩家做过什么、在空档里即兴回一句话。
// 开关：剧本写 @soul 角色名 [signal=尾鳍] [aff=好感] [rule=第N条的正则] [limit=3]，存在 P.settings.soul。
// 大脑（后端）可换：SOUL_BRAINS.local = 离线假后端（第一阶段）；galLingS = 第二阶段接 WebSocket。
// 记忆随存档保存（RT.soul），所以读档后她只记得那条时间线上发生过的事。 */
const soulCfg = () => { const s = P.settings.soul; return s && s.char ? Object.assign({ signal: '', aff: '好感', rule: '^『.*第[一二三四五六七八九十0-9]+条', limit: 3 }, s) : null; };
const soulFresh = () => ({ mem: [], sig: [], rules: [], talk: [], used: {}, unread: 0, tl: soulNewTl() });
const soulMode = () => pref('soulMode') || 'mix';          // off 纯剧本 / mix 剧本+即兴 / free 自由
let SOUL_DOCK = null, SOUL_REV = 0;                         // 停靠在外面（galLingS 窗口模式的右侧栏）时的手账容器；REV 一变就重画
let CH_AT = null;                                          // 每一节属于哪一章（开局时算一次）
function chapterAt(i) {
  if (!CH_AT || CH_AT.length !== P.lines.length) { CH_AT = []; let c = ''; P.lines.forEach((l, k) => { if (l.chapter) c = l.chapter; CH_AT[k] = c; }); }
  return CH_AT[i] || '';
}
const chShort = c => String(c || '').split(/\s*[·・:：]\s*/)[0];
const pick = a => a[Math.floor(Math.random() * a.length)];
// —— 大脑：remember(事件) → 她口吻的一句话；whisper(请求) → {text, emotion} ——
const SOUL_BRAINS = {
  local: {
    name: '离线',
    remember(ev) {
      const t = String(ev.text || '').replace(/^「|」$/g, '');
      if (ev.type === 'choice') {
        if (ev.timeout) return '人类一句话都没说。本小姐等了很久。';
        const d = ev.delta || 0;
        return `人类说「${t}」——` + (d >= 8 ? '哼，这句本小姐抄下来了。' : d > 0 ? '还算会说话。' : d < 0 ? '记仇本上记一笔。' : '勉强记下。');
      }
      if (ev.type === 'ending') return `「${t}」。这一页，本小姐先合上。`;
      return t;
    },
    async whisper(req) {
      const s = req.input, last = req.memory.filter(m => m.k === 'choice').slice(-1)[0];
      const R = [
        [/喜欢|爱你|想你|心动/, '害羞', ['谁、谁准你写这种话的！……本小姐收下了，只此一次。', '……墨水洇开了。都怪你。']],
        [/布丁/, '得意', ['布丁？本小姐那份要双倍。', '哼，算你懂行。焦糖要多。']],
        [/对不起|抱歉|错了/, '柔和', ['……知道错就好。下不为例。', '本小姐没生气。尾巴是自己在拍水的。']],
        [/笨|讨厌|丑|胖|蠢/, '生气', ['人类！给本小姐重写！', '记仇本，第一页，写你的名字。']],
        [/晚安|睡了|困/, '柔和', ['晚安。……不许梦见别的鲸鱼。', '睡吧。本小姐替你看着海。']],
        [/暗号|桂花/, '得意', ['暗号要当面对，写在纸上不算数。……不过本小姐认得你的字。']],
        [/早|你好|在吗|嗨|hello/i, '', ['在。有话快说，本小姐很忙。', '嗯。今天的海风还行。']],
        [/[?？吗呢]$/, '坏笑', ['问本小姐？自己想。', '……这个嘛，看你表现。']],
      ];
      let emo = '', text = '';
      for (const [re, e, a] of R) if (re.test(s)) { emo = e; text = pick(a); break; }
      if (!text) {
        if (last && Math.random() < .5) { emo = '柔和'; text = `你上次说「${String(last.src || '').replace(/^「|」$/g, '')}」……本小姐还记着。`; }
        else text = pick(['收到。本小姐看过了，不回。……好吧，回一句：知道了。', '哼。字写得歪歪扭扭的。', '这种话，当面说才算。']);
      }
      if (req.talk === 'short') text = text.split(/(?<=[。！？])/)[0];
      if (req.talk === 'long') text += pick(['（尾鳍在纸角拍了一下。）', '……别盯着看。', '（字迹最后一笔写得很重。）']);
      await new Promise(r => setTimeout(r, req.fast ? 0 : 900));
      return { text, emotion: emo };
    },
  },
  // galLingS 灵枢外部端口（vn-soul/1，WebSocket /ws/soul）：记忆写进灵枢，悄悄话由角色卡 + 模型回复；连不上 / 没模型就用离线回复
  galLingS: {
    name: 'galLingS',
    remember(ev) {
      soulSock.send({ type: 'remember', ev: { type: ev.type, text: soulEventText(ev) }, tl: soulTl() }).catch(() => {});
      return SOUL_BRAINS.local.remember(ev);
    },
    async whisper(req) {
      try {
        const r = await soulSock.send({ type: 'whisper', input: req.input, talk: req.talk, chapter: req.chapter, history: req.history, tl: soulTl(), vis: soulVis() }, 25000);
        if (r.blocked) return { text: pick(['（她把纸揉成一团，扔回你脸上。）', '……这种话，本小姐不收。']), emotion: '生气', src: 'guard' };
        if (r.text) return { text: r.text, emotion: r.emotion || '', src: 'llm' };
      } catch (e) { /* 连不上：走离线 */ }
      return Object.assign(await SOUL_BRAINS.local.whisper(req), { src: 'local' });
    },
  },
};
// —— 与 galLingS 的连接：一个 WebSocket，按 id 配对请求和回复；断了下次用时自动重连 ——
const soulSock = {
  ws: null, url: '', seq: 0, wait: {}, info: null, state: 'off',
  open() {
    const c = soulCfg(), base = HOSTED ? (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws/soul' : (pref('soulUrl') || 'ws://127.0.0.1:8765/ws/soul');
    const url = base + (base.includes('?') ? '&' : '?') + 'card=' + encodeURIComponent(c?.card || 'whale');
    if (this.ws && this.url === url && this.ws.readyState <= 1) return this.ready;
    if (this.state === 'bad' && this.url === url && Date.now() - this.t0 < 30000) return Promise.reject(new Error('刚才连不上，30 秒后再试'));
    this.t0 = Date.now();
    try { this.ws?.close(); } catch (e) {}
    this.url = url; this.info = null; this.state = 'wait';
    this.ready = new Promise((ok, no) => {
      let ws; try { ws = new WebSocket(url); } catch (e) { this.state = 'bad'; return no(e); }
      this.ws = ws;
      const t = setTimeout(() => { this.state = 'bad'; no(new Error('timeout')); try { ws.close(); } catch (e) {} }, 4000);
      ws.onopen = () => ws.send(JSON.stringify({ type: 'hello' }));
      ws.onerror = () => { clearTimeout(t); this.state = 'bad'; no(new Error('连不上')); };
      ws.onclose = () => { if (this.state === 'wait') { clearTimeout(t); this.state = 'bad'; no(new Error('连不上')); } this.state = this.state === 'ok' ? 'off' : this.state; Object.values(this.wait).forEach(w => w.no(new Error('断开'))); this.wait = {}; };
      ws.onmessage = ev => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.type === 'hello') { clearTimeout(t); this.info = m; this.state = 'ok'; ok(m); return; }
        const w = m.id != null && this.wait[m.id]; if (!w) return;
        delete this.wait[m.id]; clearTimeout(w.t); m.type === 'error' ? w.no(new Error(m.message)) : w.ok(m);
      };
    });
    this.ready.catch(() => {});
    return this.ready;
  },
  async send(msg, timeout = 8000) {
    await this.open();
    const id = ++this.seq;
    return new Promise((ok, no) => {
      const t = setTimeout(() => { delete this.wait[id]; no(new Error('timeout')); }, timeout);
      this.wait[id] = { ok, no, t };
      this.ws.send(JSON.stringify(Object.assign({ id }, msg)));
    });
  },
  close() { try { this.ws?.close(); } catch (e) {} this.ws = null; this.state = 'off'; },
};
// 给灵枢记忆的事件原文（不是她的口吻，是发生了什么）
function soulEventText(ev) {
  const ch = chapterAt(RT.idx);
  if (ev.type === 'choice') return `${ch ? '「' + ch + '」' : ''}${ev.timeout ? '限时选项，玩家什么都没说' : '玩家选择了：' + ev.text}${ev.delta ? '（好感' + (ev.delta > 0 ? '+' : '') + ev.delta + '）' : ''}`;
  if (ev.type === 'ending') return `玩家走到了结局「${ev.text}」`;
  return String(ev.text || '');
}
// 记忆时间线（和 galLingS 的规则一样）：lineage = 这条时间线，turn = 回合；读档 = 开一条新 lineage，旧的只看到存档那一刻
function soulTl() { const T = RT.soul.tl; T.turn++; return { lineage: T.lin, turn: T.turn }; }
function soulVis() { const T = RT.soul.tl; return [...T.anc, { lineage: T.lin, turn: 2 ** 53 }]; }
const soulNewTl = () => ({ lin: 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), turn: 0, anc: [] });
const soulBackend = () => (HOSTED && !window.GALLINGS_OFFLINE && !(window.parent && window.parent !== window && window.parent.GALLINGS_OFFLINE)) ? 'galLingS' : (pref('soulBackend') || 'local');
const soulBrain = () => SOUL_BRAINS[soulBackend()] || SOUL_BRAINS.local;
function soulAdd(list, item) {
  const S = RT.soul; if (!S) return;
  if (item.lid && S[list].some(x => x.lid === item.lid && x.k === item.k)) return;   // 读档后重放同一句，不重复记
  S[list].push(Object.assign({ ch: chShort(chapterAt(RT.idx)) }, item)); S.unread++; SOUL_REV++; soulTabUpd(true);
}
function soulRemember(ev, lid) {
  if (!soulCfg()) return;
  soulAdd('mem', { k: ev.type, src: ev.text, t: soulBrain().remember(ev), lid });
}
// 每进入一节：信号变量涨了 → 收集一条；台词里出现“第N条” → 记进规矩页
function soulOnLine(l, before) {
  const c = soulCfg(); if (!c || !RT.soul) return;
  const S = RT.soul, txt = fillVars(l.text);
  if (c.signal && +RT.vars[c.signal] > +(before[c.signal] ?? 0)) soulSignal(l.id);
  let re; try { re = new RegExp(c.rule); } catch (e) { re = null; }
  const lastRule = S.rules[S.rules.length - 1];
  if (re && txt && re.test(txt) && !/^@/.test(txt)) soulAdd('rules', { k: 'rule', t: txt.replace(/^『|』$/g, ''), lid: l.id, at: RT.idx });
  else if (lastRule && lastRule.at === RT.idx - 1 && /^『/.test(txt) && !lastRule.more) { lastRule.t += txt.replace(/^『|』$/g, ''); lastRule.more = 1; lastRule.at = RT.idx; }
}
// 信号对应的描写：本句或后面三句里第一句“（……）”括号旁白
function soulSignal(lid) {
  let t = '';
  for (let i = RT.idx; i < Math.min(P.lines.length, RT.idx + 4); i++) { const x = P.lines[i].text || ''; if (/^[（(]/.test(x)) { t = x.replace(/^[（(]|[）)]$/g, ''); break; } if (P.lines[i].choices?.length && i > RT.idx) break; }
  soulAdd('sig', { k: 'sig', t: t || (soulCfg().signal + '轻轻动了一下。'), lid });
}
function soulOnChoice(c, before, timedOut) {
  const cfg = soulCfg(); if (!cfg) return;
  const d = (+RT.vars[cfg.aff] || 0) - (+before[cfg.aff] || 0);
  soulRemember({ type: 'choice', text: c.text, delta: d, timeout: timedOut }, P.lines[RT.idx].id + ':' + c.text);
  if (cfg.signal && +RT.vars[cfg.signal] > +(before[cfg.signal] ?? 0)) soulSignal(P.lines[RT.idx].id + ':c');
}
// —— 界面 ——
function soulTabUpd(news) {
  const tab = $('#soulTab'), on = !!soulCfg() && soulMode() !== 'off' && playing;
  tab.classList.toggle('show', on && !SOUL_DOCK);
  tab.classList.toggle('new', on && (RT.soul?.unread || 0) > 0);
  if (news && on) retrigger(tab, 'wig');
}
let soulPage = 'mem';
function showSoul(page) {
  const c = soulCfg(), dock = SOUL_DOCK;
  if (dock && (!c || !RT.soul || !playing)) { dock.innerHTML = `<div class="hd">${ic('book-heart')}<span>${esc(c?.char || '')}的手账</span></div><div class="pg"><div class="empty">${c ? '开始游戏后，她会在这里记下你们的事。' : '这部作品没有手账。'}</div></div>`; return; }
  if (!c || !RT.soul) return;
  if (!dock) { clearTimeout(RT.timer); RT.timer = null; }
  soulPage = page || soulPage; RT.soul.unread = 0; soulTabUpd();
  const S = RT.soul, box = dock || $('#soul');
  const keep = dock && dock.querySelector('#soulIn'), keepV = keep?.value || '', keepF = keep && dock.ownerDocument.activeElement === keep;
  const tabs = [['mem', 'brain', '她记得的事'], ['sig', 'waves', (c.signal || '信号') + '收集'], ['talk', 'feather', '悄悄话'], ['rules', 'list-ordered', '规矩']]
    .filter(t => t[0] !== 'sig' || c.signal);
  const item = x => `<div class="it"><small>${esc(x.ch || '')}</small><p>${esc(x.t)}</p></div>`;
  let body = '';
  if (soulPage === 'mem') body = S.mem.length ? S.mem.slice().reverse().map(item).join('') : `<div class="empty">还什么都没写。</div>`;
  if (soulPage === 'sig') body = `<div class="cnt">${ic('waves')} × ${S.sig.length}</div>` + (S.sig.length ? S.sig.slice().reverse().map(item).join('') : `<div class="empty">尾巴很老实。暂时。</div>`);
  if (soulPage === 'rules') body = S.rules.length ? S.rules.map((x, i) => `<div class="it rule"><b>${i + 1}</b><p>${esc(x.t)}</p></div>`).join('') : `<div class="empty">还没有约定。</div>`;
  if (soulPage === 'talk') {
    const left = soulLeft();
    body = `<div class="talk">${S.talk.map(x => x.me ? `<div class="me"><p>${esc(x.t)}</p></div>` : `<div class="her">${soulFace(x.e)}<p>${esc(x.t)}</p></div>`).join('') || `<div class="empty">在这页写一句话，她会回。</div>`}</div>
      <div class="win"><input id="soulIn" maxlength="60" autocomplete="off" spellcheck="false" placeholder="${left === 0 ? '这一话的纸写满了' : '写给' + esc(c.char) + '……'}" ${left === 0 ? 'disabled' : ''}><button class="btn" id="soulSend" data-tip="soulSend" ${left === 0 ? 'disabled' : ''}>${ic('send')}</button></div>
      <div class="left">${soulBackend() === 'galLingS' ? `<i class="dot ${soulSock.state}"></i>${soulSock.state === 'ok' ? '灵枢在线' : '灵枢未连上，先用离线回复'}　` : ''}${left == null ? '' : '这一话还能写 ' + left + ' 句'}</div>`;
  }
  box.innerHTML = `<div class="hd">${ic('book-heart')}<span>${esc(c.char)}的手账</span></div>
    <div class="tabs">${tabs.map(t => `<button data-sp="${t[0]}" class="${t[0] === soulPage ? 'on' : ''}" title="${t[2]}">${ic(t[1])}</button>`).join('')}</div>
    <div class="pg">${body}</div>`;
  box.querySelectorAll('[data-sp]').forEach(b => b.onclick = e => { e.stopPropagation(); showSoul(b.dataset.sp); });
  box.onclick = e => e.stopPropagation();
  if (!dock) { addClose(box, kick); box.classList.add('show'); }
  const tk = box.querySelector('.talk'); if (tk) tk.scrollTop = tk.scrollHeight;
  const inp = box.querySelector('#soulIn');
  if (inp && dock) { inp.value = keepV; if (keepF) inp.focus({ preventScroll: true }); }
  if (inp) {
    const send = () => soulWhisper(inp.value);
    inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter' && !e.isComposing) send(); };
    box.querySelector('#soulSend').onclick = e => { e.stopPropagation(); send(); };
    if (!dock && !matchMedia('(pointer:coarse)').matches) inp.focus({ preventScroll: true });
  }
}
function hideSoul() { $('#soul').classList.remove('show'); kick(); }
const soulLeft = () => { const c = soulCfg(); if (soulMode() === 'free') return null; return Math.max(0, c.limit - (RT.soul.used[chShort(chapterAt(RT.idx))] || 0)); };
function soulFace(emo) {
  const c = soulCfg(), all = Object.values(P.assets).filter(a => a.type === 'ch');
  const a = all.find(x => x.name === c.char + '_' + emo) || all.find(x => x.name === c.char) || all.find(x => x.name.startsWith(c.char + '_'));
  return `<i class="face" style="background-image:${a ? esc(cssUrl(SOUL_DOCK && !/^(data|blob|https?):/.test(a.src) ? new URL(a.src, location.href).href : a.src)) : 'none'}"></i>`;
}
async function soulWhisper(text) {
  text = String(text || '').trim(); const c = soulCfg(), S = RT.soul;
  if (!text || !c || S.busy || soulLeft() === 0) return;
  const ch = chShort(chapterAt(RT.idx));
  { const i = (SOUL_DOCK || $('#soul')).querySelector('#soulIn'); if (i) i.value = ''; }
  S.used[ch] = (S.used[ch] || 0) + 1; S.talk.push({ me: 1, t: text }); S.busy = 1;
  showSoul('talk');
  const tk = (SOUL_DOCK || $('#soul')).querySelector('.talk'), wait = document.createElement('div'); wait.className = 'wait'; wait.textContent = `（${c.signal ? '她的' + c.signal + '动了动' : '她低头想了想'}，好像在想怎么回……）`; tk.appendChild(wait); tk.scrollTop = tk.scrollHeight;
  let r;
  try {
    r = await soulBrain().whisper({ protocol: 'vn-soul/1', char: c.char, input: text, talk: pref('soulTalk') || 'mid', chapter: ch, vars: clone(RT.vars),
      memory: S.mem.slice(-20), history: S.talk.slice(-10), fast: !!window.VN_SOUL_FAST });
  } catch (e) { r = { text: '……（纸被海风吹走了。）', emotion: '' }; }
  S.busy = 0; S.talk.push({ t: String(r?.text || '……').slice(0, 300), e: r?.emotion || '', src: r?.src || 'local' });
  if (S.talk.length > 60) S.talk.splice(0, S.talk.length - 60);
  SOUL_REV++;
  if (SOUL_DOCK || $('#soul').classList.contains('show')) showSoul('talk');
}
function soulForget() {   // 全部遗忘：清空手账，开一条新时间线，灵枢里旧的记忆从此不可见（剧情进度不变）
  if (!RT.soul) return;
  const keep = RT.soul.used; RT.soul = soulFresh(); RT.soul.used = keep; SOUL_REV++; soulTabUpd();
}
// 设置页里的“灵枢”一组
function soulPrefsHtml() {
  const c = soulCfg(); if (!c) return '';
  const seg = (k, def, opts) => `<div class="seg">${opts.map(([v, t]) => `<button class="tg ${(pref(k) || def) === v ? 'on' : ''}" data-seg="${k}" data-v="${v}">${t}</button>`).join('')}</div>`;
  return `<div class="row sep"><span>${ic('book-heart')} 灵枢</span><small class="dim">${esc(c.char)}的手账</small></div>
    <div class="row"><span>陪伴</span>${seg('soulMode', 'mix', [['off', '纯剧本'], ['mix', '剧本+即兴'], ['free', '自由']])}</div>
    <div class="row"><span>她的话量</span>${seg('soulTalk', 'mid', [['short', '简短'], ['mid', '适中'], ['long', '话多']])}</div>
    <div class="row"><span>记忆</span><small class="dim">${playing && RT.soul ? RT.soul.mem.length + ' 条' : '开始游戏后记录'}</small>${playing && RT.soul ? `<button class="tg" data-soul="forget">${ic('eraser')} 全部遗忘</button>` : ''}</div>
    ${HOSTED ? `<div class="row"><span>连接</span><small class="dim">galLingS（模型、记忆在 galLingS 设置里统一管理）</small><i class="dot ${soulSock.state}" id="soulDot"></i></div>` : `<div class="row"><span>连接</span>${seg('soulBackend', 'local', [['local', '离线'], ['galLingS', 'galLingS']])}<i class="dot ${(pref('soulBackend') || 'local') === 'local' ? 'ok' : soulSock.state}" id="soulDot"></i></div>
    <div class="row ${(pref('soulBackend') || 'local') === 'galLingS' ? '' : 'hid'}" id="soulUrlRow"><span>后端地址</span><input id="soulUrl" value="${esc(pref('soulUrl') || 'ws://127.0.0.1:8765/ws/soul')}" spellcheck="false"><button class="tg" data-soul="test">${ic('plug')} 测试</button></div>
    <div class="row ${(pref('soulBackend') || 'local') === 'galLingS' ? '' : 'hid'}" id="soulInfoRow"><span></span><small class="dim" id="soulInfo">${soulSock.state === 'ok' && soulSock.info ? '已连上：' + esc(soulSock.info.card?.name || '') : ''}</small></div>`}`;
}
function soulPrefsBind(box) {
  box.querySelectorAll('[data-seg]').forEach(b => b.onclick = e => {
    e.stopPropagation(); setPref(b.dataset.seg, b.dataset.v);
    box.querySelectorAll(`[data-seg="${b.dataset.seg}"]`).forEach(x => x.classList.toggle('on', x === b));
    if (b.dataset.seg === 'soulBackend') { box.querySelector('#soulUrlRow').classList.toggle('hid', b.dataset.v !== 'galLingS'); box.querySelector('#soulInfoRow').classList.toggle('hid', b.dataset.v !== 'galLingS'); if (b.dataset.v === 'local') soulSock.close(); const d = box.querySelector('#soulDot'); d.className = 'dot' + (b.dataset.v === 'local' ? ' ok' : ''); }
    soulTabUpd();
  });
  const url = box.querySelector('#soulUrl'); if (url) { url.onkeydown = e => e.stopPropagation(); url.onchange = () => setPref('soulUrl', url.value.trim()); }
  box.querySelector('[data-soul=forget]')?.addEventListener('click', e => {
    e.stopPropagation(); if (!confirm('让她忘掉这一局记下的所有事？（剧情进度不变）')) return;
    soulForget(); showPrefs();
  });
  box.querySelector('[data-soul=test]')?.addEventListener('click', e => {
    e.stopPropagation(); const d = box.querySelector('#soulDot'), info = box.querySelector('#soulInfo');
    setPref('soulUrl', url.value.trim()); soulSock.close(); d.className = 'dot wait'; info.textContent = '连接中……';
    soulSock.open().then(h => { d.className = 'dot ok'; info.textContent = `已连上：${h.card?.name || ''}　模型${h.llm ? '可用' : '未配置（用离线回复）'}　记忆${h.memory ? '可用' : '关闭'}`; })
      .catch(er => { d.className = 'dot bad'; info.textContent = '连不上（' + er.message + '），会自动用离线回复'; });
  });
}
/* ========== 角色扮演 Agent 接口 ========== */
// 约定：任何“大脑”只要实现  chat(request) → Promise<{ text, emotion?, set?, end? }>  就能接进来。
// 内置两个：mock（离线模拟，用来调流程）、http（POST 到你自己的后端，密钥只放后端）。
// 也可以在控制台或插件里 VNAgent.register('名字', async (req, settings) => ({ text: '...' }))。
const VNAgent = {
  providers: {},
  register(name, fn) { this.providers[name] = fn; },
  async chat(req) { const fn = this.providers[(RT.chat && RT.chat.provider) || P.settings.agentProvider] || this.providers.mock; return fn(req, P.settings, RT.chat); }
};
window.VNAgent = VNAgent;
VNAgent.register('mock', async req => {
  await new Promise(r => setTimeout(r, 300));
  const n = req.history.filter(h => h.role === 'player').length;
  const pool = ['嗯……你是这么想的啊。', '这样说的话，我好像能理解一点了。', '你总是会说出让人意外的话呢。', '好吧，我记住了。'];
  return { text: '（模拟）' + pool[(n - 1) % pool.length], emotion: '', end: false };
});
VNAgent.register('http', async (req, s) => {
  if (!s.agentUrl) throw new Error('没有设置接口地址');
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 30000);
  try {
    const r = await fetch(s.agentUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req), signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    if (typeof j?.text !== 'string') throw new Error('返回格式不对');
    return j;
  } finally { clearTimeout(t); }
});
function buildAgentRequest(C, input) {
  const l = C.line, c = charOf(l.agent.char) || { name: l.agent.char, persona: '' };
  return {
    protocol: 'vn-agent/1',
    character: { name: c.name, persona: c.persona || '', expressions: exprNames(c.name) },
    scene: { goal: l.agent.goal || '', setup: l.text || '', background: A(l.bg)?.name || '', turn: C.turn + 1, maxTurns: C.max },
    vars: clone(RT.vars),
    allowedVars: P.vars.map(v => v.name),
    history: C.history.slice(-20),        // 最后一条就是本次玩家输入
    input
  };
}
function startChat(l) {
  RT.auto = RT.skip = false; updPctl();
  RT.chat = { line: l, turn: 0, max: Math.max(1, +l.agent.turns || 6), history: [], busy: false, ending: false };
  $('#pin').classList.add('show'); $('#pinput').value = ''; $('#pinput').placeholder = '';
  setTimeout(() => $('#pinput').focus({ preventScroll: true }), 30);
  VNPlugins.emit('chat:start', RT.chat);
}
async function sendChat() {
  const C = RT.chat; if (!C || C.busy || C.ending) return;
  const input = $('#pinput').value.trim().slice(0, 300); if (!input) return;
  $('#pinput').value = ''; C.busy = true;
  C.history.push({ role: 'player', text: input }); RT.back.push({ s: '你', t: input });
  setName($('#pnm'), C.line.agent.char); $('#ptx').textContent = '……';
  let res;
  try { res = await VNAgent.chat(buildAgentRequest(C, input)); }
  catch (e) { res = { text: '（连接失败：' + e.message + '）' }; }
  if (RT.chat !== C) return;                       // 玩家已经离开
  C.busy = false; C.turn++;
  const text = String(res.text ?? '').slice(0, 1000);
  C.history.push({ role: 'character', text }); RT.back.push({ s: C.line.agent.char, t: text });
  if (res.set) safeSet(String(res.set), RT.vars, P.vars.map(v => v.name));
  if (res.emotion) applyEmotion(C.line.agent.char, String(res.emotion));
  typeText(text, () => { if (res.end || C.turn >= C.max) endChat(); else $('#pinput').focus({ preventScroll: true }); });
}
function endChat() { if (!RT.chat || RT.chat.ending) return; RT.chat.ending = true; $('#pin').classList.remove('show'); VNPlugins.emit('chat:end', RT.chat); }
function applyEmotion(name, emo) {
  const target = Object.values(P.assets).find(a => a.type === 'ch' && charKey(a) === name && splitName(a.name)[1] === emo);
  if (!target || !lastShown) return;
  layer.querySelectorAll('.spr').forEach(img => {
    const s = lastShown.sprites.find(x => x.uid === img.dataset.uid);
    if (s && A(s.asset) && charKey(A(s.asset)) === name) img.src = target.src;
  });
}
$('#pinput').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); sendChat(); } });
$('#pinEnd').addEventListener('click', e => { e.stopPropagation(); endChat(); if (typer) finishTyping(); advance(); });
$('#pin').addEventListener('click', e => e.stopPropagation());

/* ========== 弹窗：批量台词 / 设置 ========== */
function modal(html, onOk) {
  const m = $('#modal'), box = m.querySelector('.box');
  m._onClose = null;
  box.innerHTML = html + `<div class="act"><button data-a="c">取消</button>${onOk ? '<button class="pri" data-a="o">确定</button>' : ''}</div>`;
  m.style.display = 'flex';
  const close = closeModal;
  box.querySelector('[data-a=c]').onclick = close;
  if (onOk) box.querySelector('[data-a=o]').onclick = () => { onOk(box); close(); };
  m.onclick = e => { if (e.target === m) close(); };
  return box;
}
function closeModal() { const m = $('#modal'); m.style.display = 'none'; const f = m._onClose; m._onClose = null; f?.(); }
function openBatch() {
  const box = modal(`<textarea placeholder="小明：早上好\n小红：早。\n（旁白可以不写名字）"></textarea>`, b => batchInsert(b.querySelector('textarea').value));
  box.querySelector('textarea').focus();
}
function openSettings() {
  const s = P.settings;
  const seg = (k, opts) => `<div class="seg" data-k="${k}">` + opts.map(([v, t]) => `<button data-v="${v}" class="${s[k] === v ? 'on' : ''}">${t}</button>`).join('') + '</div>';
  const box = modal(`
    <div class="row"><span>标题</span><input data-i="title" value="${esc(P.title)}"></div>
    <div class="row"><span>提示</span>${seg('tip', [['brief', '简略'], ['normal', '默认'], ['detail', '详细']])}</div>
    <div class="row"><span>对话框</span><input type="range" min="0.05" max="0.9" step="0.05" value="${s.ghost}" data-r="ghost"></div>
    <div class="row"><span>文字速度</span><input type="range" min="5" max="80" step="5" value="${85 - s.speed}" data-r="speed"></div>
    <div class="row"><span>${ic('music')}</span><input type="range" min="0" max="1" step="0.05" value="${s.vbgm}" data-r="vbgm"></div>
    <div class="row"><span>${ic('bell')}</span><input type="range" min="0" max="1" step="0.05" value="${s.vse}" data-r="vse"></div>
    <div class="row"><span>${ic('waves')}</span><input type="range" min="0" max="1" step="0.05" value="${s.vamb ?? 0.8}" data-r="vamb"></div>
    <div class="row"><span>${ic('bot')}</span>${seg('agentProvider', [['mock', '模拟'], ['http', '接口'], ...VNPlugins.providers()])}</div>
    <div class="row"><span>接口</span><input data-i="agentUrl" value="${esc(s.agentUrl)}" placeholder="http://localhost:8787/agent"></div>`,
    b => {
      b.querySelectorAll('.seg').forEach(g => { const on = g.querySelector('.on'); if (on) s[g.dataset.k] = on.dataset.v; });
      s.ghost = +b.querySelector('[data-r=ghost]').value;
      s.speed = 85 - +b.querySelector('[data-r=speed]').value;
      s.vbgm = +b.querySelector('[data-r=vbgm]').value; s.vse = +b.querySelector('[data-r=vse]').value; s.vamb = +b.querySelector('[data-r=vamb]').value;
      P.title = b.querySelector('[data-i=title]').value.trim();
      s.agentUrl = b.querySelector('[data-i=agentUrl]').value.trim();
      changed();
    });
  box.querySelectorAll('.seg button').forEach(btn => btn.onclick = () => {
    btn.parentNode.querySelectorAll('button').forEach(x => x.classList.remove('on')); btn.classList.add('on');
  });
}
// 通用“表格编辑”弹窗：变量、角色都用它
function listEditor(rows, fields, onOk) {
  rows = clone(rows);
  const box = modal('<div class="list"></div><div class="act" style="justify-content:flex-start;margin-top:8px"><button data-a="add">' + ic('plus') + '</button></div>', () => onOk(rows));
  const list = box.querySelector('.list');
  const draw = () => {
    list.innerHTML = '';
    rows.forEach((r, k) => {
      const wrap = document.createElement('div'); wrap.className = fields.some(f => f.wide) ? 'ch' : '';
      const line = document.createElement('div'); line.className = 'li';
      fields.forEach(f => {
        const el = document.createElement(f.wide ? 'textarea' : 'input');
        if (f.type) el.type = f.type;
        if (f.type === 'checkbox') {
          el.checked = !!r[f.key]; el.onchange = () => { r[f.key] = el.checked; };
          const lb = document.createElement('label'); lb.style.cssText = 'display:flex;gap:4px;align-items:center;color:var(--dim);font-size:12px;white-space:nowrap';
          lb.append(el, f.ph || ''); line.appendChild(lb); return;
        }
        el.value = r[f.key] ?? ''; el.placeholder = f.ph || ''; if (f.w) el.style.width = f.w;
        if (f.wide) el.className = 'small';
        el.oninput = () => { r[f.key] = el.value; };
        (f.wide ? wrap : line).appendChild(el);
      });
      const x = document.createElement('button'); x.innerHTML = ic('x'); x.className = 'mini';
      x.style.cssText = 'border:0;background:none;color:var(--dim);cursor:pointer';
      x.onclick = () => { rows.splice(k, 1); draw(); };
      line.appendChild(x); wrap.prepend(line); list.appendChild(wrap);
    });
  };
  box.querySelector('[data-a=add]').onclick = () => { const o = {}; fields.forEach(f => o[f.key] = f.def ?? ''); rows.push(o); draw(); list.scrollTop = list.scrollHeight; };
  draw();
  return box;
}
function openVars() {
  const box = listEditor(P.vars, [{ key: 'name', ph: '名字', w: '180px' }, { key: 'init', ph: '初始值', w: '120px', def: '0' }, { key: 'global', type: 'checkbox', ph: '跨周目' }], rows => {
    const seen = new Set();
    P.vars = rows.map(r => ({ name: String(r.name).trim(), init: String(r.init ?? '').trim(), global: r.global ? true : undefined }))
      .filter(r => IDENT.test(r.name) && !BUILTIN_VARS.includes(r.name) && !seen.has(r.name) && seen.add(r.name));
    changed();
  });
  // 说明 + 测试用：清空本机的周目记录
  const info = document.createElement('div'); info.style.cssText = 'color:var(--dim);font-size:12px;margin-top:8px;display:flex;gap:10px;align-items:center';
  info.innerHTML = '<span>内置：周目、结局数（只读）。勾“跨周目”的变量重新开始游戏也会保留。</span><button class="mini">清空周目记录</button>';
  info.querySelector('button').onclick = () => { if (confirm('清空本机的结局、CG、跨周目变量记录？')) { loadG(); resetG(); } };
  box?.querySelector('.list')?.after(info);
}
function openChars() {
  listEditor(P.chars, [{ key: 'name', ph: '名字', w: '160px' }, { key: 'color', type: 'color', def: '#ffffff' }, { key: 'persona', ph: '人物设定（性格、说话方式、背景，给 Agent 用）', wide: true }], rows => {
    P.chars = rows.map(r => ({ name: String(r.name).trim(), color: r.color || '#ffffff', persona: String(r.persona || '') })).filter(r => r.name);
    changed();
  });
}
// 检查器：找出剧本里的问题
function runCheck() {
  const out = [], labs = {};
  const declared = new Set([...P.vars.map(v => v.name), ...BUILTIN_VARS]), undef = new Map();
  const useVars = (src, isSet, i) => exprIdents(src, isSet).forEach(k => { if (!declared.has(k) && !undef.has(k)) undef.set(k, i); });
  P.lines.forEach((l, i) => { if (l.label) { if (labs[l.label] != null) out.push([i, '标签重复：' + l.label]); else labs[l.label] = i; } });
  const has = n => labs[n] != null;
  P.lines.forEach((l, i) => {
    let m;
    if (l.bg && !A(l.bg)) out.push([i, '背景素材丢失']);
    if (l.sprites.some(s => !A(s.asset))) out.push([i, '立绘素材丢失']);
    if ((l.bgm && !A(l.bgm)) || (l.se && !A(l.se)) || (l.amb && !A(l.amb)) || (l.amb2 && !A(l.amb2))) out.push([i, '音频素材丢失']);
    if (isPause(l) && !l.bg && !l.sprites.length && !l.fx && !l.mood) out.push([i, '空台词']);
    if (l.fx && !fxName(l.fx)) out.push([i, '未知特效：' + l.fx]);
    if (l.mood && !moodName(l.mood)) out.push([i, '未知氛围：' + l.mood]);
    if (l.voice && !A(l.voice)) out.push([i, '配音素材丢失']);
    if (l.jump && !has(l.jump)) out.push([i, '跳转目标不存在：' + l.jump]);
    if ((m = exprError(l.jumpIf, false))) out.push([i, '跳转条件：' + m]);
    if ((m = exprError(l.set, true))) out.push([i, '变量修改：' + m]);
    useVars(l.jumpIf, false, i); useVars(l.set, true, i);
    if (l.ctime > 0 && l.cdef && !l.choices.some(c => c.target === l.cdef)) out.push([i, '限时选项的超时默认不是这一句的选项：' + l.cdef]);
    l.choices.forEach(c => {
      if (!c.text) out.push([i, '选项没有文字']);
      if (c.target && !has(c.target)) out.push([i, '选项目标不存在：' + c.target]);
      if ((m = exprError(c.cond, false))) out.push([i, '选项条件：' + m]);
      if ((m = exprError(c.set, true))) out.push([i, '选项效果：' + m]);
      useVars(c.cond, false, i); useVars(c.set, true, i);
    });
    if (l.agent) {
      if (!l.agent.char) out.push([i, 'Agent 没有选角色']);
      else if (!charOf(l.agent.char)?.persona) out.push([i, 'Agent 角色没有人物设定（在“角色”里写）']);
      if (l.agent.exit && !has(l.agent.exit)) out.push([i, 'Agent 结束目标不存在：' + l.agent.exit]);
    }
  });
  undef.forEach((i, k) => out.push([i, '变量没有定义：' + k]));
  // 可达性：从第 1 句出发，顺着“下一句 / 跳转 / 选项”走一遍，走不到的就是死句
  const seen = new Set(), stack = [0];
  while (stack.length) {
    const i = stack.pop();
    if (i == null || i < 0 || i >= P.lines.length || seen.has(i)) continue;
    seen.add(i);
    const l = P.lines[i];
    const fall = () => { if (l.jump && has(l.jump)) { stack.push(labs[l.jump]); if (l.jumpIf) stack.push(i + 1); } else stack.push(i + 1); };
    if (l.agent) stack.push(l.agent.exit && has(l.agent.exit) ? labs[l.agent.exit] : i + 1);
    else if (l.ending && !l.choices.length) { /* 结局：到这里结束 */ }
    else if (l.choices.length) { l.choices.forEach(c => stack.push(c.target && has(c.target) ? labs[c.target] : i + 1)); if (l.choices.every(c => c.cond)) fall(); }
    else fall();
  }
  for (let i = 0; i < P.lines.length; i++) {
    if (seen.has(i)) continue;
    let j = i; while (j + 1 < P.lines.length && !seen.has(j + 1)) j++;
    out.push([i, j > i ? `第 ${i + 1}–${j + 1} 句永远走不到` : '这句永远走不到']);
    i = j;
  }
  out.push(...VNPlugins.checks());
  return out.sort((a, b) => a[0] - b[0]);
}
function openCheck() {
  const res = runCheck();
  const box = modal('<div class="list"></div>', () => {});
  const list = box.querySelector('.list');
  if (!res.length) { list.innerHTML = '<div class="ok">' + ic('circle-check') + '</div>'; return; }
  res.forEach(([i, msg]) => {
    const d = document.createElement('div'); d.className = 'li go';
    const n = document.createElement('span'); n.className = 'n'; n.textContent = '#' + (i + 1);
    const t = document.createElement('span'); t.textContent = msg;
    d.append(n, t);
    d.onclick = () => { closeModal(); goto(i); };
    list.appendChild(d);
  });
}

/* ========== 文件：新建 / 打开 / 保存 / 导出脚本 ========== */
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function saveFile() { await inlineAll(); download('project.vnproj.json', JSON.stringify(withInline(), (k, v) => k === '_inline' ? undefined : v), 'application/json'); Object.values(P.assets).forEach(a => delete a._inline); }
function exportScript() { download('script.txt', scriptText(), 'text/plain'); }
// 旁白若会被读成“说话人：台词”、指令或注释，前面加一个反斜杠（导入时去掉），保证导出→导入无损
const SPK_RE = /^([^：:「“"『（(【‘@\s][^：:「“"『（(【‘]{0,15})[：:]\s*(.*)$/;
function narrLine(t) { t = String(t ?? ''); return (SPK_RE.test(t) || /^(@|#|\/\/|\\)/.test(t.trim()) || t !== t.trim()) ? '\\' + t : t; }
function scriptText() {
  const out = []; let prevKey = null, prevBgm = null, prevMood = '', prevLook = {}, prevAmb = ['null', 'null'];
  const nm = id => A(id)?.name ?? 'none';
  if (P.title) out.push(`@title ${P.title}`);
  if (P.settings.theme && Object.keys(P.settings.theme).length) { const t = P.settings.theme; out.push(`@theme ${t.preset || 'default'}` + THEME_KEYS.filter(k => t[k] != null && k !== 'img').map(k => ` ${k}=${t[k]}`).join('') + (t.img && A(t.img) ? ` img=${A(t.img).name}` : '')); }
  { const c = P.settings.cover; if (c && A(c.img)) out.push(`@cover ${A(c.img).name}` + ['menu', 'title', 'style', 'ty'].filter(k => c[k] != null).map(k => ` ${k}=${c[k]}`).join('')); }
  { const so = P.settings.soul; if (so?.char) out.push(`@soul ${so.char}` + ['signal', 'aff', 'rule', 'limit', 'card'].filter(k => so[k] != null && so[k] !== '').map(k => ` ${k}=${so[k]}`).join('')); }
  { const u = P.settings.uiSe; if (u) { const kv = [...UI_SE_KEYS.filter(k => u[k] && A(u[k])).map(k => `${k}=${A(u[k]).name}`), ...['favorVar', 'tailVar'].filter(k => u[k]).map(k => `${k}=${u[k]}`)]; if (kv.length) out.push('@uise ' + kv.join(' ')); } }
  out.push(...VNPlugins.exportLines());
  P.vars.forEach(v => out.push(`@var ${v.name} = ${v.init}${v.global ? ' global' : ''}`));
  Object.values(P.assets).filter(a => a.type === 'bg' && a.cg != null && a.cg !== /^cg[_\-\s]/i.test(a.name)).forEach(a => out.push(`@cg ${a.name}${a.cg ? '' : ' off'}`));
  P.chars.forEach(c => out.push(`@char ${c.name} color=${c.color}${c.persona ? ' persona=' + c.persona.replace(/\n/g, '\\n') : ''}`));
  P.lines.forEach(l => {
    if (l.chapter) out.push('', `@chapter ${l.chapter}`);
    if (l.label) out.push('', `@label ${l.label}`);
    const k = visKey(l);
    if (k !== prevKey) {
      if (l.trans !== 'fade') out.push(`@trans ${l.trans}`);
      out.push(`@bg ${nm(l.bg)}`, '@clear');
      l.sprites.forEach(s => out.push(`@show ${nm(s.asset)} x=${Math.round(s.x)} y=${Math.round(s.y)} h=${Math.round(s.h)}${s.flip ? ' flip' : ''}${s.in ? ' in=' + s.in : ''}${s.out ? ' out=' + s.out : ''}${s.look ? ' look=' + s.look : ''}`));
      prevKey = k; prevLook = {};
      l.sprites.forEach(s => { if (A(s.asset)) prevLook[charKey(A(s.asset))] = s.look || ''; });
    } else l.sprites.forEach(s => {   // 画面没变、只是外观变了：写 @look
      const a = A(s.asset); if (!a) return; const ck = charKey(a);
      if ((s.look || '') !== (prevLook[ck] || '')) { out.push(`@look ${ck} ${s.look || 'none'}`); prevLook[ck] = s.look || ''; }
    });
    if (l.bgm !== prevBgm) { out.push(l.bgm ? `@bgm ${nm(l.bgm)}` : '@bgm stop'); prevBgm = l.bgm; }
    [['amb', 'ambv'], ['amb2', 'amb2v']].forEach(([f, fv], k) => { const key = l[f] ? l[f] + '|' + l[fv] : 'null';
      if (key !== prevAmb[k]) { out.push(l[f] ? `@${f} ${nm(l[f])}${(l[fv] ?? 0.6) !== 0.6 ? ' vol=' + l[fv] : ''}` : `@${f} stop`); prevAmb[k] = key; } });
    if (l.se) out.push(`@se ${nm(l.se)}`);
    if ((l.mood || '') !== prevMood) { out.push(`@mood ${l.mood || 'none'}`); prevMood = l.mood || ''; }
    if (l.fx) out.push(`@fx ${l.fx}`);
    Object.entries(l.acts || {}).forEach(([c, v]) => out.push(`@act ${c} ${v}`));
    if (l.voice) out.push(`@voice ${nm(l.voice)}`);
    if (l.set) out.push(`@set ${l.set}`);
    if (isPause(l)) out.push(`@pause ${l.wait || 2}`);
    else { if (l.wait > 0) out.push(`@wait ${l.wait}`); out.push(l.speaker ? `${l.speaker}：${l.text}` : narrLine(l.text)); }
    if (l.agent) out.push(`@agent ${l.agent.char} turns=${l.agent.turns}${l.agent.exit ? ' exit=' + l.agent.exit : ''} goal=${l.agent.goal}`);
    l.choices.forEach(c => out.push(`@choice ${c.text} -> ${c.target || '(next)'}${c.cond ? ' if ' + c.cond : ''}${c.set ? ' do ' + c.set : ''}`));
    if (l.choices.length && l.ctime > 0) out.push(`@timeout ${l.ctime}${l.cdef ? ' -> ' + l.cdef : ''}`);
    if (l.jump) out.push(`@jump ${l.jump}${l.jumpIf ? ' if ' + l.jumpIf : ''}`);
    if (l.ending) out.push(`@ending ${l.ending}`);
  });
  return out.join('\n').trim() + '\n';
}
// 导出游戏：把“本工具自己的网页” + 项目数据打包成一个 html，打开即进入标题画面
async function exportGame() {
  const problems = runCheck().filter(([, m]) => !m.startsWith('空台词') && !m.includes('走不到'));
  if (problems.length && !confirm(`检查发现 ${problems.length} 个问题，仍然导出？`)) return openCheck();
  await inlineAll();
  const html = buildGameHtml(withInline());
  Object.values(P.assets).forEach(a => delete a._inline);
  if (!html) return alert('导出失败');
  download((P.title || 'game').replace(/[\\/:*?"<>|]/g, '_') + '.html', html, 'text/html');
}
function buildGameHtml(proj) {
  const src = window.VN_SOURCE_HTML || ORIGINAL_HTML;
  const data = JSON.stringify(Object.assign({}, proj || P, { recent: undefined, cur: 0 }), (k, v) => k === '_inline' || k === 'file' ? undefined : v).replace(/</g, '\\u003c');
  const extTag = '<script src="game.js"><\/script>', extIdx = src.indexOf(extTag);
  if (extIdx >= 0) return src.slice(0, extIdx) + '<script>window.VN_GAME=' + data + ';<\/script>' + src.slice(extIdx + extTag.length);
  const pTag = '<script src="player.js"><\/script>', pIdx = src.indexOf(pTag);
  if (pIdx >= 0) return src.slice(0, pIdx) + '<script>window.VN_GAME=' + data + ';<\/script>\n' + src.slice(pIdx);
  const marker = '<script>\n\'use strict\';';
  const i = src.indexOf(marker);
  if (i < 0) return null;
  return src.slice(0, i) + '<script>window.VN_GAME=' + data + ';<\/script>\n' + src.slice(i);
}
function loadProject(o) {
  const b = blank();
  P = Object.assign(b, o);
  P.settings = Object.assign(b.settings, o.settings || {});
  if (!P.id) P.id = uid();
  if (!Array.isArray(P.lines) || !P.lines.length) P.lines = [mkLine()];
  P.lines = P.lines.map(normLine);
  P.vars = Array.isArray(P.vars) ? P.vars : [];
  P.chars = Array.isArray(P.chars) ? P.chars : [];
  P.plugins = Array.isArray(P.plugins) ? P.plugins.filter(r => r && typeof r.code === 'string') : [];
  P.settings.pluginData = P.settings.pluginData && typeof P.settings.pluginData === 'object' ? P.settings.pluginData : {};
  P.assets = P.assets || {};
  if (studioEditor && window.VNArtLibrary) {
    for (const a of Object.values(P.assets)) if (a.libraryPath && !window.VN_PREVIEW_ONLY && !a.src?.startsWith('data:') && !a.src?.startsWith('blob:')) a.src = window.VNArtLibrary.resolve(a.libraryPath);
    window.VNArtLibrary.register();
  }
  P.recent = Object.assign({ bg: [], ch: [], au: [] }, P.recent);
  P.cur = Math.max(0, Math.min(P.lines.length - 1, P.cur | 0));
  hist = []; redoS = []; selUid = null; TL.sel = null; TL.lastCur = -1; if(gameMode){applyTheme();}else{applyTlh();changed();}
  if (!gameMode) VNPlugins.reload();
}

/* ========== 按钮与快捷键 ========== */
$('#bNew').onclick = () => { if (confirm(DIR ? '新建项目？（当前项目已自动保存在文件夹里，之后新项目存在浏览器）' : '清空当前项目？（建议先点“保存”）')) { DIR = null; idbSet('folder', null); savedAssets.clear(); loadProject(blank()); renderButtons(); } };
$('#bOpen').onclick = () => $('#fProj').click();
$('#fProj').onchange = async e => {
  const f = e.target.files[0];
  if (f) { try { const o = JSON.parse(await f.text()); if (!o || !Array.isArray(o.lines)) throw 0; loadProject(o); } catch (err) { alert('文件无法读取'); } }
  e.target.value = '';
};
$('#bSave').onclick = saveFile;
$('#bTheme').onclick = openTheme;
$('#bPlug').onclick = openPlugins;
$('#bFolder').onclick = folderMenu;
$('#bExport').onclick = exportScript;
$('#bGame').onclick = exportGame;
let impType = null;
$('#bImport').onclick = () => { impType = null; $('#fImg').click(); };
document.querySelectorAll('[data-imp]').forEach(b => b.onclick = () => { impType = b.dataset.imp; $('#fImg').click(); });
$('#fImg').onchange = async e => { await importFiles([...e.target.files], impType); e.target.value = ''; };
$('#bUndo').onclick = undo; $('#bRedo').onclick = redo;
$('#bBatch').onclick = openBatch;
$('#bLink').onclick = () => { P.settings.link = !P.settings.link; changed(); };
const DLG = ['ghost', 'hidden', 'show'];
$('#bDlg').onclick = () => { P.settings.dlg = DLG[(DLG.indexOf(P.settings.dlg) + 1) % 3]; changed(); };
$('#bPlay').onclick = () => startPlay();
$('#bSet').onclick = openSettings;
$('#bProps').onclick = toggleProps;
$('#bVars').onclick = openVars;
$('#bChars').onclick = openChars;
$('#bCheck').onclick = openCheck;
$('#chSel').onchange = e => goto(+e.target.value);
$('#bSide').onclick = () => { const s = $('#side'); s.classList.toggle('collapsed'); $('#bSide').innerHTML = ic(s.classList.contains('collapsed') ? 'panel-left-open' : 'panel-left-close'); setTimeout(fit, 170); };

document.addEventListener('keydown', e => {
  if ($('#modal').style.display === 'flex') { if (e.key === 'Escape') closeModal(); return; }
  if (playing) {
    if (e.isComposing) return;
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if (typing && document.activeElement !== $('#pinput')) return;
    if (document.activeElement === $('#pinput')) { if (e.key === 'Escape') $('#pinput').blur(); return; }
    if (e.key === 'Escape') {
      const open = [...document.querySelectorAll('.ovl.show')].filter(o => o.id !== 'title');
      if (open.length) { open.forEach(o => o.classList.remove('show')); return kick(); }
      if (!$('#title').classList.contains('show') || !gameMode) void leaveForTitle();
      return;
    }
    if (overlayOpen() || ([' ', 'Enter'].includes(e.key) && e.target.closest('button,summary,[role=button]'))) return;
    if (e.key.toLowerCase() === 'h' && !e.ctrlKey && !overlayOpen()) return setHideUI(!stage.classList.contains('hideui'));
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); if (stage.classList.contains('hideui')) return setHideUI(false); return advance(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); if (stage.classList.contains('hideui')) setHideUI(false); return goBack(); }
    if (e.key === 'Control' && !RT.skip && !RT.chat) { RT.skip = true; RT.auto = false; updPctl(); kick(); }
    if (e.key.toLowerCase() === 'a' && !e.ctrlKey) { RT.auto = !RT.auto; RT.skip = false; updPctl(); kick(); }
    return;
  }
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  const ctrl = e.ctrlKey || e.metaKey, key = e.key.toLowerCase();
  if (ctrl && key === 's') { e.preventDefault(); return saveFile(); }
  if (ctrl && key === 'o') { e.preventDefault(); return $('#fProj').click(); }
  if (ctrl && key === 'b') { e.preventDefault(); return openBatch(); }
  if (ctrl && key === 'd') { e.preventDefault(); return duplicateLine(); }
  if (e.key === 'F5') { e.preventDefault(); return startPlay(); }
  if (e.altKey && e.shiftKey && e.key === 'ArrowUp') { e.preventDefault(); return moveLine(-1); }
  if (e.altKey && e.shiftKey && e.key === 'ArrowDown') { e.preventDefault(); return moveLine(1); }
  if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); return goto(P.cur - 1); }
  if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); return goto(P.cur + 1); }
  if (typing) return;   // 打字时其余快捷键不生效
  if (ctrl && key === 'z') { e.preventDefault(); return e.shiftKey ? redo() : undo(); }
  if (ctrl && key === 'y') { e.preventDefault(); return redo(); }
  if (ctrl && key === 'c' && TL.sel) { e.preventDefault(); return copyClip(); }
  if (ctrl && key === 'v' && TL.clip) { e.preventDefault(); return pasteClip(); }
  if (ctrl) return;
  if (e.key === 'Escape') { TL.sel = null; selUid = null; return changed(); }
  if ((e.key === 'Delete' || e.key === 'Backspace') && TL.sel) { const sc = selClip(); if (sc && !locked(sc.lane.id)) deleteClip(sc.lane, sc.c); return; }
  if (e.key === 'Home') { e.preventDefault(); return goto(0); }
  if (e.key === 'End') { e.preventDefault(); return goto(P.lines.length - 1); }
  if (selIndex() < 0 && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); return goto(P.cur + (e.key === 'ArrowLeft' ? -1 : 1)); }
  if (e.key === 'Tab') { e.preventDefault(); return $('#bDlg').click(); }
  if (key === 'l') return $('#bLink').click();
  if (key === 'p') return toggleProps();
  if (e.key === 'Enter') { e.preventDefault(); if (P.settings.dlg === 'hidden') { P.settings.dlg = 'ghost'; changed(); } return $('#tx').focus(); }
  if (selIndex() < 0) return;
  if (e.key === 'Delete' || e.key === 'Backspace') return spriteOp('del');
  if (key === 'f') return spriteOp('flip');
  if (key === 'e') return spriteOp('expr');
  if (e.key === 'PageUp') { e.preventDefault(); return spriteOp('front'); }
  if (e.key === 'PageDown') { e.preventDefault(); return spriteOp('back'); }
  const step = e.shiftKey ? 10 : 1;
  const mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
  if (mv) { e.preventDefault(); const si = selIndex(); edit(l => { const s = l.sprites[si]; if (s) { s.x += mv[0]; s.y += mv[1]; } }); }
});
document.addEventListener('keyup', e => { if (playing && e.key === 'Control' && RT.skip) { RT.skip = false; updPctl(); kick(); } });
/* —— 时间轴交互 —— */
const tls = $('#tlScroll');
const beatAt = x => Math.floor((x - $('#tlInner').getBoundingClientRect().left - HEAD) / bw());
tls.addEventListener('wheel', e => {
  if (e.ctrlKey || e.metaKey) { e.preventDefault(); return setZoom(bw() * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX - tls.getBoundingClientRect().left); }
  if (e.target.closest('.thead')) return;          // 在轨道名上滚 = 上下滚
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); tls.scrollLeft += e.deltaY; }
}, { passive: false });
function dragOn(e, el, onMove, onUp) {
  const x0 = e.clientX; let moved = false, d = 0, alt = e.altKey;
  el.setPointerCapture?.(e.pointerId);
  const mv = ev => { const dx = ev.clientX - x0; alt = ev.altKey; if (!moved && Math.abs(dx) < 4) return; moved = true; d = Math.round(dx / bw()); onMove(d, ev); };
  const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); onUp(moved, d, alt); };
  el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}
function scrubTo(t) {
  t = Math.max(0, Math.min(P.lines.length - 1, t)); if (t === P.cur) return;
  P.cur = t; selUid = null; TL.sel = null;
  renderStage(L(), true); renderDialog(); renderChoicesEdit();
  $('#ph').style.left = HEAD + t * bw() + 'px'; $('#tlPos').textContent = `${t + 1} / ${P.lines.length}`;
}
tls.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  const hb = e.target.closest('.thead button');
  if (hb) { const id = hb.closest('.trow').dataset.lane, m = trk()[hb.dataset.t] = trk()[hb.dataset.t] || {}; m[id] = !m[id]; return changed(); }
  if (e.target.closest('.thead,.tclip .x,.tadd')) return;
  const row = e.target.closest('.trow'); if (!row) return;
  const laneId = row.dataset.lane, w = bw();
  if (laneId === 'ruler') { scrubTo(beatAt(e.clientX)); return dragOn(e, e.target, (d, ev) => scrubTo(beatAt(ev.clientX)), () => changed()); }
  const tc = e.target.closest('.tclip');
  if (tc) {
    const i = +tc.dataset.i, left0 = parseFloat(tc.style.left);
    return dragOn(e, tc, d => { tc.classList.add('ghost'); tc.style.left = left0 + d * w + 'px'; },
      (moved, d) => { if (!moved) return goto(i); if (!moveText(i, i + d)) renderTimeline(); });
  }
  const cl = e.target.closest('.clip');
  if (cl) {
    const lane = laneById(laneId), c = { i: +cl.dataset.i, j: +cl.dataset.j }, t = beatAt(e.clientX);
    if (locked(laneId)) return selectClip(laneId, c, t);
    const side = e.target.classList.contains('hr') ? 'r' : e.target.classList.contains('hl') ? 'l' : null;
    const left0 = parseFloat(cl.style.left), width0 = parseFloat(cl.style.width);
    return dragOn(e, cl, d => {
      cl.classList.add('ghost');
      if (side === 'r') cl.style.width = Math.max(w - 2, width0 + d * w) + 'px';
      else if (side === 'l') { const dd = Math.min(d, c.j - c.i); cl.style.left = left0 + dd * w + 'px'; cl.style.width = width0 - dd * w + 'px'; }
      else cl.style.left = left0 + d * w + 'px';
    }, (moved, d, alt) => {
      if (!moved) return selectClip(laneId, c, t);
      const ok = side ? trimClip(lane, c, side, (side === 'r' ? c.j : c.i) + d) : moveClip(lane, c, d, alt);
      if (!ok) renderTimeline();
    });
  }
  const t = beatAt(e.clientX);
  if (t >= 0 && t < P.lines.length) goto(t);
});
tls.addEventListener('click', e => {
  const x = e.target.closest('.tclip .x'); if (x) return deleteLine(+x.closest('.tclip').dataset.i);
  if (e.target.closest('.tadd')) { goto(P.lines.length - 1); continueLine(); }
});
tls.addEventListener('dragover', e => { e.preventDefault(); tls.classList.add('drop'); });
tls.addEventListener('dragleave', e => { if (!tls.contains(e.relatedTarget)) tls.classList.remove('drop'); });
tls.addEventListener('drop', async e => {
  e.preventDefault(); e.stopPropagation(); tls.classList.remove('drop');
  const t = Math.max(0, Math.min(P.lines.length - 1, beatAt(e.clientX)));
  const aid = e.dataTransfer.getData('text/vn-asset');
  const onLane = e.target.closest?.('.trow')?.dataset.lane;
  if (aid) return dropAssetAt(aid, t, onLane);
  const ids = await importFiles([...e.dataTransfer.files]);
  ids.forEach((id, k) => dropAssetAt(id, Math.min(P.lines.length - 1, t + k)));
});
$('#tlZoom').oninput = e => setZoom(+e.target.value);
$('#tlIn').onclick = () => setZoom(bw() * 1.3);
$('#tlOut').onclick = () => setZoom(bw() / 1.3);
$('#tlFit').onclick = () => setZoom((tls.clientWidth - HEAD - 70) / P.lines.length);
$('#tlSplit').addEventListener('pointerdown', e => {
  const y0 = e.clientY, h0 = $('#tl').offsetHeight, el = e.target;
  el.setPointerCapture?.(e.pointerId);
  const mv = ev => { P.settings.tlh = Math.max(120, Math.min(innerHeight - 220, h0 - (ev.clientY - y0))); applyTlh(); };
  const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); autosave(); };
  el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
});

/* ========== 悬停提示 ========== */
const tipEl = $('#tip'); let tipT;
document.addEventListener('mouseover', e => {
  const t = e.target.closest('[data-tip]');
  clearTimeout(tipT); tipEl.style.display = 'none';
  if (!t || (playing && !t.closest('#pctl,#pin'))) return;
  tipT = setTimeout(() => {
    const d = TIPS[t.dataset.tip]; if (!d) return;
    const lv = P.settings.tip;
    let h = `<b>${d[0]}</b>`;
    if (lv !== 'brief' && d[1]) h += `<span class="k">${d[1]}</span>`;
    if (lv !== 'brief' && d[2]) h += `<div>${d[2]}</div>`;
    if (lv === 'detail' && d[3]) h += `<div>${d[3]}</div>`;
    tipEl.innerHTML = emoIc(h); tipEl.style.display = 'block';
    const r = t.getBoundingClientRect(), tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2, y = r.bottom + 6;
    if (y + th > innerHeight) y = r.top - th - 6;
    tipEl.style.left = Math.max(4, Math.min(innerWidth - tw - 4, x)) + 'px'; tipEl.style.top = y + 'px';
  }, 350);
});
document.addEventListener('pointerdown', () => { clearTimeout(tipT); tipEl.style.display = 'none'; });


/* ========== AI 调试接口 VNStudio（vn-cmd/1） ==========
   让 AI 或脚本不用点按钮，直接用 JSON 命令驱动工具创作。
   浏览器里：await VNStudio.exec([{op:'say', speaker:'小红', text:'早上好'}])
   命令行里：node vn-cli.js run 项目.json 命令.json（无界面，见 AI_API.md）
   一批命令 = 一次撤销；默认“要么全成功，要么全不改”。 */
const POS = { farleft: 220, left: 380, center: 640, right: 900, farright: 1060 };
const POS_CN = { 最左: 'farleft', 左: 'left', 中: 'center', 右: 'right', 最右: 'farright' };
const posName = x => Object.keys(POS).find(k => Math.abs(POS[k] - x) <= 20) || String(Math.round(x));
class CmdError extends Error {}
const fail = m => { throw new CmdError(m); };
function hue(str) { let h = 0; for (const ch of String(str)) h = (h * 31 + ch.codePointAt(0)) % 360; return h; }
// 占位图：还没有美术时先用色块占位，以后同名导入真图会自动替换
function placeholder(name, type) {
  const h = hue(splitName(name)[0]), t = String(name).replace(/[<&>"]/g, '');
  const svg = type === 'bg'
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${h},35%,38%)"/><stop offset="1" stop-color="hsl(${h},30%,16%)"/></linearGradient></defs><rect width="1280" height="720" fill="url(#g)"/><text x="640" y="380" font-size="64" text-anchor="middle" fill="#ffffff88" font-family="sans-serif">${t}</text></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="900"><g fill="hsl(${h},45%,60%)" fill-opacity=".85"><circle cx="200" cy="170" r="110"/><path d="M60 900 Q60 330 200 310 Q340 330 340 900Z"/></g><text x="200" y="600" font-size="44" text-anchor="middle" fill="#fff" font-family="sans-serif">${t}</text></svg>`;
  return { src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), w: type === 'bg' ? 1280 : 400, h: type === 'bg' ? 720 : 900 };
}
const API = { warn: [] };
// 灵枢手账开关：'off' / '角色 signal=尾鳍 …' / {char, signal, aff, rule, limit}
// 界面音效：@uise choiceShow=UI_选项出现 cg=UI_CG ... [favorVar=好感] [tailVar=尾鳍]；@uise off 清空
// 字符串或对象都行；值是音频素材名（或 id），存成 id；值写 none 去掉这个键
API.setUiSe = a => {
  if (typeof a === 'string') { a = a.trim(); if (!a || a === 'off' || a === 'none') { delete P.settings.uiSe; return null; } const o = {}; a.replace(/(\w+)=(\S+)/g, (_, k, v) => { o[k] = v; return ''; }); a = o; }
  if (!a || a.off) { delete P.settings.uiSe; return null; }
  const u = Object.assign({}, P.settings.uiSe);
  for (const [k, v] of Object.entries(a)) {
    if (k === 'op') continue;
    if (k === 'favorVar' || k === 'tailVar') { if (!IDENT.test(String(v))) fail(k + ' 不是合法的变量名：' + v); u[k] = String(v); continue; }
    if (!UI_SE_KEYS.includes(k)) fail('不认识的界面音效：' + k + '（可用：' + UI_SE_KEYS.join(' / ') + '）');
    if (v == null || v === '' || v === 'none') delete u[k]; else u[k] = API.asset(String(v), 'au');
  }
  P.settings.uiSe = u; return u;
};
API.setSoul = a => {
  if (typeof a === 'string') { a = a.trim(); if (!a || a === 'off' || a === 'none') { delete P.settings.soul; return null; } const [n, ...rest] = a.split(/\s+/); const o = {}; rest.join(' ').replace(/(\w+)=(\S+)/g, (_, k, v) => { o[k] = v; return ''; }); a = Object.assign({ char: n }, o); }
  if (!a || !a.char || a.char === 'off') { delete P.settings.soul; return null; }
  const o = { char: String(a.char) }; ['signal', 'aff', 'rule', 'card'].forEach(k => { if (a[k] != null && a[k] !== '') o[k] = String(a[k]); });
  if (a.limit != null && a.limit !== '') o.limit = Math.max(0, parseInt(a.limit) || 0);
  if (o.rule) try { new RegExp(o.rule); } catch (e) { fail('rule 不是合法的正则：' + o.rule); }
  P.settings.soul = o; return o;
};
// 找素材：先按 id，再按名字；立绘可以只写角色名（找“角色”“角色_默认”或该角色任意表情）
API.asset = (ref, type, auto = true) => {
  if (ref == null || ref === 'none' || ref === '') return null;
  if (P.assets[ref]) return ref;
  const all = Object.values(P.assets).filter(a => !type || a.type === type || (type === 'au' && (a.type === 'bgm' || a.type === 'se' || a.type === 'vo')));
  let a = all.find(a => a.name === ref);
  if (!a && type === 'ch') a = all.find(a => a.name === ref + '_默认') || all.find(a => charKey(a) === ref);
  if (a) return a.id;
  if (!auto || type === 'au' || !type) fail('找不到素材：' + ref);
  if (type === 'bgm' || type === 'se' || type === 'vo') fail('找不到音频素材：' + ref + '（音频不能自动占位）');
  API.warn.push(`素材「${ref}」不存在，已用占位图代替`);
  return API.addAsset({ name: ref, type });
};
API.addAsset = o => {
  const type = o.type; if (!['bg', 'ch', 'bgm', 'se', 'vo'].includes(type)) fail('素材类型必须是 bg / ch / bgm / se / vo');
  const name = String(o.name || '').trim(); if (!name) fail('素材需要名字');
  let rec = o.src ? { src: o.src, w: o.w, h: o.h, dur: o.dur } : (type === 'bg' || type === 'ch') ? placeholder(name, type) : fail('音频素材必须提供 src');
  if ((type === 'bg' || type === 'ch') && !rec.w) { rec.w = type === 'bg' ? 1280 : 400; rec.h = type === 'bg' ? 720 : 900; }
  const old = Object.values(P.assets).find(a => a.name === name && a.type === type);
  const id = old ? old.id : uid();
  P.assets[id] = Object.assign({ id, type, name }, rec, old && old.cg != null ? { cg: old.cg } : {}, o.cg != null ? { cg: !!o.cg } : {});
  if (old) { cssDone.delete(id); savedAssets.delete(id); }   // 同名再导入 = 替换图片（占位图换真图）
  touchRecent(id);
  return id;
};
API.setTheme = c => {
  const o = {};
  if (c.preset) { if (!THEMES[c.preset]) fail('预设只能是 ' + Object.keys(THEMES).join(' / ')); o.preset = c.preset; }
  for (const k of THEME_KEYS) {
    if (c[k] == null || c[k] === '') continue;
    let v = c[k];
    if (['box', 'text', 'name', 'accent'].includes(k) && !/^#[0-9a-f]{6}$/i.test(v)) fail(k + ' 要写成 #rrggbb');
    if (['alpha', 'size', 'radius'].includes(k)) { v = +v; if (isNaN(v)) fail(k + ' 要是数字'); }
    if (k === 'font' && !FONTS[v]) fail('font 只能是 ' + Object.keys(FONTS).join(' / '));
    if (k === 'layout' && !['float', 'wide'].includes(v)) fail('layout 只能是 float / wide');
    if (k === 'img') v = API.asset(v, null, false);
    o[k] = v;
  }
  P.settings.theme = c.preset ? o : Object.assign({}, P.settings.theme || {}, o);
  if (typeof stage !== 'undefined') applyTheme();
};
API.setCover = c => {
  if (c == null || c === 'none' || c.img === 'none' || c.img === '') { delete P.settings.cover; return null; }
  const o = Object.assign({}, P.settings.cover || {});
  if (c.img != null) o.img = API.asset(c.img, 'bg');
  if (!o.img) fail('封面要指定一张背景图：img=名字');
  if (c.menu != null) { if (!['center', 'left', 'right'].includes(c.menu)) fail('menu 只能是 center / left / right'); o.menu = c.menu; }
  if (c.title != null) { if (!['center', 'left', 'hide'].includes(c.title)) fail('title 只能是 center / left / hide'); o.title = c.title; }
  if (c.style != null) { if (!['glass', 'theme'].includes(c.style)) fail('style 只能是 glass / theme'); o.style = c.style; }
  if (c.ty != null && c.ty !== '') { o.ty = +c.ty; if (isNaN(o.ty)) fail('ty 要是数字'); }
  P.settings.cover = o; return o;
};
API.cgMark = (ref, on) => { const id = API.asset(ref, 'bg', false); P.assets[id].cg = !!on; };
// 定位某一节：数字（从 0 开始）、'cur'、'end'、'next'、标签名、台词 id
API.at = (v, def = P.cur) => {
  if (v == null) return def;
  if (typeof v === 'number') { if (v < 0 || v >= P.lines.length) fail('没有第 ' + v + ' 节'); return v; }
  if (v === 'cur') return P.cur;
  if (v === 'end') return P.lines.length - 1;
  if (v === 'next') return Math.min(P.cur + 1, P.lines.length - 1);
  if (/^\d+$/.test(v)) return API.at(+v);
  let i = labelIndex(v); if (i >= 0) return i;
  i = P.lines.findIndex(l => l.id === v); if (i >= 0) return i;
  fail('找不到位置：' + v);
};
API.range = c => { const a = API.at(c.from ?? c.at); const b = c.to != null ? API.at(c.to) : c.beats ? Math.min(P.lines.length - 1, a + c.beats - 1) : a; if (b < a) fail('to 不能在 from 前面'); return [a, b]; };
API.sprite = (c, a, ref) => {
  const as = A(a), x = c.x != null ? +c.x : c.pos != null ? (POS[c.pos] ?? POS[POS_CN[c.pos]] ?? fail('pos 只能是 ' + Object.keys(POS).join('/'))) : ref ? ref.x : SLOTS[0];
  const o = { uid: ref?.uid || uid(), asset: a, x, y: c.y != null ? +c.y : ref ? ref.y : H, h: c.h != null ? +c.h : ref ? ref.h : (as.w > as.h ? 360 : 660), flip: c.flip != null ? !!c.flip : ref ? ref.flip : false };
  const inV = c.in ?? ref?.in, outV = c.out ?? ref?.out;
  if (inV) { if (!SPR_IN.some(x => x[0] === inV)) fail('in 只能是 ' + SPR_IN.map(x => x[0]).filter(Boolean).join('/')); o.in = inV; }
  if (outV) { if (!SPR_OUT.some(x => x[0] === outV)) fail('out 只能是 ' + SPR_OUT.map(x => x[0]).filter(Boolean).join('/')); o.out = outV; }
  const lkV = c.look ?? ref?.look;
  if (lkV && lkV !== 'none') { if (!lookOk(lkV)) fail('look 只能是 none/' + LOOKS.map(x => x[0]).filter(Boolean).join('/')); o.look = lkV; }
  const fitV = c.sceneFit ?? ref?.sceneFit;
  if (fitV && typeof fitV === 'object') o.sceneFit = clone(fitV);
  return o;
};
const TEXT_EDITABLE = ['speaker', 'text', 'label', 'chapter', 'trans', 'fx', 'mood', 'wait', 'set', 'jump', 'jumpIf', 'choices'];
function checkExprs(o) {
  let m;
  if (o.fx && !fxName(o.fx)) fail('特效只能是 ' + FX.map(x => x[0]).join(' / '));
  if (o.mood && !moodName(o.mood)) fail('氛围只能是 ' + MOODS.map(x => x[0]).join(' / '));
  if (o.set && (m = exprError(o.set, true))) fail('变量修改写错：' + m);
  if (o.jumpIf && (m = exprError(o.jumpIf, false))) fail('跳转条件写错：' + m);
}
function newLineAfter(i, fields) {
  const base = P.lines[i], l = mkLine(base);
  P.lines.splice(i + 1, 0, l); P.cur = i + 1;
  return Object.assign(l, fields);
}
function lineView(l, i) {
  const nm = id => A(id)?.name ?? '?';
  return {
    i, id: l.id, label: l.label || undefined, chapter: l.chapter || undefined, speaker: l.speaker, text: l.text,
    bg: l.bg ? nm(l.bg) : null, sprites: l.sprites.map(s => ({ asset: nm(s.asset), pos: posName(s.x), y: Math.round(s.y), h: Math.round(s.h), flip: s.flip || undefined, in: s.in, out: s.out, look: s.look })), acts: Object.keys(l.acts || {}).length ? l.acts : undefined, voice: l.voice ? nm(l.voice) : undefined,
    bgm: l.bgm ? nm(l.bgm) : null, amb: l.amb ? nm(l.amb) : undefined, ambv: l.amb ? l.ambv : undefined, amb2: l.amb2 ? nm(l.amb2) : undefined, amb2v: l.amb2 ? l.amb2v : undefined, se: l.se ? nm(l.se) : undefined, mood: l.mood || undefined, wait: l.wait || undefined, pause: isPause(l) || undefined, trans: l.trans !== 'fade' ? l.trans : undefined, fx: l.fx || undefined,
    set: l.set || undefined, jump: l.jump || undefined, jumpIf: l.jumpIf || undefined,
    choices: l.choices.length ? l.choices : undefined, agent: l.agent || undefined, ending: l.ending || undefined, cg: (l.bg && isCG(A(l.bg))) || undefined
  };
}
// 一行文字描述一节，给 AI “看”画面
function lineText(l, i) {
  const v = lineView(l, i), p = [`#${i}`];
  if (v.chapter) p.push(`[章:${v.chapter}]`);
  if (v.label) p.push(`[标签:${v.label}]`);
  p.push(v.pause ? `🎬演出 ${l.wait || 2}秒(无对话框)` : v.speaker ? `${v.speaker}：${v.text}` : v.text);
  p.push(`| 背景=${v.bg ?? '无'}`);
  if (v.sprites.length) p.push('| 立绘=' + v.sprites.map(s => `${s.asset}@${s.pos}${s.flip ? '(翻转)' : ''}${s.look ? '(' + (LOOKS.find(x => x[0] === s.look) || [, , s.look])[2] + ')' : ''}`).join(','));
  if (v.bgm) p.push(`| 音乐=${v.bgm}`);
  if (v.amb || v.amb2) p.push('| 环境音=' + [v.amb && `${v.amb}(${v.ambv})`, v.amb2 && `${v.amb2}(${v.amb2v})`].filter(Boolean).join('+'));
  if (v.se) p.push(`| 音效=${v.se}`);
  if (v.mood) p.push(`| 氛围=${moodName(v.mood)?.[2] || v.mood}`);
  if (v.fx) p.push(`| 特效=${fxName(v.fx)?.[2] || v.fx}`);
  if (v.acts) p.push('| 动作=' + Object.entries(v.acts).map(([c, a]) => c + (SPR_ACT.find(x => x[0] === a)?.[2] || a)).join('、'));
  if (v.voice) p.push(`| 配音=${v.voice}`);
  if (v.set) p.push(`| 变量:${v.set}`);
  if (l.choices.length && l.ctime > 0) p.push(`| 限时${l.ctime}秒(超时→${l.cdef || '最后一个选项'})`);
  if (v.choices) p.push('| 选项:' + v.choices.map(c => `${c.text}→${c.target || '下一句'}${c.cond ? ' 若' + c.cond : ''}${c.set ? ' 并' + c.set : ''}`).join(' / '));
  if (v.jump) p.push(`| 跳转→${v.jump}${v.jumpIf ? ' 若' + v.jumpIf : ''}`);
  if (v.agent) p.push(`| 🤖${v.agent.char}(${v.agent.turns}回合)`);
  if (v.cg) p.push('| CG');
  if (v.ending) p.push(`| 🏁结局:${v.ending}`);
  return p.join(' ');
}

/* —— 文本剧本导入（与“导出脚本”同一格式，可来回转换） —— */
function importScript(text, opt = {}) {
  const lines = [], vis = { bg: null, sprites: [] };
  let pend = {}, bgm = null, mood = '', last = null, amb = { amb: null, ambv: 0.6, amb2: null, amb2v: 0.6 };
  const rows = String(text).split(/\r?\n/);
  const kv = s => { const o = {}; s.replace(/(\w+)=(\S+)/g, (_, k, v) => { o[k] = v; return ''; }); return o; };
  rows.forEach((raw, n) => {
    const r = raw.trim(), err = m => fail(`剧本第 ${n + 1} 行：${m}`);
    if (!r || r.startsWith('#') || r.startsWith('//')) return;
    if (!r.startsWith('@')) {
      const esc = raw.trimStart().startsWith('\\'), m = esc ? null : r.match(SPK_RE);
      const l = mkLine();
      Object.assign(l, { speaker: m ? m[1].trim() : '', text: esc ? raw.trimStart().slice(1).replace(/\r$/, '') : m ? m[2] : r, bg: vis.bg, sprites: clone(vis.sprites), bgm, mood }, amb, pend);
      lines.push(l); last = l; pend = {}; return;
    }
    const sp = r.indexOf(' '), cmd = (sp < 0 ? r : r.slice(0, sp)).slice(1).toLowerCase(), arg = sp < 0 ? '' : r.slice(sp + 1).trim();
    const need = () => last || err(`@${cmd} 必须写在某句台词之后`);
    switch (cmd) {
      case 'title': P.title = arg; break;
      case 'soul': API.setSoul(arg); break;
      case 'cover': { const [n, ...rest] = arg.split(/\s+/); API.setCover(n === 'none' || !n ? null : Object.assign({ img: n }, kv(rest.join(' ')))); break; }
      case 'theme': { const [p, ...rest] = arg.split(/\s+/); API.setTheme(Object.assign({ preset: p }, kv(rest.join(' ')))); break; }
      case 'var': { const m = arg.match(/^(\S+)\s*=\s*(.+?)(\s+global)?$/); if (!m || !IDENT.test(m[1])) err('写法：@var 名字 = 初始值 [global]');
        if (BUILTIN_VARS.includes(m[1])) err(m[1] + ' 是内置变量，不能定义');
        const v = P.vars.find(v => v.name === m[1]), g = m[3] ? true : undefined; if (v) { v.init = m[2].trim(); v.global = g; } else P.vars.push({ name: m[1], init: m[2].trim(), global: g }); break; }
      case 'cg': { const [n, off] = arg.split(/\s+/); API.cgMark(n, off !== 'off'); break; }
      case 'ending': need(); last.ending = arg.trim(); break;
      case 'char': { const m = arg.match(/^(\S+)(.*)$/); if (!m) err('写法：@char 名字 color=#fff persona=设定');
        const pi = m[2].indexOf('persona='), persona = pi >= 0 ? m[2].slice(pi + 8).replace(/\\n/g, '\n') : undefined;
        const o = kv(pi >= 0 ? m[2].slice(0, pi) : m[2]);
        let c = P.chars.find(c => c.name === m[1]); if (!c) P.chars.push(c = { name: m[1], color: '#ffffff', persona: '' });
        if (o.color) c.color = o.color; if (persona != null) c.persona = persona.trim(); break; }
      case 'chapter': pend.chapter = arg; break;
      case 'label': pend.label = arg; break;
      case 'trans': pend.trans = arg; break;
      case 'bg': vis.bg = (arg === 'none' || !arg) ? null : API.asset(arg, 'bg'); break;
      case 'clear': vis.sprites = []; break;
      case 'show': { const m = arg.match(/^(\S+)(.*)$/); if (!m) err('写法：@show 立绘名 pos=left');
        const id = API.asset(m[1], 'ch'), o = kv(m[2]); if (/\bflip\b/.test(m[2])) o.flip = true;
        const k = charKey(A(id)), j = vis.sprites.findIndex(s => charKey(A(s.asset)) === k);
        const s = API.sprite(o, id, j >= 0 ? vis.sprites[j] : null);
        if (o.in) { if (!SPR_IN.some(x => x[0] === o.in)) err('in 只能是 ' + SPR_IN.map(x => x[0]).filter(Boolean).join('/')); s.in = o.in; }
        if (o.out) { if (!SPR_OUT.some(x => x[0] === o.out)) err('out 只能是 ' + SPR_OUT.map(x => x[0]).filter(Boolean).join('/')); s.out = o.out; }
        if (j >= 0) vis.sprites[j] = s; else vis.sprites.push(s); break; }
      case 'hide': vis.sprites = vis.sprites.filter(s => charKey(A(s.asset)) !== arg); break;
      case 'look': { const [ch, v] = arg.split(/\s+/); const j = vis.sprites.findIndex(s => charKey(A(s.asset)) === ch); if (j < 0) err(ch + ' 不在画面上');
        if (!lookOk(v)) err('外观只能是 none/' + LOOKS.map(x => x[0]).filter(Boolean).join('/'));
        const t = Object.assign({}, vis.sprites[j]); if (v && v !== 'none') t.look = v; else delete t.look; vis.sprites[j] = t; break; }
      case 'expr': { const [ch, ex] = arg.split(/\s+/); const j = vis.sprites.findIndex(s => charKey(A(s.asset)) === ch); if (j < 0) err(ch + ' 不在画面上');
        vis.sprites[j] = Object.assign({}, vis.sprites[j], { asset: API.asset(ex === '默认' ? ch : ch + '_' + ex, 'ch') }); break; }
      case 'bgm': bgm = (arg === 'stop' || arg === 'none') ? null : API.asset(arg, 'bgm'); break;
      case 'se': pend.se = API.asset(arg, 'se'); break;
      case 'amb': case 'amb2': { const [n, ...rest] = arg.split(/\s+/), o = kv(rest.join(' '));
        if (!n) err(`写法：@${cmd} 名字 [vol=0.6] 或 @${cmd} stop`);
        if (n === 'stop' || n === 'none') { amb = Object.assign({}, amb, { [cmd]: null }); break; }
        const v = o.vol != null ? +o.vol : 0.6; if (!(v >= 0 && v <= 1)) err('vol 要在 0 到 1 之间');
        amb = Object.assign({}, amb, { [cmd]: API.asset(n, 'au'), [cmd + 'v']: v }); break; }
      case 'uise': API.setUiSe(arg); break;
      case 'voice': pend.voice = API.asset(arg, 'vo'); break;
      case 'act': { const [ch, v] = arg.split(/\s+/); if (!SPR_ACT.some(x => x[0] === v)) err('动作只能是 ' + SPR_ACT.map(x => x[0]).join('/')); pend.acts = Object.assign({}, pend.acts, { [ch]: v }); break; }
      case 'fx': if (!fxName(arg)) err('特效只能是 ' + FX.map(x => x[0]).join(' / ')); pend.fx = arg; break;
      case 'mood': if (arg !== 'none' && !moodName(arg)) err('氛围只能是 none / ' + MOODS.map(x => x[0]).join(' / ')); mood = arg === 'none' ? '' : arg; break;
      case 'wait': if (!(+arg > 0)) err('写法：@wait 秒数'); pend.wait = +arg; break;
      case 'pause': { const l = mkLine(); Object.assign(l, { bg: vis.bg, sprites: clone(vis.sprites), bgm, mood }, amb, pend, { wait: +arg > 0 ? +arg : 0 }); lines.push(l); last = l; pend = {}; break; }
      case 'set': if (exprError(arg, true)) err('变量修改写错：' + exprError(arg, true)); pend.set = pend.set ? pend.set + '; ' + arg : arg; break;
      case 'jump': { need(); const m = arg.match(/^(\S+)(?:\s+if\s+(.+))?$/); if (!m) err('写法：@jump 标签 [if 条件]'); last.jump = m[1]; last.jumpIf = m[2] || ''; break; }
      case 'choice': { need(); const m = arg.match(/^(.+?)\s*->\s*(\S+)(?:\s+if\s+(.+?))?(?:\s+do\s+(.+))?$/); if (!m) err('写法：@choice 选项文字 -> 标签 [if 条件] [do 变量修改]');
        last.choices.push({ text: m[1], target: m[2] === '(next)' ? '' : m[2], cond: m[3] || '', set: m[4] || '' }); break; }
      case 'timeout': { need(); const m = arg.match(/^(\d+(?:\.\d+)?)(?:\s*->\s*(\S+))?$/); if (!m || !(+m[1] > 0)) err('写法：@timeout 秒数 [-> 超时默认的选项标签]'); last.ctime = +m[1]; last.cdef = m[2] || ''; break; }
      case 'agent': { need(); const gi = arg.indexOf('goal='), head = gi >= 0 ? arg.slice(0, gi) : arg, o = kv(head);
        last.agent = { char: head.trim().split(/\s+/)[0], goal: gi >= 0 ? arg.slice(gi + 5).trim() : '', turns: +o.turns || 6, exit: o.exit || '' }; break; }
      default: if (!VNPlugins.runCommand(cmd, arg, { kv, err, need })) err('不认识的命令 @' + cmd + '（如果是插件提供的命令，先在“插件”里装上并启用那个插件）');
    }
  });
  if (!lines.length) fail('剧本里没有台词');
  lines.forEach(checkExprs);
  if (opt.append) { P.lines.splice(P.cur + 1, 0, ...lines); P.cur += 1; }
  else { P.lines = lines; P.cur = 0; }
  return lines.length;
}

const OPS = {
  help: () => Object.keys(OPS),
  info: () => ({ title: P.title, lines: P.lines.length, cur: P.cur, labels: labels(), vars: P.vars, chars: P.chars.map(c => ({ name: c.name, color: c.color })),
    assets: Object.values(P.assets).map(a => ({ id: a.id, type: a.type, name: a.name, placeholder: a.src?.startsWith('data:image/svg+xml') || undefined })) }),
  describe: c => { const [a, b] = c.from == null && c.to == null ? [0, P.lines.length - 1] : API.range(Object.assign({}, c, { to: c.to ?? 'end' })); return P.lines.slice(a, b + 1).map((l, k) => lineText(l, a + k)); },
  get: c => lineView(P.lines[API.at(c.at)], API.at(c.at)),
  check: () => runCheck().map(([i, m]) => ({ i, msg: m })),
  new: c => { loadProject(blank()); P.title = c.title || ''; },
  title: c => { P.title = String(c.text ?? c.title ?? ''); },
  theme: c => { API.setTheme(c); return theme(); },
  cover: c => API.setCover(c),
  plugins: () => (P.plugins || []).map(r => ({ id: r.id, name: r.name, version: r.version, enabled: r.enabled !== false })),
  plugin: c => {     // { op:'plugin', code } 装进项目；{ op:'plugin', id, enabled } 开关；{ op:'plugin', id, remove:true } 卸载
    if (c.code != null) { const m = peekMeta(String(c.code)); P.plugins = (P.plugins || []).filter(r => r.id !== m.id); P.plugins.push({ id: m.id, name: m.name, version: m.version, code: String(c.code), enabled: c.enabled !== false, settings: c.settings || {} }); VNPlugins.reload(); return m; }
    const r = (P.plugins || []).find(r => r.id === c.id); if (!r) fail('项目里没有这个插件：' + c.id);
    if (c.remove) P.plugins = P.plugins.filter(x => x !== r); else if (c.enabled != null) r.enabled = !!c.enabled;
    if (c.settings) r.settings = Object.assign({}, r.settings, c.settings);
    VNPlugins.reload();
  },
  soul: c => API.setSoul(c.char == null || c.char === 'off' || c.char === '' ? 'off' : c),
  asset: c => API.addAsset(c),
  var: c => { if (!IDENT.test(c.name || '')) fail('变量名不合法：' + c.name); if (BUILTIN_VARS.includes(c.name)) fail(c.name + ' 是内置变量'); const v = P.vars.find(v => v.name === c.name); const init = String(c.init ?? 0), g = c.global ? true : undefined; if (v) { v.init = init; if (c.global !== undefined) v.global = g; } else P.vars.push({ name: c.name, init, global: g }); },
  ending: c => { P.lines[API.at(c.at)].ending = String(c.name || '').trim(); },
  cg: c => { API.cgMark(c.asset, c.on !== false); },
  char: c => { if (!c.name) fail('角色需要名字'); let ch = P.chars.find(x => x.name === c.name); if (!ch) P.chars.push(ch = { name: c.name, color: '#ffffff', persona: '' }); if (c.color) ch.color = c.color; if (c.persona != null) ch.persona = String(c.persona); },
  goto: c => { P.cur = API.at(c.at); return P.cur; },
  // 新的一节：沿用当前画面（就像“画面不变、接着写”）。当前是空白第一节时直接填进去
  say: c => {
    const f = {}; TEXT_EDITABLE.forEach(k => { if (c[k] !== undefined) f[k] = c[k]; });
    if (c.se) f.se = API.asset(c.se, 'se');
    checkExprs(f);
    const i = c.at != null ? API.at(c.at) : P.cur, cur = P.lines[i];
    if (P.lines.length === 1 && !cur.text && !cur.speaker && !cur.choices.length) { Object.assign(cur, f); P.cur = 0; return 0; }
    newLineAfter(i, f); return P.cur;
  },
  // 演出节：没有文字，自动隐藏对话框，停 seconds 秒（默认 2）
  pause: c => { const f = { wait: +c.seconds > 0 ? +c.seconds : 0, text: '', speaker: '' }; ['fx', 'mood', 'label', 'chapter', 'set'].forEach(k => { if (c[k] !== undefined) f[k] = c[k]; }); checkExprs(f); const i = c.at != null ? API.at(c.at) : P.cur; newLineAfter(i, f); return P.cur; },
  mood: c => { const v = c.name || c.mood || ''; if (v && v !== 'none' && !moodName(v)) fail('氛围只能是 none / ' + MOODS.map(x => x[0]).join(' / ')); const [a, b] = API.range(c); for (let i = a; i <= b; i++) P.lines[i].mood = v === 'none' ? '' : v; },
  effects: () => ({ fx: FX.map(x => ({ value: x[0], name: x[2] })), mood: MOODS.map(x => ({ value: x[0], name: x[2] })) }),
  lines: c => { const rows = String(c.text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean); rows.forEach(r => { const m = r.match(/^([^：:「“"『（(【‘][^：:「“"『（(【‘]{0,15})[：:]\s*(.*)$/); OPS.say(m ? { speaker: m[1].trim(), text: m[2] } : { speaker: '', text: r }); }); return P.cur; },
  edit: c => { const [a, b] = API.range(c); const f = {}; TEXT_EDITABLE.forEach(k => { if (c[k] !== undefined) f[k] = c[k]; }); if (f.choices) f.choices = f.choices.map(x => Object.assign({ text: '', target: '', cond: '', set: '' }, x)); checkExprs(f); for (let i = a; i <= b; i++) Object.assign(P.lines[i], f); },
  delete: c => { const [a, b] = API.range(c); if (b - a + 1 >= P.lines.length) fail('不能删掉全部台词'); P.lines.splice(a, b - a + 1); P.cur = Math.min(a, P.lines.length - 1); },
  bg: c => { const id = API.asset(c.asset, 'bg'), [a, b] = API.range(c); for (let i = a; i <= b; i++) P.lines[i].bg = id; },
  show: c => {
    const id = API.asset(c.asset, 'ch'), lane = laneById('ch:' + charKey(A(id))), [a, b] = API.range(c);
    for (let i = a; i <= b; i++) { const ref = cellOf(lane, i)?.spr || (i > 0 ? cellOf(lane, i - 1)?.spr : null); putCell(lane, i, { spr: API.sprite(c, id, ref) }); }
  },
  hide: c => { const lane = laneById('ch:' + c.char), [a, b] = API.range(c); for (let i = a; i <= b; i++) putCell(lane, i, null); },
  expr: c => {
    const lane = laneById('ch:' + c.char), id = API.asset(c.expr === '默认' ? c.char : c.char + '_' + c.expr, 'ch'), [a, b] = API.range(c);
    for (let i = a; i <= b; i++) { const s = cellOf(lane, i)?.spr; if (!s) fail(`第 ${i} 节画面上没有 ${c.char}`); putCell(lane, i, { spr: Object.assign(clone(s), { asset: id }) }); }
  },
  // 音乐：不写 to 时，从这一节一直换到“原来那首结束”为止
  bgm: c => {
    const id = API.asset(c.asset, 'bgm'), a = API.at(c.from ?? c.at);
    if (c.to != null || c.beats) { const [, b] = API.range(c); for (let i = a; i <= b; i++) P.lines[i].bgm = id; return; }
    const old = P.lines[a].bgm; for (let i = a; i < P.lines.length && P.lines[i].bgm === old; i++) P.lines[i].bgm = id;
  },
  se: c => { P.lines[API.at(c.at)].se = API.asset(c.asset, 'se'); },
  // 环境音：layer 1（默认）或 2；不写 to 时从这一节一直换到“原来那段环境音结束”为止；asset 为空 / stop = 停
  amb: c => {
    const f = +c.layer === 2 ? 'amb2' : 'amb', fv = f + 'v', id = (c.asset == null || c.asset === 'stop' || c.asset === 'none' || c.asset === '') ? null : API.asset(c.asset, 'au');
    const v = c.vol != null ? +c.vol : 0.6; if (!(v >= 0 && v <= 1)) fail('vol 要在 0 到 1 之间');
    const a = API.at(c.from ?? c.at);
    if (c.to != null || c.beats) { const [, b] = API.range(c); for (let i = a; i <= b; i++) Object.assign(P.lines[i], { [f]: id, [fv]: v }); return; }
    const old = P.lines[a][f], ov = P.lines[a][fv]; for (let i = a; i < P.lines.length && P.lines[i][f] === old && P.lines[i][fv] === ov; i++) Object.assign(P.lines[i], { [f]: id, [fv]: v });
  },
  uise: c => API.setUiSe(c),
  voice: c => { P.lines[API.at(c.at)].voice = c.asset ? API.asset(c.asset, 'vo') : null; },
  // 立绘外观：从 at（或 from）开始，直到角色离场；给 to 则只改到 to；one=true 只改这一节
  look: c => { const v = c.look || c.name || ''; if (!lookOk(v)) fail('look 只能是 none/' + LOOKS.map(x => x[0]).filter(Boolean).join('/')); if (!c.char) fail('look 需要 char');
    const a = API.at(c.from ?? c.at); if (c.to != null) { const b = API.at(c.to); for (let i = a; i <= b; i++) setLookRange(c.char, v, i, true); } else setLookRange(c.char, v, a, !!c.one);
    if (!P.lines[a].sprites.some(s => A(s.asset) && charKey(A(s.asset)) === c.char)) fail(`第 ${a} 节画面上没有 ${c.char}`); },
  // 立绘动作：只在这一节做一次
  act: c => { if (c.act && !SPR_ACT.some(x => x[0] === c.act)) fail('动作只能是 ' + SPR_ACT.map(x => x[0]).join('/')); const l = P.lines[API.at(c.at)]; const o = Object.assign({}, l.acts); if (c.act) o[c.char] = c.act; else delete o[c.char]; l.acts = o; },
  choice: c => { const l = P.lines[API.at(c.at)]; const ch = { text: String(c.text || ''), target: c.target || '', cond: c.cond || '', set: c.set || '' };
    if (ch.cond && exprError(ch.cond, false)) fail('选项条件写错：' + exprError(ch.cond, false)); if (ch.set && exprError(ch.set, true)) fail('选项效果写错：' + exprError(ch.set, true)); l.choices.push(ch); },
  agent: c => { const l = P.lines[API.at(c.at)]; l.agent = c.off ? null : { char: c.char || fail('agent 需要 char'), goal: c.goal || '', turns: +c.turns || 6, exit: c.exit || '' }; },
  extend: c => { const lane = laneById(c.track), t = API.at(c.at), clip = clipAt(lane, t); if (!clip) fail(`第 ${t} 节的 ${c.track} 轨上没有片段`); trimClip(lane, clip, c.side === 'left' ? 'l' : 'r', API.at(c.to)); },
  script: c => importScript(c.text, { append: !!c.append }),
  exportScript: () => scriptText(),
  // 命令行导出游戏文件夹用：assets 里每个素材的 src 已换成相对路径
  gameFolder: c => ({ files: gameFolderFiles(c.assets || {}) }),
  exportGame: () => buildGameHtml(),
  project: c => { const o = clone(P); if (c.noAssets) Object.values(o.assets).forEach(a => { a.src = a.src ? `(${a.src.length} 字节)` : ''; }); return o; },
  load: c => { if (!c.project || !Array.isArray(c.project.lines)) fail('load 需要 project（项目 JSON）'); loadProject(c.project); },
  settings: c => { const s = Object.assign({}, c); delete s.op; Object.assign(P.settings, s); },
  undo: () => fail('undo 只能单独一条命令发送'),
  redo: () => fail('redo 只能单独一条命令发送')
};
async function execCmds(cmds, opt = {}) {
  if (!Array.isArray(cmds)) cmds = [cmds];
  if (cmds.length === 1 && (cmds[0]?.op === 'undo' || cmds[0]?.op === 'redo')) {   // 撤销/重做单独执行
    cmds[0].op === 'undo' ? undo() : redo();
    return { ok: true, results: [{ op: cmds[0].op, ok: true }], warnings: [], cur: P.cur, lines: P.lines.length };
  }
  const atomic = opt.atomic !== false, backup = atomic ? JSON.stringify(P) : null;
  const results = []; API.warn = [];
  snapshot(); batching++;
  let failed = false;
  try {
    for (const c of cmds) {
      const fn = OPS[c?.op] || VNPlugins.op(c?.op);
      try {
        if (!fn) fail('未知命令：' + c?.op + '（可用：' + Object.keys(OPS).join(', ') + '）');
        // 浏览器里给网址/图片却没给尺寸时，先读一下尺寸
        if (c.op === 'asset' && c.src && !headless && (c.type === 'bg' || c.type === 'ch') && !c.w) { try { const im = await loadImg(c.src); c.w = im.naturalWidth; c.h = im.naturalHeight; } catch (e) {} }
        const value = fn(c);
        results.push(value === undefined ? { op: c.op, ok: true } : { op: c.op, ok: true, value });
      } catch (e) {
        results.push({ op: c?.op, ok: false, error: e instanceof CmdError ? e.message : String(e) });
        failed = true; if (opt.stopOnError !== false) break;
      }
    }
  } finally { batching--; }
  if (failed && atomic) { const o = JSON.parse(backup); Object.keys(P).forEach(k => delete P[k]); Object.assign(P, o); hist.pop(); }
  P.cur = Math.max(0, Math.min(P.lines.length - 1, P.cur));
  selUid = null; TL.sel = null; changed();
  return { ok: !failed, rolledBack: failed && atomic, results, warnings: [...new Set(API.warn)], cur: P.cur, lines: P.lines.length };
}
window.VNStudio = { protocol: 'vn-cmd/1', exec: execCmds, ops: () => Object.keys(OPS), describe: () => OPS.describe({}), state: () => P };
// galLingS 作品页（?host=gallings）用的接口：同源，直接调用。手账停靠、设置、存读档、状态都从这里走
if (HOSTED) {
  const PREF_SCHEMA = () => [
    { k: 'vbgm', label: '音乐', type: 'range', min: 0, max: 1, step: 0.05 },
    { k: 'vse', label: '音效', type: 'range', min: 0, max: 1, step: 0.05 },
    { k: 'vamb', label: '环境音', type: 'range', min: 0, max: 1, step: 0.05 },
    { k: 'vvo', label: '语音', type: 'range', min: 0, max: 1, step: 0.05 },
    ...(P.lines.some(l => l.voice) ? [{ k: 'voiceEnabled', label: '语音开关', type: 'bool', def: true }] : []),
    { k: 'readerScale', label: '文字大小', type: 'range', def: 1, min: 1, max: 1.25, step: 0.05 },
    { k: 'speed', label: '文字速度', type: 'range', min: 5, max: 80, step: 5, inv: 85 },
    { k: 'autoMul', label: '自动播放等待', type: 'range', min: 0.4, max: 2.5, step: 0.1 },
    { k: 'skipRead', label: '只快进已读', type: 'bool' },
    ...(soulCfg() ? [
      { k: 'soulMode', label: '陪伴', group: 'soul', type: 'seg', def: 'mix', options: [['off', '纯剧本'], ['mix', '剧本+即兴'], ['free', '自由']] },
      { k: 'soulTalk', label: '她的话量', group: 'soul', type: 'seg', def: 'mid', options: [['short', '简短'], ['mid', '适中'], ['long', '话多']] },
    ] : []),
  ].filter(x=>x.k!=='vvo'||P.lines.some(l=>l.voice)).map(x => Object.assign(x, { value: x.k === 'voiceEnabled' ? voiceEnabledAt(RT.idx) : x.inv ? x.inv - pref(x.k) : (pref(x.k) ?? x.def) }));
  window.VNHost = {
    version: 1, capabilities:{journal:true,audioLibrary:true,modelSettings:true},
    audioLibrary(){showAudioLibrary();},
    dock(el) {   // el = 外面页面里的容器；手账画在它里面新建的 #soul.dock 里。el 为空 = 收回游戏
      SOUL_DOCK?.remove(); SOUL_DOCK = null;
      if (el) { const d = el.ownerDocument.createElement('div'); d.id = 'soul'; d.className = 'dock'; el.appendChild(d); SOUL_DOCK = d; $('#soul').classList.remove('show'); showSoul(); }
      soulTabUpd();
    },
    css() {
      const out = [];
      for (const sh of document.styleSheets) {
        let rules; try { rules = sh.cssRules; } catch (e) { continue; }
        for (const r of rules) {
          const t = r.cssText;
          if (r.type === 1 && /#soul\b/.test(t) && !/#soulTab|#psettings|#soul\.ovl/.test(r.selectorText)) out.push(t);
          else if (r.type === 1 && /^\.svi\b/.test(r.selectorText)) out.push(t);
          else if (r.type === 7 && /^soulblink$/.test(r.name)) out.push(t);
        }
      }
      out.push(`#soul.dock{--font:system-ui,"PingFang SC","Microsoft YaHei",sans-serif;display:flex;flex-direction:column;height:100%;min-height:0;color:#3d2f28;font-family:"Kaiti SC","KaiTi","STKaiti",var(--font),serif;background:radial-gradient(120% 80% at 0 0,#fbf6ea,#f3e9d4);border-left:6px double #c9a98a;overflow:hidden;user-select:text}`,
        `#soul.dock .hd{padding:14px 18px 6px}#soul.dock .tabs{padding:4px 14px 10px}#soul.dock .pg{padding:8px 18px 14px}`,
        `#soul.dock .btn{border:0;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex:none}`,
        `#soul.dock button{font-family:inherit}`);
      return out.join('\n');
    },
    state() {
      const c = soulCfg(), v = playing ? RT.vars : {};
      return { playing:playing&&!$('#title').classList.contains('show'), title: P.title, chapter: playing ? chapterAt(RT.idx) : '', char: c?.char || '', aff: c ? v[c.aff] : null, affName: c?.aff || '',
        signal: c?.signal ? v[c.signal] : null, signalName: c?.signal || '', unread: playing && RT.soul ? RT.soul.unread : 0, rev: SOUL_REV,
        mem: playing && RT.soul ? RT.soul.mem.length : 0, link: soulSock.state, info: soulSock.info, soulOn: !!c && soulMode() !== 'off' };
    },
    prefs: PREF_SCHEMA,
    setPref(k, v) { const sc = PREF_SCHEMA().find(x => x.k === k); if (!sc) return; if (k === 'voiceEnabled') setVoiceEnabled(v); else setPref(k, sc.inv ? sc.inv - v : v); SOUL_REV++; soulTabUpd(); },
    save() { if (playing) showSlots('save'); },
    load() { showSlots('load'); },
    title() { if (playing) return leaveForTitle(); },
    forget() { if (playing) soulForget(); },
    connect() { soulSock.close(); return soulSock.open(); },
    plugins: () => VNPlugins.list().map(p => ({ id: p.id, name: p.name, version: p.version, src: p.src, enabled: p.enabled, error: p.error })),
    openPlugins() { showPluginsOvl(); },
  };
  let rev = -1;
  setInterval(() => { if (SOUL_DOCK && rev !== SOUL_REV) { rev = SOUL_REV; showSoul(); } }, 300);
  try { parent.postMessage({ vnhost: 'ready' }, location.origin); } catch (e) {}
}
// 可选：被别的页面（或测试工具）用 postMessage 驱动。只有网址带 ?bridge=1 才开启，避免被陌生网页操控
// 只接受同源页面（或网址里 origin= 指定的那一个来源）发来的命令；file:// 双击打开时只接受同为 file:// 的页面
if (/[?&]bridge=1\b/.test(location.search)) {
  const allow = new Set([location.origin]); { const o = new URLSearchParams(location.search).get('origin'); if (o) allow.add(o); }
  addEventListener('message', async e => {
    if (!e.data || !e.data.vnCmd || !allow.has(e.origin)) return;
    const r = await execCmds(e.data.vnCmd, e.data.opt || {});
    e.source?.postMessage({ vnResult: r, id: e.data.id }, e.origin === 'null' ? '*' : e.origin);
  });
}

const chapterReviewPanel = document.createElement('div'); chapterReviewPanel.id = 'pchapters'; chapterReviewPanel.className = 'ovl'; stage.appendChild(chapterReviewPanel);
const audioPanel = document.createElement('div'); audioPanel.id = 'paudio'; audioPanel.className = 'ovl'; stage.appendChild(audioPanel);
new MutationObserver(() => { if (!audioPanel.classList.contains('show')) closeAudioLibrary(); }).observe(audioPanel, { attributes: true, attributeFilter: ['class'] });


/* ========== 插件（vn-plugin/1） ==========
// 插件 = 一个 .js 文件，里面只调用一次 VNPlugin.define({ id, name, version, api: 1, setup(vn) { … } })。规范见 PLUGIN_API.md。
// 三个来源，同 id 后者覆盖前者：
//   项目插件  P.plugins（编辑器里导入，存进项目，随导出的游戏一起带走）
//   托管插件  在 galLingS 作品页里玩时，galLingS 提供的插件（/api/vn/plugins）
//   玩家插件  导出的游戏里玩家自己导入的（IndexedDB vnplugins:<项目id>）
// 玩家对每个插件的开关、设置存 localStorage vnplug:<项目id>；编辑器里改的是项目自带的默认值。
// 安全：插件能运行任意代码（这是“插件”本身的意思），所以导入前一定会提示，只导入信任的来源；剧本本身仍然不执行代码。 */
const PLUGIN_API = 1;
const PLUGIN_ID_RE = /^[a-z0-9][a-z0-9._-]{2,63}$/i;
const VNPlugins = (() => {
  const live = new Map();        // id → 已加载的插件 { id, def, src, rec, vn, offs, dispose, exports, error, needReload }
  const known = new Map();       // id → 列表里显示的条目（含未启用、加载失败的）
  const R = { providers: {}, commands: {}, ops: {}, endBtns: [], titleBtns: [], checks: [], ev: {} };
  let defined = null, booting = null, hostList = [];
  const stKey = () => 'vnplug:' + P.id, playerKey = () => 'vnplugins:' + P.id;
  const loadSt = () => { try { return JSON.parse(localStorage.getItem(stKey()) || '{}') || {}; } catch (e) { return {}; } };
  const saveSt = st => { try { localStorage.setItem(stKey(), JSON.stringify(st)); } catch (e) {} };
  const localKey = (id, k) => 'vnplugsec:' + P.id + ':' + id + ':' + k;     // local:true 的设置（令牌等）只存本机，不进项目、不随游戏导出

  /* —— 运行插件代码，取出它 define 的内容 —— */
  function exec(code, label) {
    if (typeof code !== 'string' || !code.trim()) throw new Error('插件文件是空的');
    if (code.length > 4e6) throw new Error('插件文件太大（超过 4 MB）');
    defined = null; let err = null;
    const onErr = e => { err = e.error || new Error(e.message); e.preventDefault?.(); };
    addEventListener('error', onErr);
    try {
      const s = document.createElement('script');
      s.textContent = code + '\n//# sourceURL=vnplugin-' + String(label || 'plugin').replace(/[^\w.-]/g, '_') + '.js';
      document.head.appendChild(s); s.remove();
    } finally { removeEventListener('error', onErr); }
    if (err) throw err;
    const d = defined; defined = null;
    if (!d) throw new Error('这个文件不是 VN Studio 插件（没有调用 VNPlugin.define）');
    return check(d);
  }
  function check(d) {
    if (!d || typeof d !== 'object') throw new Error('define 需要一个对象');
    if (!PLUGIN_ID_RE.test(d.id || '')) throw new Error('插件 id 不合法：' + d.id + '（3–64 个字母、数字、点、减号、下划线，建议写成 作者.名字）');
    if (!d.name) throw new Error('插件缺少 name');
    if (!/^\d+\.\d+(\.\d+)?([-+.\w]*)$/.test(String(d.version || ''))) throw new Error('插件 version 要写成 1.0.0 这样');
    if ((d.api | 0) < 1 || (d.api | 0) > PLUGIN_API) throw new Error(`插件需要接口版本 ${d.api}，这个 VN Studio 支持 ${PLUGIN_API}`);
    if (d.setup != null && typeof d.setup !== 'function') throw new Error('setup 必须是函数');
    if (d.settings != null && !Array.isArray(d.settings)) throw new Error('settings 必须是数组');
    return d;
  }
  const meta = d => ({ id: d.id, name: String(d.name), version: String(d.version), author: String(d.author || ''), description: String(d.description || ''), icon: String(d.icon || 'puzzle'), homepage: String(d.homepage || ''), permissions: Array.isArray(d.permissions) ? d.permissions.map(String) : [] });

  /* —— 事件 —— */
  function emit(name, data) {
    for (const f of [...(R.ev[name] || [])]) { try { f(data); } catch (e) { console.warn('[插件] ' + name + ' 处理出错', e); } }
  }

  /* —— 设置：玩家改的 > 项目默认 > 插件默认 —— */
  function settingDefs(id) { return (live.get(id)?.def || known.get(id)?.def)?.settings || []; }
  function getSetting(id, k) {
    const sd = settingDefs(id).find(s => s.key === k);
    if (sd?.local) { try { const v = localStorage.getItem(localKey(id, k)); if (v != null) return JSON.parse(v); } catch (e) {} return sd.default ?? ''; }
    const st = loadSt()[id]?.set || {}; if (Object.prototype.hasOwnProperty.call(st, k)) return st[k];
    const rec = (P.plugins || []).find(r => r.id === id); if (rec?.settings && Object.prototype.hasOwnProperty.call(rec.settings, k)) return rec.settings[k];
    return sd?.default ?? (sd?.type === 'bool' ? false : '');
  }
  function setSetting(id, k, v) {
    const sd = settingDefs(id).find(s => s.key === k);
    if (sd?.local) { try { localStorage.setItem(localKey(id, k), JSON.stringify(v)); } catch (e) {} }
    else {
      const rec = (P.plugins || []).find(r => r.id === id);
      if (!gameMode && !headless && rec && known.get(id)?.src === 'project') { rec.settings = Object.assign({}, rec.settings, { [k]: v }); changed(); }
      else { const st = loadSt(); st[id] = Object.assign({}, st[id]); st[id].set = Object.assign({}, st[id].set, { [k]: v }); saveSt(st); }
    }
    const p = live.get(id); if (p) for (const f of p.setFns) { try { f(k, v); } catch (e) { console.warn(e); } }
  }

  /* —— 给插件的接口 vn —— */
  function makeVn(p) {
    const id = p.id, offs = p.offs;
    const track = off => { offs.push(off); return off; };
    const removeFrom = (arr, x) => () => { const i = arr.indexOf(x); if (i >= 0) arr.splice(i, 1); };
    const vn = {
      id, api: PLUGIN_API,
      engine: { name: 'VN Studio', version: VN_VERSION, mode: gameMode ? 'game' : headless ? 'headless' : 'editor', hosted: HOSTED, origin: location.origin, protocol: location.protocol },
      exports: p.exports,
      on(ev, fn) { (R.ev[ev] ||= []).push(fn); return track(removeFrom(R.ev[ev], fn)); },
      require(other) { const q = live.get(other); return q && !q.error ? q.exports : null; },
      settings: {
        get: k => getSetting(id, k),
        all: () => Object.fromEntries(settingDefs(id).map(s => [s.key, getSetting(id, s.key)])),
        set: (k, v) => setSetting(id, k, v),
        onChange(fn) { p.setFns.push(fn); return track(removeFrom(p.setFns, fn)); },
      },
      // 项目数据：剧本命令（如 @postchat）写在这里，随项目保存、随游戏导出
      data: {
        get: () => clone(P.settings.pluginData?.[id] || {}),
        set(o) { P.settings.pluginData = Object.assign({}, P.settings.pluginData, { [id]: clone(o || {}) }); if (!gameMode && !headless && !batching) changed(); },
      },
      storage: {   // 本机小存储（localStorage，按项目 + 插件分开）
        get(k, d) { try { const v = localStorage.getItem('vnplugkv:' + P.id + ':' + id + ':' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
        set(k, v) { try { localStorage.setItem('vnplugkv:' + P.id + ':' + id + ':' + k, JSON.stringify(v)); } catch (e) {} },
      },
      project: {
        get title() { return P.title; }, get id() { return P.id; },
        chars: () => P.chars.map(c => ({ name: c.name, color: c.color, persona: c.persona || '' })),
        vars: () => P.vars.map(v => ({ name: v.name, init: v.init, global: !!v.global })),
        soul: () => clone(P.settings.soul || null),
      },
      chars: {
        get: name => { const c = charOf(name); return c ? { name: c.name, color: c.color, persona: c.persona || '' } : null; },
        expressions: name => exprNames(name),
        avatar(name) { const list = Object.values(P.assets).filter(a => a.type === 'ch' && charKey(a) === name); const a = list.find(a => !splitName(a.name)[1]) || list[0]; return a && a.src && !String(a.src).startsWith('(') ? a.src : ''; },
        setEmotion: (name, emo) => applyEmotion(name, String(emo || '')),
      },
      vars: {
        all: () => clone(playing ? RT.vars || {} : Object.fromEntries(P.vars.map(v => [v.name, v.init]))),
        get: name => (RT.vars || {})[name],
        set(name, value) {
          const v = P.vars.find(v => v.name === name); if (!v) throw new Error('没有这个变量：' + name);
          RT.vars[name] = typeof value === 'number' || (value !== '' && value != null && isFinite(+value)) ? +value : String(value);
          if (v.global) { loadG(); G.vars[name] = RT.vars[name]; saveG(); }
          return RT.vars[name];
        },
      },
      audio: {
        se(name) { const a = Object.values(P.assets).find(a => a.type === 'se' && a.name === name); if (!a) throw new Error('没有这个音效：' + name); playSe(a.id); return true; },
        list: () => Object.values(P.assets).filter(a => a.type === 'se').map(a => a.name),
      },
      story: {
        get playing() { return playing; }, get index() { return RT.idx; },
        line: () => playing ? clone(P.lines[RT.idx] || null) : null,
        backlog: (n = 20) => (RT.back || []).slice(-n).map(b => ({ speaker: b.s === '▶' ? '' : b.s || '', text: b.t, choice: b.s === '▶' })),
        background: () => { const l = lastShown || P.lines[RT.idx]; return l?.bg && A(l.bg) ? { name: A(l.bg).name, src: A(l.bg).src } : null; },
      },
      agent: {
        // 新“大脑”：fn(request, settings, chat) → Promise<{ text, emotion?, set?, end? }>；request 格式见 AGENT_API.md（vn-agent/1）
        register(name, label, fn) {
          if (typeof label === 'function') { fn = label; label = name; }
          R.providers[name] = { label: String(label || name), plugin: id }; VNAgent.register(name, fn);
          return track(() => { if (R.providers[name]?.plugin === id) { delete R.providers[name]; delete VNAgent.providers[name]; } });
        },
      },
      chat: {
        // 开一段自由对话（和剧情 @agent 同一套：对话框 + 输入框）。opts: { char, goal, provider, turns, greeting, placeholder, onExit(), extra }
        start(o = {}) {
          if (!playing) throw new Error('只有游戏进行中才能开始对话');
          const cur = P.lines[RT.idx] || {};
          const line = { id: 'plugin-chat', text: o.setup ?? cur.text ?? '', bg: lastShown ? lastShown.bg : cur.bg, agent: { char: String(o.char || ''), goal: String(o.goal || ''), turns: o.turns ?? 9999, exit: '' } };
          hideOverlays(); clearTimers(); stage.classList.remove('nodlg', 'hideui');
          startChat(line);
          Object.assign(RT.chat, { plugin: id, provider: o.provider || null, onExit: typeof o.onExit === 'function' ? o.onExit : null }, o.extra || {});
          setName($('#pnm'), line.agent.char); $('#ptx').textContent = o.greeting || '……';
          $('#pinput').placeholder = o.placeholder || '';
          return RT.chat;
        },
        end() { if (RT.chat) { endChat(); if (typer) finishTyping(); advance(); } },
        get current() { return RT.chat; },
      },
      script: {
        // 剧本命令 @名字：parse(参数文字, { kv, err })；export() 返回要写回剧本的行（字符串或数组）
        command(name, h) {
          name = String(name).toLowerCase();
          if (!/^[a-z][a-z0-9_]{1,31}$/.test(name)) throw new Error('命令名不合法：' + name);
          R.commands[name] = Object.assign({ plugin: id }, h);
          return track(() => { if (R.commands[name]?.plugin === id) delete R.commands[name]; });
        },
      },
      api: { op(name, fn) { R.ops[name] = { plugin: id, fn }; return track(() => { if (R.ops[name]?.plugin === id) delete R.ops[name]; }); } },
      check(fn) { const x = { plugin: id, fn }; R.checks.push(x); return track(removeFrom(R.checks, x)); },
      ui: {
        icon: n => ic(n), esc,
        get stage() { return stage; },
        el: name => ({ dialog: $('#pdlg'), name: $('#pnm'), text: $('#ptx'), input: $('#pinput'), inputBar: $('#pin'), endcard: $('#endcard'), title: $('#title') })[name] || null,
        css(text) { const s = document.createElement('style'); s.dataset.plugin = id; s.textContent = String(text); document.head.appendChild(s); return track(() => s.remove()); },
        toast: msg => pluginToast(msg),
        // 结局卡上的按钮：{ label(结局名) | label, primary, show(结局名), onClick(结局名) }
        addEndingButton(b) { const x = Object.assign({ plugin: id }, b); R.endBtns.push(x); return track(removeFrom(R.endBtns, x)); },
        // 开始界面菜单里多一项：{ label, onClick, show() }
        addTitleButton(b) { const x = Object.assign({ plugin: id }, b); R.titleBtns.push(x); return track(removeFrom(R.titleBtns, x)); },
        endingCard: { show: () => $('#endcard').classList.add('show'), hide: () => $('#endcard').classList.remove('show') },
      },
      get raw() { return { P, RT, VNAgent, stage }; },   // 逃生口：直接碰内部数据。不保证以后版本不变
      log: (...a) => console.log('[' + id + ']', ...a),
    };
    return vn;
  }

  /* —— 加载 / 卸下一个插件 —— */
  function start(item) {
    const { def } = item;
    stop(def.id, true);
    const p = { id: def.id, def, src: item.src, rec: item.rec, offs: [], setFns: [], exports: {}, dispose: null, error: '' };
    p.vn = makeVn(p);
    live.set(def.id, p);
    try {
      const r = def.setup ? def.setup(p.vn) : null;
      if (typeof r === 'function') p.dispose = r; else if (r && typeof r.dispose === 'function') p.dispose = () => r.dispose();
      if (r && typeof r.then === 'function') r.catch(e => { p.error = String(e?.message || e); console.warn(e); });
    } catch (e) { p.error = String(e?.message || e); console.warn('[插件] ' + def.id + ' 启动失败', e); }
    emit('plugin:ready', { id: def.id });
  }
  function stop(id, quiet) {
    const p = live.get(id); if (!p) return true;
    let clean = true;
    try { p.dispose?.(); } catch (e) { console.warn(e); }
    for (const off of p.offs.splice(0).reverse()) { try { off(); } catch (e) { console.warn(e); } }
    if (!p.dispose && p.def.cleanup === false) clean = false;      // 插件自己说清不干净，要刷新
    live.delete(id);
    if (!quiet) emit('plugin:stopped', { id });
    return clean;
  }

  /* —— 收集三个来源 —— */
  async function sources() {
    const out = [];
    for (const rec of P.plugins || []) out.push({ src: 'project', rec, code: rec.code, enabled: rec.enabled !== false });
    for (const h of hostList) out.push({ src: 'host', rec: h, code: h.code, def: h.def, enabled: true });
    if (gameMode) for (const rec of (await idbGet(playerKey())) || []) out.push({ src: 'player', rec, code: rec.code, enabled: true });
    return out;
  }
  async function loadHost() {
    hostList = [];
    if (!HOSTED) {
      if (gameMode && !/^\/_(single\.html|folder\/)/.test(location.pathname)) {
        try {
          defined = null;
          await new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = 'galagent.vnplugin.js';
            s.onload = () => { s.remove(); res(); };
            s.onerror = () => { s.remove(); rej(); };
            document.head.appendChild(s);
          });
          if (defined) { const d = check(defined); defined = null; hostList.push({ id: d.id, url: 'galagent.vnplugin.js', def: d }); }
        } catch (e) {}
      }
      return;
    }
    try {
      const r = await fetch('/api/vn/plugins', { cache: 'no-store' }); if (!r.ok) return;
      const j = await r.json();
      for (const x of (j.plugins || []).slice(0, 20)) {
        if (!x || typeof x.url !== 'string' || !x.url.startsWith('/')) continue;     // 只收同源
        try { const t = await fetch(x.url, { cache: 'no-store' }); if (t.ok) hostList.push({ id: x.id, url: x.url, code: await t.text() }); } catch (e) {}
      }
    } catch (e) {}
  }
  async function reload(opt = {}) {
    for (const id of [...live.keys()]) stop(id, true);
    known.clear();
    if (opt.host) await loadHost();
    const st = loadSt(), order = [];
    for (const it of await sources()) {
      let def = it.def || null, error = '';
      if (!def) { try { def = exec(it.code, it.rec?.id || it.src); } catch (e) { error = String(e.message || e); } }
      const id = def?.id || it.rec?.id || '?';
      const item = { id, def, src: it.src, rec: it.rec, error, enabled: it.enabled && !(st[id]?.off), meta: def ? meta(def) : { id, name: it.rec?.name || id, version: it.rec?.version || '?', author: '', description: '', icon: 'puzzle', permissions: [] } };
      if (known.has(id)) item.overrides = known.get(id).src;
      known.set(id, item);
    }
    // 先启动被依赖的（requires）
    const seen = new Set();
    const visit = (item, depth = 0) => {
      if (seen.has(item.id) || depth > 10) return; seen.add(item.id);
      for (const dep of item.def?.requires || []) { const d = known.get(dep); if (d) visit(d, depth + 1); }
      order.push(item);
    };
    for (const item of known.values()) visit(item);
    for (const item of order) {
      if (!item.def || !item.enabled || item.error) continue;
      const miss = (item.def.requires || []).filter(d => !known.get(d)?.enabled);
      if (miss.length) { item.error = '需要先装并启用：' + miss.join('、'); continue; }
      start(item);
      const p = live.get(item.id); if (p?.error) item.error = p.error;
    }
    emit('plugins:changed');
  }

  /* —— 管理面板用的操作 —— */
  async function install(code, from) {
    const def = exec(code, 'import');                // 先试运行，拿到名字版本，不启动
    const m = meta(def);
    if (!gameMode) {                                  // 编辑器：装进项目
      P.plugins = (P.plugins || []).filter(r => r.id !== m.id);
      P.plugins.push({ id: m.id, name: m.name, version: m.version, code, enabled: true, settings: {} });
      changed();
    } else {                                          // 游戏：装给这个玩家
      const list = ((await idbGet(playerKey())) || []).filter(r => r.id !== m.id);
      list.push({ id: m.id, name: m.name, version: m.version, code, from: from || '' });
      if (!(await idbSet(playerKey(), list))) throw new Error('浏览器存储不可用，装不上');
      const st = loadSt(); if (st[m.id]) { delete st[m.id].off; saveSt(st); }
    }
    await reload();
    return m;
  }
  async function remove(id) {
    const item = known.get(id); if (!item) return;
    const clean = stop(id);
    if (item.src === 'project' && !gameMode) { P.plugins = (P.plugins || []).filter(r => r.id !== id); changed(); }
    else if (item.src === 'player') { const list = ((await idbGet(playerKey())) || []).filter(r => r.id !== id); await idbSet(playerKey(), list); }
    else { const st = loadSt(); st[id] = Object.assign({}, st[id], { off: true }); saveSt(st); }   // 托管 / 项目自带的：玩家只能停用
    try { Object.keys(localStorage).filter(k => k.startsWith('vnplugsec:' + P.id + ':' + id + ':')).forEach(k => localStorage.removeItem(k)); } catch (e) {}
    await reload();
    return clean;
  }
  async function setEnabled(id, on) {
    const item = known.get(id); if (!item) return;
    if (item.src === 'project' && !gameMode) { const rec = P.plugins.find(r => r.id === id); if (rec) rec.enabled = on; changed(); }
    else { const st = loadSt(); st[id] = Object.assign({}, st[id]); if (on) delete st[id].off; else st[id].off = true; saveSt(st); }
    let clean = true;
    if (!on) clean = stop(id);
    await reload();
    return clean;
  }
  function list() {
    return [...known.values()].map(it => ({ ...it.meta, src: it.src, enabled: it.enabled, running: live.has(it.id) && !live.get(it.id).error, error: it.error, overrides: it.overrides || '',
      settings: (it.def?.settings || []).map(s => ({ ...s, value: getSetting(it.id, s.key) })),
      actions: (it.def?.actions || []).filter(a => !a.when || a.when === 'all' || a.when === (gameMode ? 'game' : 'editor')).map(a => ({ id: a.id, label: a.label, icon: a.icon || 'zap' })),
      removable: !(gameMode && (it.src === 'project' || it.src === 'host')), code: it.rec?.code }));
  }
  function action(id, aid) { const p = live.get(id); const a = p?.def.actions?.find(a => a.id === aid); if (!a) return pluginToast('先启用这个插件'); try { a.run(p.vn); } catch (e) { alert('插件出错：' + e.message); } }

  return {
    define(d) { defined = d; },
    emit, reload, install, remove, setEnabled, list, action, getSetting, setSetting,
    async boot() { if (!booting) booting = reload({ host: true }); return booting; },
    get live() { return live; }, R,
    providers: () => Object.entries(R.providers).map(([k, v]) => [k, v.label]),
    runCommand(cmd, arg, h) { const c = R.commands[cmd]; if (!c) return false; c.parse?.(arg, h); return true; },
    exportLines() { const out = []; for (const c of Object.values(R.commands)) { try { const x = c.export?.(); if (x) out.push(...[].concat(x).filter(Boolean).map(String)); } catch (e) { console.warn(e); } } return out; },
    op: name => R.ops[name]?.fn || null,
    checks() { const out = []; for (const c of R.checks) { try { for (const x of c.fn() || []) out.push([x[0] | 0, String(x[1])]); } catch (e) { console.warn(e); } } return out; },
  };
})();
window.VNPlugin = { api: PLUGIN_API, define: d => VNPlugins.define(d) };
window.VNPlugins = VNPlugins;

function pluginToast(msg) {
  let t = $('#plgToast'); if (!t) { t = document.createElement('div'); t.id = 'plgToast'; stage.appendChild(t); }
  t.textContent = String(msg); t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600);
}

/* —— 插件管理面板：编辑器里是弹窗，游戏里是和“设置”同款的浮层 —— */
const PLG_SRC = { project: '项目', host: 'galLingS', player: '我导入的' };
function pluginCardsHtml() {
  const items = VNPlugins.list();
  if (!items.length) return `<div class="plg-empty">${ic('puzzle')}<div>还没有插件</div><small>${gameMode ? '导入作者或朋友给你的 .js 插件文件' : '导入的插件会存进项目，导出游戏时一起带走'}</small></div>`;
  return items.map(p => {
    const set = p.settings.map(s => {
      const v = s.value, k = esc(s.key), lab = `<span>${esc(s.label || s.key)}</span>`;
      let inp;
      if (s.type === 'bool') inp = `<button class="plg-sw ${v ? 'on' : ''}" data-set="${k}" data-type="bool"><i></i></button>`;
      else if (s.type === 'select' || s.type === 'char') {
        const opts = s.type === 'char' ? [['', s.allowEmpty || '（不选）'], ...P.chars.map(c => [c.name, c.name])] : (s.options || []).map(o => Array.isArray(o) ? o : [o, o]);
        inp = `<select data-set="${k}">${opts.map(([ov, ol]) => `<option value="${esc(ov)}" ${String(v) === String(ov) ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select>`;
      } else if (s.type === 'textarea') inp = `<textarea data-set="${k}" placeholder="${esc(s.placeholder || '')}">${esc(v ?? '')}</textarea>`;
      else inp = `<input data-set="${k}" type="${s.type === 'password' ? 'password' : s.type === 'number' ? 'number' : 'text'}" value="${esc(v ?? '')}" placeholder="${esc(s.placeholder || '')}" spellcheck="false" autocomplete="off">`;
      return `<label class="plg-row">${lab}${inp}${s.help ? `<small>${esc(s.help)}</small>` : ''}</label>`;
    }).join('');
    const tag = `<span class="plg-tag">${esc(PLG_SRC[p.src] || p.src)}</span>` + (p.overrides ? `<span class="plg-tag dim">覆盖${esc(PLG_SRC[p.overrides] || '')}版本</span>` : '');
    const perm = p.permissions.length ? `<div class="plg-perm">${p.permissions.map(x => `<span>${esc(PLG_PERM[x] || x)}</span>`).join('')}</div>` : '';
    return `<div class="plg-card ${p.enabled ? '' : 'off'} ${p.error ? 'bad' : ''}" data-id="${esc(p.id)}">
      <div class="plg-ic">${ic(ICON[p.icon] ? p.icon : 'puzzle')}</div>
      <div class="plg-main">
        <div class="plg-t"><b>${esc(p.name)}</b><small>${esc(p.version)}${p.author ? ' · ' + esc(p.author) : ''}</small>${tag}</div>
        <div class="plg-d">${esc(p.description || p.id)}</div>${perm}
        ${p.error ? `<div class="plg-err">${ic('triangle-alert')} ${esc(p.error)}</div>` : ''}
        ${set ? `<div class="plg-set">${set}</div>` : ''}
      </div>
      <div class="plg-ops">
        <button class="plg-sw ${p.enabled ? 'on' : ''}" data-op="toggle" title="${p.enabled ? '停用' : '启用'}"><i></i></button>
        ${p.actions.map(a => `<button class="plg-b" data-act="${esc(a.id)}" ${p.running ? '' : 'disabled'}>${ic(ICON[a.icon] ? a.icon : 'zap')}<span>${esc(a.label)}</span></button>`).join('')}
        ${set ? `<button class="plg-b ico" data-op="set" title="设置">${ic('settings')}</button>` : ''}
        ${!gameMode && p.code ? `<button class="plg-b ico" data-op="dl" title="导出插件文件">${ic('arrow-down-to-line')}</button>` : ''}
        ${p.removable ? `<button class="plg-b ico del" data-op="del" title="${p.src === 'project' || p.src === 'player' ? '卸载' : '停用'}">${ic('trash-2')}</button>` : ''}
      </div></div>`;
  }).join('');
}
const PLG_PERM = { network: '联网', agent: '角色对话', script: '剧本命令', vars: '改变量', ui: '界面', storage: '本机存储', tools: '运行工具' };
function bindPluginPanel(root, rerender) {
  const list = root.querySelector('.plg-list');
  const draw = () => { list.innerHTML = pluginCardsHtml(); };
  draw();
  const fileIn = document.createElement('input'); fileIn.type = 'file'; fileIn.accept = '.js,.mjs,text/javascript,application/javascript'; fileIn.multiple = true; fileIn.hidden = true; root.appendChild(fileIn);
  const importFiles = async files => {
    for (const f of files) {
      if (!/\.m?js$/i.test(f.name)) { alert(f.name + ' 不是 .js 插件文件'); continue; }
      const code = await f.text();
      let m;
      try {
        const cur = VNPlugins.list();
        const peek = peekMeta(code);
        const old = cur.find(x => x.id === peek.id);
        const msg = `导入插件「${peek.name}」${peek.version}${peek.author ? '（' + peek.author + '）' : ''}？\n\n${peek.description || ''}\n${peek.permissions.length ? '\n会用到：' + peek.permissions.map(x => PLG_PERM[x] || x).join('、') : ''}${old ? `\n\n已经装了 ${old.version}，会被替换。` : ''}\n\n插件可以运行任意代码，只导入你信任的来源。`;
        if (!confirm(msg)) continue;
        m = await VNPlugins.install(code, f.name);
        pluginToast(`已导入：${m.name} ${m.version}`);
      } catch (e) { alert('导入失败：' + e.message); }
    }
    draw(); rerender?.();
  };
  root.querySelector('[data-plg=imp]').onclick = e => { e.stopPropagation(); fileIn.value = ''; fileIn.click(); };
  fileIn.onchange = () => importFiles([...fileIn.files]);
  root.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); e.stopPropagation(); root.classList.add('drag'); } });
  root.addEventListener('dragleave', e => { if (e.target === root) root.classList.remove('drag'); });
  root.addEventListener('drop', e => { if (!e.dataTransfer.files.length) return; e.preventDefault(); e.stopPropagation(); root.classList.remove('drag'); importFiles([...e.dataTransfer.files]); });
  list.addEventListener('click', async e => {
    e.stopPropagation();
    const card = e.target.closest('.plg-card'); if (!card) return;
    const id = card.dataset.id, b = e.target.closest('button'); if (!b) return;
    if (b.dataset.set) { const v = !b.classList.contains('on'); b.classList.toggle('on', v); VNPlugins.setSetting(id, b.dataset.set, v); return; }
    if (b.dataset.act) { if (!gameMode) closeModal(); VNPlugins.action(id, b.dataset.act); return; }
    const op = b.dataset.op;
    if (op === 'set') return card.classList.toggle('open');
    if (op === 'toggle') { const on = !b.classList.contains('on'); const clean = await VNPlugins.setEnabled(id, on); if (!clean) pluginToast('停用了；有些改动要刷新页面后才完全消失'); draw(); rerender?.(); return; }
    if (op === 'dl') { const p = VNPlugins.list().find(x => x.id === id); if (p?.code) download(id + '.vnplugin.js', p.code, 'text/javascript'); return; }
    if (op === 'del') {
      const p = VNPlugins.list().find(x => x.id === id); if (!p) return;
      const verb = p.src === 'project' || p.src === 'player' ? '卸载' : '停用';
      if (!confirm(`${verb}「${p.name}」？` + (p.src === 'project' && !gameMode ? '\n项目里的插件文件会删掉，导出的游戏也不再带它。' : ''))) return;
      const clean = await VNPlugins.remove(id); if (clean === false) pluginToast('已' + verb + '；有些改动要刷新页面后才完全消失');
      draw(); rerender?.();
    }
  });
  const onSet = e => {
    const el = e.target.closest('[data-set]'); if (!el || el.tagName === 'BUTTON') return;
    const card = el.closest('.plg-card'); VNPlugins.setSetting(card.dataset.id, el.dataset.set, el.type === 'number' ? +el.value : el.value);
  };
  list.addEventListener('change', onSet);
  list.addEventListener('keydown', e => e.stopPropagation());
  return { draw };
}
// 只读出插件的名字版本，不启动
function peekMeta(code) {
  const keep = window.VNPlugin;
  let d = null;
  window.VNPlugin = { api: PLUGIN_API, define: x => { d = x; } };
  try {
    const s = document.createElement('script'); let err = null;
    const onErr = e => { err = e.error || new Error(e.message); e.preventDefault?.(); };
    addEventListener('error', onErr);
    s.textContent = code + '\n//# sourceURL=vnplugin-peek.js'; document.head.appendChild(s); s.remove();
    removeEventListener('error', onErr);
    if (err) throw err;
  } finally { window.VNPlugin = keep; }
  if (!d) throw new Error('这个文件不是 VN Studio 插件（没有调用 VNPlugin.define）');
  if (!PLUGIN_ID_RE.test(d.id || '') || !d.name || !d.version) throw new Error('插件信息不完整（需要 id、name、version）');
  if ((d.api | 0) < 1 || (d.api | 0) > PLUGIN_API) throw new Error(`插件需要接口版本 ${d.api}，这个 VN Studio 支持 ${PLUGIN_API}`);
  return { id: d.id, name: String(d.name), version: String(d.version), author: String(d.author || ''), description: String(d.description || ''), permissions: Array.isArray(d.permissions) ? d.permissions : [] };
}
function plgHead() {
  return `<div class="plg-head"><h2>${ic('puzzle')}<span>插件</span></h2><span class="plg-sub">${gameMode ? '给游戏加功能：导入 .js 插件文件，或把文件拖进来' : '导入的插件存进项目，导出游戏时一起带走 · 规范见 PLUGIN_API.md'}</span><span class="grow"></span><button class="plg-imp" data-plg="imp">${ic('upload')}<span>导入插件</span></button></div><div class="plg-list"></div><div class="plg-foot">插件可以运行任意代码，只导入你信任的来源 · vn-plugin/${PLUGIN_API}</div>`;
}
// 编辑器：顶栏“插件”按钮
function openPlugins() {
  const box = modal(`<div id="plgBox" class="plgui">${plgHead()}</div>`, null);
  box.querySelector('[data-a=c]').textContent = '关闭';
  bindPluginPanel(box.querySelector('#plgBox'));
}
// 游戏：开始界面“插件”
function showPluginsOvl() {
  const box = $('#plugins');
  box.innerHTML = `<div class="plgui">${plgHead()}</div>`;
  bindPluginPanel(box.querySelector('.plgui'), () => { if ($('#title').classList.contains('show')) { showTitle(); box.classList.add('show'); } });   // 插件改了开始界面菜单：重画菜单，面板留着
  addClose(box); box.classList.add('show');
  box.onclick = e => { e.stopPropagation(); if (e.target === box) box.classList.remove('show'); };
}
/* ========== 玩家界面平滑过渡（独立视觉层，不参与 RT / 存档） ========== */
const VN_FADE = (() => {
  const duration = 360;
  let pending = null, active = null, frame = 0;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function dispose(item) {
    if (!item) return;
    clearTimeout(item.timeout); item.animation?.cancel(); item.host.remove();
    if (active === item) active = null;
  }
  function capture() {
    const host = document.createElement('div');
    host.dataset.vnFade = ''; host.setAttribute('aria-hidden', 'true'); host.inert = true;
    host.style.cssText = 'position:absolute;inset:0;z-index:1000;pointer-events:none;overflow:hidden;contain:layout paint;';
    const shadow = host.attachShadow({ mode: 'closed' });
    const styles = document.createElement('style');
    // assetCss 只有编辑时间轴使用，单文件版其中可能含巨大的 data URL，不复制它。
    styles.textContent = [...document.styleSheets].filter(sh => sh.ownerNode?.id !== 'assetCss').map(sh => {
      try { return [...sh.cssRules].map(r => r.cssText).join('\n'); } catch (e) { return ''; }
    }).join('\n') + '\n* ,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';
    const body = document.createElement('body'); body.className = document.body.className;
    body.style.cssText = 'position:relative;margin:0;width:1280px;height:' + (stage.offsetHeight || 720) + 'px;overflow:hidden;background:transparent;';
    const copy = stage.cloneNode(true);
    copy.querySelectorAll('[data-vn-fade]').forEach(el => el.remove());
    const sources = [stage, ...stage.querySelectorAll('*')].filter(el => !el.closest('[data-vn-fade]'));
    const copies = [copy, ...copy.querySelectorAll('*')];
    sources.forEach((el, i) => {
      const twin = copies[i]; if (!twin) return;
      if ('value' in el) twin.value = el.value;
      if ('checked' in el) twin.checked = el.checked;
      if (el.getClientRects().length) {
        const cs = getComputedStyle(el);
        for (const key of ['opacity', 'transform', 'filter', 'translate', 'rotate', 'scale']) twin.style.setProperty(key, cs.getPropertyValue(key), 'important');
      }
    });
    copy.style.setProperty('transform', 'none', 'important');
    copy.style.setProperty('left', '0px', 'important'); copy.style.setProperty('top', '0px', 'important');
    body.appendChild(copy); shadow.append(styles, body); stage.appendChild(host);
    // cloneNode 不保留滚动位置；必须在接入布局之后恢复。
    sources.forEach((el, i) => { if (copies[i]) { copies[i].scrollTop = el.scrollTop; copies[i].scrollLeft = el.scrollLeft; } });
    return { host, animation: null, timeout: null };
  }
  function reveal(item) {
    if (pending !== item) return;
    pending = null;
    if (!item.host.isConnected || (RT.skip && !item.force) || reduced()) return dispose(item);
    active = item;
    if (typeof item.host.animate !== 'function') return dispose(item);
    item.animation = item.host.animate([{ opacity: 1 }, { opacity: 0 }], { duration, easing: 'ease-in-out', fill: 'forwards' });
    item.animation.finished.then(() => dispose(item), () => dispose(item));
    item.timeout = setTimeout(() => dispose(item), duration + 200);
  }
  function begin(force = false) {
    if (!playing || (RT.skip && !force) || reduced() || pending) return;
    try {
      dispose(active);
      pending = capture(); pending.force = force;
      const item = pending;
      // 让新 DOM 先布局；资源未解码时最多等 180ms，绝不延迟剧情执行。
      frame = requestAnimationFrame(() => {
        frame = 0;
        const images = [...layer.querySelectorAll('img')].filter(img => !img.complete);
        const ready = images.map(img => img.decode?.().catch(() => {}));
        if (ready.length) Promise.race([Promise.all(ready), new Promise(r => setTimeout(r, 180))]).then(() => reveal(item));
        else reveal(item);
      });
    } catch (e) {
      pending?.host.remove(); pending = null;
      console.warn('渐变不可用，保留正常播放', e);
    }
  }
  function wrap(fn, should = () => true, force = true) {
    return function (...args) { if (should(...args)) begin(force); return fn.apply(this, args); };
  }
  function cancel() {
    cancelAnimationFrame(frame); frame = 0;
    const item = pending; pending = null; dispose(item); dispose(active);
  }
  function dockPage(el) {
    if (!el || reduced()) return;
    el.getAnimations().forEach(a => a.cancel());
    el.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 280, easing: 'ease-out' });
  }
  return { begin, wrap, cancel, dockPage, running: () => !!pending || !!active };
})();
// 顶层事务在改变标题/立绘前采样，嵌套调用同一帧只保留一个旧画面。
startPlay = VN_FADE.wrap(startPlay);
stopPlay = VN_FADE.wrap(stopPlay);
showTitle = VN_FADE.wrap(showTitle);
showPrefs = VN_FADE.wrap(showPrefs);
showBacklog = VN_FADE.wrap(showBacklog);
showGallery = VN_FADE.wrap(showGallery);
showEnding = VN_FADE.wrap(showEnding);
choose = VN_FADE.wrap(choose);
setHideUI = VN_FADE.wrap(setHideUI);
hideSoul = VN_FADE.wrap(hideSoul);
const showSoulImmediately = showSoul;
showSoul = function (page) {
  const dock = SOUL_DOCK, changed = !!page && page !== soulPage;
  if (!dock) VN_FADE.begin(true);
  const result = showSoulImmediately(page);
  if (dock && changed) VN_FADE.dockPage(dock.querySelector('.pg'));
  return result;
};
showPlay = VN_FADE.wrap(showPlay, () => {
  const l = P.lines[RT.idx];
  return !!lastShown && l.trans !== 'cut' && (visKey(lastShown) !== visKey(l) || lastShown.mood !== l.mood || isPause(lastShown) !== isPause(l) || $('#choices').classList.contains('show'));
}, false);
// 覆盖内联关闭回调及 CG 打开/关闭；不为音量滑条、输入、自动/快进状态制造整屏动画。
stage.addEventListener('click', e => {
  const t = e.target;
  if (t.closest('.ovx,#cgview,#gallery .cg:not(.lock),#endcard button,#backlog,[data-seg],[data-tg],[data-soul=test],#pinEnd') || (t.matches('.ovl:not(#title):not(#soul),.ovl>h2'))) VN_FADE.begin(true);
}, true);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !e.isComposing && playing && document.querySelector('.ovl.show,#cgview.show')) VN_FADE.begin(true);
}, true);
// 跳转、快进、失焦和异常中断都不能遗留遮罩。
document.addEventListener('keydown', e => { if (e.key === 'Control') VN_FADE.cancel(); }, true);
window.addEventListener('pagehide', VN_FADE.cancel);

/* ========== 启动 ========== */
(async () => {
  if (studioEditor) {
    const script = src => new Promise((resolve, reject) => { const el = document.createElement('script'); el.src = src; el.onload = resolve; el.onerror = () => reject(new Error('无法加载 ' + src)); document.head.appendChild(el); });
    try {
      if (!window.VN_GAME) throw new Error('没有可编辑的作品');
      if (!window.VN_ART_CATALOG) await script('art-catalog.js');
      if (!window.VNArtLibrary) await script('art-editor.js');
      const draft = window.VN_PREVIEW_ONLY ? null : await loadAutosave();
      loadProject(clone(draft || window.VN_GAME));
      if (!draft) P.cur = Math.max(0, P.lines.findIndex(l => l.chapter && !l.chapter.includes('导航')));
      // Do not automatically reopen a writable folder while inspecting an editor link.
      DIR = null; if (!draft) P.settings.link = false; render(); fit();
      await window.VNArtLibrary.start(window.VN_ART_CATALOG);
    } catch (e) { console.error(e); alert('开发页加载失败：' + e.message); }
    return;
  }
  if (gameMode) {
    document.body.classList.add('game');
    loadProject(window.VN_GAME);
    document.title = P.title || 'Game';
    try { await Promise.race([VNPlugins.boot(), new Promise(r => setTimeout(r, 4000))]); } catch (e) { console.warn(e); }
    return showTitle();
  }
  if (headless) { render(); await VNPlugins.reload({ headless: true }); window.VN_READY = true; return; }
  // 上次用的是项目文件夹：浏览器要求点一下才能重新访问
  const lastDir = fsOK() ? await idbGet('folder') : null;
  if (lastDir) {
    render(); fit();
    const box = modal(`<div id="folderMenu"><div class="opt"><small>继续上次的项目文件夹？</small><button data-f="go">${ic('folder')} ${esc(lastDir.name)}</button><button data-f="no">用浏览器里的项目</button></div></div>`, null);
    box.querySelector('[data-f=go]').onclick = async () => {
      closeModal();
      try { if ((await lastDir.requestPermission({ mode: 'readwrite' })) !== 'granted') throw new Error('没有获得权限'); await openFolder(lastDir); }
      catch (e) { alert('打不开：' + e.message); idbSet('folder', null); const sv = await loadAutosave(); if (sv) loadProject(sv); }
    };
    box.querySelector('[data-f=no]').onclick = async () => { closeModal(); idbSet('folder', null); const sv = await loadAutosave(); if (sv) loadProject(sv); };
    return;
  }
  let saved = null;
  try { saved = await loadAutosave(); } catch (e) { console.warn(e); }
  if (saved) { try { loadProject(saved); } catch (e) { render(); } } else render();
  fit();
})();
