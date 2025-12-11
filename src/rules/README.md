# 规则引擎模块

规则引擎负责根据场景上下文匹配规则并生成执行计划。

## 功能概述

- **规则加载**: 从 YAML 文件或对象加载场景规则
- **规则匹配**: 根据当前场景上下文匹配适用的规则
- **规则评分**: 计算规则与当前场景的匹配度
- **规则排序**: 按优先级和得分对匹配的规则排序

## 核心组件

### RuleEngine

规则引擎主类，负责规则的加载、匹配和评分。

```typescript
import { RuleEngine } from './rules';

const ruleEngine = new RuleEngine();
await ruleEngine.loadRules();

const matches = await ruleEngine.matchRules(context);
```

### SceneExecutor

场景执行器，负责执行规则引擎生成的动作列表。

```typescript
import { SceneExecutor } from './executors';

const executor = new SceneExecutor();
const results = await executor.execute(actions);
```

## 规则格式

规则使用 YAML 格式定义，包含以下字段：

```yaml
id: RULE_COMMUTE
priority: HIGH  # LOW | MEDIUM | HIGH
mode: ONE_TAP   # SUGGEST_ONLY | ONE_TAP | AUTO
enabled: true

conditions:
  - type: time
    value: MORNING_RUSH
    weight: 0.6
  
  - type: location
    value: SUBWAY_STATION
    weight: 0.8

actions:
  - target: system
    action: setDoNotDisturb
    params:
      enable: true
  
  - target: app
    intent: TRANSIT_APP_TOP1
    action: open_ticket_qr
    deepLink: 'alipays://platformapi/startapp?appId=200011235'
```

## 条件类型

- `time`: 时间条件（如 MORNING_RUSH, EVENING_RUSH）
- `location`: 位置条件（如 SUBWAY_STATION, OFFICE, HOME）
- `motion`: 运动状态（如 WALKING, VEHICLE, STILL）
- `wifi`: Wi-Fi 连接（如家庭 Wi-Fi SSID）
- `app_usage`: 应用使用历史
- `calendar`: 日历事件

## 动作类型

### 系统动作 (system)

- `setDoNotDisturb`: 设置勿扰模式
- `setBrightness`: 设置屏幕亮度

### 应用动作 (app)

- 打开应用（支持 Deep Link）
- 三级降级策略：
  1. Deep Link（最佳）
  2. 打开应用首页（次优）
  3. 提示用户手动操作（兜底）

### 通知动作 (notification)

- 发送场景建议通知
- 显示一键执行按钮

## 规则匹配流程

1. **信号采集**: SilentContextEngine 采集场景信号
2. **规则匹配**: RuleEngine 匹配适用的规则
3. **规则评分**: 计算每条规则的匹配度
4. **规则排序**: 按优先级和得分排序
5. **动作执行**: SceneExecutor 执行最佳匹配规则的动作

## 评分机制

规则得分 = Σ(满足的条件权重) / Σ(所有条件权重)

- 得分 > 0.6: 触发规则
- 得分 0.6-0.75: 低频提示（预测触发）
- 得分 > 0.75: 高置信度，可自动执行

## 使用示例

### 基本使用

```typescript
import { RuleEngine } from './rules';
import { SceneExecutor } from './executors';
import { SilentContextEngine } from './sensors';

// 1. 获取场景上下文
const contextEngine = new SilentContextEngine();
const context = await contextEngine.getContext();

// 2. 匹配规则
const ruleEngine = new RuleEngine();
await ruleEngine.loadRules();
const matches = await ruleEngine.matchRules(context);

// 3. 执行动作
if (matches.length > 0) {
  const topMatch = matches[0];
  const executor = new SceneExecutor();
  const results = await executor.execute(topMatch.rule.actions);
  
  console.log('执行结果:', results);
}
```

### 自定义规则

```typescript
const customRule: Rule = {
  id: 'RULE_CUSTOM',
  priority: 'MEDIUM',
  mode: 'SUGGEST_ONLY',
  enabled: true,
  conditions: [
    { type: 'time', value: 'EVENING', weight: 0.7 },
    { type: 'location', value: 'HOME', weight: 0.8 },
  ],
  actions: [
    {
      target: 'notification',
      action: 'suggest',
      params: {
        title: '晚上好',
        body: '要不要放松一下？',
      },
    },
  ],
};

await ruleEngine.loadRules([customRule]);
```

## 测试

### 运行演示

```bash
npx ts-node src/rules/demo.ts
```

### 运行验证

```bash
npx ts-node src/rules/verify.ts
```

## 已实现的规则

- ✓ 通勤场景规则 (RULE_COMMUTE)

## 待实现的规则

- [ ] 会议场景规则 (RULE_MEETING)
- [ ] 学习场景规则 (RULE_STUDY)
- [ ] 到家场景规则 (RULE_HOME)
- [ ] 睡前场景规则 (RULE_SLEEP)
- [ ] 出行场景规则 (RULE_TRAVEL)

## 相关需求

- 需求 2.1: 通勤场景识别
- 需求 2.2: 通勤模式通知
- 需求 2.3: 打开乘车码应用
- 需求 2.4: 打开音乐应用
- 需求 2.6: 开启勿扰模式

## 注意事项

1. **权限要求**: 某些系统动作需要特殊权限（如勿扰模式、修改系统设置）
2. **应用安装**: 应用动作需要目标应用已安装
3. **Deep Link**: Deep Link 可能因应用版本不同而失效
4. **降级策略**: 始终提供降级方案，确保基本功能可用

## 下一步

1. 实现更多场景规则（会议、学习、到家等）
2. 集成 AppDiscoveryEngine 进行应用意图解析
3. 实现真正的通知功能（使用 expo-notifications）
4. 添加规则的动态加载和热更新
5. 实现规则的用户自定义和编辑
