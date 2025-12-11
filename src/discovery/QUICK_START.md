# App Discovery Engine - Quick Start Guide

## 快速开始

### 1. 导入模块

```typescript
import { appDiscoveryEngine } from './src/discovery';
import sceneBridge from './src/core/SceneBridge';
```

### 2. 初始化引擎

```typescript
// 初始化（扫描应用、分类、获取使用统计、计算偏好）
await appDiscoveryEngine.initialize();
```

### 3. 基本操作

#### 获取所有应用
```typescript
const allApps = appDiscoveryEngine.getAllApps();
console.log(`找到 ${allApps.length} 个应用`);
```

#### 按类别获取应用
```typescript
const musicApps = appDiscoveryEngine.getAppsByCategory('MUSIC_PLAYER');
const transitApps = appDiscoveryEngine.getAppsByCategory('TRANSIT_APP');
```

#### 获取偏好设置
```typescript
// 获取某个类别的偏好
const musicPref = appDiscoveryEngine.getPreference('MUSIC_PLAYER');
console.log('首选音乐应用:', musicPref?.topApps);

// 获取所有偏好
const allPrefs = appDiscoveryEngine.getAllPreferences();
```

#### 解析意图
```typescript
// 将意图解析为包名
const packageName = appDiscoveryEngine.resolveIntent('MUSIC_PLAYER_TOP1');
if (packageName) {
  // 打开应用
  await sceneBridge.openAppWithDeepLink(packageName);
}
```

### 4. 权限处理

#### 检查使用统计权限
```typescript
const hasPermission = await sceneBridge.checkUsageStatsPermission();
if (!hasPermission) {
  console.log('需要使用统计权限');
}
```

#### 引导用户授权
```typescript
if (!hasPermission) {
  // 打开系统设置页面
  await sceneBridge.openUsageStatsSettings();
}
```

### 5. 手动设置偏好

```typescript
// 用户可以手动设置某个类别的首选应用
appDiscoveryEngine.setPreference('MUSIC_PLAYER', [
  'com.spotify.music',
  'com.netease.cloudmusic',
  'com.tencent.qqmusic'
]);
```

## 支持的应用类别

| 类别 | 说明 | 意图示例 |
|------|------|----------|
| `MUSIC_PLAYER` | 音乐播放器 | `MUSIC_PLAYER_TOP1` |
| `TRANSIT_APP` | 交通出行 | `TRANSIT_APP_TOP1` |
| `PAYMENT_APP` | 支付应用 | `PAYMENT_APP_TOP1` |
| `MEETING_APP` | 会议应用 | `MEETING_APP_TOP1` |
| `STUDY_APP` | 学习应用 | `STUDY_APP_TOP1` |
| `SMART_HOME` | 智能家居 | `SMART_HOME_TOP1` |
| `CALENDAR` | 日历 | `CALENDAR_TOP1` |
| `OTHER` | 其他 | - |

## 意图格式

意图格式：`{CATEGORY}_TOP{N}`

- `CATEGORY`: 应用类别（大写）
- `N`: 排名（1, 2, 3）

示例：
- `MUSIC_PLAYER_TOP1` - 首选音乐应用
- `TRANSIT_APP_TOP2` - 第二选择的交通应用
- `MEETING_APP_TOP1` - 首选会议应用

## 完整示例

```typescript
import { appDiscoveryEngine } from './src/discovery';
import sceneBridge from './src/core/SceneBridge';

async function setupAppDiscovery() {
  try {
    // 1. 检查权限
    const hasPermission = await sceneBridge.checkUsageStatsPermission();
    if (!hasPermission) {
      console.log('提示用户授予使用统计权限');
      // 可选：引导用户到设置页面
      // await sceneBridge.openUsageStatsSettings();
    }

    // 2. 初始化引擎
    console.log('正在初始化应用发现引擎...');
    await appDiscoveryEngine.initialize();
    console.log('初始化完成！');

    // 3. 显示统计信息
    const allApps = appDiscoveryEngine.getAllApps();
    const preferences = appDiscoveryEngine.getAllPreferences();
    console.log(`扫描到 ${allApps.length} 个应用`);
    console.log(`生成了 ${preferences.size} 个类别的偏好`);

    // 4. 显示各类别的首选应用
    for (const [category, pref] of preferences) {
      if (pref.topApps.length > 0 && category !== 'OTHER') {
        console.log(`\n${category}:`);
        pref.topApps.forEach((packageName, index) => {
          const app = allApps.find(a => a.packageName === packageName);
          console.log(`  ${index + 1}. ${app?.appName || packageName}`);
        });
      }
    }

    // 5. 测试意图解析
    const topMusicApp = appDiscoveryEngine.resolveIntent('MUSIC_PLAYER_TOP1');
    if (topMusicApp) {
      console.log(`\n首选音乐应用: ${topMusicApp}`);
    }

  } catch (error) {
    console.error('设置失败:', error);
  }
}

// 运行
setupAppDiscovery();
```

## 在规则引擎中使用

```typescript
// 规则定义（YAML 格式）
const rule = {
  id: 'RULE_COMMUTE',
  actions: [
    {
      target: 'app',
      intent: 'TRANSIT_APP_TOP1',  // 使用意图
      action: 'open_ticket_qr',
      deepLink: 'alipays://platformapi/startapp?appId=200011235'
    },
    {
      target: 'app',
      intent: 'MUSIC_PLAYER_TOP1',  // 使用意图
      action: 'launch'
    }
  ]
};

// 执行规则
for (const action of rule.actions) {
  if (action.intent) {
    // 解析意图为包名
    const packageName = appDiscoveryEngine.resolveIntent(action.intent);
    if (packageName) {
      // 打开应用
      await sceneBridge.openAppWithDeepLink(packageName, action.deepLink);
    }
  }
}
```

## 测试和验证

### 运行演示
```typescript
import { demoAppDiscovery } from './src/discovery/demo';
await demoAppDiscovery();
```

### 运行验证
```typescript
import { verifyAppDiscoveryEngine, quickVerify } from './src/discovery/verify';

// 完整验证
await verifyAppDiscoveryEngine();

// 快速验证
const isValid = await quickVerify();
```

## 常见问题

### Q: 为什么获取不到使用统计？
A: 需要用户在系统设置中授予"使用情况访问"权限。可以调用 `openUsageStatsSettings()` 引导用户授权。

### Q: 如何添加新的应用类别？
A: 在 `AppDiscoveryEngine.ts` 的 `detectCategory()` 方法中添加新的分类规则。

### Q: 应用分类不准确怎么办？
A: 可以使用 `setPreference()` 方法手动设置偏好，或改进 `detectCategory()` 中的分类规则。

### Q: 如何更新偏好设置？
A: 重新调用 `initialize()` 方法会重新扫描和计算偏好。

## 性能提示

1. **初始化时机**: 建议在应用启动时初始化，避免在关键路径上初始化
2. **缓存结果**: 初始化后的结果会缓存，无需重复初始化
3. **权限检查**: 在初始化前检查权限，避免不必要的错误
4. **错误处理**: 始终使用 try-catch 包裹异步操作

## 下一步

- 查看 [README.md](./README.md) 了解详细文档
- 查看 [demo.ts](./demo.ts) 了解更多示例
- 查看 [verify.ts](./verify.ts) 了解测试方法
