# SceneLens

Android 智能场景助手（Expo / React Native）。基于低功耗信号持续做场景检测，在合适的时机给出可信的个性化建议，并对可自动完成的动作提供一键执行。

## 产品定位

SceneLens 的定位**不是**"后台持续偷听/偷看的全自动监控器"，而是：

1. 使用时间、位置围栏、Wi-Fi、运动状态、前台 App 等低功耗信号做自动场景检测（Silent Context Engine，加权投票推断当前场景）
2. 在需要时给出与真实上下文对应的场景建议
3. 对可自动完成的动作一键执行；不能自动完成的**明确标注**"仅打开应用 / 需用户继续"，不虚标能力
4. 用户主动触发时，使用端侧 TFLite 小模型做更精确的环境识别增强（增强路径，而非后台常驻主路径）

> 项目状态：从"功能可演示的原型"向"能力边界清晰、主路径可用"推进中。详细的完成度定义与路线见内部主计划文档。

## 技术栈

- Expo ~54 / React Native / React 19 / TypeScript
- 端侧推理：react-native-fast-tflite（模型随 assetBundlePatterns 打包）
- 测试：Jest（含 smoke 配置）、@testing-library

## 目录结构（src/）

| 目录 | 职责 |
|------|------|
| `sensors/` | Silent Context Engine：多信号采集与加权投票场景推断 |
| `core/` | 场景桥接、预测触发、快捷方式、统一分析器 |
| `prediction/` / `learning/` / `reflection/` | 时间模式、行为分析、偏好学习与反馈调权 |
| `automation/` / `executors/` / `quickactions/` | 动作执行与快捷入口 |
| `ml/` | 端侧 TFLite 模型加载与推理封装 |
| `screens/` / `components/` / `stores/` | UI 与状态层 |
| `discovery/` / `services/` / `notifications/` | 应用发现、建议服务与通知 |

## 开发

```bash
npm install
npm start          # expo start
npm run android    # expo run:android
npm run typecheck  # tsc --noEmit
npm test           # jest
npm run test:smoke # smoke 子集
```

构建发布走 EAS（`eas.json`，Android 包名 `com.che1sy.scenelens`）。
