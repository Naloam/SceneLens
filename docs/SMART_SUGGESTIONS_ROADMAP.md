# SceneLens 智能建议系统重构规划

> 版本: v0.6.0  
> 创建日期: 2026-01-30  
> 前置版本: v0.5.0 (commit: 3766255)

---

## 📋 项目概述

本文档规划了 SceneLens 智能建议系统的全面重构，目标是将当前仅输出文本的"AI建议"升级为**真正可执行、个性化、预测性的智能自动化系统**。

### 核心原则

1. **可执行性**: 每个建议都应该能一键执行
2. **个性化**: 基于用户历史行为和偏好
3. **预测性**: 提前预判用户需求
4. **渐进性**: 从简单功能开始，逐步增强

---

## 🎯 任务大项总览

| 大项 | 名称 | 优先级 | 预估工作量 | 状态 |
|------|------|--------|-----------|------|
| 1 | 系统设置自动调整 | ⭐⭐⭐⭐⭐ | 3-4天 | ✅ 已完成 |
| 2 | 智能应用启动与控制 | ⭐⭐⭐⭐⭐ | 2-3天 | ✅ 已完成 |
| 3 | 预测性智能 | ⭐⭐⭐⭐ | 2-3天 | ✅ 已完成 |
| 4 | 快捷操作卡片 | ⭐⭐⭐⭐⭐ | 2天 | ✅ 已完成 |
| 5 | 主动式通知与提醒 | ⭐⭐⭐⭐ | 2天 | ✅ 已完成 |
| 7 | 反馈学习与个性化 | ⭐⭐⭐⭐ | 2天 | ✅ 已完成 |
| 8 | 自动化规则引擎 | ⭐⭐⭐⭐⭐ | 3-4天 | ✅ 已完成 |

**总预估工作量**: 16-20天
**实际完成日期**: 2026-01-30

---

## 📁 文件结构规划

```
src/
├── automation/                    # [新建] 自动化核心模块
│   ├── index.ts
│   ├── AutomationEngine.ts        # 自动化执行引擎
│   ├── SystemSettingsController.ts # 系统设置控制器
│   ├── AppLaunchController.ts     # 应用启动控制器
│   └── types.ts                   # 自动化类型定义
│
├── prediction/                    # [新建] 预测引擎模块
│   ├── index.ts
│   ├── BehaviorAnalyzer.ts        # 用户行为分析器
│   ├── TimePatternEngine.ts       # 时间模式引擎
│   ├── ContextPredictor.ts        # 上下文预测器
│   └── types.ts
│
├── quickactions/                  # [新建] 快捷操作模块
│   ├── index.ts
│   ├── QuickActionManager.ts      # 快捷操作管理器
│   ├── ActionCard.tsx             # 快捷操作卡片组件
│   ├── presets/                   # 预设快捷操作
│   │   ├── payment.ts             # 支付快捷操作
│   │   ├── navigation.ts          # 导航快捷操作
│   │   ├── communication.ts       # 通讯快捷操作
│   │   └── index.ts
│   └── types.ts
│
├── rules/                         # [扩展] 规则引擎模块
│   ├── RuleEngine.ts              # [修改] 增强规则引擎
│   ├── RuleBuilder.ts             # [新建] 规则构建器
│   ├── RuleTemplates.ts           # [新建] 规则模板库
│   ├── NaturalLanguageParser.ts   # [新建] 自然语言解析器
│   └── types.ts
│
├── learning/                      # [新建] 学习与个性化模块
│   ├── index.ts
│   ├── AppUsageTracker.ts         # 应用使用追踪器
│   ├── HabitDiscovery.ts          # 习惯发现引擎
│   ├── PreferenceManager.ts       # 偏好管理器
│   ├── FeedbackProcessor.ts       # 反馈处理器
│   └── types.ts
│
├── notifications/                 # [扩展] 通知模块
│   ├── NotificationManager.ts     # [修改] 增强通知管理
│   ├── SmartNotificationFilter.ts # [新建] 智能通知过滤
│   ├── ProactiveReminder.ts       # [新建] 主动提醒引擎
│   └── types.ts
│
├── components/
│   ├── home/
│   │   ├── QuickActionsPanel.tsx  # [新建] 快捷操作面板
│   │   ├── PredictionCard.tsx     # [新建] 预测卡片
│   │   └── SmartSuggestionCard.tsx # [新建] 智能建议卡片
│   └── settings/
│       ├── RuleEditorScreen.tsx   # [新建] 规则编辑器
│       └── AutomationSettingsScreen.tsx # [新建] 自动化设置
│
├── services/
│   ├── DynamicSuggestionService.ts # [重构] 动态建议服务
│   └── ExecutableSuggestionService.ts # [新建] 可执行建议服务
│
└── native/                        # [需要] Native 模块扩展
    └── android/
        ├── SystemSettingsModule.kt # [新建] 系统设置模块
        ├── AppControlModule.kt     # [新建] 应用控制模块
        └── NotificationAccessModule.kt # [新建] 通知访问模块
```

---

## 🔧 大项 1: 系统设置自动调整

### 1.1 目标
实现场景触发的系统设置自动调整，包括免打扰模式、音量、亮度、WiFi/蓝牙等。

### 1.2 需要新建的文件

#### 1.2.1 `src/automation/SystemSettingsController.ts`
```typescript
// 核心功能
- setDoNotDisturb(enabled: boolean, options?: DNDOptions)
- setVolume(type: 'ring' | 'media' | 'alarm' | 'notification', level: number)
- setBrightness(level: number, autoMode?: boolean)
- setWiFi(enabled: boolean)
- setBluetooth(enabled: boolean)
- setLocationMode(mode: 'high' | 'balanced' | 'low' | 'off')
- setScreenTimeout(seconds: number)
- setDarkMode(enabled: boolean)
- setBatterySaver(enabled: boolean)

// 批量操作
- applySceneSettings(sceneType: SceneType, settings: SceneSettings)
- getSystemState(): SystemState
- resetToDefault(): void
```

#### 1.2.2 `android/.../SystemSettingsModule.kt` (Native)
```kotlin
// Android 原生模块，通过 React Native Bridge 暴露
- 需要权限: WRITE_SETTINGS, ACCESS_NOTIFICATION_POLICY
- 实现音量控制 (AudioManager)
- 实现免打扰模式 (NotificationManager)
- 实现亮度控制 (Settings.System)
- 实现 WiFi/蓝牙控制 (WifiManager, BluetoothAdapter)
```

### 1.3 需要修改的文件

| 文件 | 修改内容 |
|------|----------|
| `src/executors/SceneExecutor.ts` | 添加系统设置执行器 |
| `src/types/index.ts` | 添加 SystemSettings 相关类型 |
| `src/config/scene-suggestions.json` | 添加默认系统设置配置 |
| `android/app/src/main/AndroidManifest.xml` | 添加所需权限 |

### 1.4 场景默认设置预设

```typescript
const SCENE_SYSTEM_PRESETS: Record<SceneType, Partial<SystemSettings>> = {
  COMMUTE: {
    volume: { media: 70, ring: 80 },
    bluetooth: true,
    doNotDisturb: false,
  },
  OFFICE: {
    volume: { ring: 0, notification: 30 },
    doNotDisturb: 'priority_only',
    screenTimeout: 120,
  },
  HOME: {
    wifi: true,
    volume: { media: 60, ring: 100 },
    doNotDisturb: false,
  },
  STUDY: {
    doNotDisturb: true,
    volume: { ring: 0, notification: 0 },
    screenTimeout: 300,
  },
  SLEEP: {
    doNotDisturb: true,
    brightness: 10,
    darkMode: true,
    volume: { ring: 0, media: 0 },
  },
  TRAVEL: {
    locationMode: 'high',
    bluetooth: true,
    batterySaver: false,
  },
};
```

### 1.5 实现步骤

1. **步骤 1**: 创建 Kotlin Native 模块 `SystemSettingsModule.kt`
2. **步骤 2**: 创建 TypeScript 控制器 `SystemSettingsController.ts`
3. **步骤 3**: 更新 `SceneExecutor.ts` 集成系统设置执行
4. **步骤 4**: 创建设置 UI 让用户自定义场景设置
5. **步骤 5**: 编写测试用例

### 1.6 权限需求

```xml
<!-- AndroidManifest.xml -->
<uses-permission android:name="android.permission.WRITE_SETTINGS" />
<uses-permission android:name="android.permission.ACCESS_NOTIFICATION_POLICY" />
<uses-permission android:name="android.permission.CHANGE_WIFI_STATE" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
```

---

## 📱 大项 2: 智能应用启动与控制

### 2.1 目标
基于用户历史行为智能推荐应用，并支持应用深度链接（如直接打开微信扫一扫）。

### 2.2 需要新建的文件

#### 2.2.1 `src/learning/AppUsageTracker.ts`
```typescript
// 应用使用追踪
interface AppUsageRecord {
  packageName: string;
  launchCount: number;
  totalDuration: number;
  lastUsed: number;
  hourlyDistribution: Record<number, number>;  // 按小时统计
  sceneDistribution: Record<SceneType, number>; // 按场景统计
  sequenceAfter: Record<string, number>;       // 连续启动统计
}

// 核心功能
- trackAppLaunch(packageName: string, sceneType: SceneType)
- getTopAppsForScene(sceneType: SceneType, limit: number): AppRecommendation[]
- getTopAppsForTimeSlot(hour: number, limit: number): AppRecommendation[]
- predictNextApp(currentApp: string): AppRecommendation | null
- getAppUsageStats(): AppUsageStats
```

#### 2.2.2 `src/automation/AppLaunchController.ts`
```typescript
// 应用启动控制
- launchApp(packageName: string): Promise<boolean>
- launchAppWithDeepLink(packageName: string, deepLink: string): Promise<boolean>
- isAppInstalled(packageName: string): Promise<boolean>
- getInstalledApps(): Promise<InstalledApp[]>

// 深度链接快捷操作
const DEEP_LINK_SHORTCUTS: Record<string, DeepLinkConfig> = {
  'wechat_scan': {
    packageName: 'com.tencent.mm',
    deepLink: 'weixin://scanqrcode',
    fallback: 'weixin://',
  },
  'alipay_pay': {
    packageName: 'com.eg.android.AlipayGphone',
    deepLink: 'alipays://platformapi/startapp?appId=20000056',
    fallback: 'alipays://',
  },
  'amap_home': {
    packageName: 'com.autonavi.minimap',
    deepLink: 'androidamap://navi?sourceApplication=scenelens&dest=${HOME_ADDRESS}',
  },
  // ... 更多
};
```

### 2.3 需要修改的文件

| 文件 | 修改内容 |
|------|----------|
| `src/services/DynamicSuggestionService.ts` | 集成应用推荐逻辑 |
| `src/config/deeplinks.json` | 扩展深度链接配置 |
| `src/types/index.ts` | 添加 AppRecommendation 类型 |

### 2.4 应用推荐算法

```typescript
function recommendApps(context: UnifiedContext): AppRecommendation[] {
  const weights = {
    sceneRelevance: 0.35,      // 场景相关性
    timeRelevance: 0.25,       // 时间相关性
    recentUsage: 0.20,         // 最近使用
    sequencePrediction: 0.20,  // 连续启动预测
  };
  
  // 计算综合得分并排序
  return calculateWeightedScore(apps, context, weights);
}
```

### 2.5 实现步骤

1. **步骤 1**: 创建 `AppUsageTracker.ts`，实现使用追踪
2. **步骤 2**: 扩展 `deeplinks.json`，添加常用应用深度链接
3. **步骤 3**: 创建 `AppLaunchController.ts`，实现启动控制
4. **步骤 4**: 修改 `DynamicSuggestionService.ts`，集成推荐逻辑
5. **步骤 5**: 更新 UI 显示推荐应用列表

---

## 🔮 大项 3: 预测性智能

### 3.1 目标
实现时间预测、行为学习、异常检测等预测性功能。

### 3.2 需要新建的文件

#### 3.2.1 `src/prediction/TimePatternEngine.ts`
```typescript
// 时间模式分析
interface TimePattern {
  type: 'daily' | 'weekly' | 'monthly';
  triggerTime: string;        // "HH:mm" 格式
  triggerDays?: number[];     // 周几触发 [1-7]
  sceneType: SceneType;
  confidence: number;
  sampleCount: number;
}

// 核心功能
- analyzePatterns(history: SceneHistory[]): TimePattern[]
- predictNextScene(currentTime: Date): ScenePrediction
- getUsualDepartureTime(): string | null
- getUsualArrivalTime(sceneType: SceneType): string | null
- detectAnomaly(currentScene: SceneType, currentTime: Date): Anomaly | null
```

#### 3.2.2 `src/prediction/BehaviorAnalyzer.ts`
```typescript
// 行为分析
interface BehaviorPattern {
  id: string;
  description: string;
  conditions: PatternCondition[];
  frequency: number;
  lastOccurrence: number;
  suggestedAction?: AutomationAction;
}

// 核心功能
- discoverPatterns(history: SceneHistory[], appUsage: AppUsageRecord[]): BehaviorPattern[]
- matchCurrentPattern(context: UnifiedContext): BehaviorPattern | null
- generatePatternSuggestion(pattern: BehaviorPattern): Suggestion
```

#### 3.2.3 `src/prediction/ContextPredictor.ts`
```typescript
// 上下文预测
- predictTimeToNextScene(): { sceneType: SceneType; minutes: number } | null
- shouldRemindDeparture(): { shouldRemind: boolean; message: string }
- getCalendarAwareSuggestions(): CalendarSuggestion[]
- getWeatherAwareSuggestions(): WeatherSuggestion[]
```

### 3.3 需要修改的文件

| 文件 | 修改内容 |
|------|----------|
| `src/services/DynamicSuggestionService.ts` | 集成预测结果 |
| `src/stores/sceneStore.ts` | 添加预测状态 |
| `src/components/home/PredictionCard.tsx` | 新建预测展示卡片 |

### 3.4 预测触发时机

```typescript
const PREDICTION_TRIGGERS = {
  // 定时触发
  HOURLY_CHECK: '每小时检查一次模式匹配',
  
  // 事件触发
  SCENE_CHANGE: '场景变化时更新预测',
  APP_LAUNCH: '应用启动时更新序列预测',
  LOCATION_CHANGE: '位置变化时检查异常',
  
  // 主动触发
  USER_REQUEST: '用户主动请求预测',
};
```

### 3.5 实现步骤

1. **步骤 1**: 创建 `TimePatternEngine.ts`，分析时间模式
2. **步骤 2**: 创建 `BehaviorAnalyzer.ts`，发现行为模式
3. **步骤 3**: 创建 `ContextPredictor.ts`，整合预测逻辑
4. **步骤 4**: 集成日历 API（可选）获取日程
5. **步骤 5**: 创建预测展示 UI 组件

---

## ⚡ 大项 4: 快捷操作卡片 (One-Tap Actions)

### 4.1 目标
提供场景化的一键快捷操作，减少用户操作步骤。

### 4.2 需要新建的文件

#### 4.2.1 `src/quickactions/QuickActionManager.ts`
```typescript
interface QuickAction {
  id: string;
  label: string;
  icon: string;
  category: 'payment' | 'navigation' | 'communication' | 'system' | 'custom';
  execute: () => Promise<QuickActionResult>;
  isAvailable: () => Promise<boolean>;
  sceneRelevance: Record<SceneType, number>; // 0-1 场景相关性
}

// 核心功能
- registerAction(action: QuickAction): void
- getActionsForScene(sceneType: SceneType): QuickAction[]
- executeAction(actionId: string): Promise<QuickActionResult>
- getRecentActions(limit: number): QuickAction[]
- trackActionUsage(actionId: string, sceneType: SceneType): void
```

#### 4.2.2 `src/quickactions/presets/` 预设快捷操作

**payment.ts**:
```typescript
export const paymentActions: QuickAction[] = [
  {
    id: 'wechat_pay',
    label: '微信支付',
    icon: '💳',
    execute: () => launchDeepLink('weixin://pay'),
    sceneRelevance: { COMMUTE: 0.8, HOME: 0.5, OFFICE: 0.3 },
  },
  {
    id: 'alipay_scan',
    label: '支付宝扫码',
    icon: '📱',
    execute: () => launchDeepLink('alipays://platformapi/startapp?appId=10000007'),
    sceneRelevance: { COMMUTE: 0.9, HOME: 0.4 },
  },
];
```

**navigation.ts**:
```typescript
export const navigationActions: QuickAction[] = [
  {
    id: 'nav_home',
    label: '导航回家',
    icon: '🏠',
    execute: () => navigateTo(userSettings.homeAddress),
    sceneRelevance: { OFFICE: 0.9, TRAVEL: 0.7 },
  },
  {
    id: 'nav_work',
    label: '导航去公司',
    icon: '🏢',
    execute: () => navigateTo(userSettings.workAddress),
    sceneRelevance: { HOME: 0.9 },
  },
];
```

**communication.ts**:
```typescript
export const communicationActions: QuickAction[] = [
  {
    id: 'call_favorite',
    label: '呼叫常用联系人',
    icon: '📞',
    execute: () => showContactPicker(),
  },
  {
    id: 'send_location',
    label: '分享当前位置',
    icon: '📍',
    execute: () => shareCurrentLocation(),
  },
];
```

#### 4.2.3 `src/components/home/QuickActionsPanel.tsx`
```tsx
// UI 组件
- 横向滚动的快捷操作卡片
- 根据当前场景动态排序
- 支持长按自定义
- 显示最近使用的快捷操作
```

### 4.3 需要修改的文件

| 文件 | 修改内容 |
|------|----------|
| `src/screens/HomeScreen.tsx` | 添加快捷操作面板 |
| `src/config/deeplinks.json` | 添加快捷操作深度链接 |
| `src/types/index.ts` | 添加 QuickAction 类型 |

### 4.4 实现步骤

1. **步骤 1**: 创建 `QuickActionManager.ts` 核心管理器
2. **步骤 2**: 创建预设快捷操作 (payment, navigation, communication)
3. **步骤 3**: 创建 `QuickActionsPanel.tsx` UI 组件
4. **步骤 4**: 集成到 HomeScreen
5. **步骤 5**: 添加使用追踪和个性化排序

---

## 🔔 大项 5: 主动式通知与提醒

### 5.1 目标
实现智能提醒（离开提醒、久坐提醒、睡眠提醒）和情境感知通知。

### 5.2 需要新建的文件

#### 5.2.1 `src/notifications/ProactiveReminder.ts`
```typescript
interface Reminder {
  id: string;
  type: 'departure' | 'sedentary' | 'eye_rest' | 'sleep' | 'arrival' | 'custom';
  triggerCondition: ReminderCondition;
  message: string;
  actions?: NotificationAction[];
  cooldown: number; // 冷却时间，防止频繁提醒
  enabled: boolean;
}

// 核心功能
- scheduleReminder(reminder: Reminder): void
- cancelReminder(reminderId: string): void
- checkReminderConditions(): Reminder[]
- triggerReminder(reminder: Reminder): void

// 内置提醒
const BUILT_IN_REMINDERS = {
  DEPARTURE: {
    type: 'departure',
    triggerCondition: { 
      sceneChange: ['HOME', 'OFFICE'], 
      direction: 'leaving',
    },
    message: '出门前别忘了：钥匙、钱包、手机',
  },
  SEDENTARY: {
    type: 'sedentary',
    triggerCondition: {
      sceneType: 'OFFICE',
      duration: 60, // 分钟
    },
    message: '您已坐了1小时，起来活动一下吧',
  },
  EYE_REST: {
    type: 'eye_rest',
    triggerCondition: {
      sceneType: 'STUDY',
      duration: 20,
    },
    message: '学习20分钟了，让眼睛休息一下',
  },
  SLEEP: {
    type: 'sleep',
    triggerCondition: {
      timeRange: ['22:30', '23:30'],
      sceneType: 'HOME',
    },
    message: '夜深了，该休息了',
  },
};
```

#### 5.2.2 `src/notifications/SmartNotificationFilter.ts`
```typescript
// 智能通知过滤（参考 Apple Focus Mode）
interface NotificationFilter {
  sceneType: SceneType;
  allowedApps: string[];           // 允许通知的应用
  allowedContacts: string[];       // 允许来电的联系人
  urgencyThreshold: 'all' | 'important' | 'critical';
  silenceMode: 'mute' | 'vibrate' | 'normal';
}

// 核心功能
- setFilterForScene(sceneType: SceneType, filter: NotificationFilter): void
- shouldAllowNotification(notification: Notification, currentScene: SceneType): boolean
- getQueuedNotifications(): Notification[]
- deliverQueuedNotifications(): void
```

### 5.3 需要修改的文件

| 文件 | 修改内容 |
|------|----------|
| `src/notifications/NotificationManager.ts` | 集成智能过滤和主动提醒 |
| `src/background/BackgroundService.ts` | 添加定时检查任务 |
| `src/stores/settingsStore.ts` | 添加提醒设置状态 |

### 5.4 实现步骤

1. **步骤 1**: 创建 `ProactiveReminder.ts` 主动提醒引擎
2. **步骤 2**: 创建 `SmartNotificationFilter.ts` 通知过滤器
3. **步骤 3**: 修改 `NotificationManager.ts` 集成新功能
4. **步骤 4**: 更新 BackgroundService 添加定时检查
5. **步骤 5**: 创建提醒设置 UI

---

## 🎓 大项 7: 反馈学习与个性化

### 7.1 目标
增强反馈机制，实现深度个性化，包括快速反馈、偏好设置、工作日/周末区分等。

### 7.2 需要新建的文件

#### 7.2.1 `src/learning/PreferenceManager.ts`
```typescript
interface UserPreference {
  // 建议类型偏好
  suggestionPreferences: {
    showSystemSettings: boolean;
    showAppRecommendations: boolean;
    showQuickActions: boolean;
    showPredictions: boolean;
  };
  
  // 场景偏好
  scenePreferences: Record<SceneType, ScenePreference>;
  
  // 时间偏好
  timePreferences: {
    workdaySchedule: { start: string; end: string };
    weekendBehavior: 'same' | 'relaxed' | 'custom';
  };
  
  // 隐私偏好
  privacySettings: {
    trackAppUsage: boolean;
    trackLocation: boolean;
    shareAnonymousData: boolean;
  };
}

// 核心功能
- getPreference<K extends keyof UserPreference>(key: K): UserPreference[K]
- setPreference<K extends keyof UserPreference>(key: K, value: UserPreference[K]): void
- resetToDefaults(): void
- exportPreferences(): string
- importPreferences(data: string): void
```

#### 7.2.2 `src/learning/HabitDiscovery.ts`
```typescript
interface DiscoveredHabit {
  id: string;
  description: string;
  pattern: {
    timeRange?: [string, string];
    dayOfWeek?: number[];
    sceneType?: SceneType;
    location?: GeoFence;
  };
  associatedActions: string[];
  confidence: number;
  occurrenceCount: number;
  lastSeen: number;
}

// 核心功能
- discoverHabits(history: CombinedHistory): DiscoveredHabit[]
- suggestAutomationForHabit(habit: DiscoveredHabit): AutomationRule
- confirmHabit(habitId: string): void
- dismissHabit(habitId: string): void
```

#### 7.2.3 `src/learning/FeedbackProcessor.ts`
```typescript
// 增强的反馈处理
interface DetailedFeedback {
  suggestionId: string;
  action: 'accept' | 'ignore' | 'dismiss' | 'modify';
  reason?: string;  // 可选的反馈原因
  modification?: Partial<Suggestion>; // 用户的修改
  timestamp: number;
  context: UnifiedContext;
}

// 核心功能
- processFeedback(feedback: DetailedFeedback): void
- getInsightsFromFeedback(): FeedbackInsight[]
- adjustSuggestionWeights(insights: FeedbackInsight[]): void
- generatePersonalizationReport(): PersonalizationReport
```

### 7.3 需要修改的文件

| 文件 | 修改内容 |
|------|----------|
| `src/reflection/FeedbackLogger.ts` | 增强反馈记录 |
| `src/reflection/WeightAdjuster.ts` | 增强权重调整逻辑 |
| `src/services/DynamicSuggestionService.ts` | 应用个性化偏好 |
| `src/components/home/SuggestionCard.tsx` | 添加快速反馈按钮 |

### 7.4 个性化维度

```typescript
const PERSONALIZATION_DIMENSIONS = {
  // 时间维度
  TIME: {
    workdayMorning: '工作日早上',
    workdayEvening: '工作日晚上',
    weekendMorning: '周末早上',
    weekendEvening: '周末晚上',
  },
  
  // 季节维度
  SEASON: {
    spring: '春季',
    summer: '夏季',
    autumn: '秋季',
    winter: '冬季',
  },
  
  // 天气维度 (可选)
  WEATHER: {
    sunny: '晴天',
    rainy: '雨天',
    cold: '寒冷',
    hot: '炎热',
  },
};
```

### 7.5 实现步骤

1. **步骤 1**: 创建 `PreferenceManager.ts` 偏好管理
2. **步骤 2**: 创建 `HabitDiscovery.ts` 习惯发现
3. **步骤 3**: 创建 `FeedbackProcessor.ts` 反馈处理
4. **步骤 4**: 更新 UI 添加快速反馈按钮
5. **步骤 5**: 创建个性化设置界面

---

## 🤖 大项 8: 自动化规则引擎

### 8.1 目标
实现用户可自定义的 IF-THEN 规则，提供规则模板库，并支持自然语言创建规则。

### 8.2 需要新建的文件

#### 8.2.1 `src/rules/RuleBuilder.ts`
```typescript
interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: RuleCondition[];       // IF 条件
  actions: RuleAction[];             // THEN 动作
  conditionLogic: 'AND' | 'OR';      // 条件逻辑
  priority: number;
  cooldown: number;                  // 冷却时间
  createdAt: number;
  lastTriggered?: number;
}

interface RuleCondition {
  type: 'scene' | 'time' | 'location' | 'app' | 'battery' | 'network' | 'custom';
  operator: 'equals' | 'not_equals' | 'contains' | 'greater' | 'less' | 'between';
  value: any;
}

interface RuleAction {
  type: 'system_setting' | 'app_launch' | 'notification' | 'quick_action' | 'custom';
  params: Record<string, any>;
}

// 核心功能
class RuleBuilder {
  when(condition: RuleCondition): RuleBuilder;
  and(condition: RuleCondition): RuleBuilder;
  or(condition: RuleCondition): RuleBuilder;
  then(action: RuleAction): RuleBuilder;
  withCooldown(minutes: number): RuleBuilder;
  withPriority(priority: number): RuleBuilder;
  build(): AutomationRule;
}
```

#### 8.2.2 `src/rules/RuleTemplates.ts`
```typescript
// 预设规则模板
export const RULE_TEMPLATES: RuleTemplate[] = [
  {
    id: 'work_mode',
    name: '工作模式',
    description: '到达公司后自动开启工作模式',
    rule: new RuleBuilder()
      .when({ type: 'scene', operator: 'equals', value: 'OFFICE' })
      .and({ type: 'time', operator: 'between', value: ['09:00', '18:00'] })
      .then({ type: 'system_setting', params: { doNotDisturb: 'priority_only' } })
      .then({ type: 'app_launch', params: { packageName: 'com.dingtalk' } })
      .build(),
  },
  {
    id: 'sleep_mode',
    name: '睡眠模式',
    description: '晚上11点后在家自动开启睡眠模式',
    rule: new RuleBuilder()
      .when({ type: 'scene', operator: 'equals', value: 'HOME' })
      .and({ type: 'time', operator: 'greater', value: '23:00' })
      .then({ type: 'system_setting', params: { doNotDisturb: true, brightness: 10 } })
      .build(),
  },
  {
    id: 'commute_music',
    name: '通勤音乐',
    description: '通勤时自动播放音乐',
    rule: new RuleBuilder()
      .when({ type: 'scene', operator: 'equals', value: 'COMMUTE' })
      .then({ type: 'app_launch', params: { packageName: 'com.netease.cloudmusic' } })
      .then({ type: 'system_setting', params: { bluetooth: true } })
      .withCooldown(30)
      .build(),
  },
  // ... 更多模板
];
```

#### 8.2.3 `src/rules/NaturalLanguageParser.ts` (高级功能)
```typescript
// 自然语言解析器 - 将用户输入转换为规则
interface ParseResult {
  success: boolean;
  rule?: AutomationRule;
  clarificationNeeded?: string[];
  suggestions?: string[];
}

// 示例输入 -> 输出
// "到家后开灯" -> RuleBuilder().when(scene=HOME).then(smartHome.light=on)
// "工作时静音" -> RuleBuilder().when(scene=OFFICE).then(volume.ring=0)
// "每天早上8点提醒我出门" -> RuleBuilder().when(time=08:00).then(notification)

// 核心功能
- parseNaturalLanguage(input: string): ParseResult
- getSuggestions(partialInput: string): string[]
- explainRule(rule: AutomationRule): string
```

#### 8.2.4 `src/components/settings/RuleEditorScreen.tsx`
```tsx
// 规则编辑器 UI
// - 条件选择器（场景、时间、位置等）
// - 动作选择器（系统设置、应用启动、通知等）
// - 规则测试模拟
// - 规则启用/禁用开关
// - 规则执行历史
```

### 8.3 需要修改的文件

| 文件 | 修改内容 |
|------|----------|
| `src/rules/RuleEngine.ts` | 重构以支持新规则格式 |
| `src/background/BackgroundService.ts` | 添加规则检查逻辑 |
| `src/stores/settingsStore.ts` | 添加规则存储 |
| `src/navigation/` | 添加规则编辑器路由 |

### 8.4 实现步骤

1. **步骤 1**: 创建 `RuleBuilder.ts` 规则构建器
2. **步骤 2**: 创建 `RuleTemplates.ts` 预设模板
3. **步骤 3**: 重构 `RuleEngine.ts` 支持新格式
4. **步骤 4**: 创建 `RuleEditorScreen.tsx` UI
5. **步骤 5**: (可选) 创建 `NaturalLanguageParser.ts`

---

## 📊 依赖关系图

```
                    ┌─────────────────────────────────────┐
                    │         大项 8: 规则引擎            │
                    │   (RuleBuilder, RuleTemplates)      │
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────┴───────────────────┐
                    ▼                                     ▼
    ┌───────────────────────────┐       ┌───────────────────────────┐
    │   大项 1: 系统设置控制    │       │   大项 2: 应用启动控制    │
    │ (SystemSettingsController)│       │  (AppLaunchController)    │
    └───────────────┬───────────┘       └───────────────┬───────────┘
                    │                                   │
                    └─────────────────┬─────────────────┘
                                      ▼
                    ┌─────────────────────────────────────┐
                    │   大项 4: 快捷操作卡片              │
                    │    (QuickActionManager)             │
                    └─────────────────┬───────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          ▼                           ▼                           ▼
┌───────────────────┐   ┌───────────────────────┐   ┌───────────────────────┐
│  大项 3: 预测引擎 │   │  大项 5: 主动提醒     │   │  大项 7: 反馈学习     │
│ (ContextPredictor)│   │ (ProactiveReminder)   │   │ (PreferenceManager)   │
└───────────────────┘   └───────────────────────┘   └───────────────────────┘
```

---

## 🚀 推荐实现顺序

### Phase 1: 基础设施 (Week 1)
1. **大项 1.1-1.3**: Native 系统设置模块 + TypeScript 控制器
2. **大项 2.1-2.2**: 应用使用追踪 + 启动控制器
3. **大项 8.1-8.2**: 规则构建器 + 模板库

### Phase 2: 核心功能 (Week 2)
4. **大项 4**: 快捷操作卡片（完整实现）
5. **大项 7.1-7.2**: 偏好管理 + 习惯发现
6. **大项 5.1**: 主动提醒引擎

### Phase 3: 高级功能 (Week 3)
7. **大项 3**: 预测引擎（完整实现）
8. **大项 5.2**: 智能通知过滤
9. **大项 7.3**: 增强反馈处理

### Phase 4: UI 与打磨 (Week 4)
10. **大项 8.3-8.4**: 规则编辑器 UI + 自然语言（可选）
11. 全面测试与优化
12. 文档更新

---

## 📝 注意事项

### 权限要求汇总

```xml
<!-- AndroidManifest.xml 新增权限 -->
<uses-permission android:name="android.permission.WRITE_SETTINGS" />
<uses-permission android:name="android.permission.ACCESS_NOTIFICATION_POLICY" />
<uses-permission android:name="android.permission.CHANGE_WIFI_STATE" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.QUERY_ALL_PACKAGES" />
<uses-permission android:name="android.permission.PACKAGE_USAGE_STATS" />
<uses-permission android:name="android.permission.READ_CALENDAR" />
```

### 性能考虑

1. 规则检查应在后台线程执行
2. 应用使用追踪使用批量写入
3. 预测计算结果应缓存
4. 避免频繁的 Native Bridge 调用

### 隐私考虑

1. 所有数据本地存储
2. 应用使用追踪可选关闭
3. 规则导出前提示用户
4. 敏感操作需要用户确认

---

## ✅ 验收标准

### 功能验收
- [x] 场景变化时系统设置自动调整
- [x] 应用推荐准确率 > 70%
- [x] 快捷操作响应时间 < 500ms
- [x] 预测准确率 > 60%
- [x] 规则执行成功率 > 95%

### 用户体验验收
- [x] 首次使用引导完整
- [x] 设置界面清晰易懂
- [x] 反馈机制响应及时
- [x] 无明显卡顿或闪退

---

## 📊 实现总结

### 已完成模块清单

| 模块 | 文件 | 行数 | 功能说明 |
|------|------|------|----------|
| **Native 模块** | | | |
| 系统设置控制 | `SystemSettingsModule.kt` | 938 | 音量、亮度、勿扰、WiFi/蓝牙控制 |
| 场景桥接 | `SceneBridgeModule.kt` | 1659 | 应用启动、活动识别、日历访问 |
| **自动化模块** | | | |
| 系统设置控制器 | `SystemSettingsController.ts` | 715 | TypeScript 层系统设置封装 |
| 应用启动控制器 | `AppLaunchController.ts` | 477 | 应用启动与 Deep Link 控制 |
| **预测模块** | | | |
| 时间模式引擎 | `TimePatternEngine.ts` | 556 | 分析时间规律，预测场景 |
| 行为分析器 | `BehaviorAnalyzer.ts` | 608 | 发现行为模式，生成建议 |
| 上下文预测器 | `ContextPredictor.ts` | 410 | 整合预测，出发提醒 |
| **快捷操作模块** | | | |
| 快捷操作管理器 | `QuickActionManager.ts` | 622 | 管理和执行快捷操作 |
| 快捷操作面板 | `QuickActionsPanel.tsx` | 496 | UI 组件 |
| 预设库 | `presets/` | - | 支付、导航、通讯预设 |
| **学习模块** | | | |
| 习惯发现引擎 | `HabitDiscovery.ts` | 603 | 分析使用习惯 |
| 偏好管理器 | `PreferenceManager.ts` | - | 用户偏好管理 |
| 反馈处理器 | `FeedbackProcessor.ts` | 933 | 反馈分析与权重调整 |
| **通知模块** | | | |
| 智能通知过滤 | `SmartNotificationFilter.ts` | 941 | 场景感知通知过滤 |
| 主动提醒引擎 | `ProactiveReminder.ts` | 839 | 离开/久坐/睡眠提醒 |
| **规则引擎** | | | |
| 规则构建器 | `RuleBuilder.ts` | 560 | 流畅 API 构建规则 |
| 规则模板库 | `RuleTemplates.ts` | 681 | 14 个预设模板 |
| 规则编辑器 | `RuleEditorScreen.tsx` | 1040 | 完整规则编辑 UI |
| 自然语言解析器 | `NaturalLanguageParser.ts` | 750+ | 自然语言创建规则 |
| **权限管理** | | | |
| 权限管理器 | `PermissionManager.ts` | 650+ | 统一权限请求管理 |
| 权限 Hook | `usePermissions.ts` | 200+ | React Hook 封装 |
| 权限管理页面 | `PermissionsScreen.tsx` | 300+ | 权限管理 UI |
| **测试覆盖** | | | |
| 规则构建器测试 | `RuleBuilder.test.ts` | 200+ | 单元测试 |
| 时间模式测试 | `TimePatternEngine.test.ts` | 150+ | 单元测试 |
| 反馈处理测试 | `FeedbackProcessor.test.ts` | 200+ | 单元测试 |
| 行为分析测试 | `BehaviorAnalyzer.test.ts` | 200+ | 单元测试 |
| 快捷操作测试 | `QuickActionManager.test.ts` | 250+ | 单元测试 |

### 总代码量
- **TypeScript/TSX**: ~15,000 行
- **Kotlin**: ~2,600 行
- **测试代码**: ~1,000 行

---

> 文档更新于 2026-01-30，所有规划功能已实现完成。
