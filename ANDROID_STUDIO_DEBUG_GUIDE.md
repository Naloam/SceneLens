# Android Studio 调试指南

## 🎯 目标

使用 Android Studio 来调试 SceneLens 应用，找出为什么 APK 在真机上无法打开的原因。

---

## 📋 准备工作

### 1. 确保项目已经 Prebuild
```bash
cd scenelens
npx expo prebuild --platform android
```
✅ 已完成

### 2. 检查 Android 项目结构
现在你的项目应该有完整的 Android 原生代码：
```
scenelens/
├── android/
│   ├── app/
│   │   ├── src/main/java/com/che1sy/scenelens/
│   │   ├── build.gradle
│   │   └── ...
│   ├── build.gradle
│   ├── settings.gradle
│   └── local.properties
```

---

## 🚀 在 Android Studio 中打开项目

### 步骤 1：启动 Android Studio
1. 打开 Android Studio
2. 选择 "Open an Existing Project"
3. 导航到 `D:\myProjects\SceneLens\scenelens\android` 目录
4. 点击 "OK"

### 步骤 2：等待项目同步
- Android Studio 会自动同步 Gradle 项目
- 等待底部状态栏显示 "Gradle sync finished"
- 如果有错误，会在 "Build" 窗口中显示

### 步骤 3：配置设备
1. 连接你的 Android 手机（USB 调试模式）
2. 在 Android Studio 顶部工具栏中，设备下拉菜单应该显示你的手机
3. 如果没有显示，点击 "Device Manager" 检查连接

---

## 🔧 构建和运行

### 方法一：直接运行（推荐）

1. **选择运行配置**
   - 在顶部工具栏，确保选择了 "app" 配置
   - 选择你的设备

2. **点击运行按钮**
   - 点击绿色的 "Run" 按钮（▶️）
   - 或使用快捷键 `Shift + F10`

3. **观察构建过程**
   - 在底部 "Build" 窗口查看构建日志
   - 如果有错误，会在这里显示详细信息

### 方法二：先构建再安装

1. **构建 APK**
   - 菜单：Build → Build Bundle(s) / APK(s) → Build APK(s)
   - 等待构建完成

2. **查看构建结果**
   - 构建完成后会显示通知
   - 点击 "locate" 找到 APK 文件位置

3. **手动安装**
   ```bash
   adb install path/to/app-debug.apk
   ```

---

## 🐛 调试崩溃问题

### 1. 查看 Logcat

**在 Android Studio 中：**
1. 底部点击 "Logcat" 标签
2. 确保选择了正确的设备和应用包名 `com.che1sy.scenelens`
3. 尝试启动应用，观察日志输出

**过滤日志：**
- 在搜索框中输入：`com.che1sy.scenelens`
- 或者输入：`SceneLens`
- 设置日志级别为 "Error" 查看错误信息

### 2. 使用 ADB 查看崩溃日志

```bash
# 清除之前的日志
adb logcat -c

# 启动应用，然后立即查看日志
adb logcat | findstr "com.che1sy.scenelens"

# 或者查看所有错误
adb logcat *:E
```

### 3. 检查应用是否安装成功

```bash
# 检查应用是否已安装
adb shell pm list packages | findstr scenelens

# 检查应用信息
adb shell dumpsys package com.che1sy.scenelens
```

---

## 🔍 常见问题排查

### 问题 1：应用安装后无法启动

**可能原因：**
- JavaScript bundle 加载失败
- 原生模块初始化错误
- 权限问题
- 依赖库冲突

**排查步骤：**

1. **检查 Metro Bundler 是否需要运行**
   ```bash
   cd scenelens
   npx expo start
   ```
   
2. **查看详细错误信息**
   ```bash
   adb logcat -s ReactNativeJS:V
   ```

3. **检查应用权限**
   ```bash
   adb shell dumpsys package com.che1sy.scenelens | findstr permission
   ```

### 问题 2：构建失败

**检查 Gradle 错误：**
1. 在 Android Studio 底部点击 "Build" 标签
2. 查看详细的错误信息
3. 常见错误：
   - NDK 版本问题
   - 依赖冲突
   - 签名问题

**解决方法：**
```bash
# 清理构建缓存
cd scenelens/android
.\gradlew.bat clean

# 重新构建
.\gradlew.bat assembleDebug
```

### 问题 3：设备连接问题

**检查设备连接：**
```bash
adb devices
```

**如果设备未显示：**
1. 确保手机开启了 USB 调试
2. 确保安装了正确的 USB 驱动
3. 尝试重新连接 USB 线
4. 在手机上允许 USB 调试授权

---

## 📊 调试技巧

### 1. 使用断点调试

**Java/Kotlin 代码调试：**
1. 在 `SceneBridgeModule.java` 中设置断点
2. 点击 "Debug" 按钮（🐛）运行应用
3. 当代码执行到断点时会暂停

**JavaScript 代码调试：**
1. 在应用中摇晃手机打开开发者菜单
2. 选择 "Debug"
3. 在 Chrome 开发者工具中调试

### 2. 添加日志输出

**在 Java 代码中：**
```java
import android.util.Log;

public class SceneBridgeModule extends ReactContextBaseJavaModule {
    private static final String TAG = "SceneBridge";
    
    @ReactMethod
    public void getCurrentLocation(Promise promise) {
        Log.d(TAG, "getCurrentLocation called");
        // ... 你的代码
    }
}
```

**在 JavaScript 代码中：**
```javascript
console.log('SceneLens: App starting...');
console.error('SceneLens: Error occurred:', error);
```

### 3. 检查应用状态

```bash
# 检查应用是否在运行
adb shell ps | findstr scenelens

# 检查应用的内存使用
adb shell dumpsys meminfo com.che1sy.scenelens

# 强制停止应用
adb shell am force-stop com.che1sy.scenelens
```

---

## 🎯 具体调试步骤

### 步骤 1：在 Android Studio 中运行

1. 打开 Android Studio
2. 打开 `scenelens/android` 项目
3. 连接手机
4. 点击 "Run" 按钮
5. 观察构建过程和运行结果

### 步骤 2：如果应用崩溃

1. **立即查看 Logcat**
   - 寻找红色的错误信息
   - 特别关注 `FATAL EXCEPTION` 或 `AndroidRuntime` 错误

2. **记录错误信息**
   - 复制完整的错误堆栈
   - 注意错误发生的位置

3. **分析错误类型**
   - JavaScript 错误：通常是代码逻辑问题
   - 原生错误：通常是权限或依赖问题
   - 网络错误：通常是 Metro Bundler 连接问题

### 步骤 3：修复常见问题

**如果是 Metro Bundler 连接问题：**
```bash
cd scenelens
npx expo start --clear
```

**如果是权限问题：**
- 在手机设置中手动授予应用权限
- 或在代码中添加权限检查

**如果是依赖问题：**
```bash
cd scenelens
npm install
npx expo prebuild --clean
```

---

## 📱 测试建议

### 1. 分步测试

1. **先测试基础启动**
   - 应用能否正常启动
   - 主界面是否显示

2. **再测试核心功能**
   - 权限请求是否正常
   - 场景识别是否工作
   - 通知是否能推送

3. **最后测试完整流程**
   - 端到端的场景测试

### 2. 使用不同构建类型

```bash
# Debug 构建（包含调试信息）
.\gradlew.bat assembleDebug

# Release 构建（优化版本）
.\gradlew.bat assembleRelease
```

---

## 📞 需要帮助时

如果在调试过程中遇到问题，请提供：

1. **完整的错误日志**
   ```bash
   adb logcat > logcat.txt
   ```

2. **构建输出**
   - Android Studio 的 Build 窗口内容

3. **设备信息**
   - 手机型号和 Android 版本
   - 是否是第一次安装

4. **具体现象**
   - 应用是否能安装
   - 点击图标后发生什么
   - 是否有错误提示

---

## 🚀 快速开始

**立即开始调试：**

1. 打开 Android Studio
2. 打开项目：`scenelens/android`
3. 连接手机
4. 点击 Run 按钮
5. 查看 Logcat 中的错误信息

这样我们就能快速定位问题所在！