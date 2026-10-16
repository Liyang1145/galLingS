# 2026-10-14 重启恢复与身体X交接

当前续作源已切换为 whale-girl-body-x-wip-v6.cmo3（18:41:41，6,857,815字节），重启后已在Cubism5.3.04 FREE成功打开。Body_TurnX_v6/Warp24的-10/0/10初始关键形已保存，最新原生包18:43:17。默认顶点最大差0.00024414模型像素、透明度差0；225身体组合的下部网格代理最大位移0.00040284。BodyY仍零响应，新身体包Viewer/物理/全身折叠/实际游戏尚未验收，眼部近闭残线仍待。无新Git推送，完整制作目标保持未完成。

完整可执行交接见 LIVE2D-RESUME-20261014.md（工作区根目录）。它覆盖本文件旧条目中的“当前源”和失效窗口ID，历史记录保留用于回退。
# 2026-10-14 14:19 极近闭笔画浓度保持与现有Viewer复用

- 当前续作试验源 whale-girl-lash-opacity-separation-wip-v6.cmo3，14:00:05原生CtrlS，6,855,376字节；13:23源6,847,868字节备份 before-opaque-closure-checkpoint-v6.cmo3。稳定 bilateral-blink-smile-wip-v6仍11:33未覆盖。默认双Open1/Smile0、XYZ0，原结构保留。
- 仅ClosedLash_Hi_L_v5自身Open轴新增.05关键点（原0/.1/.25/.5/1保持）。精确数值框输入.05、提交后opacity50可编辑，再改100。直接点击密集滑杆x422落在约.06插值（opacity40且灰字段），因此未在那个插值状态修改；续作密集关键值应使用数字框，不把显示一位小数或滑杆附近点击当精确键。原生进入.05后设置100，几何未直接拖动。
- 新opacity law：闭眼笔画Open0..05保持100，.05..1/10淡出到0；主睁眼睫毛仍0..1/10淡入，眼白仍0..1/4淡入。用途是已校准轨迹上保持浓度，不等于所有重叠轮廓/厚度问题已修复。原生401.6%干净面部对比中性与Smile1/.05，深色线条恢复，但内端仍有细双线。
- audit-lash-transition.mjs新增.025/.03125/.05/.075/.09375/.1附近样本，实际现在17开度×3Smile=51姿态；既有UV采样阈值与九区间统计不变。未以测试通过代替实际渲染。
- 原生包 runtime-test-v6-opaque-closed-stroke-wip/whale-girl-v6-opaque-closed-stroke-wip.model3.json，14:04:51，MOC132480字节。串行诊断避免已发生的内存峰值问题：右侧含隐藏网格1,215姿态/812,835三角形翻转0/近退化0；与13:27包默认25对象顶点及opacity差均0。真实MOC opacity .025=[.25,1]、.05=[.5,1]、.0625=[.625,.75]、.075=[.75,.5]、.1=[1,0]。几何轮廓诊断保持上一包相同既有采样值；本轮未重新称全部206550组合Core已运行。
- 新包通过Explorer文件关联打开时没有出现Viewer；不按一次无窗口判定Editor终止或重启。现有空启动窗口3154948（与balanced预览同一进程）实际文件菜单→打开，owned文件对话框687x492，输入新model3.json完整路径，成功生成新模型窗口3417144，避免再次启动Java实例。后续预览应复用这个已运行的空启动窗口File→Open；模型子窗口File菜单只有表情/姿势等，不能把它当同一个打开模型入口。小父窗截图可能只386宽，owned文件框用其自身返回截图ID/坐标，勿用父窗裁剪图坐标。
- Viewer3417144标题确认14:04:51包，实际全身载入并面部近景，检查中性Open约.05、Smile1同开度、Smile1约.08和全0。约.05睫毛不再整体淡灰，完全0无虹膜漏出；但约.08仍部分淡线，内端双线、极近闭蓝色眼裂及笑弧局部转折仍待。不是双侧/全连续运动艺术验收。已Reset默认，786x793近景，LOpen606/LSmile621，参数x134..208，Reset113/527。旧balanced Viewer2171880保留。
- Editor1318034当前401.6%、ClosedLash_Hi_L_v5选中，隐藏选择状态开启，源保存后星号消失。查看当前原生物理Meta仍仅2组HairBack_Physics与Tail_Physics、2输出、4物理顶点；不是高质量全身/全部头发衣物物理已经完成。该事实来自磁盘导出的physics3.json，后续全身阶段不能省略。
- 下一步完善.05..1/10交替区的实际笔画厚度/残影与内端轮廓，并把浓度与曲率方案检查到另一侧、Smile0/.5/1和头部角度。然后完整眉眼口情绪、可信XYZ、全身连接/呼吸/重心、前发/衣服及尾巴物理、动作与最终原生/Core/Viewer/实际galLingS接入；保留完整目标，active，无新Git推送。已有Geometry零翻转和默认保留仅证明局部数值稳定，不能证明完成。
# 2026-10-14 13:39 中性闭眼外端与中央平衡校准

- 续作试验源仍 whale-girl-lash-opacity-separation-wip-v6.cmo3，13:23:04原生CtrlS，6,847,868字节。12:48源备份 before-neutral-outer-tip-checkpoint（6,846,496字节）；13:06:55中间源6,846,529字节备份 outer-tip-before-central-balance-checkpoint。稳定 bilateral-blink-smile-wip-v6仍11:33未覆盖。默认双Open1/Smile0、XYZ0。
- Warp23/Smile0/Open0和.25仅外列x1151三排各额外下移24screenpx（401.6%）：0为348/472/597→372/496/621；.25为344/468/593→368/492/617。13:06:55保存、13:11原生 neutral-outer-tip 包，默认差0、右侧含隐藏网格零翻转。其Open.0625九区间中线差为-.24,.5,1.05,1.68,1.94,2.22,2.25,1.15,.63，尾端反向2.77→正向.63改善，但中央受到Bezier耦合牵动。未实际加载此中间包Viewer，不称其艺术通过。
- 接续补偿Warp23/Smile0中央x1026，Open0新观察三排330/455/580各上移8screenpx，.25新观察324/449/574各上移8。操作前重新观察，未重用上轮中心坐标。内/外列不新增直接拖动；Bezier耦合仍会影响其间曲线。Smile1和默认Open1未直接改动。
- 最终原生包 runtime-test-v6-neutral-balanced-closure-wip/whale-girl-v6-neutral-balanced-closure-wip.model3.json，13:27:09、MOC131392字节。对比12:52包默认25对象顶点差0、opacity差0。右侧含全透明网格1,215姿态/812,835三角形，翻转0、近退化0。初次与另外两个诊断并行时Sharp读取16MB纹理报out of memory，失败不算模型折叠；后单独重跑通过。没有重复宣称该包全206550组合Core已经新跑。
- 最新中性Open.0625九区间中线差-1.58,-1.02,-.58,.06,.38,.67,.91,.04,-.28模型像素；Open0 -1.66,-1.12,-.65,-.02,.28,.56,.79,-.06,-.2；Open.125 -1.5,-.92,-.5,.14,.48,.78,1.05,.14,-.27。大部分收敛到1像素内，内端仍约1.6；不称每区均单调改善。Smile1纹理诊断保持12:04包一致。
- 资源恢复：只用CU AltF4关闭本任务旧精确曲线Viewer336764及空启动窗口402288、旧closed-arc-smooth Viewer467418及其空启动窗口6102404；逐一观察并刷新确认消失，文件不删除，Editor1318034保留。关闭模型窗口后Java可能仍保留空启动窗口，不能据窗口关闭即声称进程退出。首次打开balanced没有新的Viewer窗口，进程最新StartTime仍12:54，非单纯捕获超时；资源释放后Explorer实际重试双击moc3成功。旧Viewer206498与206328仍保留对照。
- 最新真实Viewer2171880标题确认13:27:09包，实际全身和面部近景载入，检查中性Open约.05和0。极近闭中线更近，但灰淡睫毛/细蓝色眼裂仍可见；全闭无虹膜漏出、尾部走向更新。画面仍未达到艺术融合要求。已Reset默认；786x793近景，x134..208，LOpen606/LSmile621，Reset113/527。最新Smile1实际Viewer未新检查（几何诊断一致），双側连续眨眼/厚度均待。
- Editor当前1318034、401.6%、Warp23选中、控制点可见、边框隐藏，默认双Open1/Smile0/XYZ0，源已保存。捕获裁剪错误通过fresh list→激活旧Viewer206498→get_window Editor→激活刷新恢复，不能把未知输入结果当未发生而重复。
- 下一步不再单纯追中线：当前0..1/10交替仍导致两纹理均半透明、厚度差明显；需要沿匹配后的轨迹保持笔画清晰并验证连续运动（不能以缩短alpha区间冒充几何完成），补内端小差、Smile1厚度/弧线及另一侧，随后完整眉眼口情绪、可信XYZ、全身连接/呼吸/重心与发衣尾物理、动作，最终原生/Core/Viewer和实际galLingS验收。完整目标仍active，无新Git推送。
# 2026-10-14 12:57 中性闭眼纹理中线校准；父级拱弧方案已撤回

- 当前续作试验源 whale-girl-lash-opacity-separation-wip-v6.cmo3，12:48:28原生CtrlS，6,846,496字节，默认双Open1/Smile0、XYZ0。12:01源另备份 whale-girl-before-nearclosed-arc-checkpoint-v6.cmo3（6,845,467字节）；稳定 bilateral-blink-smile-wip-v6 仍11:33未覆盖。新源未艺术验收，不以默认/零翻转证明完工。
- 诊断真实MOC：中性上睫毛网格高度Open0约4.66、.125约6.97、.25约9.27、1约23.11模型像素，说明整体正向压缩会使近闭轮廓变薄。只是网格包围盒，非真实笔画厚度测量，不据此断言双重压缩来源。
- 已拒绝并撤回的方案：Warp22/Smile1/Open0及.25中央三行各上移12screenpx（401.6%），造成Open.0625蓝色细眼裂抬到闭眼线之上、明显双线。六次CtrlZ逐一刷新，原生包中Smile1真实纹理诊断与12:04包一致，进一步证明未采用该拱弧试验。不要重新按此方案单独抬父级中央列。
- 其他未采用操作：尝试在Warp23矩形内部950,390→950,383以整体移动，实际命中单个转换点，已立即CtrlZ撤回。随后CtrlA观察确认为全模型对象多选（不是当前变形器所有点）；未在全选后输入拖动/移动，重新列表单选Warp23清除多选。不要以CtrlA批量移动当前控制面。捕获裁剪越界仍通过fresh list→旧Viewer206328→get_window Editor1318034→激活刷新恢复；没有重启Editor。
- 本轮采用：Warp23/Smile0/Open0，401.6%隐藏边界框后，内列x901三行y341/465/590各上移15screenpx；中央x1026三行各上移14；外列x1151三行各下移7。每列同幅，保留正向垂直高度。Smile0/Open.25内列相同初始三行各上移19、中央各上移21、外列各下移3。18次分别刷新观察，Smile1及Open1没有新几何修改。opacity沿用上一轮分离试验。
- 最新原生包 runtime-test-v6-neutral-lash-alignment-wip/whale-girl-v6-neutral-lash-alignment-wip.model3.json，12:52:07，MOC131392字节。右侧含隐藏网格1,215姿态/812,835三角形，翻转0、近退化0；对比12:04包默认25对象顶点差0、opacity差0。最新包本轮仅folding/default/纹理诊断；未重复宣称全206550组合Core已重跑。
- 中性真实纹理九区间中线差Open.0625从3.71,4.44,4.33,4.36,4.09,3.59,2.5,.08,-1.79变为-.24,.5,.71,1.05,.95,.81,.25,-1.55,-2.77模型像素。Open0变为-.33,.39,.63,.97,.85,.7,.12,-1.64,-2.75；.125变为-.15,.61,.79,1.13,1.05,.92,.37,-1.45,-2.8。内侧/中央明显收敛，外端仍反向偏差且最后两区有所加大，不能写成九区间全部改善；下一步应局部外端校准并实际看曲率。
- Viewer206498标题确认12:52:07包，实际加载全身并放大面部，检查中性Open约.05和完全0：全闭无虹膜漏出，闭线位置更新，极近闭仍有淡线、蓝色细眼裂和尾部错位。已Reset默认。最新Smile1实际Viewer未重新检查（几何诊断保持前包一致），双側艺术/连续眨眼仍待。窗口786x793近景，LOpen606/LSmile621、参数x134..208，Reset113/527。
- Editor1318034仍当前试验源、401.6%、Warp23选中、显示控制点、边框隐藏，Open1/Smile0/XYZ0。所有续作坐标须新截图。本轮属于采用18个点校准及拒绝错误方案的实质进展。下阶段优先修中性闭眼外端中线/两端倾角，再完善Smile1近闭轮廓、厚度和0..1/10交替区；不把缩短alpha交替当几何融合完成。然后另一侧闭笑、双侧表情、可信XYZ、全身连接/呼吸/重心、发衣尾物理、动作、最终原生/Core/Viewer和实际galLingS验收。完整目标active，无新Git推送。
# 2026-10-14 12:10 睫毛与眼白透明度分离试验副本

- 当前Editor1318034打开的新续作试验源 output/whale-girl-live2d-base/whale-girl-lash-opacity-separation-wip-v6.cmo3，12:01:01原生另存、6,845,467字节。原稳定源 whale-girl-bilateral-blink-smile-wip-v6.cmo3 仍11:33:23、6,843,304字节未覆盖；同源另备份 before-lash-opacity-separation-checkpoint。新副本有可验证改善，但尚非艺术验收通过或已正式替换稳定源。
- audit-eye-folding.cjs新增 --include-hidden 开关，未改变原可见网格检查阈值；独立输出 eye-folding-viewer-right-including-hidden.json。旧11:34包含全透明网格的1,215姿态/812,835三角形也零翻转、零近退化，排除靠透明度掩盖闭眼网格折叠的疑问。
- Warp22仅在Smile0/Open0和Smile1/Open0将组opacity0→100（.25/1原100）；正向压缩几何保持不动。Sclera_Only_Test在Open1默认形重新绑定自身Open0/.25/1，三键本地几何一致，只将Open0 opacity设0，.25/1保持100，使眼白独立淡出；未重复改回旧眼白压缩形。Lash_Overlay_Test原Open0/.5/1增加.1节点，.1/.5/1透明度100，0透明度0；ClosedLash_Hi_L_v5原0/.25/.5/1增加.1节点并设opacity0，原0透明度100保持。两睫毛交替区缩为0..1/10开度，眼白仍0..1/4淡出。不是单纯隐藏错误几何；全隐藏网格诊断也无翻转。
- 原生 runtime-test-v6-lash-opacity-separation-wip/whale-girl-v6-lash-opacity-separation-wip.model3.json，12:04:45，MOC131392字节。右眼含透明网格1,215姿态/812,835三角形零翻转、零近退化；与11:34包默认25对象顶点及opacity差均0。Core206,550有限坐标/合法opacity/阴影引用组合通过，25drawables/28parameters。左眼未改透明度结构，本轮未声称双侧新验收。
- 真实MOC睫毛opacity核实Open0=[0,1]、.0625=[.625,.375]、.125及以上=[1,0]。真实纹理几何诊断与前包一致，只新增 opacity/key 绑定。这说明采用的是独立淡出及缩短交替，并没有以通过数值测试冒充曲线美术修复。
- Viewer206328标题确认12:04:45试验包，实际全身加载、面部近景检查观众右眼中性Open约.125、Smile1同开度、约.05、全0。约.125旧半透明尾部消失，全闭无虹膜外漏；0..1/10区间仍存在淡线/局部错位，近闭上睫毛形状偏平、压缩后过薄，艺术尚不合格。蓝色细眼裂在非零开度仍存在，不写成全闭漏瞳，也不声称已消除。已重置默认，Viewer786x793近景，参数x134..208、LOpen606/LSmile621、Reset113/527。
- Editor当前401.6%，ClosedLash_Hi_L_v5选中、隐藏选择状态开启，双Open1/Smile0、XYZ0，已保存。部分视图字段需再次刷新才能看到新Name/ID。顶部名称查找框PositiveBlink保留但未实际过滤；定位Warp22是通过EyeL_Placement下的位置调整Rotation展开，不能以这个搜索框认定查找成功。
- 下一步在试验副本拟合Warp22 Smile1近闭轮廓/厚度，避免上睑过平过薄；校准0..1/10与闭眼弧的中线和两端，让缩短交替不是掩盖剩余问题。真实Viewer逐步检查更密集近闭区、Smile0/.5/1与双侧，达标后才决定采用/回退。随后继续另一侧闭笑、完整眉眼口情绪、可信XYZ、身体连接/呼吸/重心、发衣尾物理、动作与最终原生/Core/Viewer/galLingS实机验收。完整目标active，无新Git推送。
# 2026-10-14 11:39 高倍率精确闭笑手柄修正

- 最新制作源仍 whale-girl-bilateral-blink-smile-wip-v6.cmo3，11:33:23原生CtrlS，6,843,304字节，星号消失；11:22源6,843,356字节备份为 whale-girl-before-precise-tangents-checkpoint-v6.cmo3。双Open1/Smile0、XYZ0。当前Editor1318034、401.6%、Warp23选中，选择状态可见、边框隐藏。原旧face-refinement源不作为续作入口。
- 更正11:26记录的解释：重新在401.6%观察发现此前低倍率小拖动后中央左右柄仍倾斜，不能据操作意图宣称切线完全水平。实际原因尚未严格证明，可能涉及低倍率吸附或微调落点；不要把推断写成事实。本轮直接在高倍率分离锚点和柄，实际截图已显示水平柄。
- Warp23/Smile1/Open0：401.6%初始中央x1026,y223，右柄1068,237→223、左柄984,230→223；底排y348，右363→348、左356→348。随后通过缩放重定位相机，顶排y287右302→287、左294→287。三排锚点原位置保持，左右柄分别拖动观察。
- Warp23/Smile1/Open.25：重新定位后顶/中/底锚点x1026,y313/439/563；右柄x1068,y321/445/571→313/439/563，左柄x984,y318/443/568→313/439/563。六次分别拖动后观察水平柄。默认Smile0/Open1不改，opacity未调整。
- 两次捕获出现window crop is outside captured monitor；重新list_windows、激活返回的旧Viewer467418、get_window恢复Editor1318034再激活捕获，均恢复。没有重启Editor，失败后不重复输入，因为参数点击已经发生。
- 原生新包 runtime-test-v6-precise-closed-tangents-wip/whale-girl-v6-precise-closed-tangents-wip.model3.json，11:34:59、MOC126272字节。右眼1,215姿态/696,438三角形，翻转0、近退化0；相对11:23包默认全部25对象顶点差0及opacity差0。仅本轮右侧folding/默认/纹理轮廓诊断，不宣称最新包206550组合Core或左侧folding已重新运行。
- 真实纹理中线Smile1/Open.125九区间差约1.94,1.63,1.39,1.32,1.13,1.04,1.73,1.45,1.75模型像素，较11:23版收敛。中央上缘代理差Open0 -1.129、.125 -.294、.25 .542。Open0外端中线仍3.38；只追中央上缘并不能保证两端吻合。
- Viewer336764实际加载11:34:59包，默认全身和面部近景、角色左眼Smile1/Open0及约.125观察。全闭没有虹膜外漏，但闭弧外端转折和近闭半透明睫毛/蓝色眼裂仍待；不是艺术完成。已Reset默认。窗口786x793、近景，参数x134..208，LOpen606/LSmile621，Reset113/527。本轮目录因检查生成3个报告文件异步刷新，首次双击误落报告触发文件关联窗口，已Escape取消，未更改关联；刷新后实际双击moc3载入Viewer。后续须确认文件行真实刷新。
- 下一项：以右侧真实纹理九区间中线和实际Viewer轮廓校准Warp22/Smile1/Open0与.25的近闭上睫毛、厚度和曲率；闭眼笑弧單独调整不足以处理半透明及蓝缝。保持默认眼型与采用阴影、嘴鼻/短圆下颌。随后观众左闭笑弧线/双侧过渡，眉眼口情绪，可信XYZ，全身连接/呼吸/重心和发衣尾物理，动作、原生最终导出及实际galLingS接入。完整目标仍active，无新Git推送。
# 2026-10-14 11:26 半闭笑眼过渡及观众右闭眼切线微调

- 当前原生制作入口 output/whale-girl-live2d-base/whale-girl-bilateral-blink-smile-wip-v6.cmo3，11:22:05 CtrlS保存，6,843,356字节，星号清除。双Open1/Smile0、XYZ0。11:10:29的6,843,312字节源另备份为 whale-girl-before-closed-arc-smoothing-checkpoint-v6.cmo3；10:15源备份 before-half-transition-checkpoint 保留。旧 face-refinement-v6 不含这些双侧改动，不应作为续作入口。
- 接续上轮11:10半过渡修改：Warp23/Smile1/Open.25中央三行上移15screenpx、内列上移3、外列下移8。原生包 runtime-test-v6-smile-half-transition-wip 在11:13:49完成；右侧1,215姿态/696,438三角形零翻转、零近退化，默认对比10:39包最大顶点及opacity差均0。Smile1/Open.125中央上缘诊断差4.29→1.63模型像素。Viewer467182确实加载该包，Open0无虹膜漏出，但闭笑线尚有折角，近闭仍有蓝色细缝和半透明睫毛。
- 本轮仅调整Warp23/Smile1/Open0和.25的Bezier中央切线，不改默认Open1/Smile0。200.8%视图：Open0中央x1027的三行y183/246/308，右柄x1048由191/255/317改为183/246/308，左柄x1006由185/248/310改为183/246/308；Open.25右柄x1048由201/263/326改为196/258/321。九次拖动分别刷新观察；对应三行尽量同步，避免厚度挤压。
- 最新原生包 runtime-test-v6-closed-arc-smooth-wip/whale-girl-v6-closed-arc-smooth-wip.model3.json，11:23:21，MOC126272字节。右侧1,215姿态/696,438三角形零翻转、零近退化；与half-transition包比较默认最大顶点差0，全部25对象opacity差0。Core已完成206,550有限坐标/合法opacity/阴影引用组合，25drawables/28parameters。左侧未新增几何修改，本轮未重新运行左侧folding，不将其写为本轮双侧新检查。
- 新包真实纹理中央上缘诊断差Smile1/Open0约.080、Open.0625约.334、Open.125约.589、Open.1875约.843、Open.25约1.097模型像素。注意它是上缘代理，不能等同轮廓完全对齐：Open.125九区间纹理中线差仍约1.98..2.65模型像素，Open0外端可达4.37。后续应按纹理中线与实际厚度校准Warp22近闭轮廓，不盲目只追中央上缘指标。
- Viewer467418标题确认11:23:21包，实际载入全身并放大面部，检查角色左眼Smile1/Open0与约.125；全闭没有虹膜外漏，弧线中央切线调整已反映，但外端仍有局部转折。接近闭眼仍看到细蓝色眼裂、偏淡睫毛，不宣称艺术验收完成。已点击重置默认，双Open1/Smile0、XYZ0。Viewer当前786x793近景；参数范围x134..208，LOpen606/LSmile621，Reset113/527。Editor1318034当前1426x793、200.8%、Warp23选中，选择状态可见、边界框隐藏。任何续作坐标须重新截图。
- 下一项：校准观众右近闭上睫毛与闭眼纹理中线、厚度及两端曲率，再处理观众左闭笑弧线，检查两侧Open.03125/.0625/.125/.1875/.25、Smile0/.5/1实际融合。保持默认眼型、短圆下巴、已对齐鼻口及采用的阴影。之后继续完整情绪、可信XYZ透视、身体连接/呼吸/重心、头发衣服尾巴物理、动作和表情、最终原生/Core/Viewer以及实际galLingS接入。完整目标未完成，goal保持active，无新Git推送。
# 2026-10-14 10:46 双侧翻转已归零，最新原生包与 Viewer 核验

- 当前制作入口仍whale-girl-bilateral-blink-smile-wip-v6.cmo3，10:15:37、6,842,689字节。最后Smile1上睑微调已在保存文件内。原单侧副本与旧主源均未覆盖。
- 首次smile-relief-probe导出期间Editor658022窗口消失，未产生model3.json；已确认不是捕获超时后的盲目重启。原生副本已保存，因此未丢失修改。启动预装CubismEditor5.exe首次launch未及时出现窗口，随后list_windows确认新Editor1318034、Java46768；选择FREE启动，关闭主页公告，CtrlO实际恢复上述文件。未重做改动，未用自动备份覆盖新文件。
- 恢复后35.5%全身视图、XYZ0、双眼Open1/Smile0，未选择对象。重新原生导出runtime-test-v6-bilateral-smile-relief-recovered/whale-girl-v6-bilateral-smile-relief-recovered.model3.json，10:39:19，MOC126272字节；Editor仍存活且Responding为true。此前空smile-relief-probe目录保留，不把它当有效运行包。
- 最新双侧audit-eye-folding：两侧各1,215姿态、696,438三角形检查，翻转0/近退化0。对侧原2,133→1,001→353→0：移出Warp9/10重复Open，眼白自身Open键移出，最后Warp18 Smile1中央点上移3screenpx消除剩余单三角翻转。两侧报告分别eye-folding.json与eye-folding-viewer-right.json。
- 默认MOC对比最大顶点浮点差.0001220703125模型像素、25对象opacity差0；对侧闭眼隐藏网格4→81明确记录hiddenTopologyChanged。不是所有几何逐顶点完全相同，但当前可见默认形没有实质改变。
- 最新check-runtime-core完成206,550组合有限坐标/合法opacity和阴影引用检查；25drawables/28parameters。最新Viewer2890860标题确认10:39:19包，实际全身及面部近景加载，双眼Open0/Smile0完全闭合无虹膜外漏；两侧Smile1闭眼笑弧也无虹膜外漏。Viewer参数已重置默认，2560x1392最大化、左栏490。
- 艺术问题仍真实存在：满Smile1闭眼弧偏平且有细小折点；观众右眼Open约.125/Smile1时明显上下双线和蓝色细眼裂，不能以0翻转和全闭无漏当连续过渡通过。最新lash-transition-viewer-right.json的Smile1中央上缘代理差Open0约1.39、Open.125约4.29、Open.25约7.06模型像素；0..25闭眼Warp23的笑弧退回中性过快，形成错位。
- 下一步第一项：Warp23/Smile1/Open.25目前为初始中性形（不可见但影响插值），应保持约一半笑弧，而不是在.25完全回落。可先在该键将中央三行同幅上移约15screenpx（以新的实际视图坐标为准），内/外端约半幅倾斜，再从真实纹理中线诊断校准Warp22近闭轮廓。预计缓解.125双线，但必须重新导出/Viewer证实；这是待执行方案，不能写成已完成。后续以Bezier中央水平切线修圆两侧闭眼笑弧，协调眉口/完整情绪，可信XYZ、全身连接/呼吸/重心/发衣尾物理、动作与真实galLingS接入。
- 无Git推送。完整目标未完成，本轮属于可验证的实质进展，不标记完成或阻塞。
# 2026-10-14 10:16 双侧眨眼与闭眼笑弧工作副本

- 当前制作入口whale-girl-bilateral-blink-smile-wip-v6.cmo3，10:15:37原生另存保存，6,842,689字节；Editor658022，284.0%近景，Warp18选中、边界框隐藏，双Open1/Smile0。上轮单侧副本whale-girl-positive-blink-aligned-wip-v6.cmo3仍09:03:24，旧主源06:55均未覆盖。
- 本轮诊断扩展audit-eye-folding.cjs和audit-lash-transition.mjs，第三参数viewer-right检查角色左眼、输出独立viewer-right报告。compare-native-default.cjs允许仅两包默认opacity均0的对象改变拓扑，明确报告hiddenTopologyChanged；有可见opacity的拓扑变化仍报错，未放宽可见默认眼型判据。
- 对侧原始检查1,215姿态、2,133条带绘画的翻转项，闭眼ClosedLash_Hi_L_v5仅4顶点。不是双侧已稳定。
- 保留Warp9 Lash_Local_Correction和Warp10 Eyelid_Blink_Test在Open1的默认几何/opacity100，移出其ParamEyeLOpen轴，保留对象和层级。Warp18原Smile0/1绑定保留。
- 新Warp22 Eye_ViewerRight_PositiveBlink_v6为Warp18父级，仍在EyeL_Placement下，转换5x9、Bezier2x2（创建时改分区后Tab实际提交）。绑定Open0/.25/1 × Smile0/1。Smile0/Open0红边界上下中点1147,168→252、366→296，实际外框248..301；均匀保持方向的闭合压缩。opacity0/100/100。Smile1/Open0整体上移20screenpx（275→255），Smile1/Open.25整体上移6（273→267），Smile1/Open1不改。
- ClosedLash_Hi_L_v5增加Open.25并将opacity50→0，保持Open0为100、Open.5/1为0，完成0..25交叉淡化。开始灰字段不可编辑，随后重新观察/选择网格后字段真实可编辑；没有擅自绑定Rotation3（无Open轴）。
- 对侧闭眼网格原生四等份三次4→9→25→81顶点。新Warp23 ClosedLash_ViewerRight_Smile_v6位于原Rotation3下，转换5x9、Bezier2x2，绑定Smile0/1 × Open0/.25/1。Smile1/Open0中央x1143三行203/265/328均上移30screenpx；内端x1081三行均上移5；外端x1205三行均下移15。Smile0和Open.25/1保留初始形。闭眼笑弧仍偏硬，需要进一步看真实曲线与厚度，不能宣称艺术完成。
- 09:59:03原生runtime-test-v6-bilateral-positive-blink-wip，MOC131200字节：观众左零翻转；观众右1,001项，主要来自Sclera_Only_Test自身旧Open几何。默认比较最大浮点差.0001220703125模型像素、所有opacity差0，隐藏闭眼拓扑4→81明确报告。
- 随后在Open1移出Sclera_Only_Test自身Open轴并保留默认形；由Warp22统一控制几何和淡出。runtime-test-v6-bilateral-clean-blink-wip进一步降至353项，全部仅Lash_Overlay_Test在Smile1有1个翻转三角形，Smile0/.5眼白与闭眼网格不再翻转。剩余问题在旧Warp18睁眼笑意，而非眨眼压缩。
- 最后在Warp18 Smile1/Open1、284%放大下中央中行点1147,266→263（仅笑眼键、约上移3screenpx），释放局部压力，回Smile0后保存上述10:15副本。runtime-test-v6-bilateral-smile-relief-probe正在原生导出；首次检查早于导出文件落盘出现ENOENT，并非模型检查失败，必须等model3.json真实存在再运行，不能将其当0翻转通过。
- 本轮Viewer尚未加载新的双侧包；Viewer334934仍上轮09:00:26单侧contour-probe。新双侧闭眼不漏虹膜、两眼Smile0/.5/1及近闭连续过渡、全身物理/透视/真实游戏验收都待。下一步先完成smile-relief-probe双侧折叠检查，若对侧仍有单三角翻转，继续原生定位Warp18的Smile1局部形，不回退已消除眼白重复压缩的改进。完整目标未完成，无Git推送。
# 2026-10-14 09:12 最新轮廓包已原生 Viewer 复查

- Viewer334934标题确认09:00:26 contour-probe包；全身和面部近景实际载入。最新包206,550组合Core数值检查也已完成并产出runtime-core-check.json，25drawables/28parameters。
- 当前Viewer2560x1392、左栏490宽、近景；动画菜单自动眨眼实际无勾选。手动观众左眼Open约.125、Smile0和1观察，笑眼双轮廓距离比上次aligned-wip收敛，仍留部分半透明线与细蓝色眼裂，不能宣称近闭融合最终完成。之后点击将参数重置默认，双Open1、Smile0。
- 下一步应在新WIP源上完善Open.25附近真实轮廓衔接以及另一侧笑眼，再按完整计划推进。编辑源09:03:24已经保存，原旧源06:55未覆盖。无需重新跑已失败的密集转换分区/网格自身键隔离实验。完整目标保持未完成，本轮属于实质进展。
# 2026-10-14 09:04 最新制作入口：轮廓中线再对齐并保存

- 继续使用whale-girl-positive-blink-aligned-wip-v6.cmo3，已09:03:24原生CtrlS保存，6,843,113字节，星号清除；双Open1、Smile0，Warp21选中，显示菜单已隐藏边界框。08:34校准前备份whale-girl-positive-blink-aligned-checkpoint-v6.cmo3保留。旧whale-girl-face-refinement-v6.cmo3仍06:55未覆盖。
- 新运行导出runtime-test-v6-positive-blink-contour-probe/whale-girl-v6-positive-blink-contour-probe.model3.json，09:00，MOC122,496字节。包含下述新轮廓调整；Viewer16324980仍08:38:33 aligned-wip包，不包含这最后一轮，不得宣称最新包Viewer通过。
- Warp21/Smile1/Open0，200.8%主视图隐藏边界框后，将三列控制点平行微移：外端x891三行235/253/271均下15screenpx（先下、中、上避免碰点）；中列x983三行各下3；内端x1075三行各上5。Smile1/Open.25与1保持此前形状，Smile0不改。此步骤对齐真实纹理中线和两端倾斜，弧线仍是WIP。
- 最新轮廓探针audit-eye-folding仍1,215姿态、696,438三角形、翻转0/近退化0。默认姿态对比旧crossfade最大差仍.0001220703125模型像素，所有25drawables opacity差0。
- 真实像素9水平区间的Smile1/Open0中线平均绝对差2.09→.45、最大4.58→.96模型像素；Open.125平均1.39→.51、最大3.56→1.69。这个诊断依据比只看中央上缘合理，但仍不能代替Viewer像素与连续动作艺术验收。
- 下一步第一项：原生Viewer加载最新contour-probe，关闭动画菜单“自动眨眼”（否则会覆盖手动眼开合），必要时关闭跟踪光标再检查精确XYZ，逐步检查Open.03125/.0625/.125/.1875/.25/.5、Smile0/.5/1；继续调整真实两端弧线/厚度，并校准Open.25处剩余中线差。Viewer参数单击可生效，但自动眨眼开启时会立即覆盖。最大化后左栏分隔线可从x202拖至490，面板宽度变大更易准确操作。
- 对侧闭眼笑弧/眨眼未处理；头部透视、全身连接/物理、真实游戏接入仍待，完整目标未完成。无Git推送。
# 2026-10-14 08:45 正向眨眼修正副本：网格翻转归零，轮廓仍待细化

- 当前原生工作副本：output/whale-girl-live2d-base/whale-girl-positive-blink-aligned-wip-v6.cmo3，6,842,817字节，08:34:25保存。Editor658022已打开该副本，星号清除。原权威whale-girl-face-refinement-v6.cmo3仍为06:55:12、6,843,979字节，未覆盖；新副本是下一步制作入口，不把旧源当已含修正。
- 原生导出runtime-test-v6-positive-blink-aligned-wip/whale-girl-v6-positive-blink-aligned-wip.model3.json，08:38:33。真实Viewer16324980标题确认载入该包，全身和近景已观察。当前Viewer最大化2560x1392、参数栏宽约490；自动眨眼已关闭便于手动检查。已检查观众左眼Open约.5/.125/0、Smile0/1；未进行完整连续动作艺术验收。
- 诊断：旧crossfade包1,404条折叠姿态记录；上一轮Warp11转换分割5x9改9x9探针增至1,539，已弃用。FREE转换分割最高9x9，Copy/Paste Form为PRO功能，不重复这些方案。
- 本轮继承待修复内存：Warp11在Open1移除自身Open轴，保留默认形状。将Warp12/Open0透明度改0，导出local-static-probe后折叠降至1,195，仍不通过。隔离Lash_Overlay_Test2自身Open轴导出mesh-static-probe，仍1,195；已CtrlZ恢复睫毛自身绑定，证明其自身键不是剩余来源。
- 新方案保留Warp11静态默认；Warp12在Open1移除Open轴并保留默认几何/opacity100；Warp19在Open1移除Open轴，保留Smile0/1睁眼笑意。未删除对象、子网格、图层或原画。
- 新Warp21 Eye_ViewerLeft_PositiveBlink_v6成为Warp19父级，仍位于角色右眼Placement下；转换5x9、Bezier2x2。创建对话框改分区未提交，实际仍2x6，随后检视面板输入2并Return才真正改为2x2。今后所有数值需Return并观察实际提交结果。
- Warp21绑定ParamEyeROpen0/.25/1 × ParamEyeRSmile0/1。Smile0/Open1保持单位映射；Open0用红边界上下中间缩放手柄166→250、364→294（实际外框247..299，留8px边距），形成保持方向的均匀压缩。opacity0/100/100，实现min(4*Open,1)淡化，沿用已有闭眼素材反向淡化。Smile1/Open0整体上移20screenpx（中心273→253），Smile1/Open.25整体上移6screenpx（中心271→265）；Smile1/Open1不改。当前Smile0/Open1保存。
- audit-eye-folding.cjs检查XYZ27 × Smile3 × Open15共1,215姿态，696,438三角形检查，翻转0、近退化0；范围仅观众左眼睫毛/眼白/闭眼网格，不证明对侧/全模型或像素遮罩。报告eye-folding.json。
- 新compare-native-default.cjs对实际MOC默认姿态逐Drawable对比旧crossfade包：所有25对象opacity差0，最大顶点差0.0001220703125模型像素，仅观众左眼睫毛/眼白浮点误差，其余完全相同。报告default-pose-comparison.json。
- check-runtime-core.cjs既有206,550组合全部有限顶点/合法opacity通过，25drawables/28parameters。数值检查不代表画质、物理连续播放或实际游戏验收。
- lash-transition.json：Smile1近闭交叉淡化中央上缘代理差Open0/.0625/.125/.1875/.25分别约.428/.283/.138/.034/-.069模型像素。但Viewer实际近闭仍有淡化后的双轮廓/较平直横线，不能拿代理指标当艺术通过。闭眼笑弧本身也仍不够圆润甜美，需继续修整Open与Closed真实线条、厚度与两端走向。
- 下一步以新WIP副本继续：对齐真实轮廓中线（不要只对齐上缘高分位，睫毛尖会影响代理）；保留无翻转的正向压缩、默认眼型；完善另一侧闭眼笑弧与同步过渡。之后眉眼嘴完整情绪、可信XYZ透视、全身连接/呼吸重心/发衣尾物理、动作文件、真实galLingS接入。无新Git推送，完整目标未完成。
# 最新接续：闭眼笑弧、近闭眼淡化与真实翻折诊断（2026-10-14 07:20）

- 当前权威源 whale-girl-face-refinement-v6.cmo3：6,843,979字节，2026-10-14 06:55:12；与whale-girl-lash-crossfade-wip-checkpoint-v6.cmo3哈希相同。已关闭不保存自动重整实验并重新打开权威源，默认双眼Open1/Smile0、XYZ/嘴/眉/视线0。当前Editor658022，1426x793，35.5%全身、无选中对象。完整目标仍active，未做新Git推送。
- 本轮已采用闭眼笑弧修正：Warp20，Smile1/Open0，200.8%画布下移后的左列x864三点y271/333/396→286/348/411（下移15屏幕px），右列x990三点→266/328/391（上移5）。中列上点250→245；中/下两点在401.6%精确294→284、419→409（等效200.8%各上移5）。误吸附的整块平移已立即撤回并刷新核对，最后以400%点间距离分离后做中列。Smile0完整闭眼不改；默认睁眼不改。
- ClosedLash_Hi_v5于Smile0/Open0原生网格编辑再“四等份”一次，25→81顶点。06:07:27曾保存6,839,631字节，备份whale-girl-closed-arc-81mesh-wip-checkpoint-v6.cmo3。独立原生包runtime-test-v6-closed-arc-wip，MOC中确认闭眼81顶点/128三角形；开眼睫毛219顶点/315三角形、眼白144顶点/226三角形。
- 修正真正的交叉淡化：补齐同侧ParamEyeROpen .25关键点：Lash_Overlay_Test2、Warp11、Warp12、Warp19、Warp20、ClosedLash_Hi_v5（Sclera_Only_Test2既有.25键保留）。Warp19/20现有Smile0/1×Open0/.25/.5/1八键，其余新键采样原插值形状。Warp11/Open.25将不透明度50→100；ClosedLash_Hi_v5/Open.25不透明度50→0。未改Iris_Test2自身opacity，运行确认该虹膜恒1并被Sclera_Only_Test2裁剪。补齐父子键态后共同透明度才能正常编辑；不以灰色字段显示值冒充改动。
- 最新原生SDK5.3检查包runtime-test-v6-lash-crossfade-wip/whale-girl-v6-lash-crossfade-wip.model3.json，2026-10-14 06:59:29，MOC125760字节、2048纹理、physics/CDI。原生Core33姿态确认开眼睫毛opacity=min(4*Open,1)、闭眼opacity=1-min(4*Open,1)，Smile0/.5/1一致；Open.25时Lash/Sclera/Iris=1、Closed=0。更早的细化网格包及curve2包均保留。新包尚未Viewer加载。
- audit-lash-transition.mjs现记录真实vertexCount；新包Smile1/Open.25中段上缘代理差.15356模型px。代理上缘/透明度好看不等于连续眨眼美术通过。
- Core6.0.1最新包：25drawables/28parameters，基础3645+视线6075+眉177147+笑眼19683，共206550组有限顶点/合法opacity/阴影mask检查通过。这些检查原本不覆盖几何翻折。
- 新audit-eye-folding.cjs读取真实MOC三角形，按默认形状符号检查XYZ27×Smile3×Open15=1215姿态，对opacity>=.02对象计数；UV实际atlas每2px采alpha>=128，至少3个样本判作有绘画的三角形。只诊断几何符号，不渲染mask/纹理重叠/物理。报告eye-folding.json。
- 更严格诊断不通过：最新crossfade与之前closed-arc包都检出1404个网格-姿态翻折项（带绘画样本），其中Lash_Overlay_Test2 972项、Sclera_Only_Test2 432项；ClosedLash_Hi_v5没有翻折项。问题在旧开眼闭合形变中已存在，不能把有限坐标检查通过当眨眼完成。XYZ0/Smile0/Open.25的开眼睫毛8个翻折三角形，6个带绘画；Open.5仍1个带绘画翻折。近Open.03125还较多，Sclera和Lash均受影响。缩短淡化虽去掉.25双剪影，却让旧翻折更早显示，因此当前仍是WIP，需要修开眼几何。
- 已否定并撤回实验：Warp12/Smile0/Open0按“重置贝塞尔控制点”，开启“自动调整顶点”，400%中列上第二点249→251再回249触发重整。另导出runtime-test-v6-blink-reshape-probe做单变量对比，翻折项仍1404，近零眼白仅细微变化，无有效改善。不采用；关闭文档不保存并重新打开06:55权威源，自动调整顶点仍按原设置，不能再次重复此实验当进展。
- 通过UI只读核对：同侧闭眼放置Rotation2倍率4.5%、父级EyeR_Placement/Warp2，均未显示Open绑定；不能随意新增其Open键。原Iris_Test2自身opacity1、maskSclera_Only_Test2；不用额外透明度键重做虹膜。不要在灰色/未确认焦点的属性框用CtrlA：它可能变成全局选择；Shift+Down也会移动选中图形而不是选树范围（本轮眼白位移已撤回，且磁盘源不含此实验）。
- 官方参考已读： https://docs.live2d.com/en/cubism-editor-manual/inspector-palette/ 与 https://docs.live2d.com/en/cubism-editor-manual/edit-parameters/ 。手动键编辑可在稳定对话框刻度x563/y220直接加精确.25并核对表，省去添加键子对话框；参数右键可吸附关键点。CU快照可能先返回过渡/旧属性；动作后等350~800ms，模态必要时再观察，必须确认选中对象名称/ID后操作。Crop失败重新返回窗口绑定、激活Viewer再Editor恢复，不复用失败坐标。
- 下一步优先定位Warp11/Warp12及Lash/Sclera自身Open0/.25/.5关键形中实际翻折三角形对应的位置，逐项修复；不要继续凭单一上缘间隔或alpha终点调形。得到无翻折且干净连续眨眼后，再制作观众右闭眼笑弧，协调眉眼口，可信XYZ、全身连接/呼吸/物理、最终原生导出与galLingS实际接入。完整要求未完成，不缩为单眼检查点。
# 最后观察补记（2026-10-14）

- 最新默认态再保存：6837095字节，2026-10-14 05:46:48。新增curve2-defaults-checkpoint备份；几何同05:38:36导出，只有最后检查/视图状态再保存。
- 803.1%隐藏选择状态实际检查Smile1/Open.25与Open0：主轮廓更接近，但仍看到闭眼素材向下睫毛与开眼向上睫毛的双剪影；完整闭眼Smile1弧线还偏斜且中央局部隆起，尚非自然甜笑。下一步需调整闭眼笑弧真实轮廓并让开眼近闭合轮廓匹配，不能继续仅优化单一上缘差指标。
- 最终Editor恢复200.8%干净整脸、隐藏选择状态有效、双眼Open1/Smile0，Warp20仍选中。原生保存完成；完整目标未完成。

# 最新接续：睫毛过渡几何修正（2026-10-14 05:38）

- 当前权威源 output/whale-girl-live2d-base/whale-girl-face-refinement-v6.cmo3：6,837,095 字节，2026-10-14 05:36:59；备份 whale-girl-lash-transition-curve2-wip-checkpoint-v6.cmo3。默认双眼 Open1、Smile0，XYZ0，嘴/眉/视线0。完整模型目标仍 active，未完成最终美术、物理或游戏验收，无新 Git 推送。
- 补录上一轮 04:40：Warp19（观众左/角色右的开眼笑眼）新增 ParamEyeROpen0/.5/1 与 Smile0/1 六键；Smile1/Open0，中列在801.7%中行上移100屏幕px、下行相对原形上移100屏幕px，使近闭眼开眼素材向闭眼笑弧收敛。04:40 checkpoint 和 runtime-test-v6-smile-transition-wip 保留。
- 补录05:07：Warp20（观众左高分辨率闭眼笑弧）Open.5、Smile0与1，左边三点下移13屏幕px、右边三点上移13屏幕px（200.4%）；Open0完整闭眼弧和Open1隐藏形状不改。05:12:06附近原生导出 runtime-test-v6-smile-transition-shear-wip，moc117568字节。其 Smile1/Open.25 中段上缘差2.18模型px，端部错位改善但中段仍分离。
- 本轮最终只保留几何修正：Warp20 Open.5/Smile0与1，200.8%中列 x927 三点 y172/234/297→163/225/288（上移9屏幕px），左边列 x864 y185/247/310→198/260/323（再下移13屏幕px）。转换5x9、Bezier2x2不改；完整Open0笑弧、Open1中性与原opacity曲线不变。
- 曾试缩短交叉淡化到Open.2，涉及ClosedLash_Hi_v5关键点/opacity、Warp11及Lash_Overlay_Test2中间键。未可靠验证睁眼有效透明度来源；关闭文档不保存后，重新打开本轮开始的05:07权威源，再仅重做上述几何。实验不在当前源/curve2导出中，不能声称已完成切换。Cubism撤销包含选择变化，不能按四次CtrlZ假定模型回滚四项；采用磁盘源恢复。
- 最新原生 SDK5.3 包 runtime-test-v6-smile-transition-curve2-wip/whale-girl-v6-smile-transition-curve2-wip.model3.json，2026-10-14 05:38:36，moc117568字节、2048纹理、physics/CDI。curve-wip中段版本单独保留。
- audit-lash-transition.mjs 用实际atlas深色alpha纹素、UV三角形重心插值映射到真实MOC顶点；33个Open/Smile姿态、共用x区间9段。不是遮罩渲染/美术验收。Smile1/Open.25原WIP九段最大绝对差2.98→shear2.18→curve2 1.15模型px；curve中段最佳.53但外眼角-1.84，curve2整体更均匀（九段 .30,-.21,1.08,.98,1.15,.55,.64,.81,.62）。Smile0/Open.25九段 -.22,-.86,.65,.53,.99,.68,.56,.60,.23。当前Open.25两素材opacity仍均.5，未以隐藏素材冒充修复。
- Core6.0.1读取最新curve2：25 drawables/28 parameters，3645基础+6075视线+177147眉+19683笑眼，共206550组合，顶点有限/opacity合法/阴影mask引用检查通过。检查不证明三角折叠、无像素重影、自然透视、物理或游戏完成。
- Viewer真实新窗口595206标题确认05:38:36 curve2包；完整全身及面颈近景已观察，无红轴线/眼嘴参考框输出，阴影素材可见。此时为默认运行，不算Smile/Open连续组合通过；仍需Viewer表情/动作播放。
- Editor658022，1426x793、200.8%面部，Warp20选中；边界框隐藏、选择状态未隐藏。参数滚动位置：左Smile625，右Open650，右Smile678，EyeBallX704/Y730。当前三列闭眼控制点（Open1）x864/927/990，y171/234/297；再次操作必须新截图。
- 下一步：800%干净近景复查Open.0625/.125/.1875/.25/.375、Smile0/.5/1。当前量化整体改善但睫毛两套剪影仍不同，不宣布过渡完成；有必要时增加真正中间几何键或修闭眼源轮廓，先解决同侧后再绑定观众右闭眼笑弧。随后眉眼口情绪协调、可信XYZ、全身连接/呼吸重心/发衣尾物理、最终原生导出与实际galLingS接入。
# Live2D 最新检查点：颈影与二次眼口微调

## 2026-10-12 20:38 已保存

- 权威源 output/whale-girl-live2d-base/whale-girl-face-refinement-v6.cmo3：9,322,319字节，2026-10-12 20:38:50。备份 whale-girl-eye-mouth-balance-checkpoint-v6.cmo3；此前颈影检查点 whale-girl-neck-shadow-checkpoint-v6.cmo3 为9,322,309字节、20:22:22。CtrlS未使用原画提示均选否，保留4张历史源。
- 接续此前未保存JawNeckShadow_v6：Rotation5倍率7%、角度0，颈部位置沿用上轮1053,394→1008,271放置；网格透明度35%、绘制顺序500、裁剪ID BodyCore（身体绘制顺序498）；Rotation5从Root挂到Head_Turn，保持初始姿态。新图集纹理倍率40%，X914/Y1457（2048图集），原生重叠/越界选择检测未选中冲突项；不重新排原眼部纹理。
- 隐藏选择状态下观察AngleX -30/30；X30,Y30；X30,Y-30；X30,Y-30,Z30，未见新颈影明显跑出身体边缘。不代表全27组合或运行验收；头部现有近远透视偏弱，待改。恢复角度点击中点后显示XYZ各-0.1，近中性但非精确0，之后编辑关键形前应数值归零。
- 用户重发三张参考复制至 references-user-20261012/：face-target.jpg、painting-reference.jpg、fullbody-reference.jpg；最新二次评价截图 face-secondary-target.jpg。PLAN-v6顶部补当前覆盖关系（眼睛仍在范围、继续制作），末尾补二次评价执行依据。
- 实际刷新后核实眼睑ID：观众左眼是Warp12、观众右眼是Warp10，之前摘要方向对应写反；以后以实际选中网格、参数绑定和屏幕位置确认，不能依赖旧摘要。
- 2560主截图、283.4%：观众左Warp12/Open1中上两个控制点1457,746→1457,741及1499,746→1499,741；观众右Warp10/Open1点1688,747→1688,744及1732,747→1732,744。保留现有虹膜与高光，不新画整眼、不替换眨眼结构。复查角色左独立Open0、双眼0、左0.5/右0、双眼0.5，后回双眼1，未见明显眼白/虹膜外漏。全范围连续插值与角度组合仍待检。
- Rotation4倍率5.5%→5.1%（共享眼口之外的嘴部整体控制；Open/Form旧键保留）， pivot1594,865→1594,860，整体上移5屏幕px。MouthForm0/Open0干净整脸检查；Open1配Form0/+1/-1检查未见明显双线或折叠，回Form0/Open0。仍需更完整嘴型情绪/眉眼组合审查，不将微调当最终艺术验收。
- 内置image_gen产生独立刘海投影候选 exec-b9db2a59-5727-4c87-bfa9-9c7113b08800.png，已复制layers/bangs-cast-shadow-candidate-v6.png。以bangs-accessories-draft-v1作精确形状指导、水中原画作画风参考，要求透明玫瑰灰紫半透明窄投影，不带头发/五官/皮肤底。实际中央影带偏厚且偏下；仅候选，未组PSD、未导入/绑定，需收薄和定位后判断，不能宣称刘海投影完成。
- 当前Editor8065280，2560x1392主窗口，283.4%，Rotation4选中但隐藏选择状态开启；参数面板在嘴与身体位置，双眼1，Form/Open0。source星号已清除。所有坐标操作需新截图，不能用旧1426窗口坐标。
- 下一步：以最新二次图继续审查上睑自然拱弧与两眼平衡（改幅刻意克制）、嘴位/闭口浅弧，刘海投影融合，然后微侧中性/可信头部透视、全身连接和物理、v6原生导出/Core/Viewer/本机游戏验收。无新运行导出或Git更新；完整目标尚未完成，goal保持active。

# Live2D 最新检查点：中央刘海投影、v6 原生导出与混合实验

## 2026-10-12 当前状态（先读此条）

- 中央投影已独立接入BangsCenterShadow_v6，Rotation6倍率15%、角度0、Head_Turn父级。原生283.4% pivot1051,566→780,424，再780,424→780,430。网格opacity40%、draworder最终500、mask Face_Static_v4（已选脸底确认真实ID）。499同脸底顺序下显隐差异不足，已改500并微下移；中央投影仍较克制，不能当完整刘海光影完成。
- 素材layers/bangs-cast-shadow-thin-candidate-v6.png，内置image_gen编辑exec-d25581b8-0944-43d6-b72e-acfc8069c4a2.png。生成仍没有精确遵从要求的坐标；按实际素材截中央crop490,810,280,150，仅作PSD组装，无位图重画/改色/预缩小。bangs-center-shadow-import-v6.psd为185,640字节、1024x1536、left450/top200、单层高分辨率，像素回读通过。两侧影条未导入，前一候选保留。
- 图集新中央影条100%倍率、X543/Y1508，原生重叠和越界检测没有选中冲突项；既有眼部纹理位置不改。显隐A/B后保持可见。
- 21:21:18权威源曾保存9,370,556字节，含中央投影。随后原生CtrlAltS输出SDK5.3/Cubism5.3检查包runtime-test-v6/whale-girl-v6.model3.json：moc3 98,816字节，2048纹理、physics、CDI，21:25:41。隐藏旧部件/图形网格不导出。检查包不是最终交付。
- 新可复用check-runtime-core.cjs用既有外部CubismSdkForWeb-5-r.5/Core/live2dcubismcore.js（实际Core6.0.1）加载真实moc；22drawables、28parameters。采用Face、MouthClosed/Open_v6、两阴影存在，旧Face/旧EyeOpen/旧Mouth不导出。两阴影opacity约.4/.35、mask分别Face_Static_v4/BodyCore。XYZ三点×左眼五点×右眼三点×Open三点×Form三点共3,645组合顶点有限、透明度合法。report runtime-test-v6/runtime-core-check.json。仅证明数值/引用完整，不证明三角折叠、画质、物理播放或游戏验收。
- Viewer6当前窗口ID9308106，原生实际加载上述21:25检查包，完整全身和面部近景已观察；红轴/眼口框未出现在运行图。Viewer滚轮在面部位置向上可锚点放大：全身492,164,-360，再491,185,-240；底部放大按钮会以中心放大导致头部出画。左拖画布不能平移（会影响动作观察），不重复。
- Viewer近景发现颈部仍有浅色带观感，不能认为颈影美术完成。素材alpha加权RGB约180/117/119，比肤色暗，但实际普通混合仍需诊断。Editor随后将JawNeckShadow_v6颜色混合由正常改正片叠底，透明度混合Over，opacity35不变。Cubism提示部分混合模式在SDK/动画可能表现不同，当前显示“外观可能与预期不符”需点详情检查。该实验尚未重新导出，21:25检查包与Core报告不覆盖这个最后改动。
- 最新源已保存，具体时间/大小见下条自动记录；备份whale-girl-shadow-blend-checkpoint-v6.cmo3。下次第一步检查混合模式详情和运行支持，重新导出单独blend对比包；如果不支持，应原生回退正常后调整真实投影画法/位置与颈部接缝，不能把不支持的模式当完成。
- 多次截屏出现no monitor或crop outside monitor，均重新list_windows、激活返回的其他Cubism窗口（包括各Viewer）、再Editor恢复。不能复用失败前坐标。当前Editor8065280、1426x793、283.4%，颈影选中、隐藏选择状态开启，检视面板滚在颜色/透明度混合属性，嘴Form/Open0、双眼1；XYZ此前约-0.1需精确归零后改关键形。
- 完整目标未完成。下一阶段：解决颈部浅带及混合支持，完善中央/两侧刘海投影并动态检查，眼睑弧度/眼神与最新用户图再审，微侧中性与可信XYZ，全身连接/物理，最终导出/Core/Viewer/实际GALgame验收。无新Git推送。

最新源：9370898字节，2026-10-12 21:44:37。


# 2026-10-14 02:34 独立眉毛导入、上下绑定与原生导出验证

- 权威源 whale-girl-face-refinement-v6.cmo3 已于02:33:07保存，6,822,402字节；备份 whale-girl-independent-brows-y-checkpoint-v6.cmo3。继续使用最新源，不回退覆盖。
- independent-brows-import-v6.psd 原生添加两层 Brow_ViewerLeft_v6/Brow_ViewerRight_v6；共同位置控制 Rotation12，倍率输入9.56%（面板显示9.6%）、角度0、父级Head_Turn。200.4%面部近景共同定位到1008,241。旧Eyebrows只隐藏并保留回退，不删除。
- 新 Rotation13 Brow_ViewerRight_Position_v6 包住观众右眉，绑定角色左眉ParamBrowLY -1/0/+1；新 Rotation14 Brow_ViewerLeft_Position_v6 包住观众左眉，绑定角色右眉ParamBrowRY -1/0/+1。两者倍率100%、角度0、置于Rotation12下。200.4%中性pivot分别1093,240与923,240；+1上移8screenpx，-1下移6screenpx，0不改。最后两眉回0。
- 图集2048x2048，眉纹理倍率100%。原位置X11/Y1035及X11/Y1167原生重叠检查确实选出冲突，因此重新排列：观众右眉X650/Y1292；观众左眉X1347/Y1053。重新重叠与越界检测均未选出对象，应用后模型正常。一次未选中对象的拖动只形成框选，没有采用错误移动。
- 02:34:31原生SDK5.3导出 runtime-test-v6-brows-y/whale-girl-v6-brows-y.model3.json，MOC/2048纹理/physics/CDI齐全。Core25drawables、28parameters，3645基础组合与6075视线组合均通过有限顶点/合法opacity检查。
- 参数影响审计证实ParamBrowLY只影响Brow_ViewerRight_v6、ParamBrowRY只影响Brow_ViewerLeft_v6，两者maxVertexDelta均0.0038979649543762207，闭嘴/开嘴一致。旧合并眉不在该导出中。EyeBallXY与MouthForm仍有真实影响；眉角度/弧度/左右、笑眼等未完成，仍零响应。
- Viewer18026004标题确认02:34:31新包，真实观察全身与面颈放大图，独立左眉+1、右眉-1组合产生对应位移；随后重置默认。未见重复眉/明显缺纹理。此为局部端点验证，不代表完整表情、头角、连续动作或物理验收。
- 下一步：独立眉角度/弧度与笑眼，协调嘴形形成自然表情；检查发遮挡与中性眉大小/透明度，可信头部XYZ透视，再全身连接、呼吸重心、发衣尾物理和实际GALgame接入。完整目标仍未完成，无新Git推送。

# 2026-10-14 02:51 双眉独立角度原生绑定与导出

- 权威源whale-girl-face-refinement-v6.cmo3于02:49:36保存，6,823,402字节；备份whale-girl-independent-brows-angle-checkpoint-v6.cmo3。新增Rotation15 Brow_ViewerLeft_Angle_v6位于Rotation14下，包住观众左眉；新增Rotation16 Brow_ViewerRight_Angle_v6位于Rotation13下，包住观众右眉。各100%倍率，中性0度，不改位置控制。
- Rotation15绑定ParamBrowRAngle -1/0/+1，对应角度-6/0/+6度；Rotation16绑定ParamBrowLAngle -1/0/+1，对应+6/0/-6度。两侧镜像，参数+1内眉下压，-1内眉抬起；不要把第一次输入+6的操作标题误作最终方向证据。
- 原生200.4%隐藏选择状态观察双角度-1（内眉抬起）、双+1（内眉下压），形态有细微变化，无明显重复眉。随后两角度精确回0，Y也保持0。原有脸型、嘴形与视线不重做。眉弧度/笑眼/完整情绪尚待，不将角度绑定当最终表情验收。
- 02:51:38原生导出runtime-test-v6-brows-angle/whale-girl-v6-brows-angle.model3.json，MOC105,024字节。Core25drawables/28parameters；参数审计确认LAngle只影响Brow_ViewerRight_v6，maxdelta0.0027554631；RAngle只影响Brow_ViewerLeft_v6，maxdelta0.0027557015，闭嘴/开嘴一致。眉Y、眼球XY及MouthForm仍有效。
- check-runtime-core.cjs新增独立眉Y/Angle×XYZ×双眼开合19683组合，要求旧合并Eyebrows不同时导出；加原3645+6075共29403组合均通过有限顶点/合法opacity检查。数值检查不证明折叠、绘画质量、遮挡或物理连续播放。
- 最新眉角包尚未Viewer加载；Viewer18026004仍02:34:31双眉Y包。当前Editor658022、200.4%面部近景、Rotation16选中，隐藏选择状态有效，两眉角度0。创建后FREE变形器总数33个，未开启Pro试用。
- 下一步在角度控制内给两眉网格加足够顶点并创建独立弧度Warp（避免旋转手柄导致过大包围盒），绑定BrowForm；再笑眼/嘴形组合、头部透视与全身动态物理、实际GALgame接入。完整目标active，无新Git推送。

# 2026-10-14 03:17 双眉独立弧度绑定、导出与Viewer复查

- 最新权威源whale-girl-face-refinement-v6.cmo3于03:15:09保存，6,828,498字节；备份whale-girl-independent-brows-form-checkpoint-v6.cmo3。原两眉Y/Angle、眼球XY、嘴形和脸颈阴影继续保留。
- 两眉原4角网格各原生“四等份”两次，变25顶点。新Warp16 Brow_ViewerRight_Form_v6位于Rotation16下，绑定角色左眉ParamBrowLForm -1/0/+1；新Warp17 Brow_ViewerLeft_Form_v6位于Rotation15下，绑定角色右眉ParamBrowRForm -1/0/+1。默认转换5x5、Bezier2x2。从实际眉网格创建，包围盒没有包含旋转手柄。
- 801.7%局部控制：右侧中央列x1095，三控制点y196/242/288；左侧中央列x925，同三y。Form+1三点分别上移16screenpx，Form-1三点分别下移20screenpx；两端不改。使用显示菜单“显示/隐藏边界框”隐藏该对象红框后操作绿点，避免中央红手柄吸附整体平移。两侧0不改。另一次短暂切编辑级别1随后回2，没有采用额外形变。
- 200.4%隐藏选择状态观察双Form-1、双Form+1，眉弧有克制变化，未见明显硬折/重复线。最后双Form0，角度/Y仍0，双眼1、嘴Form/Open0。笑眼仍未绑定，不将眉部完成当整脸最终验收。
- 参数点击后截图四次报“window crop is outside captured monitor”，均重新列窗口、激活全部Cubism Viewer再回Editor恢复；核实参数实际已切换后才继续，未重复未知拖动。后续坐标操作用面积最大的主截图ID，不能假定screenshots[0]始终为主窗口。
- 03:17:43原生SDK5.3导出runtime-test-v6-brows-form/whale-girl-v6-brows-form.model3.json，MOC108,928字节、2048纹理、physics/CDI齐全。Core25drawables/28parameters。BrowLForm只影响Brow_ViewerRight_v6，maxdelta0.0019490719；BrowRForm只影响Brow_ViewerLeft_v6，maxdelta0.0019491315。开/闭嘴均有效。Y与Angle也仍有效。
- check-runtime-core.cjs增加两眉Form轴：独立眉Y/Angle/Form×XYZ×双眼开合177147组合，加3645基础与6075视线共186867组合通过有限顶点/合法opacity检查。此检查不证明三角折叠/美术/物理播放/游戏验收。
- Viewer332074标题确认03:17:43最新包，实际全身及面颈近景观察。左眉Form+1、右眉Form-1和双Angle-1叠加抽查，眉毛独立反应，无明显重复眉或缺纹理；重置默认。截图中曾观察到默认眨眼闭合，但没有证实完整视线动作文件连续播放。
- 当前Editor658022、200.4%近景、Warp17选中、隐藏选择状态有效，所有眉参数0；最新Viewer332074参数面板已滚到眉Form/嘴部，全部重置。FREE当前变形器35个。下一步笑眼及眉眼嘴完整情绪，再可信头部XYZ透视，全身连接、呼吸重心发衣尾物理和实际GALgame接入。完整目标继续active，无新Git推送。

# 2026-10-14 03:51 睁眼笑意初绑保存与原生运行参数核验

- 最新权威源whale-girl-face-refinement-v6.cmo3于03:48:10保存，6,832,301字节；备份whale-girl-eye-smile-open-checkpoint-v6.cmo3。双眼Open1、Smile0、嘴Form/Open0、眉参数0；中性眼型未重做。
- 原生核实观众右眼眨眼Warp10、观众左眼眨眼Warp12，各在原位置调整旋转下，与虹膜GazeXY是兄弟链。新Warp18 Eye_ViewerRight_Smile_v6包住Warp10，绑定角色左眼ParamEyeLSmile0/1；新Warp19 Eye_ViewerLeft_Smile_v6包住Warp12，绑定角色右眼ParamEyeRSmile0/1。转换5x9、Bezier2x6，保留原位置父级和眨眼子级，不把虹膜挂入笑眼父级。
- 801.7%Smile1/Open1局部：右中心列x1091，下行y389→341（上48screenpx），中心行y279→287（下8）；左中心列x928，下行y390→342，中心行y279→287。两侧外围不改，Smile0不改。显示/隐藏边界框用于避免中央整体手柄吸附。
- 实际观察：下睑抬起、眼裂收窄而虹膜高光保留；角色左Open0，角色右Open.5/0未见明显虹膜漏出。200.4%干净整脸双Smile1、嘴Form1/Open0及.5组合已观察。但当前睁眼笑意仍较克制，接近微眯眼，尚未达到完整甜美表情艺术验收；应继续调整眉眼嘴配合，不能宣称最终笑脸完成。
- 高分辨率闭眼睫毛另处于EyeL/R_Placement下，尚未绑定笑眼，也未改变原向下闭合弧度。闭眼时无虹膜外漏只是遮挡证据，不是开心上拱闭眼笑弧已完成。下一步专门处理现有高分辨率闭眼睫毛的笑弧与睁眼/半闭过渡。
- 03:51:57原生SDK5.3导出runtime-test-v6-smile-open/whale-girl-v6-smile-open.model3.json，MOC111,104字节、2048纹理、physics/CDI。Core25drawables/28parameters；LSmile仅影响Lash_Overlay_Test与Sclera_Only_Test，maxdelta约0.00370324/0.00364715；RSmile仅对应Test2两层，近同值。虹膜视线与嘴形/眉控制仍有影响。
- check-runtime-core.cjs新增两侧Smile0/.5/1×两侧Open0/.5/1×XYZ×GazeXY的19683组合，加既有186867共206550组通过有限顶点/合法opacity检查。参数审计证明影响对象，不证明遮罩像素、折叠、最终美术或物理连续播放。
- 两次参数点击后的捕获越界均按重新列窗口并激活所有Cubism Viewer再回Editor恢复，核实值后继续。当前Editor658022、200.4%整脸、Warp19选中、隐藏选择状态有效；参数面板显示EyeOpen/Smile，双眼Open1/Smile0。FREE变形器37个。最新笑眼包尚未Viewer加载，Viewer332074仍03:17:43眉Form包。
- 完整目标继续active：闭眼笑弧、自然情绪、可信头部XYZ透视、全身连接呼吸重心及发衣尾物理、完整连续动作与实际GALgame接入均仍待。无新Git推送。

# 2026-10-14 04:27 观众左侧闭眼笑弧制作中，过渡尚未通过

- 当前权威源whale-girl-face-refinement-v6.cmo3于04:27:01保存，6,835,284字节；备份whale-girl-closed-smile-left-wip-checkpoint-v6.cmo3。最新源是制作中版本，默认两眼Open1、Smile0，嘴Form/Open0、眉0。完整目标active，不能宣称闭眼笑弧完成。
- 原生核实观众左侧闭眼高分辨率网格ClosedLash_Hi_v5（运行导出预计ID带2；尚未导出本次变更），位于EyeR_Placement下的closed-lash-hires-v5旋转内。原4角网格在角色右Open0时“四等份”两次，变25顶点，Open透明度键保留。
- 新Warp20 ClosedLash_ViewerLeft_Smile_v6从实际闭眼网格创建父级，仍在原旋转内；转换5x9、Bezier2x2。ParamEyeRSmile0/1真实绑定。对中央列上移形成初始闭眼笑弧，外围不变。
- 初次只移中央中间点：801.7% x926,y260→180，再400.8% y230→190。发现厚度改变，未作为最终形态；随后回200.4%统一中央三点位移，再收敛幅度。最终此视野中央x926原y213/275/338，Smile1/Open0对应188/250/313（均上25screenpx）；Smile0保持原形。该视野面部因缩放锚点改变，与历史200.4%眼部坐标不完全同位置，恢复不可直接复用。
- 发现Smile1/Open.25闭眼笑弧与原开眼睫毛上下分离。因此Warp20增加ParamEyeROpen0/.5/1，构成Smile0/1×Open0/.5/1六键。Smile0全部不改；Smile1/Open0保留25px中央列上移，Smile1/Open.5及Open1三点均回原213/275/338，使闭眼素材在睁开过程中回落。
- 过渡复查仍未通过：801.7%Open.25（面板四舍五入显示.3）、Smile1，闭眼素材与开眼眼睑仍出现明显半透明双线。没有改透明度隐藏问题，没有将六键存在或无虹膜外漏当作完整通过。观众右侧闭眼笑弧尚未制作。
- 下一步优先修复现有Eye_ViewerLeft_Smile_v6/Warp19的近闭合关键形：它目前只绑Smile，开眼睫毛的闭合姿态仍是原向下弧，导致与新闭眼笑弧错位。应给Warp19接入ParamEyeROpen轴，Smile1/Open0调整开眼Lash/Sclera的近闭合弧至闭眼笑弧位置，Smile1/Open.5与1保留已有睁眼笑意；Smile0全部原样。实际逐步检查Open0/.125/.25/.375/.5与Smile0/.5/1，避免只靠端点。验证后再镜像处理另一侧。
- 新Warp20在Open1时隐藏素材中性几何已恢复，Smile0中性不破坏当前显示。现有高分辨率闭眼素材部分透明和原开眼素材交叉淡化，需要几何对齐，不能仅删去其中一层或压低opacity来冒充连续过渡。
- 本次无新运行导出/Core/Viewer验收。最新可运行导出仍runtime-test-v6-smile-open/whale-girl-v6-smile-open.model3.json（03:51:57，MOC111104），不包含Warp20。Viewer332074仍03:17:43眉Form包。
- CU捕获偶发window crop越界，均重新列窗口、激活所有Cubism Viewer后回Editor恢复。有一次scroll误把72x24临时提示窗当输入范围，报point outside window bounds，未发生缩放；重新绑定主窗口并Escape解除选择，已成功CtrlS并核实文件。本次没有删图层、没有Git推送。
- 当前Editor658022、801.7%观众左眼近景，Escape已解除选择，隐藏选择状态关闭；参数面板双Open1/Smile0。FREE当前变形器38个。完整表情/头部透视/全身物理/真实GALgame接入仍未完成。







