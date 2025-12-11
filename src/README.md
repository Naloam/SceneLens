# SceneLens 源代码结构

## 目录说明

### `/core`
核心引擎和基础设施代码
- `SceneBridge.ts` - React Native 与 Android 原生模块的桥接接口

### `/executors`
场景执行器，负责执行场景动作
- 将在后续任务中实现

### `/sensors`
传感器和信号采集模块
- 将在后续任务中实现

### `/rules`
规则引擎和 YAML 规则配置
- 将在后续任务中实现

### `/types`
TypeScript 类型定义
- `index.ts` - 所有核心类型定义

## 开发指南

### 添加新的原生方法

1. 在 `android/app/src/main/java/com/che1sy/scenelens/SceneBridgeModule.java` 中添加 `@ReactMethod`
2. 在 `src/core/SceneBridge.ts` 的接口中添加对应的 TypeScript 类型定义
3. 如果需要新的类型，在 `src/types/index.ts` 中定义

### 测试原生模块

运行应用后，点击 "Test Native Bridge" 按钮测试原生模块连接。

### 构建和运行

```bash
# 开发模式
npm run android

# 清理并重新构建
cd android && ./gradlew clean && cd ..
npm run android
```
