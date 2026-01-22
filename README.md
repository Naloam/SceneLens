# SceneLens

SceneLens 是一个基于 Expo + React Native 的场景感知助手，结合原生 Android 能力，在不同场景下自动提供应用和系统控制建议。

## Quickstart (真机调试)

> 以下命令均在 `scenelens/` 目录中执行，确保 Android 设备已开启开发者模式和 USB/Wi-Fi 调试。

1. **安装依赖**
   ```bash
   npm install
   ```
2. **启动 Metro Bundler**（必须在任何设备连接前启动）
   ```bash
   npm start
   ```
3. **为真机转发调试端口**（新终端执行）
   ```bash
   adb reverse tcp:8081 tcp:8081
   ```
   - 如使用无线调试，请先通过 `adb connect <device-ip>:5555` 建立连接，再执行上方命令。
4. **连接手机**
   - USB 连接：使用数据线连接，确认 `adb devices` 能看到设备。
   - 无线连接：在开发者选项中开启无线调试，依次完成配对/连接。
5. **安装并运行到真机**
   ```bash
   npm run android
   ```
   - 构建完成后即可在真机上热更新调试；保持 `npm start` 终端常驻即可。

### 常见问题
- 如果真机无法加载 Bundler，请重新执行 `adb reverse tcp:8081 tcp:8081` 并确保设备保持连接。
- 当修改原生代码后，需要重新运行 `npm run android` 以重新安装应用。
