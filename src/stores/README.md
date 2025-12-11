# State Management (Zustand Stores)

状态管理模块，使用 Zustand 管理应用的全局状态。

## 功能特性

- ✅ 场景状态管理
- ✅ 应用偏好管理
- ✅ 权限状态管理
- ✅ 轻量级、高性能
- ✅ TypeScript 类型安全

## Store 列表

### 1. Scene Store (场景状态)

管理当前场景、场景历史和自动模式设置。

```typescript
import { useSceneStore } from './stores';

function MyComponent() {
  const {
    currentContext,
    isDetecting,
    history,
    setCurrentContext,
    addToHistory,
    getRecentHistory,
  } = useSceneStore();

  // 使用状态...
}
```

**状态字段：**
- `currentContext`: 当前场景上下文
- `isDetecting`: 是否正在检测场景
- `lastDetectionTime`: 最后检测时间
- `detectionError`: 检测错误信息
- `history`: 场景历史记录
- `autoModeEnabled`: 自动模式是否启用
- `autoModeScenes`: 启用自动模式的场景集合

**操作方法：**
- `setCurrentContext(context)`: 设置当前场景
- `setIsDetecting(isDetecting)`: 设置检测状态
- `setDetectionError(error)`: 设置错误信息
- `addToHistory(historyItem)`: 添加历史记录
- `clearHistory()`: 清空历史记录
- `setAutoModeEnabled(enabled)`: 设置自动模式
- `toggleAutoModeForScene(sceneType)`: 切换场景的自动模式
- `isAutoModeEnabledForScene(sceneType)`: 检查场景是否启用自动模式
- `getRecentHistory(limit)`: 获取最近的历史记录
- `reset()`: 重置所有状态

### 2. App Preference Store (应用偏好)

管理已安装应用列表和用户的应用偏好。

```typescript
import { useAppPreferenceStore } from './stores';

function MyComponent() {
  const {
    allApps,
    preferences,
    isInitialized,
    setPreferences,
    getTopAppsForCategory,
  } = useAppPreferenceStore();

  // 使用状态...
}
```

**状态字段：**
- `allApps`: 所有已安装应用列表
- `preferences`: 应用偏好映射（类别 → 偏好）
- `isInitialized`: 是否已初始化
- `isLoading`: 是否正在加载
- `error`: 错误信息

**操作方法：**
- `setAllApps(apps)`: 设置应用列表
- `setPreferences(preferences)`: 设置偏好
- `updatePreference(category, preference)`: 更新单个类别的偏好
- `setTopAppForCategory(category, packageName, position)`: 设置类别的首选应用
- `getTopAppsForCategory(category)`: 获取类别的首选应用列表
- `getAppByPackageName(packageName)`: 根据包名获取应用信息
- `setIsInitialized(initialized)`: 设置初始化状态
- `setIsLoading(loading)`: 设置加载状态
- `setError(error)`: 设置错误信息
- `reset()`: 重置所有状态

### 3. Permission Store (权限状态)

管理应用权限状态和引导流程。

```typescript
import { usePermissionStore } from './stores';

function MyComponent() {
  const {
    permissions,
    onboardingCompleted,
    setPermissionStatus,
    isPermissionGranted,
    getRequiredPermissions,
  } = usePermissionStore();

  // 使用状态...
}
```

**状态字段：**
- `permissions`: 权限信息映射
- `isCheckingPermissions`: 是否正在检查权限
- `onboardingCompleted`: 引导流程是否完成
- `currentOnboardingStep`: 当前引导步骤

**权限类型：**
- `LOCATION`: 位置权限
- `ACTIVITY_RECOGNITION`: 活动识别权限
- `USAGE_STATS`: 使用统计权限
- `CAMERA`: 相机权限
- `MICROPHONE`: 麦克风权限
- `NOTIFICATIONS`: 通知权限
- `DO_NOT_DISTURB`: 勿扰模式权限

**操作方法：**
- `setPermissionStatus(type, status)`: 设置权限状态
- `setPermissionLastRequested(type, timestamp)`: 设置权限请求时间
- `setPermissionLastChecked(type, timestamp)`: 设置权限检查时间
- `getPermissionStatus(type)`: 获取权限状态
- `isPermissionGranted(type)`: 检查权限是否已授予
- `getAllGrantedPermissions()`: 获取所有已授予的权限
- `getAllDeniedPermissions()`: 获取所有被拒绝的权限
- `getRequiredPermissions()`: 获取所有必需的权限
- `setIsCheckingPermissions(checking)`: 设置检查状态
- `setOnboardingCompleted(completed)`: 设置引导完成状态
- `setCurrentOnboardingStep(step)`: 设置当前引导步骤
- `reset()`: 重置所有状态

## 使用示例

### 场景检测流程

```typescript
import { useSceneStore } from './stores';
import { silentContextEngine } from '../sensors';

function SceneDetector() {
  const { setIsDetecting, setCurrentContext, addToHistory } = useSceneStore();

  const detectScene = async () => {
    setIsDetecting(true);
    
    try {
      const context = await silentContextEngine.getContext();
      setCurrentContext(context);
      
      addToHistory({
        sceneType: context.context,
        timestamp: Date.now(),
        confidence: context.confidence,
        triggered: false,
        userAction: null,
      });
    } catch (error) {
      console.error('Detection error:', error);
    } finally {
      setIsDetecting(false);
    }
  };

  return <button onClick={detectScene}>检测场景</button>;
}
```

### 应用偏好管理

```typescript
import { useAppPreferenceStore } from './stores';
import { appDiscoveryEngine } from '../discovery';

function AppPreferenceManager() {
  const { setAllApps, setPreferences, setIsInitialized } = useAppPreferenceStore();

  const initialize = async () => {
    await appDiscoveryEngine.initialize();
    
    const apps = appDiscoveryEngine.getAllApps();
    const prefs = appDiscoveryEngine.getAllPreferences();
    
    setAllApps(apps);
    setPreferences(prefs);
    setIsInitialized(true);
  };

  return <button onClick={initialize}>初始化应用发现</button>;
}
```

### 权限检查

```typescript
import { usePermissionStore } from './stores';
import { sceneBridge } from '../core/SceneBridge';

function PermissionChecker() {
  const { setPermissionStatus, isPermissionGranted } = usePermissionStore();

  const checkLocationPermission = async () => {
    const hasPermission = await sceneBridge.hasLocationPermission();
    setPermissionStatus('LOCATION', hasPermission ? 'granted' : 'denied');
  };

  const locationGranted = isPermissionGranted('LOCATION');

  return (
    <div>
      <p>位置权限: {locationGranted ? '已授予' : '未授予'}</p>
      <button onClick={checkLocationPermission}>检查权限</button>
    </div>
  );
}
```

## 持久化

目前 stores 的状态仅保存在内存中。如需持久化，可以：

1. 使用 `react-native-mmkv` 进行本地存储
2. 在 store 中添加持久化逻辑
3. 使用 Zustand 的 persist 中间件

## 相关需求

- 需求 14: 可维护性（模块化架构）
- 需求 9.5: 首次配置向导
- 需求 10.6: 用户反馈学习
