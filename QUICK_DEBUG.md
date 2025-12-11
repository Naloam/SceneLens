# 快速调试 SceneLens APK

## 🎯 立即开始调试

### 方法一：使用 Android Studio（推荐）

1. **打开 Android Studio**
2. **导入项目**：选择 `scenelens/android` 目录
3. **连接手机**：确保 USB 调试已开启
4. **点击 Run 按钮**（绿色播放按钮）
5. **查看 Logcat**：底部 Logcat 标签，过滤 `com.che1sy.scenelens`

### 方法二：使用命令行快速诊断

```bash
# 1. 进入项目目录
cd scenelens

# 2. 运行调试脚本
debug_app.bat
```

---

## 🔍 最可能的问题和解决方案

### 问题 1：Metro Bundler 连接问题

**现象：** 应用启动后白屏或立即崩溃

**解决方案：**
```bash
# 启动 Metro Bundler
cd scenelens
npx expo start

# 然后在另一个终端安装应用
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### 问题 2：权限问题

**现象：** 应用崩溃，日志显示 SecurityException

**解决方案：**
1. 手动在手机设置中授予应用所有权限
2. 或者先安装，然后手动授权

### 问题 3：原生模块问题

**现象：** 日志显示 "Native module SceneBridge is null"

**解决方案：**
```bash
cd scenelens
npx expo prebuild --clean
cd android
.\gradlew.bat clean
.\gradlew.bat assembleDebug
```

---

## 📱 立即测试步骤

### 步骤 1：准备环境
```bash
# 确保手机连接
adb devices

# 确保有 Metro Bundler（如果是 Debug 版本）
cd scenelens
npx expo start
```

### 步骤 2：在 Android Studio 中运行
1. 打开 Android Studio
2. 打开 `scenelens/android`
3. 选择你的设备
4. 点击 Run（▶️）

### 步骤 3：观察结果
- 如果应用正常启动 → 成功！
- 如果崩溃 → 查看 Logcat 中的错误信息

---

## 🚨 紧急修复

如果应用仍然无法启动，尝试这个最简单的版本：

### 创建最小化测试版本

1. **临时简化 App.tsx**：
```javascript
import React from 'react';
import { View, Text } from 'react-native';

export default function App() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>SceneLens Test</Text>
    </View>
  );
}
```

2. **重新构建**：
```bash
cd scenelens/android
.\gradlew.bat assembleDebug
```

3. **安装测试**：
```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

如果这个简化版本能运行，说明问题在于复杂的功能代码。

---

## 📞 需要帮助？

如果问题仍然存在，请运行以下命令收集信息：

```bash
# 收集设备信息
adb shell getprop ro.build.version.release > device_info.txt
adb shell getprop ro.product.model >> device_info.txt

# 收集崩溃日志
adb logcat -c
# 启动应用，然后立即运行：
adb logcat > crash_log.txt
```

然后告诉我：
1. 设备型号和 Android 版本
2. 具体的错误现象
3. Logcat 中的错误信息

我会根据具体情况提供针对性的解决方案！