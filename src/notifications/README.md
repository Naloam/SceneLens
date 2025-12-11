# Notification Manager

通知管理器模块，负责处理场景建议通知、执行结果通知和系统通知。

## 功能特性

- ✅ 场景建议通知（带一键执行按钮）
- ✅ 场景执行结果通知
- ✅ 系统状态通知
- ✅ Android 通知渠道配置
- ✅ 通知权限管理
- ✅ 通知响应处理

## 使用方法

### 初始化

```typescript
import { notificationManager } from './notifications';

// 初始化通知管理器
const success = await notificationManager.initialize();
if (!success) {
  console.warn('通知权限未授予');
}
```

### 显示场景建议通知

```typescript
import type { SceneSuggestionNotification } from './notifications';

const suggestion: SceneSuggestionNotification = {
  sceneType: 'COMMUTE',
  title: '检测到通勤场景',
  body: '一键打开乘车码和音乐应用',
  actions: [],
  confidence: 0.85,
};

const notificationId = await notificationManager.showSceneSuggestion(suggestion);
```

### 显示执行结果通知

```typescript
await notificationManager.showExecutionResult(
  'COMMUTE',
  true,
  '已打开乘车码和音乐应用'
);
```

### 显示系统通知

```typescript
await notificationManager.showSystemNotification(
  '系统提示',
  '场景检测服务已启动'
);
```

### 检查通知状态

```typescript
// 检查通知是否启用
const enabled = await notificationManager.areNotificationsEnabled();

// 获取待处理的通知
const pending = await notificationManager.getPendingNotifications();
```

### 取消通知

```typescript
// 取消特定通知
await notificationManager.cancelNotification(notificationId);

// 取消所有通知
await notificationManager.cancelAllNotifications();
```

## 通知渠道

### Android 通知渠道配置

1. **场景建议** (`scene_suggestions`)
   - 优先级：高
   - 震动：是
   - 显示角标：是
   - 用途：场景识别后的操作建议

2. **场景执行** (`scene_execution`)
   - 优先级：默认
   - 震动：否
   - 显示角标：否
   - 用途：场景执行结果通知

3. **系统通知** (`system`)
   - 优先级：低
   - 震动：否
   - 显示角标：否
   - 用途：系统状态和错误通知

## 通知响应处理

通知管理器会自动处理用户与通知的交互：

- **execute**: 用户点击"一键执行"按钮
- **dismiss**: 用户忽略通知
- **default**: 用户点击通知本身

响应处理逻辑可以在 `NotificationManager.ts` 的 `handleNotificationResponse` 方法中自定义。

## 权限要求

- Android 13+ 需要 `POST_NOTIFICATIONS` 权限
- 权限已在 `AndroidManifest.xml` 中声明

## 运行演示

```typescript
import { runAllNotificationDemos } from './notifications/demo';

// 运行所有演示
await runAllNotificationDemos();
```

## 注意事项

1. 通知管理器使用单例模式，全局只有一个实例
2. 初始化会自动请求通知权限
3. 通知数据会包含场景类型、动作列表等信息
4. 通知响应需要与场景执行器集成

## 相关需求

- 需求 2.2: 通勤场景推送通知卡片
- 需求 14: 可维护性（模块化架构）
