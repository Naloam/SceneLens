# SceneLens APK 构建指南

## 🚨 当前问题

Gradle 构建遇到 NDK 配置问题。以下是几种替代方案：

---

## 方案一：使用 Expo EAS Build（推荐）

这是最简单可靠的方式，由 Expo 云端构建。

### 步骤：

1. **安装 EAS CLI**
```bash
npm install -g eas-cli
```

2. **登录 Expo 账号**
```bash
eas login
```
如果没有账号，访问 https://expo.dev 注册一个免费账号。

3. **配置 EAS Build**
```bash
cd scenelens
eas build:configure
```

4. **构建 APK**
```bash
# 构建预览版 APK（不需要上传到 Google Play）
eas build --platform android --profile preview

# 或者构建开发版
eas build --platform android --profile development
```

5. **下载 APK**
构建完成后，会提供下载链接，直接下载 APK 文件即可。

### 优点：
- ✅ 无需本地配置 Android SDK/NDK
- ✅ 构建环境统一，不会有兼容性问题
- ✅ 支持云端构建，速度快
- ✅ 免费账号每月有 30 次构建额度

---

## 方案二：修复本地 Gradle 构建

### 问题诊断
当前错误：`NDK at C:\Users\22636\AppData\Local\Android\Sdk\ndk\27.1.12297006 did not have a source.properties file`

### 解决步骤：

#### 1. 清理 NDK 目录
```bash
# 删除损坏的 NDK
rmdir /s /q "C:\Users\22636\AppData\Local\Android\Sdk\ndk\27.1.12297006"
```

#### 2. 使用 Android Studio SDK Manager 重新安装 NDK
- 打开 Android Studio
- Tools → SDK Manager
- SDK Tools 标签页
- 勾选 "NDK (Side by side)"
- 点击 Apply 安装

#### 3. 或者使用 sdkmanager 命令行安装
```bash
# 查看可用的 NDK 版本
sdkmanager --list | findstr ndk

# 安装指定版本的 NDK
sdkmanager "ndk;27.1.12297006"
```

#### 4. 重新构建
```bash
cd scenelens/android
.\gradlew.bat clean
.\gradlew.bat assembleRelease
```

---

## 方案三：使用较低版本的 NDK

修改 `android/build.gradle` 使用较低版本的 NDK。

### 步骤：

1. **编辑 `scenelens/android/build.gradle`**

找到：
```gradle
buildscript {
    ext {
        // ...
        ndkVersion = "27.1.12297006"
    }
}
```

改为：
```gradle
buildscript {
    ext {
        // ...
        ndkVersion = "26.1.10909125"  // 使用较低版本
    }
}
```

2. **重新构建**
```bash
cd scenelens/android
.\gradlew.bat assembleRelease
```

---

## 方案四：使用 Expo Prebuild + Android Studio

### 步骤：

1. **Prebuild 项目**
```bash
cd scenelens
npx expo prebuild --platform android
```

2. **在 Android Studio 中打开项目**
- File → Open
- 选择 `scenelens/android` 目录

3. **在 Android Studio 中构建**
- Build → Build Bundle(s) / APK(s) → Build APK(s)
- 等待构建完成
- 点击通知中的 "locate" 找到 APK 文件

---

## 方案五：使用开发构建（最快）

如果只是为了测试功能，可以使用开发构建：

### 步骤：

1. **启动 Metro Bundler**
```bash
cd scenelens
npx expo start
```

2. **在另一个终端构建开发 APK**
```bash
cd scenelens
npx expo run:android
```

3. **APK 位置**
```
scenelens/android/app/build/outputs/apk/debug/app-debug.apk
```

### 注意：
- 开发版 APK 需要连接到 Metro Bundler
- 适合快速测试，不适合分发

---

## 🎯 推荐方案

根据你的需求选择：

### 如果需要独立的 APK 文件（可以分发给其他人）
→ **使用方案一：Expo EAS Build**

### 如果只是自己测试
→ **使用方案五：开发构建**

### 如果想要完全本地构建
→ **使用方案二：修复 NDK** 或 **方案四：Android Studio**

---

## 📦 APK 文件位置

构建成功后，APK 文件位置：

### Release 版本
```
scenelens/android/app/build/outputs/apk/release/app-release.apk
```

### Debug 版本
```
scenelens/android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 🚀 快速开始（推荐）

如果你想立即测试，最快的方式是：

```bash
# 1. 连接手机到电脑（USB调试模式）
# 2. 运行开发构建
cd scenelens
npx expo run:android

# 应用会自动安装到手机上
```

这样可以立即在手机上测试所有功能！

---

## 📞 需要帮助？

如果遇到问题，请告诉我：
1. 你选择哪个方案？
2. 遇到什么错误？
3. 你的 Android SDK 安装路径是什么？
