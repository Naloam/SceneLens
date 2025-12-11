# 应用发现引擎 (App Discovery Engine)

应用发现引擎负责扫描已安装应用、学习用户偏好，并为规则引擎提供「意图 → 应用」的映射。

## 功能特性

### 1. 应用扫描
- 扫描所有已安装的应用
- 自动过滤系统应用
- 获取应用基本信息（包名、应用名、图标等）

### 2. 智能分类
基于包名和应用名的启发式规则，将应用分为以下类别：
- `MUSIC_PLAYER` - 音乐播放器
- `TRANSIT_APP` - 交通出行
- `PAYMENT_APP` - 支付应用
- `MEETING_APP` - 会议应用
- `STUDY_APP` - 学习应用
- `SMART_HOME` - 智能家居
- `CALENDAR` - 日历
- `OTHER` - 其他

### 3. 使用统计
- 获取应用使用时长
- 统计应用启动次数
- 记录最后使用时间

### 4. 偏好学习
- 根据使用统计计算应用得分
- 在每个类别中选出 Top 3 应用
- 支持用户手动调整偏好

### 5. 意图解析
将抽象意图（如 `MUSIC_PLAYER_TOP1`）解析为具体的应用包名，供规则引擎使用。

## 使用方法

### 基本使用

```typescript
import { appDiscoveryEngine } from './discovery';

// 初始化引擎
await appDiscoveryEngine.initialize();

// 获取所有应用
const allApps = appDiscoveryEngine.getAllApps();

// 获取某个类别的应用
const musicApps = appDiscoveryEngine.getAppsByCategory('MUSIC_PLAYER');

// 获取偏好设置
const musicPreference = appDiscoveryEngine.getPreference('MUSIC_PLAYER');
console.log('Top music apps:', musicPreference?.topApps);

// 解析意图
const packageName = appDiscoveryEngine.resolveIntent('MUSIC_PLAYER_TOP1');
console.log('Top music app:', packageName);
```

### 手动设置偏好

```typescript
// 用户可以手动设置某个类别的首选应用
appDiscoveryEngine.setPreference('MUSIC_PLAYER', [
  'com.spotify.music',
  'com.netease.cloudmusic',
  'com.tencent.qqmusic'
]);
```

## 权限要求

### 应用列表
不需要特殊权限，可以直接获取。

### 使用统计
需要 `PACKAGE_USAGE_STATS` 权限，这是一个特殊权限，需要用户在系统设置中手动授予。

#### 检查权限
```typescript
import sceneBridge from '../core/SceneBridge';

const hasPermission = await sceneBridge.checkUsageStatsPermission();
if (!hasPermission) {
  // 引导用户到设置页面
  await sceneBridge.openUsageStatsSettings();
}
```

## 演示和测试

```typescript
import { demoAppDiscovery, verifyAppDiscovery } from './discovery/demo';

// 运行演示
await demoAppDiscovery();

// 验证功能
const isValid = await verifyAppDiscovery();
```

## 架构设计

### 数据流

```
1. 扫描应用
   ↓
2. 分类应用
   ↓
3. 获取使用统计
   ↓
4. 计算偏好
   ↓
5. 提供意图解析
```

### 评分算法

应用得分 = 使用时长得分 × 0.6 + 启动次数得分 × 0.4

- 使用时长得分：总前台时长（小时）
- 启动次数得分：启动次数

### 分类规则

分类基于包名和应用名的关键词匹配：

```typescript
// 示例：音乐播放器
if (packageName.includes('music') || 
    packageName.includes('spotify') ||
    appName.includes('音乐')) {
  return 'MUSIC_PLAYER';
}
```

## 注意事项

1. **初始化时机**：应在应用启动时初始化，以便后续使用
2. **权限处理**：使用统计权限可能未授予，需要优雅降级
3. **性能考虑**：应用扫描可能耗时，建议在后台线程执行
4. **缓存策略**：可以缓存扫描结果，定期更新

## 相关需求

- 需求 9.1：扫描已安装应用列表
- 需求 9.2：应用分类逻辑
- 需求 9.3：获取使用统计
- 需求 9.4：应用偏好计算
- 需求 9.6：意图解析

## 未来改进

1. 支持更多应用类别
2. 改进分类算法（机器学习）
3. 支持应用图标获取
4. 支持应用评分和推荐
5. 支持跨设备同步偏好
