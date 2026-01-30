package com.che1sy.scenelens.modules

import android.Manifest
import android.app.NotificationManager
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioManager
import android.net.wifi.WifiManager
import android.os.Build
import android.provider.Settings
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule

/**
 * SystemSettingsModule - 系统设置控制原生模块
 * 
 * 提供对 Android 系统设置的控制能力：
 * - 音量控制（媒体/铃声/通知/闹钟）
 * - 亮度调节
 * - 勿扰模式切换
 * - WiFi/蓝牙开关
 * - 屏幕超时设置
 */
@ReactModule(name = SystemSettingsModule.NAME)
class SystemSettingsModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {

    companion object {
        const val NAME = "SystemSettings"
        private const val LOG_TAG = "SystemSettings"
    }

    override fun getName() = NAME

    // ==================== 权限检查工具方法 ====================

    private fun permissionGranted(vararg perms: String): Boolean =
        perms.all { ContextCompat.checkSelfPermission(ctx, it) == PackageManager.PERMISSION_GRANTED }

    private fun requestPermissions(perms: Array<String>): Boolean {
        val activity = ctx.currentActivity ?: return false
        ActivityCompat.requestPermissions(activity, perms, 1011)
        return true
    }

    // ==================== 音量控制 ====================

    /**
     * 设置音量
     * @param streamType 音量类型: "media" | "ring" | "notification" | "alarm" | "system"
     * @param level 音量级别 (0-100)
     */
    @ReactMethod
    fun setVolume(streamType: String, level: Int, promise: Promise) {
        try {
            val audioManager = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            
            val stream = when (streamType.lowercase()) {
                "media" -> AudioManager.STREAM_MUSIC
                "ring" -> AudioManager.STREAM_RING
                "notification" -> AudioManager.STREAM_NOTIFICATION
                "alarm" -> AudioManager.STREAM_ALARM
                "system" -> AudioManager.STREAM_SYSTEM
                else -> {
                    promise.reject("ERR_INVALID_STREAM", "Invalid stream type: $streamType")
                    return
                }
            }
            
            val maxVolume = audioManager.getStreamMaxVolume(stream)
            val targetVolume = (level.coerceIn(0, 100) * maxVolume / 100)
            
            audioManager.setStreamVolume(stream, targetVolume, 0)
            
            Log.d(LOG_TAG, "Set $streamType volume to $level% ($targetVolume/$maxVolume)")
            
            val result = Arguments.createMap().apply {
                putString("streamType", streamType)
                putInt("level", level)
                putInt("actualVolume", targetVolume)
                putInt("maxVolume", maxVolume)
                putBoolean("success", true)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(LOG_TAG, "Failed to set volume: ${e.message}", e)
            promise.reject("ERR_SET_VOLUME", "Failed to set volume: ${e.message}", e)
        }
    }

    /**
     * 获取当前音量
     * @param streamType 音量类型: "media" | "ring" | "notification" | "alarm" | "system"
     */
    @ReactMethod
    fun getVolume(streamType: String, promise: Promise) {
        try {
            val audioManager = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            
            val stream = when (streamType.lowercase()) {
                "media" -> AudioManager.STREAM_MUSIC
                "ring" -> AudioManager.STREAM_RING
                "notification" -> AudioManager.STREAM_NOTIFICATION
                "alarm" -> AudioManager.STREAM_ALARM
                "system" -> AudioManager.STREAM_SYSTEM
                else -> {
                    promise.reject("ERR_INVALID_STREAM", "Invalid stream type: $streamType")
                    return
                }
            }
            
            val currentVolume = audioManager.getStreamVolume(stream)
            val maxVolume = audioManager.getStreamMaxVolume(stream)
            val level = if (maxVolume > 0) (currentVolume * 100 / maxVolume) else 0
            
            val result = Arguments.createMap().apply {
                putString("streamType", streamType)
                putInt("level", level)
                putInt("currentVolume", currentVolume)
                putInt("maxVolume", maxVolume)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(LOG_TAG, "Failed to get volume: ${e.message}", e)
            promise.reject("ERR_GET_VOLUME", "Failed to get volume: ${e.message}", e)
        }
    }

    /**
     * 获取所有音量状态
     */
    @ReactMethod
    fun getAllVolumes(promise: Promise) {
        try {
            val audioManager = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            
            val streams = mapOf(
                "media" to AudioManager.STREAM_MUSIC,
                "ring" to AudioManager.STREAM_RING,
                "notification" to AudioManager.STREAM_NOTIFICATION,
                "alarm" to AudioManager.STREAM_ALARM,
                "system" to AudioManager.STREAM_SYSTEM
            )
            
            val result = Arguments.createMap()
            for ((name, stream) in streams) {
                val currentVolume = audioManager.getStreamVolume(stream)
                val maxVolume = audioManager.getStreamMaxVolume(stream)
                val level = if (maxVolume > 0) (currentVolume * 100 / maxVolume) else 0
                
                val volumeInfo = Arguments.createMap().apply {
                    putInt("level", level)
                    putInt("current", currentVolume)
                    putInt("max", maxVolume)
                }
                result.putMap(name, volumeInfo)
            }
            
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(LOG_TAG, "Failed to get all volumes: ${e.message}", e)
            promise.reject("ERR_GET_VOLUMES", "Failed to get volumes: ${e.message}", e)
        }
    }

    // ==================== 亮度控制 ====================

    /**
     * 设置屏幕亮度
     * @param level 亮度级别 (0-100)
     * @param autoMode 是否启用自动亮度
     */
    @ReactMethod
    fun setBrightness(level: Int, autoMode: Boolean, promise: Promise) {
        try {
            if (!Settings.System.canWrite(ctx)) {
                Log.w(LOG_TAG, "Write settings permission not granted")
                val result = Arguments.createMap().apply {
                    putInt("level", level)
                    putBoolean("autoMode", autoMode)
                    putBoolean("success", false)
                    putString("error", "PERMISSION_DENIED")
                }
                promise.resolve(result)
                return
            }
            
            // 设置自动亮度模式
            Settings.System.putInt(
                ctx.contentResolver,
                Settings.System.SCREEN_BRIGHTNESS_MODE,
                if (autoMode) Settings.System.SCREEN_BRIGHTNESS_MODE_AUTOMATIC
                else Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL
            )
            
            // 如果是手动模式，设置亮度值
            if (!autoMode) {
                val brightnessValue = (level.coerceIn(0, 100) * 255 / 100)
                Settings.System.putInt(
                    ctx.contentResolver,
                    Settings.System.SCREEN_BRIGHTNESS,
                    brightnessValue
                )
            }
            
            Log.d(LOG_TAG, "Set brightness to $level%, autoMode=$autoMode")
            
            val result = Arguments.createMap().apply {
                putInt("level", level)
                putBoolean("autoMode", autoMode)
                putBoolean("success", true)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(LOG_TAG, "Failed to set brightness: ${e.message}", e)
            promise.reject("ERR_SET_BRIGHTNESS", "Failed to set brightness: ${e.message}", e)
        }
    }

    /**
     * 获取当前亮度
     */
    @ReactMethod
    fun getBrightness(promise: Promise) {
        try {
            val brightness = Settings.System.getInt(
                ctx.contentResolver,
                Settings.System.SCREEN_BRIGHTNESS,
                128
            )
            val mode = Settings.System.getInt(
                ctx.contentResolver,
                Settings.System.SCREEN_BRIGHTNESS_MODE,
                Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL
            )
            
            val level = (brightness * 100 / 255)
            val autoMode = mode == Settings.System.SCREEN_BRIGHTNESS_MODE_AUTOMATIC
            
            val result = Arguments.createMap().apply {
                putInt("level", level)
                putInt("rawValue", brightness)
                putBoolean("autoMode", autoMode)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(LOG_TAG, "Failed to get brightness: ${e.message}", e)
            promise.reject("ERR_GET_BRIGHTNESS", "Failed to get brightness: ${e.message}", e)
        }
    }

    // ==================== 勿扰模式 ====================

    /**
     * 设置勿扰模式
     * @param enabled 是否启用
     * @param mode 勿扰模式: "all" | "priority" | "alarms" | "none"
     */
    @ReactMethod
    fun setDoNotDisturb(enabled: Boolean, mode: String?, promise: Promise) {
        try {
            val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            
            if (!nm.isNotificationPolicyAccessGranted) {
                Log.w(LOG_TAG, "Notification policy access not granted")
                val result = Arguments.createMap().apply {
                    putBoolean("enabled", enabled)
                    putString("mode", mode ?: "unknown")
                    putBoolean("success", false)
                    putString("error", "PERMISSION_DENIED")
                }
                promise.resolve(result)
                return
            }
            
            val filter = if (enabled) {
                when (mode?.lowercase()) {
                    "priority" -> NotificationManager.INTERRUPTION_FILTER_PRIORITY
                    "alarms" -> NotificationManager.INTERRUPTION_FILTER_ALARMS
                    "none" -> NotificationManager.INTERRUPTION_FILTER_NONE
                    else -> NotificationManager.INTERRUPTION_FILTER_NONE
                }
            } else {
                NotificationManager.INTERRUPTION_FILTER_ALL
            }
            
            nm.setInterruptionFilter(filter)
            
            Log.d(LOG_TAG, "Set DND to enabled=$enabled, mode=$mode, filter=$filter")
            
            val result = Arguments.createMap().apply {
                putBoolean("enabled", enabled)
                putString("mode", mode ?: "none")
                putInt("filter", filter)
                putBoolean("success", true)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(LOG_TAG, "Failed to set DND: ${e.message}", e)
            promise.reject("ERR_SET_DND", "Failed to set DND: ${e.message}", e)
        }
    }

    /**
     * 获取勿扰模式状态
     */
    @ReactMethod
    fun getDoNotDisturbStatus(promise: Promise) {
        try {
            val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            
            val filter = nm.currentInterruptionFilter
            val enabled = filter != NotificationManager.INTERRUPTION_FILTER_ALL
            
            val mode = when (filter) {
                NotificationManager.INTERRUPTION_FILTER_ALL -> "all"
                NotificationManager.INTERRUPTION_FILTER_PRIORITY -> "priority"
                NotificationManager.INTERRUPTION_FILTER_ALARMS -> "alarms"
                NotificationManager.INTERRUPTION_FILTER_NONE -> "none"
                else -> "unknown"
            }
            
            val hasPermission = nm.isNotificationPolicyAccessGranted
            
            val result = Arguments.createMap().apply {
                putBoolean("enabled", enabled)
                putString("mode", mode)
                putInt("filter", filter)
                putBoolean("hasPermission", hasPermission)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(LOG_TAG, "Failed to get DND status: ${e.message}", e)
            promise.reject("ERR_GET_DND", "Failed to get DND status: ${e.message}", e)
        }
    }

    /**
     * 检查勿扰模式权限
     */
    @ReactMethod
    fun checkDoNotDisturbPermission(promise: Promise) {
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        promise.resolve(nm.isNotificationPolicyAccessGranted)
    }

    /**
     * 打开勿扰模式设置页面
     */
    @ReactMethod
    fun openDoNotDisturbSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            ctx.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(LOG_TAG, "Failed to open DND settings: ${e.message}", e)
            promise.reject("ERR_OPEN_DND_SETTINGS", e.message, e)
        }
    }

    // ==================== WiFi 控制 ====================

    /**
     * 设置 WiFi 状态
     * @param enabled 是否启用
     */
    @ReactMethod
    fun setWiFi(enabled: Boolean, promise: Promise) {
        try {
            // Android 10+ 不再允许直接控制 WiFi
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                Log.w(LOG_TAG, "Cannot programmatically control WiFi on Android 10+")
                val result = Arguments.createMap().apply {
                    putBoolean("enabled", enabled)
                    putBoolean("success", false)
                    putString("error", "NOT_SUPPORTED")
                    putString("message", "Android 10+ does not allow programmatic WiFi control. Opening WiFi settings instead.")
                }
                
                // 打开 WiFi 设置页面
                try {
                    val intent = Intent(Settings.ACTION_WIFI_SETTINGS)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    ctx.startActivity(intent)
                    result.putBoolean("settingsOpened", true)
                } catch (e: Exception) {
                    result.putBoolean("settingsOpened", false)
                }
                
                promise.resolve(result)
                return
            }
            
            @Suppress("DEPRECATION")
            val wifiManager = ctx.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            @Suppress("DEPRECATION")
            val success = wifiManager.setWifiEnabled(enabled)
            
            Log.d(LOG_TAG, "Set WiFi enabled=$enabled, success=$success")
            
            val result = Arguments.createMap().apply {
                putBoolean("enabled", enabled)
                putBoolean("success", success)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(LOG_TAG, "Failed to set WiFi: ${e.message}", e)
            promise.reject("ERR_SET_WIFI", "Failed to set WiFi: ${e.message}", e)
        }
    }

    /**
     * 获取 WiFi 状态
     */
    @ReactMethod
    fun getWiFiStatus(promise: Promise) {
        try {
            val wifiManager = ctx.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            val enabled = wifiManager.isWifiEnabled
            
            val result = Arguments.createMap().apply {
                putBoolean("enabled", enabled)
                putInt("state", wifiManager.wifiState)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(LOG_TAG, "Failed to get WiFi status: ${e.message}", e)
            promise.reject("ERR_GET_WIFI", "Failed to get WiFi status: ${e.message}", e)
        }
    }

    /**
     * 打开 WiFi 设置页面
     */
    @ReactMethod
    fun openWiFiSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_WIFI_SETTINGS)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            ctx.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(LOG_TAG, "Failed to open WiFi settings: ${e.message}", e)
            promise.reject("ERR_OPEN_WIFI_SETTINGS", e.message, e)
        }
    }

    // ==================== 蓝牙控制 ====================

    /**
     * 设置蓝牙状态
     * @param enabled 是否启用
     */
    @ReactMethod
    fun setBluetooth(enabled: Boolean, promise: Promise) {
        try {
            val bluetoothManager = ctx.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
            val bluetoothAdapter = bluetoothManager.adapter
            
            if (bluetoothAdapter == null) {
                val result = Arguments.createMap().apply {
                    putBoolean("enabled", enabled)
                    putBoolean("success", false)
                    putString("error", "NOT_SUPPORTED")
                    putString("message", "Bluetooth is not supported on this device")
                }
                promise.resolve(result)
                return
            }
            
            // Android 12+ 需要 BLUETOOTH_CONNECT 权限
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (!permissionGranted(Manifest.permission.BLUETOOTH_CONNECT)) {
                    Log.w(LOG_TAG, "BLUETOOTH_CONNECT permission not granted")
                    val result = Arguments.createMap().apply {
                        putBoolean("enabled", enabled)
                        putBoolean("success", false)
                        putString("error", "PERMISSION_DENIED")
                        putString("message", "Bluetooth permission not granted. Opening Bluetooth settings instead.")
                    }
                    
                    // 打开蓝牙设置页面
                    try {
                        val intent = Intent(Settings.ACTION_BLUETOOTH_SETTINGS)
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        ctx.startActivity(intent)
                        result.putBoolean("settingsOpened", true)
                    } catch (e: Exception) {
                        result.putBoolean("settingsOpened", false)
                    }
                    
                    promise.resolve(result)
                    return
                }
            }
            
            @Suppress("DEPRECATION", "MissingPermission")
            val success = if (enabled) {
                bluetoothAdapter.enable()
            } else {
                bluetoothAdapter.disable()
            }
            
            Log.d(LOG_TAG, "Set Bluetooth enabled=$enabled, success=$success")
            
            val result = Arguments.createMap().apply {
                putBoolean("enabled", enabled)
                putBoolean("success", success)
            }
            promise.resolve(result)
        } catch (e: SecurityException) {
            Log.e(LOG_TAG, "Bluetooth permission denied: ${e.message}", e)
            val result = Arguments.createMap().apply {
                putBoolean("enabled", enabled)
                putBoolean("success", false)
                putString("error", "PERMISSION_DENIED")
            }
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(LOG_TAG, "Failed to set Bluetooth: ${e.message}", e)
            promise.reject("ERR_SET_BLUETOOTH", "Failed to set Bluetooth: ${e.message}", e)
        }
    }

    /**
     * 获取蓝牙状态
     */
    @ReactMethod
    fun getBluetoothStatus(promise: Promise) {
        try {
            val bluetoothManager = ctx.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
            val bluetoothAdapter = bluetoothManager.adapter
            
            if (bluetoothAdapter == null) {
                val result = Arguments.createMap().apply {
                    putBoolean("supported", false)
                    putBoolean("enabled", false)
                }
                promise.resolve(result)
                return
            }
            
            val result = Arguments.createMap().apply {
                putBoolean("supported", true)
                putBoolean("enabled", bluetoothAdapter.isEnabled)
                putInt("state", bluetoothAdapter.state)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(LOG_TAG, "Failed to get Bluetooth status: ${e.message}", e)
            promise.reject("ERR_GET_BLUETOOTH", "Failed to get Bluetooth status: ${e.message}", e)
        }
    }

    /**
     * 打开蓝牙设置页面
     */
    @ReactMethod
    fun openBluetoothSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_BLUETOOTH_SETTINGS)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            ctx.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(LOG_TAG, "Failed to open Bluetooth settings: ${e.message}", e)
            promise.reject("ERR_OPEN_BLUETOOTH_SETTINGS", e.message, e)
        }
    }

    // ==================== 屏幕超时 ====================

    /**
     * 设置屏幕超时时间
     * @param seconds 超时秒数
     */
    @ReactMethod
    fun setScreenTimeout(seconds: Int, promise: Promise) {
        try {
            if (!Settings.System.canWrite(ctx)) {
                Log.w(LOG_TAG, "Write settings permission not granted")
                val result = Arguments.createMap().apply {
                    putInt("seconds", seconds)
                    putBoolean("success", false)
                    putString("error", "PERMISSION_DENIED")
                }
                promise.resolve(result)
                return
            }
            
            val milliseconds = seconds * 1000
            Settings.System.putInt(
                ctx.contentResolver,
                Settings.System.SCREEN_OFF_TIMEOUT,
                milliseconds
            )
            
            Log.d(LOG_TAG, "Set screen timeout to $seconds seconds")
            
            val result = Arguments.createMap().apply {
                putInt("seconds", seconds)
                putInt("milliseconds", milliseconds)
                putBoolean("success", true)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(LOG_TAG, "Failed to set screen timeout: ${e.message}", e)
            promise.reject("ERR_SET_TIMEOUT", "Failed to set screen timeout: ${e.message}", e)
        }
    }

    /**
     * 获取屏幕超时时间
     */
    @ReactMethod
    fun getScreenTimeout(promise: Promise) {
        try {
            val milliseconds = Settings.System.getInt(
                ctx.contentResolver,
                Settings.System.SCREEN_OFF_TIMEOUT,
                60000
            )
            
            val result = Arguments.createMap().apply {
                putInt("seconds", milliseconds / 1000)
                putInt("milliseconds", milliseconds)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(LOG_TAG, "Failed to get screen timeout: ${e.message}", e)
            promise.reject("ERR_GET_TIMEOUT", "Failed to get screen timeout: ${e.message}", e)
        }
    }

    // ==================== 权限检查 ====================

    /**
     * 检查系统写入权限
     */
    @ReactMethod
    fun checkWriteSettingsPermission(promise: Promise) {
        promise.resolve(Settings.System.canWrite(ctx))
    }

    /**
     * 打开系统写入权限设置页面
     */
    @ReactMethod
    fun openWriteSettingsSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS)
                .setData(android.net.Uri.parse("package:" + ctx.packageName))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            ctx.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(LOG_TAG, "Failed to open write settings: ${e.message}", e)
            promise.reject("ERR_OPEN_WRITE_SETTINGS", e.message, e)
        }
    }

    /**
     * 检查蓝牙连接权限 (Android 12+)
     */
    @ReactMethod
    fun checkBluetoothPermission(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            promise.resolve(permissionGranted(Manifest.permission.BLUETOOTH_CONNECT))
        } else {
            promise.resolve(true)
        }
    }

    /**
     * 请求蓝牙连接权限
     */
    @ReactMethod
    fun requestBluetoothPermission(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (permissionGranted(Manifest.permission.BLUETOOTH_CONNECT)) {
                promise.resolve(true)
            } else {
                val requested = requestPermissions(arrayOf(Manifest.permission.BLUETOOTH_CONNECT))
                promise.resolve(requested)
            }
        } else {
            promise.resolve(true)
        }
    }

    // ==================== 批量设置 ====================

    /**
     * 批量应用系统设置
     * @param settings 设置项配置
     */
    @ReactMethod
    fun applySettings(settings: ReadableMap, promise: Promise) {
        try {
            val results = Arguments.createMap()
            var hasErrors = false
            
            // 处理音量设置
            if (settings.hasKey("volume")) {
                val volumeSettings = settings.getMap("volume")
                if (volumeSettings != null) {
                    val volumeResults = Arguments.createMap()
                    val audioManager = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
                    
                    val streamTypes = mapOf(
                        "media" to AudioManager.STREAM_MUSIC,
                        "ring" to AudioManager.STREAM_RING,
                        "notification" to AudioManager.STREAM_NOTIFICATION,
                        "alarm" to AudioManager.STREAM_ALARM
                    )
                    
                    for ((name, stream) in streamTypes) {
                        if (volumeSettings.hasKey(name)) {
                            try {
                                val level = volumeSettings.getInt(name)
                                val maxVolume = audioManager.getStreamMaxVolume(stream)
                                val targetVolume = (level.coerceIn(0, 100) * maxVolume / 100)
                                audioManager.setStreamVolume(stream, targetVolume, 0)
                                volumeResults.putBoolean(name, true)
                            } catch (e: Exception) {
                                volumeResults.putBoolean(name, false)
                                hasErrors = true
                            }
                        }
                    }
                    results.putMap("volume", volumeResults)
                }
            }
            
            // 处理亮度设置
            if (settings.hasKey("brightness")) {
                val brightnessLevel = settings.getInt("brightness")
                val autoMode = if (settings.hasKey("autoBrightness")) settings.getBoolean("autoBrightness") else false
                
                if (Settings.System.canWrite(ctx)) {
                    try {
                        Settings.System.putInt(
                            ctx.contentResolver,
                            Settings.System.SCREEN_BRIGHTNESS_MODE,
                            if (autoMode) Settings.System.SCREEN_BRIGHTNESS_MODE_AUTOMATIC
                            else Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL
                        )
                        
                        if (!autoMode) {
                            val brightnessValue = (brightnessLevel.coerceIn(0, 100) * 255 / 100)
                            Settings.System.putInt(
                                ctx.contentResolver,
                                Settings.System.SCREEN_BRIGHTNESS,
                                brightnessValue
                            )
                        }
                        results.putBoolean("brightness", true)
                    } catch (e: Exception) {
                        results.putBoolean("brightness", false)
                        hasErrors = true
                    }
                } else {
                    results.putBoolean("brightness", false)
                    hasErrors = true
                }
            }
            
            // 处理勿扰模式
            if (settings.hasKey("doNotDisturb")) {
                val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                
                if (nm.isNotificationPolicyAccessGranted) {
                    try {
                        val dndValue = settings.getDynamic("doNotDisturb")
                        val (enabled, mode) = when {
                            dndValue is Boolean -> Pair(dndValue, "none")
                            dndValue is String -> Pair(true, dndValue)
                            else -> Pair(false, "all")
                        }
                        
                        val filter = if (enabled) {
                            when (mode.lowercase()) {
                                "priority" -> NotificationManager.INTERRUPTION_FILTER_PRIORITY
                                "alarms" -> NotificationManager.INTERRUPTION_FILTER_ALARMS
                                else -> NotificationManager.INTERRUPTION_FILTER_NONE
                            }
                        } else {
                            NotificationManager.INTERRUPTION_FILTER_ALL
                        }
                        
                        nm.setInterruptionFilter(filter)
                        results.putBoolean("doNotDisturb", true)
                    } catch (e: Exception) {
                        results.putBoolean("doNotDisturb", false)
                        hasErrors = true
                    }
                } else {
                    results.putBoolean("doNotDisturb", false)
                    hasErrors = true
                }
            }
            
            // 处理屏幕超时
            if (settings.hasKey("screenTimeout")) {
                val seconds = settings.getInt("screenTimeout")
                
                if (Settings.System.canWrite(ctx)) {
                    try {
                        Settings.System.putInt(
                            ctx.contentResolver,
                            Settings.System.SCREEN_OFF_TIMEOUT,
                            seconds * 1000
                        )
                        results.putBoolean("screenTimeout", true)
                    } catch (e: Exception) {
                        results.putBoolean("screenTimeout", false)
                        hasErrors = true
                    }
                } else {
                    results.putBoolean("screenTimeout", false)
                    hasErrors = true
                }
            }
            
            Log.d(LOG_TAG, "Applied settings batch, hasErrors=$hasErrors")
            
            val response = Arguments.createMap().apply {
                putMap("results", results)
                putBoolean("success", !hasErrors)
                putBoolean("hasErrors", hasErrors)
            }
            promise.resolve(response)
        } catch (e: Exception) {
            Log.e(LOG_TAG, "Failed to apply settings batch: ${e.message}", e)
            promise.reject("ERR_APPLY_SETTINGS", "Failed to apply settings: ${e.message}", e)
        }
    }

    /**
     * 获取完整的系统状态
     */
    @ReactMethod
    fun getSystemState(promise: Promise) {
        try {
            val audioManager = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val wifiManager = ctx.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            val bluetoothManager = ctx.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
            
            val result = Arguments.createMap()
            
            // 音量状态
            val volumeState = Arguments.createMap()
            val streams = mapOf(
                "media" to AudioManager.STREAM_MUSIC,
                "ring" to AudioManager.STREAM_RING,
                "notification" to AudioManager.STREAM_NOTIFICATION,
                "alarm" to AudioManager.STREAM_ALARM
            )
            for ((name, stream) in streams) {
                val current = audioManager.getStreamVolume(stream)
                val max = audioManager.getStreamMaxVolume(stream)
                volumeState.putInt(name, if (max > 0) (current * 100 / max) else 0)
            }
            result.putMap("volume", volumeState)
            
            // 亮度状态
            val brightness = Settings.System.getInt(ctx.contentResolver, Settings.System.SCREEN_BRIGHTNESS, 128)
            val brightnessMode = Settings.System.getInt(ctx.contentResolver, Settings.System.SCREEN_BRIGHTNESS_MODE, 0)
            val brightnessState = Arguments.createMap().apply {
                putInt("level", brightness * 100 / 255)
                putBoolean("autoMode", brightnessMode == Settings.System.SCREEN_BRIGHTNESS_MODE_AUTOMATIC)
            }
            result.putMap("brightness", brightnessState)
            
            // 勿扰状态
            val dndFilter = nm.currentInterruptionFilter
            val dndState = Arguments.createMap().apply {
                putBoolean("enabled", dndFilter != NotificationManager.INTERRUPTION_FILTER_ALL)
                putString("mode", when (dndFilter) {
                    NotificationManager.INTERRUPTION_FILTER_PRIORITY -> "priority"
                    NotificationManager.INTERRUPTION_FILTER_ALARMS -> "alarms"
                    NotificationManager.INTERRUPTION_FILTER_NONE -> "none"
                    else -> "all"
                })
            }
            result.putMap("doNotDisturb", dndState)
            
            // WiFi 状态
            val wifiState = Arguments.createMap().apply {
                putBoolean("enabled", wifiManager.isWifiEnabled)
            }
            result.putMap("wifi", wifiState)
            
            // 蓝牙状态
            val bluetoothAdapter = bluetoothManager.adapter
            val bluetoothState = Arguments.createMap().apply {
                putBoolean("supported", bluetoothAdapter != null)
                putBoolean("enabled", bluetoothAdapter?.isEnabled ?: false)
            }
            result.putMap("bluetooth", bluetoothState)
            
            // 屏幕超时
            val timeout = Settings.System.getInt(ctx.contentResolver, Settings.System.SCREEN_OFF_TIMEOUT, 60000)
            result.putInt("screenTimeout", timeout / 1000)
            
            // 权限状态
            val permissions = Arguments.createMap().apply {
                putBoolean("writeSettings", Settings.System.canWrite(ctx))
                putBoolean("notificationPolicy", nm.isNotificationPolicyAccessGranted)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    putBoolean("bluetoothConnect", permissionGranted(Manifest.permission.BLUETOOTH_CONNECT))
                } else {
                    putBoolean("bluetoothConnect", true)
                }
            }
            result.putMap("permissions", permissions)
            
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(LOG_TAG, "Failed to get system state: ${e.message}", e)
            promise.reject("ERR_GET_STATE", "Failed to get system state: ${e.message}", e)
        }
    }
}
