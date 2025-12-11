# SceneLens APK 问题排查指南

## 🚨 问题现象

APK 构建成功，但在真机上无法打开。

---

## 🔍 快速诊断

### 方法一：使用调试脚本（推荐）

我已经为你创建了一个自动化调试脚本：

```bash
cd scenelens
debug_app.bat
```

这个脚本会：
1. 检查设备连接
2. 卸载旧版本
3. 构建 Debug 版本
4. 安装并启动应用
5. 实时显示日志

### 方法二：手动步骤

#### 1. 检查设备连接
```bash
adb devices
```
应该显示你的设备。

#### 2. 检查应用安装状态
```bash
# 检查是否已安装
adb shell pm list packages | findstr scenelens

# 检查应用详细信息
adb shell dumpsys package com.che1sy.scenelens
```

#### 3. 查看崩溃日志
```bash
# 清理旧日志
adb logcat -c

# 尝试启动应用
adb shell am start -n com.che1sy.scenelens/.MainActivity

# 立即查看日志
adb logcat | findstr "che1sy\|scenelens\|FATAL\|AndroidRuntime"
```

---

## 🐛 常见问题和解决方案

### 问题 1：应用安装后图标不显示

**可能原因：**
- 应用安装不完整
- 权限问题

**解决方法：**
```bash
# 完全卸载
adb uninstall com.che1sy.scenelens

# 重新安装
adb install -r path/to/app-debug.apk
```

### 问题 2：点击图标后应用立即崩溃

**可能原因：**
- JavaScript bundle 加载失败
- 原生模块初始化错误
- 权限问题

**排查步骤：**

1. **查看详细崩溃日志**
```bash
adb logcat *:E
```

2. **检查是否需要 Metro Bundler**
如果是 Debug 版本，可能需要启动 Metro：
```bash
cd scenelens
npx expo start
```

3. **检查 JavaScript 错误**
```bash
adb logcat -s ReactNativeJS:V
```

### 问题 3：权限相关错误

**常见错误信息：**
- `SecurityException: Permission denied`
- `java.lang.SecurityException`

**解决方法：**
1. 手动在设置中授予权限
2. 或者修改权限请求代码

### 问题 4：原生模块加载失败

**常见错误信息：**
- `Native module SceneBridge is null`
- `Cannot resolve module`

**解决方法：**
1. 检查原生模块注册
2. 重新构建项目

---

## 🔧 使用 Android Studio 调试

### 步骤 1：打开项目

1. 启动 Android Studio
2. 选择 "Open an Existing Project"
3. 打开 `scenelens/android` 目录

### 步骤 2：配置运行

1. 确保选择了正确的设备
2. 选择 "app" 运行配置
3. 点击 "Run" 或 "Debug" 按钮

### 步骤 3：查看日志

1. 底部点击 "Logcat" 标签
2. 过滤包名：`com.che1sy.scenelens`
3. 观察错误信息

### 步骤 4：设置断点

在关键位置设置断点：
- `MainActivity.onCreate()`
- `SceneBridgeModule` 的方法
- JavaScript 入口点

---

## 📊 详细日志分析

### 1. 应用启动日志

正常启动应该看到：
```
I/ReactNative: Starting React Native
I/ReactNative: Loading JS bundle
D/SceneBridge: Module initialized
```

### 2. 崩溃日志示例

**JavaScript 错误：**
```
E/ReactNativeJS: Error: Cannot read property 'xxx' of undefined
```

**原生错误：**
```
E/AndroidRuntime: FATAL EXCEPTION: main
E/AndroidRuntime: java.lang.RuntimeException: Unable to start activity
```

**权限错误：**
```
E/AndroidRuntime: java.lang.SecurityException: Permission denied
```

---

## 🛠️ 修复建议

### 针对不同错误类型的修复方案：

#### JavaScript Bundle 错误
```bash
cd scenelens
# 清理缓存
npx expo start --clear
# 或者重新构建
npm run android
```

#### 原生模块错误
```bash
cd scenelens
# 清理并重新构建
npx expo prebuild --clean
cd android
.\gradlew.bat clean
.\gradlew.bat assembleDebug
```

#### 权限错误
在 `AndroidManifest.xml` 中添加缺失的权限，或在代码中正确请求权限。

#### 依赖冲突
```bash
cd scenelens
# 重新安装依赖
rm -rf node_modules
npm install
```

---

## 🎯 推荐调试流程

### 第一步：快速诊断
```bash
cd scenelens
debug_app.bat
```

### 第二步：如果仍有问题
1. 打开 Android Studio
2. 导入 `scenelens/android` 项目
3. 使用 Debug 模式运行
4. 查看详细的错误信息

### 第三步：根据错误类型修复
- JavaScript 错误 → 检查代码逻辑
- 原生错误 → 检查权限和依赖
- 构建错误 → 清理重新构建

---

## 📱 测试不同版本

### Debug 版本（推荐用于调试）
```bash
cd scenelens/android
.\gradlew.bat assembleDebug
```
- 包含调试信息
- 可以连接 Metro Bundler
- 文件较大但便于调试

### Release 版本（用于分发）
```bash
cd scenelens/android
.\gradlew.bat assembleRelease
```
- 优化过的版本
- 独立运行
- 文件较小

---

## 📞 获取帮助

如果问题仍然存在，请提供以下信息：

### 1. 设备信息
```bash
adb shell getprop ro.build.version.release  # Android 版本
adb shell getprop ro.product.model          # 设备型号
```

### 2. 完整的错误日志
```bash
adb logcat > logcat.txt
```

### 3. 构建信息
- 使用的构建方法（EAS Build / Gradle）
- 构建版本（Debug / Release）
- 是否是第一次安装

### 4. 具体现象
- 应用是否能安装成功
- 点击图标后发生什么
- 是否有任何错误提示
- 多长时间后崩溃

---

## 🚀 立即开始

**最快的调试方法：**

1. 连接手机到电脑
2. 运行调试脚本：
   ```bash
   cd scenelens
   debug_app.bat
   ```
3. 观察日志输出，找到错误原因
4. 根据错误类型应用相应的修复方案

这样我们就能快速定位并解决问题！