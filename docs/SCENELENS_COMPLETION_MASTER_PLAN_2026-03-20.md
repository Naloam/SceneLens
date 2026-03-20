# SceneLens 完成版总计划书

更新时间：2026-03-20

适用范围：
- 当前本地仓库状态
- 后续多轮开发、修复、验证、提测
- 目标是把 SceneLens 从“功能可演示但存在真实性缺口的原型”推进到“能力边界清晰、主路径可用、关键能力说到做到的完整应用”

本文档是后续开发的主计划书。除非本地代码状态发生重大变化，否则后续对话与开发应优先以本计划为执行依据，而不是重新做全仓探索。

---

## 1. 目标定义

### 1.1 产品目标

SceneLens 的目标不是做成“后台一直偷听/偷看环境的全自动监控器”，而是做成一个以下面架构为核心的 Android 智能场景助手：

1. 使用低功耗信号持续做自动场景检测
2. 在需要时给出可信的个性化建议
3. 对真正可自动完成的动作提供一键执行
4. 对不能自动完成的动作明确标注“仅打开应用/需用户继续”
5. 在用户主动触发时，使用端侧小模型做更精确的环境识别增强

### 1.2 正确的技术边界

必须明确：

- 自动检测主路径应基于时间、位置、围栏、Wi-Fi、运动状态、前台 App、日历、电池、屏幕等低功耗信号
- 相机/麦克风 + TFLite 的端侧小模型适合作为“用户主动触发的精确识别增强”，而不是后台持续常驻主路径
- 第三方地图软件不应被伪装成“通用自动回传选点器”；除非已验证其支持可控 callback，否则只能表述为“查看 / 复制 / 分享回 SceneLens”

### 1.3 完成版定义

一个“可交付的完整版本”至少需要满足：

1. 位置导入主路径真实可用，文案不虚标
2. 自动检测链路稳定运行，误报率可接受
3. 建议系统输出与真实上下文有明确对应关系
4. 一键执行不再大量退化为“只打开首页”
5. 设置、权限、导出、隐私、反馈等基础产品面完整
6. 真机验证覆盖至少一组主流国产 Android 设备与一组原生 Android 设备

---

## 2. 当前状态总览

### 2.1 已完成或基本完成的能力

#### A. 位置导入闭环已达到“可用”

当前已打通三条真实导入路径：

1. 使用当前位置导入围栏
2. 手动输入经纬度
3. 粘贴或分享坐标 / 地图链接导入

当前状态：

- `LocationConfigScreen.tsx` 已将“当前位置导入”作为主路径之一
- `LocationConfigScreen.tsx` 已统一处理粘贴与分享回流文本
- `locationImport.ts` 已支持普通经纬度、地图链接、`destination=` / `dest=` / `daddr=`
- `SceneBridgeModule.consumePendingLocationImport()` 已能读取 `ACTION_VIEW dataString`、`EXTRA_TEXT`、`EXTRA_SUBJECT`
- `app.json` 已声明 `scenelens` scheme
- `AndroidManifest.xml` 已声明 `scenelens://location-import` 的 `ACTION_VIEW` + `BROWSABLE` intent-filter
- 地图入口文案已修正为“查看 / 复制 / 分享回 SceneLens”，不再伪装成通用自动回传选点

#### B. 自动场景检测骨架已存在

当前自动检测主链路已具备：

- `SilentContextEngine` 持续整合时间、位置、Wi-Fi、运动状态、前台 App、日历、电池、屏幕等信号
- `BackgroundService` 能在后台位置更新时触发检测与建议通知
- `settingsStore` 已有自动检测开关、检测间隔、置信度阈值
- 后台位置恢复、策略诊断、恢复工人相关能力已接入原生层

#### C. 用户主动触发的小模型识别链路已存在

当前已具备：

- `UserTriggeredAnalyzer` 可在用户触发时采样图像和音频
- `ModelRunner` 已接入 `react-native-fast-tflite`
- 仓库中已有两个端侧模型：
  - `mobilenet_v3_small_quant.tflite`
  - `yamnet_lite_quant.tflite`
- 可通过音量键双击、桌面快捷方式等入口触发分析

#### D. 建议系统与执行链路已跑通骨架

当前已具备：

- `SceneSuggestionManager` 负责加载静态建议包与执行一键动作
- `DynamicSuggestionService` 提供动态建议增强
- `SmartSuggestionEngine` 提供模板化的智能建议生成
- `NotificationManager` 能展示场景建议通知
- `SceneExecutor` / `SceneSuggestionManager` 已能执行部分系统设置与应用跳转

#### E. 权限与后台运行修复能力已有一定基础

当前已具备：

- 权限检查、权限请求、受阻后跳设置
- OPPO/ColorOS 定向跳转能力已基本吸收
- 后台位置服务状态、恢复计划、修复入口已进入 Settings / Home 相关体验

### 2.2 已知验证结果

已在本地跑通过：

- `npm run typecheck`
- Jest 全量测试
- `:app:compileDebugKotlin`

这说明当前仓库不是“无法运行的破碎分支”，而是一个可以持续迭代的工作基线。

### 2.3 当前最关键的不完整点

当前最关键的问题不是“没有任何功能”，而是以下几类“真实性缺口”：

1. 一键执行的真实完成度不足
2. 建议层仍有模拟 / 启发式 / 模板化成分
3. 一些用户可见设置仍是 placeholder
4. 真机验证不足，尤其是地图分享回流与 OEM 行为差异

---

## 3. 当前问题清单与优先级

本节按 P0-P4 划分。

### 3.1 P0：必须优先收口的问题

#### P0-1. 一键执行真实性不足

现状：

- 很多执行链路在 Deep Link 失败后，会退化为“打开应用首页”
- 当前 UI 容易让用户误以为动作已真正完成

典型高风险动作：

- `COMMUTE.transit_qr`
- `HOME.smart_home`
- `MEETING.meeting_app`
- `TRAVEL.travel_app`

根因：

- Deep link 配置和真实 App 行为未完全打实
- 执行结果缺少“真正完成 / 仅打开应用 / 失败”的清晰分层
- fallback 过于宽泛

影响：

- 这是当前最伤产品可信度的问题

验收标准：

1. 每个一键动作都必须明确归类为：
   - 完全自动完成
   - 打开指定页面但需用户继续
   - 当前不支持自动完成
2. UI、通知、执行结果页文案必须与实际能力一致
3. 不再出现“实际上只打开首页，但 UI 表述为已执行完成”的情况

#### P0-2. `RuleExecutor` 快捷动作仍未真正接线

现状：

- `RuleExecutor.executeQuickAction()` 仍是 TODO 级逻辑，只打印日志

影响：

- 自动化规则链路并不完整
- 用户如果依赖“规则触发快捷动作”，实际得到的是空执行

验收标准：

1. `RuleExecutor` 真正调用 `QuickActionManager`
2. 有成功、失败、权限不足、动作不存在等明确结果
3. 补单元测试与至少一条集成测试

#### P0-3. Settings 中仍有用户可见 placeholder

现状：

- 导出数据：仍是 alert 占位
- 隐私政策：仍是占位提示
- GitHub 链接：仍是假的占位 URL

影响：

- 会让应用明显呈现“课程作业 / demo”感

验收标准：

1. 导出数据变成真实文件导出 + 分享
2. 隐私政策可真实打开
3. GitHub 地址换成真实仓库或移除该入口

### 3.2 P1：重要但可在 P0 之后推进的问题

#### P1-1. 地图导入缺少真机矩阵验证

现状：

- 当前支持分享回流和链接解析
- 但未验证多地图 App 的真实分享体验与回流稳定性

验收标准：

1. 至少验证高德、百度、腾讯、Google Maps 四类入口中的可用子集
2. 明确哪些是：
   - 复制链接可导入
   - 分享文本可导入
   - 支持 callback
   - 完全不支持
3. 文档与 UI 文案同步更新

#### P1-2. 日历建议仍是模拟

现状：

- `ContextPredictor.getCalendarAwareSuggestions()` 仍是模拟逻辑

验收标准：

1. 接入真实 upcoming events
2. 可根据会议开始时间生成建议
3. 会议前提醒、会议模式建议与真实日历对齐

#### P1-3. 天气建议仍未接入真实数据

现状：

- `ContextPredictor.getWeatherAwareSuggestions()` 仍为空壳

验收标准：

二选一：

1. 接入真实天气数据并形成建议
2. 如果短期不做，移除天气相关承诺和文案

#### P1-4. 节假日 / 调休上下文未补全

现状：

- `ContextAggregator.checkIsHoliday()` 仍返回固定 false

验收标准：

1. 至少支持本地节假日 / 调休数据
2. 节假日场景判断与建议不再错误套用工作日假设

### 3.3 P2：体验增强与智能化深化

#### P2-1. 建议生成仍偏模板 / 启发式

现状：

- `SmartSuggestionEngine` 主要是模板、条件评分、随机选择
- `DynamicSuggestionService` 主要是时间段 + 历史使用 + 权重调整

问题：

- 智能感不稳定
- 容易出现“有变化，但不一定更准”

验收标准：

1. 建议排序纳入更多真实因子：
   - 用户接受率
   - 执行成功率
   - 当前时段
   - 当前场景稳定性
   - 常用 App 偏好
2. 可解释每个建议的来源
3. 不再大量依赖随机选择造成不稳定体验

#### P2-2. 通勤时间学习闭环不完整

现状：

- `ContextPredictor` 中通勤时间估计可更新，但没有完整自动学习闭环

验收标准：

1. 能从通勤开始/结束中学习平均耗时
2. 出发提醒随用户真实通勤变化调整
3. 有最小样本保护和异常值过滤

#### P2-3. 模型推理降级策略会制造“伪成功”

现状：

- `ModelRunner` 对无效输入会给低置信度 fallback prediction，而不是显式 degraded result

问题：

- 上层可能把无效输入当成“模型正常输出”

验收标准：

1. 区分：
   - 正常推理成功
   - 输入无效
   - 模型不可用
   - 推理失败后回退
2. 上层 UI 和分析器可感知 degraded result

### 3.4 P3：基础设施与可靠性风险

#### P3-1. `AppDiscoveryEngine` 依赖 fallback candidates

现状：

- 当真实已安装应用或使用统计不足时，会用 fallback 包名映射填充

风险：

- UI 看起来有可用动作，但真实执行失败

验收标准：

1. 区分“已真实发现的 App”与“推测候选 App”
2. UI 不再把纯 fallback 候选当成同等可靠能力
3. 执行前做更严格验证

#### P3-2. 原生 fallback shim 会掩盖真实缺失

现状：

- `SceneBridge` 和部分系统控制层有较强 fallback

风险：

- 有助于稳定，但不利于发现真问题

验收标准：

1. 调试模式下对 fallback 行为做更明显标识
2. 关键能力缺失时在开发日志和诊断页中可见

#### P3-3. 真机级验证不足

重点未充分验证的链路：

- 第三方地图分享回流
- 多 OEM 权限页跳转
- 后台恢复与省电策略
- 系统设置写入
- 深链接打开指定页面而非仅首页

### 3.5 P4：工程与仓库卫生

#### P4-1. 资产目录包含 `.venv`

现状：

- `assets/models/.venv` 存在于仓库目录结构中

风险：

- 增大仓库体积
- 干扰资产管理
- 容易污染打包和审查

验收标准：

1. 将模型制作环境迁移到工具目录或仓库外
2. `.venv` 不进入应用资产目录
3. 更新 `.gitignore` 与模型准备文档

---

## 4. 核心工作流拆分

后续开发按以下七条主线推进。

### 4.1 主线 A：一键执行真实性收口

目标：

- 让“执行”真正代表可验证结果，而不是模糊成功

任务：

1. 梳理所有一键动作及其当前真实结果
2. 将动作拆成三类：
   - 真正自动完成
   - 打开指定页面但需用户继续
   - 仅能打开应用或暂不支持
3. 逐个补真实 Deep Link / Intent
4. 无法真实完成的动作调整文案或临时下架
5. 执行结果增加结构化状态
6. 补执行成功率与降级统计

重点模块：

- `src/services/SceneSuggestionManager.ts`
- `src/executors/SceneExecutor.ts`
- `src/config/scene-suggestions.json`
- `src/config/deeplinks.json`
- `src/automation/AppLaunchController.ts`

阶段验收：

1. `transit_qr`、`smart_home`、`meeting_app`、`travel_app` 先完成专项核对
2. “打开首页” fallback 不再被默认视为真正执行成功
3. 用户在通知/弹窗中能看到明确结果语义

### 4.2 主线 B：规则执行闭环

目标：

- 让自动化规则不再停留在部分空壳状态

任务：

1. 将 `RuleExecutor.executeQuickAction()` 接入真实 `QuickActionManager`
2. 对失败原因做结构化返回
3. 补规则与建议执行之间的接口统一
4. 增加规则执行历史、节流、失败回退策略

重点模块：

- `src/rules/engine/RuleExecutor.ts`
- `src/quickactions/*`
- `src/__tests__/unit/quickactions/*`
- `src/rules/engine/__tests__/*`

阶段验收：

1. 至少一类 quick action 可由规则真实触发
2. 执行结果可追踪
3. 自动化链路无 TODO 级核心空洞

### 4.3 主线 C：位置配置与地图导入产品化

目标：

- 将当前“可用”的位置导入，推进到“可解释、可验证、可维护”的产品能力

任务：

1. 真机验证分享导入矩阵
2. 补全可解析地图链接样本库与测试
3. 优化导入失败时的文案与纠错流程
4. 如果需要地图点选，新增 in-app map picker，而不是继续依赖第三方 map callback
5. 补 LocationConfigScreen 的最终交互收尾

重点模块：

- `src/screens/LocationConfigScreen.tsx`
- `src/utils/locationImport.ts`
- `src/utils/__tests__/locationImport.test.ts`
- `android/app/src/main/java/com/che1sy/scenelens/SceneBridgeModule.kt`
- `android/app/src/main/AndroidManifest.xml`

阶段验收：

1. 当前位置导入、手动输入、粘贴/分享导入全部真机通过
2. UI 不再暗示不存在的自动选点回流
3. 如增加 in-app map picker，则必须做到比当前方案更真实、更稳定

### 4.4 主线 D：自动检测与后台运行稳定性

目标：

- 提高自动检测的可用性、稳定性与可解释性

任务：

1. 继续收口后台位置恢复链路
2. 优化 `SilentContextEngine` 信号权重与误报率
3. 增加对背景受限状态的用户引导
4. 让自动检测开关、检测间隔、后台运行提示形成完整 onboarding
5. 加入诊断页或更明确的 runtime status 说明

重点模块：

- `src/core/SilentContextEngine.ts`
- `src/background/BackgroundService.ts`
- `src/screens/HomeScreen.tsx`
- `src/screens/SettingsScreen.tsx`
- 原生后台恢复相关 Kotlin 文件

阶段验收：

1. 自动检测开启后能稳定运行
2. 背景位置恢复可诊断、可修复
3. 误报与“UNKNOWN 抖动”明显下降

### 4.5 主线 E：端侧小模型识别增强

目标：

- 把现有 TFLite 识别链路从“能跑”推进到“可信”

任务：

1. 补充模型输入无效 / 推理失败 / degraded result 区分
2. 校准模型输出到 Scene 的映射阈值
3. 增加真实样本评测
4. 优化采样时长、推理耗时与异常处理
5. 明确该能力是“用户主动触发增强”，不是后台常驻主路径

重点模块：

- `src/core/UserTriggeredAnalyzer.ts`
- `src/ml/ModelRunner.ts`
- `src/hooks/useUserTriggeredAnalysis.ts`
- `src/components/home/ModelStatusCard.tsx`
- `assets/models/*`

阶段验收：

1. 用户主动触发分析结果更稳定
2. 模型异常不会伪装成正常识别
3. 模型状态可见、错误可解释

### 4.6 主线 F：建议层智能化深化

目标：

- 提升建议与用户实际上下文的一致性与可信度

任务：

1. 接入真实日历建议
2. 决定天气能力：接入或移除
3. 接入节假日/调休数据
4. 用执行成功率、反馈接受率、时间上下文优化排序
5. 收口随机模板选择造成的不稳定输出

重点模块：

- `src/prediction/ContextPredictor.ts`
- `src/services/DynamicSuggestionService.ts`
- `src/services/suggestion/SmartSuggestionEngine.ts`
- `src/services/suggestion/ContextAggregator.ts`
- `src/services/suggestion/PersonalizationManager.ts`

阶段验收：

1. 建议不再主要依赖模拟数据
2. 重要场景的建议可解释
3. 用户接受率与执行成功率可用于后续迭代

### 4.7 主线 G：基础产品面补全

目标：

- 去掉明显的 demo 痕迹，补齐正式版基础能力

任务：

1. 导出数据做成真实文件与分享
2. 增加真实隐私政策
3. 修正 GitHub 仓库地址
4. 增加版本信息、诊断信息、反馈入口收口
5. 清理不该出现在正式交付中的资产或临时文件

重点模块：

- `src/screens/SettingsScreen.tsx`
- `src/utils/diagnostics.ts`
- `docs/*`
- `assets/models/.venv`

阶段验收：

1. Settings 页无明显 placeholder
2. 导出、隐私、反馈形成完整链路
3. 仓库与应用资产更干净

---

## 5. 建议实施顺序

### 阶段 0：冻结当前基线

目标：

- 将当前代码状态作为正式可回溯起点

动作：

1. 提交当前工作
2. 固定本计划书
3. 后续每轮只做增量开发与验证

### 阶段 1：优先修真实性

优先级最高，先做以下四件事：

1. 一键执行真实性清单与整改
2. `RuleExecutor` quick action 真接线
3. Settings 页 placeholder 清除
4. 地图导入真机验证矩阵

理由：

- 这四件事最直接决定产品是否“说到做到”

### 阶段 2：补真实数据源

目标：

1. 日历真实接入
2. 天气接入或删除承诺
3. 节假日 / 调休接入

### 阶段 3：提升自动检测与建议质量

目标：

1. 收口误报
2. 提升建议质量
3. 打通用户反馈到建议排序的闭环

### 阶段 4：提升端侧识别质量

目标：

1. 强化主动触发小模型识别
2. 降低异常与伪成功
3. 优化性能与状态可见性

### 阶段 5：正式版收尾

目标：

1. 设备矩阵测试
2. 资产清理
3. 版本文档
4. 发布前回归

---

## 6. 版本里程碑建议

### M1：可信执行版

目标：

- 修掉最影响可信度的问题

必须完成：

1. 一键执行真实性收口
2. `RuleExecutor` quick action 实装
3. Settings placeholder 清除
4. 地图导入真机矩阵初版

完成后可对外表述：

- “自动检测 + 建议 + 部分一键执行已真实可用”

### M2：真实建议版

目标：

- 把建议层从 demo 感推进到产品化

必须完成：

1. 日历真实接入
2. 天气能力定案
3. 节假日上下文接入
4. 建议排序与反馈闭环优化

完成后可对外表述：

- “建议已能基于真实时间、日历、位置与习惯生成”

### M3：精确识别增强版

目标：

- 让端侧小模型真正成为差异化能力

必须完成：

1. 小模型 degraded result 分层
2. 真实样本验证
3. 主动触发识别 UX 完整

完成后可对外表述：

- “用户可主动触发端侧多模态分析，以获得更精确的环境判断”

### M4：候选发布版

目标：

- 形成可提测、可演示、可复现的候选版本

必须完成：

1. 主路径真机回归
2. 权限与后台运行 onboarding
3. 文档、隐私、导出、反馈完整
4. 仓库与资产收尾

---

## 7. 各模块详细任务表

### 7.1 位置与围栏

涉及文件：

- `src/screens/LocationConfigScreen.tsx`
- `src/utils/locationImport.ts`
- `src/utils/__tests__/locationImport.test.ts`
- `src/core/SceneBridge.ts`
- `android/app/src/main/java/com/che1sy/scenelens/SceneBridgeModule.kt`
- `android/app/src/main/AndroidManifest.xml`
- `app.json`

任务：

1. 验证地图分享导入的真实行为
2. 扩大可解析链接格式测试
3. 如果保留外部地图入口，继续保持“查看/复制/分享回流”语义
4. 仅在引入受控地图组件时再提供“地图点选”能力

### 7.2 自动检测与后台

涉及文件：

- `src/core/SilentContextEngine.ts`
- `src/background/BackgroundService.ts`
- `src/screens/HomeScreen.tsx`
- `src/screens/SettingsScreen.tsx`
- `src/background/__tests__/*`
- 原生后台服务 / worker / receiver 文件

任务：

1. 检查 `UNKNOWN` 抖动与强信号优先级
2. 确认后台恢复策略在不同受限情景下的行为
3. 优化用户对后台运行状态的可感知性

### 7.3 权限与系统设置

涉及文件：

- `src/hooks/usePermissions.ts`
- `src/screens/PermissionsScreen.tsx`
- `src/utils/PermissionManager.ts`
- `src/utils/__tests__/PermissionManager.test.ts`

任务：

1. 保持当前 OPPO / fallback 行为稳定
2. 强化用户对“权限已受阻”的理解与跳转效果
3. 增加不同权限失败后的文案一致性

### 7.4 建议与执行

涉及文件：

- `src/services/SceneSuggestionManager.ts`
- `src/executors/SceneExecutor.ts`
- `src/config/scene-suggestions.json`
- `src/config/deeplinks.json`
- `src/automation/AppLaunchController.ts`

任务：

1. 完整梳理动作清单
2. 明确每个动作的真实完成度
3. 移除或降级虚高承诺

### 7.5 规则与快捷动作

涉及文件：

- `src/rules/engine/RuleExecutor.ts`
- `src/__tests__/unit/quickactions/*`
- `src/rules/engine/__tests__/*`

任务：

1. 真接线
2. 增强测试
3. 完善失败路径

### 7.6 智能建议与个性化

涉及文件：

- `src/prediction/ContextPredictor.ts`
- `src/services/DynamicSuggestionService.ts`
- `src/services/suggestion/SmartSuggestionEngine.ts`
- `src/services/suggestion/ContextAggregator.ts`
- `src/services/suggestion/PersonalizationManager.ts`

任务：

1. 用真实上下文替换模拟上下文
2. 收口模板化和随机性过强的问题
3. 打通建议反馈与排序优化

### 7.7 端侧模型

涉及文件：

- `src/core/UserTriggeredAnalyzer.ts`
- `src/ml/ModelRunner.ts`
- `src/hooks/useUserTriggeredAnalysis.ts`
- `src/components/home/ModelStatusCard.tsx`
- `assets/models/*`

任务：

1. 清晰区分正常推理与 degraded result
2. 改善模型异常时的可解释性
3. 建立真实样本验证清单

### 7.8 设置与产品面

涉及文件：

- `src/screens/SettingsScreen.tsx`
- `src/utils/diagnostics.ts`
- `docs/*`

任务：

1. 导出
2. 隐私
3. 仓库链接
4. 反馈
5. 版本与诊断信息

---

## 8. 未来每轮开发的执行规范

后续开发统一遵守：

1. 所有命令、测试、git 操作都在 `D:\myProjects\SceneLens\scenelens` 下执行
2. 不重做全仓探索，优先使用 `rg`
3. 先小范围定位，再开小窗口读取
4. 不回退任何与当前任务无关的改动
5. 编辑继续使用 `apply_patch`
6. 每完成一轮实质改动后，按任务影响范围执行必要验证
7. 将重要结论追加到 `TempLog.md`

### 8.1 默认验证规范

只要做了实质改动，默认至少跑：

- `npm run typecheck`
- `node .\node_modules\jest-cli\bin\jest.js --runInBand --silent --json --outputFile jest-results.json --forceExit`
- `node .\node_modules\jest-cli\bin\jest.js --runInBand --silent --detectOpenHandles`

如果触及 native，再跑：

- `.\android\gradlew.bat -p android :app:compileDebugKotlin`

### 8.2 输出规范

每轮开发结束应明确输出：

1. 做了什么
2. 验证结果
3. 当前风险点
4. 下一步建议
5. 剩余检查项

---

## 9. 立即执行计划

如果从下一轮开始继续推进，推荐按以下顺序执行。

### 第 1 轮：执行真实性专项

目标：

- 先把最影响产品可信度的问题打掉

任务：

1. 盘点所有一键动作的真实执行结果
2. 标记哪些只是“打开首页”
3. 优先修复四个高风险动作：
   - `COMMUTE.transit_qr`
   - `HOME.smart_home`
   - `MEETING.meeting_app`
   - `TRAVEL.travel_app`
4. 给执行结果补真实语义分层

验收：

- 不再把“只打开首页”算作完整执行成功

### 第 2 轮：规则执行闭环

目标：

- 把 `RuleExecutor` 的 quick action TODO 真接线

任务：

1. 接 `QuickActionManager`
2. 增加失败与权限结果
3. 补测试

验收：

- 自动化规则能真实触发快捷动作

### 第 3 轮：Settings 产品面补全

目标：

- 去掉明显 placeholder

任务：

1. 真实导出
2. 隐私政策
3. GitHub 链接
4. 诊断与反馈信息收口

### 第 4 轮：地图导入真机验证与必要收尾

目标：

- 把“当前可用”变成“真机确认可用”

任务：

1. 做地图 App 分享导入矩阵
2. 扩大解析测试覆盖
3. 如需点选，再决定是否引入 in-app picker

### 第 5 轮：真实上下文接入

目标：

- 去掉建议层中最明显的模拟能力

任务：

1. 日历真实接入
2. 天气能力定案
3. 节假日接入

### 第 6 轮：自动检测与模型质量提升

目标：

- 提升准确率、稳定性和可解释性

任务：

1. 优化 `SilentContextEngine`
2. 优化 `ContextPredictor`
3. 优化 `ModelRunner` degraded result

---

## 10. 明确不做或暂不做的事项

为了避免方向跑偏，以下内容默认不作为当前阶段主目标：

1. 不把后台持续 camera/mic 识别作为主路线
2. 不为了地图点选去引入高风险重依赖，除非明确决定做 in-app picker
3. 不做大规模 UI 重写以掩盖执行层真实性问题
4. 不整包合并 PR 1 或 PR 2

---

## 11. 最终交付标准

一个可称为“完整版本”的 SceneLens，至少应满足：

1. 位置导入：当前位置、手输、粘贴/分享回流都真机可用
2. 自动检测：开启后可持续工作，后台受限时有明确修复路径
3. 端侧小模型：用户主动触发时识别稳定，异常可解释
4. 智能建议：至少接入真实日历，天气能力有明确去留
5. 一键执行：核心动作不再大量退化为“打开首页”
6. 设置页：导出、隐私、反馈、仓库链接均真实可用
7. 文案：不再虚标自动化能力
8. 验证：类型、测试、Kotlin compile、真机专项验证都完成

---

## 12. 结论

当前项目已经具备继续打磨成完整应用的基础，不需要推倒重来。

接下来最重要的不是继续堆新能力，而是先把已有能力的真实性、可解释性和产品边界收口。只要按照本计划优先解决：

1. 一键执行真实性
2. 规则执行闭环
3. Settings placeholder
4. 地图导入真机验证

就能很快把 SceneLens 从“看起来功能很多的原型”推进到“能稳定演示、能力边界清晰、主路径可信”的完整应用。
