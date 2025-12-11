# SceneLens 快速构建指南

## 🎯 最简单的方法：使用 Expo EAS Build

这是推荐的方式，无需配置本地 Android 环境。

### 步骤 1：安装 EAS CLI

```bash
npm install -g eas-cli
```

### 步骤 2：登录 Expo

```bash
eas login
```

如果没有账号，访问 https://expo.dev 免费注册。

### 步骤 3：初始化 EAS

```bash
cd scenelens
eas build:configure
```

这会创建 `eas.json` 配置文件。

### 步骤 4：构建 APK

```bash
# 构建预览版 APK（推荐）
eas build --platform android --profile preview

# 或者构建生产版
eas build --platform android --profile production
```

### 步骤 5：下载 APK

构建完成后（大约 10-15 分钟），会显示下载链接：
```
✔ Build finished
https://expo.dev/accounts/[your-account]/projects/scenelens/builds/[build-id]
```

点击链接下载 APK 文件。

---

## 🔧 备选方法：本地构建（需要修复 NDK）

### 问题：NDK 配置错误

当前错误：`NDK did not have a source.properties file`

### 解决方案 A：重新安装 NDK

#### 使用 Android Studio（推荐）

1. 打开 Android Studio
2. Tools → SDK Manager
3. SDK Tools 标签页
4. 取消勾选 "NDK (Side by side)"，点击 Apply 卸载
5. 重新勾选 "NDK (Side by side)"，点击 Apply 安装
6. 等待安装完成

#### 使用命令行

```bash
# 删除损坏的 NDK
rmdir /s /q "C:\Users\22636\AppData\Local\Android\Sdk\ndk\27.1.12297006"

# 使用 sdkmanager 重新安装
cd C:\Users\22636\AppData\Local\Android\Sdk\cmdline-tools\latest\bin
sdkmanager "ndk;27.1.12297006"
```

### 解决方案 B：使用较低版本的 NDK

编辑 `scenelens/android/build.gradle`：

```gradle
buildscript {
    ext {
        buildToolsVersion = "36.0.0"
        minSdkVersion = 24
        compileSdkVersion = 36
        targetSdkVersion = 36
        ndkVersion = "26.1.10909125"  // 改为较低版本
        kotlinVersion = "2.1.20"
        kspVersion = "2.1.20-2.0.1"
    }
    // ...
}
```

然后重新构建：

```bash
cd scenelens/android
.\gradlew.bat clean
.\gradlew.bat assembleRelease
```

---

## 📱 最快测试方法：直接运行到手机

如果你只是想快速测试，不需要独立的 APK：

### 步骤 1：连接手机

1. 在手机上启用"开发者选项"
   - 设置 → 关于手机 → 连续点击"版本号" 7次
2. 启用"USB调试"
   - 设置 → 开发者选项 → USB调试
3. 用 USB 线连接手机到电脑

### 步骤 2：验证连接

```bash
adb devices
```

应该显示你的设备。

### 步骤 3：运行应用

```bash
cd scenelens
npx expo run:android
```

应用会自动安装到手机上并启动！

---

## 📦 构建完成后的文件位置

### Release APK
```
scenelens/android/app/build/outputs/apk/release/app-release.apk
```

### Debug APK
```
scenelens/android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 🚀 推荐流程

### 对于快速测试（今天就能用）
```bash
# 1. 连接手机
# 2. 运行
cd scenelens
npx expo run:android
```

### 对于生成独立 APK（可分发）
```bash
# 1. 安装 EAS CLI
npm install -g eas-cli

# 2. 登录
eas login

# 3. 配置
cd scenelens
eas build:configure

# 4. 构建
eas build --platform android --profile preview

# 5. 等待 10-15 分钟，下载 APK
```

---

## ❓ 常见问题

### Q: EAS Build 需要付费吗？
A: 免费账号每月有 30 次构建额度，足够使用。

### Q: 本地构建一直失败怎么办？
A: 使用 EAS Build，它会在云端构建，不受本地环境影响。

### Q: 我想要完全离线构建怎么办？
A: 需要先修复 NDK 问题，参考上面的"解决方案 A"或"解决方案 B"。

### Q: 构建的 APK 能在其他手机上运行吗？
A: 可以！Release 版本的 APK 可以安装在任何 Android 手机上（需要允许未知来源安装）。

---

## 📞 需要帮助？

如果遇到问题，请告诉我：
1. 你选择哪种构建方式？
2. 遇到什么错误信息？
3. 你的目标是快速测试还是生成可分发的 APK？

我会根据你的情况提供具体的解决方案！
