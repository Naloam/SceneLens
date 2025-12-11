@echo off
echo ========================================
echo SceneLens 应用调试脚本
echo ========================================

echo.
echo 1. 检查设备连接...
adb devices

echo.
echo 2. 检查应用是否已安装...
adb shell pm list packages | findstr scenelens

echo.
echo 3. 卸载旧版本（如果存在）...
adb uninstall com.che1sy.scenelens

echo.
echo 4. 清理日志...
adb logcat -c

echo.
echo 5. 构建并安装 Debug 版本...
cd android
call gradlew.bat assembleDebug
if %ERRORLEVEL% NEQ 0 (
    echo 构建失败！请检查错误信息。
    pause
    exit /b 1
)

echo.
echo 6. 安装 APK...
adb install app\build\outputs\apk\debug\app-debug.apk
if %ERRORLEVEL% NEQ 0 (
    echo 安装失败！请检查错误信息。
    pause
    exit /b 1
)

echo.
echo 7. 启动应用...
adb shell am start -n com.che1sy.scenelens/.MainActivity

echo.
echo 8. 开始监控日志（按 Ctrl+C 停止）...
echo 请尝试打开应用，观察下面的日志输出：
echo ========================================
adb logcat | findstr "che1sy\|scenelens\|ReactNative\|FATAL\|AndroidRuntime"

pause