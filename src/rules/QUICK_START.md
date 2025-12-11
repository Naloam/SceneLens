# 规则引擎快速开始指南

## Task 4 实现完成 ✓

所有子任务已完成：

- ✓ 4.1 创建通勤场景 YAML 规则
- ✓ 4.2 实现 RuleEngine 基础类
- ✓ 4.3 实现 SceneExecutor 基础类
- ✓ 4.4 实现系统设置控制（Android 原生）
- ✓ 4.5 实现应用启动（Android 原生）

## 快速测试

### 1. 在 React Native 应用中测试

在 `App.tsx` 中添加以下代码：

```typescript
import { RuleEngine } from './src/rules';
import { SceneExecutor } from './src/executors';
import { SilentContext } from './src/types';

// 创建测试场景
const testContext: SilentContext = {
  timestamp: Date.now(),
  context: 'COMMUTE',
  confidence: 0.85,
  signals: [
    { type: 'TIME', value: 'MORNING_RUSH', weight: 0.8, timestamp: Date.now() },
    { type: 'LOCATION', value: 'SUBWAY_STATION', weight: 0.9, timestamp: Date.now() },
    { type: 'MOTION', value: 'WALKING', weight: 0.7, timestamp: Date.now() },
  ],
};

// 测试规则匹配
async function testRuleEngine() {
  const ruleEngine = new RuleEngine();
  await ruleEngine.loadRules();
  
  const matches = await ruleEngine.matchRules(testContext);
  console.log('匹配的规则:', matches);
  
  if (matches.length > 0) {
    const executor = new SceneExecutor();
    const results = await executor.execute(matches[0].rule.actions);
    console.log('执行结果:', results);
  }
}

// 在组件中调用
useEffect(() => {
  testRuleEngine();
}, []);
```

### 2. 测试 Android 原生功能

在真实 Android 设备上测试：

```typescript
import SceneBridge from './src/core/SceneBridge';

// 测试勿扰模式
async function testDoNotDisturb() {
  try {
    // 检查权限
    const hasPermission = await SceneBridge.checkDoNotDisturbPermission();
    console.log('勿扰权限:', hasPermission);
    
    if (!hasPermission) {
      // 打开设置页面
      await SceneBridge.openDoNotDisturbSettings();
      return;
    }
    
    // 设置勿扰模式
    const result = await SceneBridge.setDoNotDisturb(true);
    console.log('勿扰模式设置成功:', result);
  } catch (error) {
    console.error('勿扰模式设置失败:', error);
  }
}

// 测试应用启动
async function testAppLaunch() {
  try {
    // 检查应用是否安装
    const isInstalled = await SceneBridge.isAppInstalled('com.eg.android.AlipayGphone');
    console.log('支付宝已安装:', isInstalled);
    
    if (isInstalled) {
      // 打开应用
      const success = await SceneBridge.openAppWithDeepLink(
        'com.eg.android.AlipayGphone',
        'alipays://platformapi/startapp?appId=200011235'
      );
      console.log('应用启动成功:', success);
    }
  } catch (error) {
    console.error('应用启动失败:', error);
  }
}
```

### 3. 运行演示脚本

虽然不能直接运行 TypeScript 文件，但可以在应用中导入并调用：

```typescript
import { runRuleEngineDemo } from './src/rules/demo';

// 在组件中调用
useEffect(() => {
  runRuleEngineDemo();
}, []);
```

## 功能验证清单

### 4.1 YAML 规则文件 ✓

- [x] 创建 `src/rules/commute.rule.yaml`
- [x] 定义通勤场景条件（时间、位置、运动状态）
- [x] 定义通勤场景动作（乘车码、音乐、勿扰模式）

### 4.2 RuleEngine 基础类 ✓

- [x] 创建 Rule, Condition, Action 数据结构
- [x] 实现 `loadRules()` 方法
- [x] 实现 `matchRules()` 方法
- [x] 实现 `calculateRuleScore()` 方法
- [x] 实现规则优先级排序

### 4.3 SceneExecutor 基础类 ✓

- [x] 创建 ExecutionResult 数据结构
- [x] 实现 `execute()` 方法
- [x] 实现 `executeSingle()` 方法
- [x] 实现 `executeSystemAction()` 方法
- [x] 实现 `executeAppAction()` 方法
- [x] 实现三级降级策略（Deep Link → 首页 → 提示）

### 4.4 系统设置控制（Android 原生）✓

- [x] 实现 `setDoNotDisturb()` 方法
- [x] 实现 `checkDoNotDisturbPermission()` 方法
- [x] 实现 `openDoNotDisturbSettings()` 方法
- [x] 实现 `setBrightness()` 方法
- [x] 实现 `checkWriteSettingsPermission()` 方法
- [x] 实现 `openWriteSettingsSettings()` 方法

### 4.5 应用启动（Android 原生）✓

- [x] 实现 `openAppWithDeepLink()` 方法
- [x] 支持 Deep Link 启动
- [x] 支持普通 Intent 启动
- [x] 实现三级降级策略
- [x] 实现 `isAppInstalled()` 方法
- [x] 实现 `validateDeepLink()` 方法

## 已知限制

1. **YAML 解析**: 目前使用硬编码的规则对象，未实现真正的 YAML 文件解析
   - 原因: 避免引入额外的依赖
   - 解决方案: 在后续任务中可以添加 YAML 解析库

2. **通知功能**: 通知动作目前只是记录日志
   - 原因: 需要在 Week 1 Task 5 中实现
   - 解决方案: 使用 expo-notifications 实现真正的通知

3. **应用意图解析**: 目前使用硬编码的包名映射
   - 原因: 需要集成 AppDiscoveryEngine
   - 解决方案: 在后续任务中集成应用发现引擎

4. **权限要求**: 某些功能需要特殊权限
   - 勿扰模式: 需要 ACCESS_NOTIFICATION_POLICY 权限
   - 修改亮度: 需要 WRITE_SETTINGS 权限
   - 解决方案: 提供权限引导和设置页面跳转

## 下一步

1. **Week 1 Task 5**: 实现通知与 UI
   - 配置 expo-notifications
   - 实现场景建议通知卡片
   - 创建基础 UI 界面

2. **Week 1 Task 6**: 端到端集成测试
   - 在真实设备上测试通勤场景
   - 验证场景识别和动作执行
   - 测试权限流程

3. **Week 2**: 实现更多场景规则
   - 会议场景
   - 学习场景
   - 到家场景
   - 睡前场景
   - 出行场景

## 相关文件

- `src/rules/commute.rule.yaml` - 通勤场景规则定义
- `src/rules/RuleEngine.ts` - 规则引擎实现
- `src/executors/SceneExecutor.ts` - 场景执行器实现
- `src/rules/demo.ts` - 演示脚本
- `src/rules/verify.ts` - 验证脚本
- `src/rules/README.md` - 详细文档
- `android/app/src/main/java/com/che1sy/scenelens/SceneBridgeModule.java` - Android 原生模块

## 技术亮点

1. **模块化设计**: 规则引擎、执行器、原生桥接分离
2. **类型安全**: 完整的 TypeScript 类型定义
3. **降级策略**: 三级降级确保基本功能可用
4. **权限处理**: 完善的权限检查和引导流程
5. **可扩展性**: 易于添加新的场景规则和动作类型

## 总结

Task 4 "通勤场景规则与执行" 已完成所有子任务。实现了完整的规则引擎和场景执行器，支持规则匹配、评分、排序和动作执行。Android 原生模块实现了系统设置控制和应用启动功能，包括勿扰模式、屏幕亮度和 Deep Link 启动。

所有代码已通过 TypeScript 类型检查，无编译错误。功能需要在真实 Android 设备上进行完整测试。
