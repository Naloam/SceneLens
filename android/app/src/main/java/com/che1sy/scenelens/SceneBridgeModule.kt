package com.che1sy.scenelens

import android.Manifest
import android.annotation.SuppressLint
import android.app.AppOpsManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.pm.PackageManager
import android.content.pm.ApplicationInfo
import android.location.Location
import android.location.LocationManager
import android.net.Uri
import android.os.Looper
import android.net.wifi.WifiManager
import android.os.Build
import android.provider.CalendarContract
import android.provider.Settings
import android.util.Log
import android.util.Base64
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageFormat
import android.graphics.Matrix
import android.hardware.camera2.*
import android.hardware.camera2.params.OutputConfiguration
import android.hardware.camera2.params.SessionConfiguration
import android.media.Image
import android.media.ImageReader
import android.media.MediaRecorder
import android.media.AudioRecord
import android.media.AudioFormat
import android.media.MediaMetadataRetriever
import android.os.Handler
import android.os.HandlerThread
import android.view.KeyEvent
import android.view.Surface
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityRecognitionClient
import com.google.android.gms.location.ActivityRecognitionResult
import com.google.android.gms.location.DetectedActivity
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.util.Calendar
import java.util.concurrent.TimeUnit
import java.util.concurrent.Semaphore

@ReactModule(name = SceneBridgeModule.NAME)
class SceneBridgeModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {

  companion object {
    const val NAME = "SceneBridge"
    private const val LOG_TAG = "SceneBridge"
    private const val MOTION_INTENT_ACTION = "com.che1sy.scenelens.MOTION_UPDATE"
    private const val MOTION_REQUEST_CODE = 2024
    private const val VOLUME_KEY_DOUBLE_TAP_TIMEOUT = 500L // 500ms for double tap detection
  }

  override fun getName() = NAME

  override fun onCatalystInstanceDestroy() {
    super.onCatalystInstanceDestroy()
    try {
      if (motionUpdatesRequested) {
        activityRecognitionClient.removeActivityUpdates(getMotionPendingIntent())
      }
    } catch (_: Throwable) {
    }
    try {
      ctx.unregisterReceiver(motionReceiver)
    } catch (_: Throwable) {
    }
    stopBackgroundThread()
  }

  private fun getMotionPendingIntent(): PendingIntent {
    val intent = Intent(MOTION_INTENT_ACTION)
    return PendingIntent.getBroadcast(
      ctx,
      MOTION_REQUEST_CODE,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun ensureMotionUpdates() {
    if (motionUpdatesRequested) return
    if (!permissionGranted(Manifest.permission.ACTIVITY_RECOGNITION)) return
    try {
      activityRecognitionClient.requestActivityUpdates(
        5000L,
        getMotionPendingIntent()
      ).addOnSuccessListener {
        motionUpdatesRequested = true
      }.addOnFailureListener {
        Log.w(LOG_TAG, "Failed to request activity updates", it)
      }
    } catch (t: Throwable) {
      Log.w(LOG_TAG, "Activity updates error", t)
    }
  }

  private val activityRecognitionClient: ActivityRecognitionClient by lazy {
    ActivityRecognition.getClient(ctx)
  }

  private var motionUpdatesRequested: Boolean = false
  @Volatile private var lastMotionState: String = "UNKNOWN"

  // Camera related properties
  private var cameraManager: CameraManager? = null
  private var backgroundThread: HandlerThread? = null
  private var backgroundHandler: Handler? = null
  private val cameraOpenCloseLock = Semaphore(1)

  // Volume key double-tap detection
  private var lastVolumeKeyTime: Long = 0
  private var volumeKeyTapCount: Int = 0
  private var volumeKeyHandler: Handler = Handler(Looper.getMainLooper())
  private var volumeKeyCallback: (() -> Unit)? = null
  private var isVolumeKeyListenerEnabled: Boolean = false

  private val motionReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (intent == null) return
      if (MOTION_INTENT_ACTION != intent.action) return
      val result = ActivityRecognitionResult.extractResult(intent) ?: return
      val probable = result.mostProbableActivity
      lastMotionState = when (probable.type) {
        DetectedActivity.IN_VEHICLE -> "VEHICLE"
        DetectedActivity.ON_BICYCLE -> "VEHICLE"
        DetectedActivity.ON_FOOT -> "WALKING"
        DetectedActivity.RUNNING -> "RUNNING"
        DetectedActivity.WALKING -> "WALKING"
        DetectedActivity.STILL -> "STILL"
        else -> "UNKNOWN"
      }
    }
  }

  init {
    // Register receiver early; request updates lazily when needed
    val filter = IntentFilter(MOTION_INTENT_ACTION)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      ctx.registerReceiver(motionReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      ctx.registerReceiver(motionReceiver, filter)
    }
    
    // Initialize camera manager
    cameraManager = ctx.getSystemService(Context.CAMERA_SERVICE) as CameraManager
  }

  private fun startBackgroundThread() {
    backgroundThread = HandlerThread("CameraBackground").also { it.start() }
    backgroundHandler = Handler(backgroundThread!!.looper)
  }

  private fun stopBackgroundThread() {
    backgroundThread?.quitSafely()
    try {
      backgroundThread?.join()
      backgroundThread = null
      backgroundHandler = null
    } catch (e: InterruptedException) {
      Log.e(LOG_TAG, "Error stopping background thread", e)
    }
  }

  private fun permissionGranted(vararg perms: String): Boolean =
    perms.all { ContextCompat.checkSelfPermission(ctx, it) == PackageManager.PERMISSION_GRANTED }

  private fun requestPermissions(perms: Array<String>): Boolean {
    val activity = ctx.currentActivity ?: getCurrentActivity() ?: return false
    ActivityCompat.requestPermissions(activity, perms, 1010)
    return true
  }

  @ReactMethod
  fun ping(promise: Promise) {
    try {
      val map = Arguments.createMap().apply {
        putString("message", "pong")
        putDouble("timestamp", System.currentTimeMillis().toDouble())
      }
      promise.resolve(map)
    } catch (t: Throwable) {
      promise.reject("ERR_PING", t)
    }
  }

  @SuppressLint("MissingPermission")
  @ReactMethod
  fun getCurrentLocation(promise: Promise) {
    try {
      if (!permissionGranted(Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION)) {
        promise.reject("ERR_NO_PERMISSION", "Location permission not granted")
        return
      }
      val lm = ctx.getSystemService(Context.LOCATION_SERVICE) as LocationManager
      val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
      var best: Location? = null
      for (p in providers) {
        val loc = lm.getLastKnownLocation(p)
        if (loc != null && (best == null || loc.accuracy < best!!.accuracy)) {
          best = loc
        }
      }
      if (best == null) {
        promise.resolve(null)
        return
      }
      val map = Arguments.createMap().apply {
        putDouble("latitude", best.latitude)
        putDouble("longitude", best.longitude)
        putDouble("accuracy", best.accuracy.toDouble())
      }
      promise.resolve(map)
    } catch (t: Throwable) {
      promise.reject("ERR_LOCATION", t)
    }
  }

  @SuppressLint("MissingPermission")
  @ReactMethod
  fun getConnectedWiFi(promise: Promise) {
    try {
      if (!permissionGranted(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) {
        promise.reject("ERR_NO_PERMISSION", "Location/WiFi permission not granted")
        return
      }
      val wifiManager = ctx.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
      val info = wifiManager.connectionInfo
      if (info == null || info.ssid == WifiManager.UNKNOWN_SSID) {
        promise.resolve(null)
        return
      }
      val ssid = info.ssid.removePrefix("\"").removeSuffix("\"")
      val map = Arguments.createMap().apply {
        putString("ssid", ssid)
        putString("bssid", info.bssid)
        putInt("rssi", info.rssi)
      }
      promise.resolve(map)
    } catch (t: Throwable) {
      promise.reject("ERR_WIFI", t)
    }
  }

  @ReactMethod
  fun getMotionState(promise: Promise) {
    ensureMotionUpdates()
    promise.resolve(lastMotionState)
  }

  @ReactMethod
  fun getInstalledApps(promise: Promise) {
    try {
      val pm = ctx.packageManager
      val appsArray = Arguments.createArray()
      pm.getInstalledApplications(0)
        .filter { (it.flags and ApplicationInfo.FLAG_SYSTEM) == 0 }
        .forEach {
          val map = Arguments.createMap()
          map.putString("appName", pm.getApplicationLabel(it).toString())
          map.putString("packageName", it.packageName)
          appsArray.pushMap(map)
        }
      promise.resolve(appsArray)
    } catch (t: Throwable) {
      promise.reject("ERR_APPS", t)
    }
  }

  @ReactMethod
  fun getForegroundApp(promise: Promise) {
    try {
      val usm = ctx.getSystemService(Context.USAGE_STATS_SERVICE) as android.app.usage.UsageStatsManager
      val end = System.currentTimeMillis()
      val begin = end - TimeUnit.MINUTES.toMillis(2)
      val stats = usm.queryUsageStats(android.app.usage.UsageStatsManager.INTERVAL_DAILY, begin, end)
      val top = stats?.maxByOrNull { it.lastTimeUsed }
      promise.resolve(top?.packageName ?: "")
    } catch (t: Throwable) {
      promise.reject("ERR_FOREGROUND", t)
    }
  }

  @ReactMethod
  fun getUsageStats(days: Int, promise: Promise) {
    try {
      val usm = ctx.getSystemService(Context.USAGE_STATS_SERVICE) as android.app.usage.UsageStatsManager
      val end = System.currentTimeMillis()
      val begin = end - TimeUnit.DAYS.toMillis(days.toLong())
      val stats = usm.queryUsageStats(android.app.usage.UsageStatsManager.INTERVAL_DAILY, begin, end)
      val arr = Arguments.createArray()
      stats?.forEach {
        val map = Arguments.createMap()
        map.putString("packageName", it.packageName)
        map.putDouble("totalTimeInForeground", it.totalTimeInForeground.toDouble())
        map.putDouble("lastTimeUsed", it.lastTimeUsed.toDouble())
        // Use reflection so builds that target < 29 still compile, while preferring the real field when available.
        val launches = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          try {
            val m = it.javaClass.getMethod("getAppLaunchCount")
            (m.invoke(it) as? Int) ?: 0
          } catch (ignored: Throwable) {
            0
          }
        } else 0
        map.putInt("launchCount", launches)
        arr.pushMap(map)
      }
      promise.resolve(arr)
    } catch (t: Throwable) {
      promise.reject("ERR_USAGE", t)
    }
  }

  @ReactMethod
  fun setDoNotDisturb(enabled: Boolean, promise: Promise) {
    try {
      val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (!nm.isNotificationPolicyAccessGranted) {
        promise.reject("ERR_NO_PERMISSION", "Notification policy access not granted")
        return
      }
      nm.setInterruptionFilter(if (enabled) NotificationManager.INTERRUPTION_FILTER_NONE else NotificationManager.INTERRUPTION_FILTER_ALL)
      val map = Arguments.createMap().apply {
        putBoolean("enabled", enabled)
        putString("mode", if (enabled) "NONE" else "ALL")
      }
      promise.resolve(map)
    } catch (t: Throwable) {
      promise.reject("ERR_DND", t)
    }
  }

  @ReactMethod
  fun checkDoNotDisturbPermission(promise: Promise) {
    val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    promise.resolve(nm.isNotificationPolicyAccessGranted)
  }

  @ReactMethod
  fun openDoNotDisturbSettings(promise: Promise) {
    try {
      val intent = Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      ctx.startActivity(intent)
      promise.resolve(true)
    } catch (t: Throwable) {
      promise.reject("ERR_OPEN_DND", t)
    }
  }

  @ReactMethod
  fun setBrightness(level: Double, promise: Promise) {
    try {
      if (!Settings.System.canWrite(ctx)) {
        promise.reject("ERR_NO_PERMISSION", "Write settings not allowed")
        return
      }
      val clamped = level.coerceIn(0.0, 1.0)
      val value = (clamped * 255).toInt()
      Settings.System.putInt(ctx.contentResolver, Settings.System.SCREEN_BRIGHTNESS, value)
      val map = Arguments.createMap().apply {
        putDouble("level", clamped)
        putDouble("brightness", value.toDouble())
      }
      promise.resolve(map)
    } catch (t: Throwable) {
      promise.reject("ERR_BRIGHTNESS", t)
    }
  }

  @ReactMethod
  fun checkWriteSettingsPermission(promise: Promise) {
    promise.resolve(Settings.System.canWrite(ctx))
  }

  @ReactMethod
  fun openWriteSettingsSettings(promise: Promise) {
    try {
      val intent = Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS)
        .setData(Uri.parse("package:" + ctx.packageName))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      ctx.startActivity(intent)
      promise.resolve(true)
    } catch (t: Throwable) {
      promise.reject("ERR_OPEN_WRITE", t)
    }
  }

  @ReactMethod
  fun openAppWithDeepLink(packageName: String, deepLink: String?, promise: Promise) {
    try {
      val pm = ctx.packageManager
      var intent: Intent? = null
      if (!deepLink.isNullOrBlank()) {
        intent = Intent(Intent.ACTION_VIEW, Uri.parse(deepLink)).apply {
          `package` = packageName
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
      }
      if (intent == null || intent.resolveActivity(pm) == null) {
        intent = pm.getLaunchIntentForPackage(packageName)?.apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
      }
      if (intent == null) {
        promise.resolve(false)
        return
      }
      ctx.startActivity(intent)
      promise.resolve(true)
    } catch (t: Throwable) {
      promise.reject("ERR_OPEN_APP", t)
    }
  }

  @ReactMethod
  fun isAppInstalled(packageName: String, promise: Promise) {
    val pm = ctx.packageManager
    val installed = try {
      pm.getPackageInfo(packageName, 0)
      true
    } catch (_: PackageManager.NameNotFoundException) {
      false
    }
    promise.resolve(installed)
  }

  @ReactMethod
  fun validateDeepLink(deepLink: String, promise: Promise) {
    try {
      val intent = Intent(Intent.ACTION_VIEW, Uri.parse(deepLink))
      val pm = ctx.packageManager
      promise.resolve(intent.resolveActivity(pm) != null)
    } catch (t: Throwable) {
      promise.reject("ERR_VALIDATE", t)
    }
  }

  @ReactMethod
  fun getUpcomingEvents(hours: Int, promise: Promise) {
    try {
      if (!permissionGranted(Manifest.permission.READ_CALENDAR)) {
        promise.reject("ERR_NO_PERMISSION", "Calendar permission not granted")
        return
      }
      val now = Calendar.getInstance()
      val end = Calendar.getInstance().apply { add(Calendar.HOUR_OF_DAY, hours) }
      val uri = CalendarContract.Instances.CONTENT_URI
      val projection = arrayOf(
        CalendarContract.Instances.TITLE,
        CalendarContract.Instances.BEGIN,
        CalendarContract.Instances.END,
        CalendarContract.Instances.EVENT_ID,
      )
      val selection = "${CalendarContract.Instances.BEGIN} >= ? AND ${CalendarContract.Instances.END} <= ?"
      val args = arrayOf(now.timeInMillis.toString(), end.timeInMillis.toString())
      val cursor = ctx.contentResolver.query(uri, projection, selection, args, CalendarContract.Instances.BEGIN + " ASC")
      val list = Arguments.createArray()
      cursor?.use {
        while (it.moveToNext()) {
          val map = Arguments.createMap().apply {
            putString("title", it.getString(0))
            putDouble("begin", it.getLong(1).toDouble())
            putDouble("end", it.getLong(2).toDouble())
            putDouble("eventId", it.getLong(3).toDouble())
          }
          list.pushMap(map)
        }
      }
      promise.resolve(list)
    } catch (t: Throwable) {
      promise.reject("ERR_CALENDAR", t)
    }
  }

  // Generic permission helpers ------------------------------------------

  @ReactMethod
  fun requestPermission(permission: String, promise: Promise) {
    val granted = permissionGranted(permission)
    if (granted) {
      promise.resolve(true)
      return
    }
    val requested = requestPermissions(arrayOf(permission))
    promise.resolve(requested)
  }

  @ReactMethod
  fun checkPermission(permission: String, promise: Promise) {
    promise.resolve(permissionGranted(permission))
  }

  @ReactMethod
  fun checkUsageStatsPermission(promise: Promise) {
    try {
      val appOps = ctx.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
      val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, ctx.applicationInfo.uid, ctx.packageName)
      } else {
        @Suppress("DEPRECATION")
        appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, ctx.applicationInfo.uid, ctx.packageName)
      }
      promise.resolve(mode == AppOpsManager.MODE_ALLOWED)
    } catch (t: Throwable) {
      promise.reject("ERR_USAGE_PERMISSION", t)
    }
  }

  @ReactMethod
  fun openUsageStatsSettings(promise: Promise) {
    try {
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      ctx.startActivity(intent)
      promise.resolve(true)
    } catch (t: Throwable) {
      promise.reject("ERR_OPEN_USAGE", t)
    }
  }

  @ReactMethod
  fun hasLocationPermission(promise: Promise) {
    promise.resolve(permissionGranted(Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION))
  }

  @ReactMethod
  fun requestLocationPermission(promise: Promise) {
    val ok = permissionGranted(Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION)
    if (ok) {
      promise.resolve(true)
    } else {
      val requested = requestPermissions(arrayOf(Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION))
      promise.resolve(requested)
    }
  }

  @ReactMethod
  fun hasActivityRecognitionPermission(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      promise.resolve(true)
      return
    }
    promise.resolve(permissionGranted(Manifest.permission.ACTIVITY_RECOGNITION))
  }

  @ReactMethod
  fun requestActivityRecognitionPermission(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      promise.resolve(true)
      return
    }
    val ok = permissionGranted(Manifest.permission.ACTIVITY_RECOGNITION)
    if (ok) {
      promise.resolve(true)
    } else {
      val requested = requestPermissions(arrayOf(Manifest.permission.ACTIVITY_RECOGNITION))
      promise.resolve(requested)
    }
  }

  @ReactMethod
  fun hasUsageStatsPermission(promise: Promise) {
    checkUsageStatsPermission(promise)
  }

  @ReactMethod
  fun requestUsageStatsPermission(promise: Promise) {
    openUsageStatsSettings(promise)
  }

  // Camera methods ------------------------------------------

  @ReactMethod
  fun hasCameraPermission(promise: Promise) {
    promise.resolve(permissionGranted(Manifest.permission.CAMERA))
  }

  @ReactMethod
  fun requestCameraPermission(promise: Promise) {
    val granted = permissionGranted(Manifest.permission.CAMERA)
    if (granted) {
      promise.resolve(true)
      return
    }
    val requested = requestPermissions(arrayOf(Manifest.permission.CAMERA))
    promise.resolve(requested)
  }

  @SuppressLint("MissingPermission")
  @ReactMethod
  fun captureImage(promise: Promise) {
    try {
      if (!permissionGranted(Manifest.permission.CAMERA)) {
        promise.reject("ERR_NO_PERMISSION", "Camera permission not granted")
        return
      }

      val manager = cameraManager ?: run {
        promise.reject("ERR_CAMERA_MANAGER", "Camera manager not available")
        return
      }

      // Start background thread for camera operations
      startBackgroundThread()

      // Get back-facing camera
      val cameraId = manager.cameraIdList.find { id ->
        val characteristics = manager.getCameraCharacteristics(id)
        val facing = characteristics.get(CameraCharacteristics.LENS_FACING)
        facing == CameraCharacteristics.LENS_FACING_BACK
      } ?: run {
        promise.reject("ERR_NO_CAMERA", "No back-facing camera found")
        stopBackgroundThread()
        return
      }

      // Create ImageReader for capturing images
      val imageReader = ImageReader.newInstance(224, 224, ImageFormat.JPEG, 1)
      
      imageReader.setOnImageAvailableListener({ reader ->
        val image = reader.acquireLatestImage()
        try {
          val buffer = image.planes[0].buffer
          val bytes = ByteArray(buffer.remaining())
          buffer.get(bytes)
          
          // Convert to bitmap and resize if needed
          val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
          val resizedBitmap = Bitmap.createScaledBitmap(bitmap, 224, 224, true)
          
          // Convert to base64
          val outputStream = ByteArrayOutputStream()
          resizedBitmap.compress(Bitmap.CompressFormat.JPEG, 80, outputStream)
          val base64 = Base64.encodeToString(outputStream.toByteArray(), Base64.NO_WRAP)
          
          val result = Arguments.createMap().apply {
            putString("base64", base64)
            putInt("width", 224)
            putInt("height", 224)
            putString("format", "JPEG")
            putDouble("timestamp", System.currentTimeMillis().toDouble())
          }
          
          promise.resolve(result)
          
          // Cleanup
          bitmap.recycle()
          resizedBitmap.recycle()
          outputStream.close()
        } catch (e: Exception) {
          promise.reject("ERR_IMAGE_PROCESSING", "Failed to process image: ${e.message}")
        } finally {
          image.close()
          stopBackgroundThread()
        }
      }, backgroundHandler)

      // Open camera and capture
      try {
        cameraOpenCloseLock.acquire()
        manager.openCamera(cameraId, object : CameraDevice.StateCallback() {
          override fun onOpened(camera: CameraDevice) {
            cameraOpenCloseLock.release()
            
            try {
              // Create capture session
              val surface = imageReader.surface
              val captureRequestBuilder = camera.createCaptureRequest(CameraDevice.TEMPLATE_STILL_CAPTURE)
              captureRequestBuilder.addTarget(surface)
              
              // Set auto-focus and auto-exposure
              captureRequestBuilder.set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE)
              captureRequestBuilder.set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON)
              
              if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                val sessionConfig = SessionConfiguration(
                  SessionConfiguration.SESSION_REGULAR,
                  listOf(OutputConfiguration(surface)),
                  ctx.mainExecutor,
                  object : CameraCaptureSession.StateCallback() {
                    override fun onConfigured(session: CameraCaptureSession) {
                      try {
                        session.capture(captureRequestBuilder.build(), object : CameraCaptureSession.CaptureCallback() {
                          override fun onCaptureCompleted(session: CameraCaptureSession, request: CaptureRequest, result: TotalCaptureResult) {
                            // Image will be processed in ImageReader callback
                            camera.close()
                          }
                          
                          override fun onCaptureFailed(session: CameraCaptureSession, request: CaptureRequest, failure: CaptureFailure) {
                            promise.reject("ERR_CAPTURE_FAILED", "Capture failed: ${failure.reason}")
                            camera.close()
                            stopBackgroundThread()
                          }
                        }, backgroundHandler)
                      } catch (e: CameraAccessException) {
                        promise.reject("ERR_CAMERA_ACCESS", "Camera access error: ${e.message}")
                        camera.close()
                        stopBackgroundThread()
                      }
                    }
                    
                    override fun onConfigureFailed(session: CameraCaptureSession) {
                      promise.reject("ERR_SESSION_CONFIG", "Failed to configure camera session")
                      camera.close()
                      stopBackgroundThread()
                    }
                  }
                )
                camera.createCaptureSession(sessionConfig)
              } else {
                @Suppress("DEPRECATION")
                camera.createCaptureSession(listOf(surface), object : CameraCaptureSession.StateCallback() {
                  override fun onConfigured(session: CameraCaptureSession) {
                    try {
                      session.capture(captureRequestBuilder.build(), object : CameraCaptureSession.CaptureCallback() {
                        override fun onCaptureCompleted(session: CameraCaptureSession, request: CaptureRequest, result: TotalCaptureResult) {
                          // Image will be processed in ImageReader callback
                          camera.close()
                        }
                        
                        override fun onCaptureFailed(session: CameraCaptureSession, request: CaptureRequest, failure: CaptureFailure) {
                          promise.reject("ERR_CAPTURE_FAILED", "Capture failed: ${failure.reason}")
                          camera.close()
                          stopBackgroundThread()
                        }
                      }, backgroundHandler)
                    } catch (e: CameraAccessException) {
                      promise.reject("ERR_CAMERA_ACCESS", "Camera access error: ${e.message}")
                      camera.close()
                      stopBackgroundThread()
                    }
                  }
                  
                  override fun onConfigureFailed(session: CameraCaptureSession) {
                    promise.reject("ERR_SESSION_CONFIG", "Failed to configure camera session")
                    camera.close()
                    stopBackgroundThread()
                  }
                }, backgroundHandler)
              }
            } catch (e: CameraAccessException) {
              promise.reject("ERR_CAMERA_ACCESS", "Camera access error: ${e.message}")
              camera.close()
              stopBackgroundThread()
            }
          }
          
          override fun onDisconnected(camera: CameraDevice) {
            cameraOpenCloseLock.release()
            camera.close()
            promise.reject("ERR_CAMERA_DISCONNECTED", "Camera disconnected")
            stopBackgroundThread()
          }
          
          override fun onError(camera: CameraDevice, error: Int) {
            cameraOpenCloseLock.release()
            camera.close()
            promise.reject("ERR_CAMERA_ERROR", "Camera error: $error")
            stopBackgroundThread()
          }
        }, backgroundHandler)
      } catch (e: CameraAccessException) {
        cameraOpenCloseLock.release()
        promise.reject("ERR_CAMERA_ACCESS", "Failed to open camera: ${e.message}")
        stopBackgroundThread()
      } catch (e: SecurityException) {
        cameraOpenCloseLock.release()
        promise.reject("ERR_NO_PERMISSION", "Camera permission denied")
        stopBackgroundThread()
      }
    } catch (e: Exception) {
      promise.reject("ERR_CAMERA_GENERAL", "Camera error: ${e.message}")
      stopBackgroundThread()
    }
  }

  // Microphone methods ------------------------------------------

  @ReactMethod
  fun hasMicrophonePermission(promise: Promise) {
    promise.resolve(permissionGranted(Manifest.permission.RECORD_AUDIO))
  }

  @ReactMethod
  fun requestMicrophonePermission(promise: Promise) {
    val granted = permissionGranted(Manifest.permission.RECORD_AUDIO)
    if (granted) {
      promise.resolve(true)
      return
    }
    val requested = requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO))
    promise.resolve(requested)
  }

  @SuppressLint("MissingPermission")
  @ReactMethod
  fun recordAudio(durationMs: Int, promise: Promise) {
    try {
      if (!permissionGranted(Manifest.permission.RECORD_AUDIO)) {
        promise.reject("ERR_NO_PERMISSION", "Microphone permission not granted")
        return
      }

      // Audio recording parameters
      val sampleRate = 16000 // 16kHz sample rate for ML models
      val channelConfig = AudioFormat.CHANNEL_IN_MONO
      val audioFormat = AudioFormat.ENCODING_PCM_16BIT
      
      // Calculate buffer size
      val bufferSize = AudioRecord.getMinBufferSize(sampleRate, channelConfig, audioFormat)
      if (bufferSize == AudioRecord.ERROR || bufferSize == AudioRecord.ERROR_BAD_VALUE) {
        promise.reject("ERR_AUDIO_CONFIG", "Invalid audio configuration")
        return
      }

      // Create AudioRecord instance
      val audioRecord = AudioRecord(
        android.media.MediaRecorder.AudioSource.MIC,
        sampleRate,
        channelConfig,
        audioFormat,
        bufferSize
      )

      if (audioRecord.state != AudioRecord.STATE_INITIALIZED) {
        promise.reject("ERR_AUDIO_INIT", "Failed to initialize AudioRecord")
        return
      }

      // Start recording in background thread
      Thread {
        try {
          val audioData = mutableListOf<Short>()
          val buffer = ShortArray(bufferSize / 2) // 16-bit samples
          
          audioRecord.startRecording()
          
          val startTime = System.currentTimeMillis()
          val endTime = startTime + durationMs
          
          while (System.currentTimeMillis() < endTime) {
            val readSamples = audioRecord.read(buffer, 0, buffer.size)
            if (readSamples > 0) {
              for (i in 0 until readSamples) {
                audioData.add(buffer[i])
              }
            }
          }
          
          audioRecord.stop()
          audioRecord.release()
          
          // Convert to WAV format
          val wavData = createWavFile(audioData.toShortArray(), sampleRate)
          val base64 = Base64.encodeToString(wavData, Base64.NO_WRAP)
          
          val result = Arguments.createMap().apply {
            putString("base64", base64)
            putInt("duration", durationMs)
            putInt("sampleRate", sampleRate)
            putString("format", "WAV")
            putDouble("timestamp", System.currentTimeMillis().toDouble())
          }
          
          promise.resolve(result)
          
        } catch (e: Exception) {
          audioRecord.stop()
          audioRecord.release()
          promise.reject("ERR_AUDIO_RECORDING", "Failed to record audio: ${e.message}")
        }
      }.start()

    } catch (e: Exception) {
      promise.reject("ERR_AUDIO_GENERAL", "Audio recording error: ${e.message}")
    }
  }

  /**
   * Create WAV file from PCM data
   */
  private fun createWavFile(audioData: ShortArray, sampleRate: Int): ByteArray {
    val channels = 1
    val bitsPerSample = 16
    val byteRate = sampleRate * channels * bitsPerSample / 8
    val blockAlign = channels * bitsPerSample / 8
    val dataSize = audioData.size * 2 // 2 bytes per sample
    val fileSize = 36 + dataSize

    val output = ByteArrayOutputStream()
    
    // WAV header
    output.write("RIFF".toByteArray())
    output.write(intToByteArray(fileSize))
    output.write("WAVE".toByteArray())
    
    // Format chunk
    output.write("fmt ".toByteArray())
    output.write(intToByteArray(16)) // Chunk size
    output.write(shortToByteArray(1)) // Audio format (PCM)
    output.write(shortToByteArray(channels.toShort()))
    output.write(intToByteArray(sampleRate))
    output.write(intToByteArray(byteRate))
    output.write(shortToByteArray(blockAlign.toShort()))
    output.write(shortToByteArray(bitsPerSample.toShort()))
    
    // Data chunk
    output.write("data".toByteArray())
    output.write(intToByteArray(dataSize))
    
    // Audio data
    for (sample in audioData) {
      output.write(shortToByteArray(sample))
    }
    
    return output.toByteArray()
  }

  private fun intToByteArray(value: Int): ByteArray {
    return byteArrayOf(
      (value and 0xFF).toByte(),
      ((value shr 8) and 0xFF).toByte(),
      ((value shr 16) and 0xFF).toByte(),
      ((value shr 24) and 0xFF).toByte()
    )
  }

  private fun shortToByteArray(value: Short): ByteArray {
    return byteArrayOf(
      (value.toInt() and 0xFF).toByte(),
      ((value.toInt() shr 8) and 0xFF).toByte()
    )
  }

  // Volume key double-tap detection methods ------------------------------------------

  /**
   * Enable volume key double-tap detection
   */
  @ReactMethod
  fun enableVolumeKeyListener(promise: Promise) {
    try {
      isVolumeKeyListenerEnabled = true
      Log.d(LOG_TAG, "Volume key listener enabled")
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("ERR_VOLUME_KEY_LISTENER", "Failed to enable volume key listener: ${e.message}")
    }
  }

  /**
   * Disable volume key double-tap detection
   */
  @ReactMethod
  fun disableVolumeKeyListener(promise: Promise) {
    try {
      isVolumeKeyListenerEnabled = false
      volumeKeyCallback = null
      volumeKeyTapCount = 0
      lastVolumeKeyTime = 0
      Log.d(LOG_TAG, "Volume key listener disabled")
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("ERR_VOLUME_KEY_LISTENER", "Failed to disable volume key listener: ${e.message}")
    }
  }

  /**
   * Check if volume key listener is enabled
   */
  @ReactMethod
  fun isVolumeKeyListenerEnabled(promise: Promise) {
    promise.resolve(isVolumeKeyListenerEnabled)
  }

  /**
   * Set callback for volume key double-tap events
   * This method is called from MainActivity when volume keys are pressed
   */
  fun handleVolumeKeyEvent(keyCode: Int, event: KeyEvent): Boolean {
    if (!isVolumeKeyListenerEnabled) {
      return false // Let system handle the key event
    }

    // Only handle volume down and volume up keys
    if (keyCode != KeyEvent.KEYCODE_VOLUME_DOWN && keyCode != KeyEvent.KEYCODE_VOLUME_UP) {
      return false
    }

    // Only handle key down events to avoid duplicate triggers
    if (event.action != KeyEvent.ACTION_DOWN) {
      return false
    }

    val currentTime = System.currentTimeMillis()
    
    // Check if this is within the double-tap timeout window
    if (currentTime - lastVolumeKeyTime <= VOLUME_KEY_DOUBLE_TAP_TIMEOUT) {
      volumeKeyTapCount++
      
      if (volumeKeyTapCount >= 2) {
        // Double tap detected!
        Log.d(LOG_TAG, "Volume key double-tap detected")
        triggerUserAnalysis()
        
        // Reset counters
        volumeKeyTapCount = 0
        lastVolumeKeyTime = 0
        
        return true // Consume the event
      }
    } else {
      // Reset if too much time has passed
      volumeKeyTapCount = 1
    }
    
    lastVolumeKeyTime = currentTime
    
    // Schedule reset if no second tap comes
    volumeKeyHandler.removeCallbacksAndMessages(null)
    volumeKeyHandler.postDelayed({
      if (volumeKeyTapCount == 1 && currentTime == lastVolumeKeyTime) {
        // Single tap timeout, reset
        volumeKeyTapCount = 0
        lastVolumeKeyTime = 0
      }
    }, VOLUME_KEY_DOUBLE_TAP_TIMEOUT)
    
    return true // Consume the event to prevent volume change
  }

  /**
   * Trigger user analysis when double-tap is detected
   */
  private fun triggerUserAnalysis() {
    try {
      Log.d(LOG_TAG, "Triggering user analysis from volume key double-tap")
      
      // Send event to React Native
      val params = Arguments.createMap().apply {
        putString("trigger", "volume_key_double_tap")
        putDouble("timestamp", System.currentTimeMillis().toDouble())
      }
      
      ctx.getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("onVolumeKeyDoubleTap", params)
        
    } catch (e: Exception) {
      Log.e(LOG_TAG, "Failed to trigger user analysis", e)
    }
  }

  /**
   * Test method to manually trigger volume key double-tap (for testing)
   */
  @ReactMethod
  fun testVolumeKeyDoubleTap(promise: Promise) {
    try {
      if (isVolumeKeyListenerEnabled) {
        triggerUserAnalysis()
        promise.resolve(true)
      } else {
        promise.resolve(false)
      }
    } catch (e: Exception) {
      promise.reject("ERR_TEST_VOLUME_KEY", "Failed to test volume key double-tap: ${e.message}")
    }
  }

  // Desktop shortcut methods ------------------------------------------

  /**
   * Create desktop shortcut for scene analysis
   */
  @ReactMethod
  fun createSceneAnalysisShortcut(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        // Use ShortcutManager for Android 8.0+
        createDynamicShortcut(promise)
      } else {
        // Use legacy method for older Android versions
        createLegacyShortcut(promise)
      }
    } catch (e: Exception) {
      promise.reject("ERR_CREATE_SHORTCUT", "Failed to create shortcut: ${e.message}")
    }
  }

  /**
   * Remove desktop shortcut for scene analysis
   */
  @ReactMethod
  fun removeSceneAnalysisShortcut(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val shortcutManager = ctx.getSystemService(android.content.pm.ShortcutManager::class.java)
        shortcutManager?.removeDynamicShortcuts(listOf("scene_analysis"))
        Log.d(LOG_TAG, "Dynamic shortcut removed")
      }
      // For legacy shortcuts, we can't programmatically remove them
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("ERR_REMOVE_SHORTCUT", "Failed to remove shortcut: ${e.message}")
    }
  }

  /**
   * Check if shortcuts are supported
   */
  @ReactMethod
  fun isShortcutSupported(promise: Promise) {
    promise.resolve(Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
  }

  /**
   * Create dynamic shortcut for Android 8.0+
   */
  @androidx.annotation.RequiresApi(Build.VERSION_CODES.O)
  private fun createDynamicShortcut(promise: Promise) {
    try {
      val shortcutManager = ctx.getSystemService(android.content.pm.ShortcutManager::class.java)
      
      if (shortcutManager == null) {
        promise.reject("ERR_SHORTCUT_MANAGER", "ShortcutManager not available")
        return
      }

      // Create intent for shortcut
      val shortcutIntent = Intent(ctx, MainActivity::class.java).apply {
        action = "com.che1sy.scenelens.TRIGGER_SCENE_ANALYSIS"
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        putExtra("trigger_source", "desktop_shortcut")
      }

      // Create shortcut info
      val shortcut = android.content.pm.ShortcutInfo.Builder(ctx, "scene_analysis")
        .setShortLabel(ctx.getString(R.string.shortcut_scene_analysis_short))
        .setLongLabel(ctx.getString(R.string.shortcut_scene_analysis_long))
        .setIcon(android.graphics.drawable.Icon.createWithResource(ctx, R.drawable.ic_shortcut_scene_analysis))
        .setIntent(shortcutIntent)
        .build()

      // Add shortcut
      val success = shortcutManager.setDynamicShortcuts(listOf(shortcut))
      
      if (success) {
        Log.d(LOG_TAG, "Dynamic shortcut created successfully")
        promise.resolve(true)
      } else {
        promise.reject("ERR_SHORTCUT_CREATION", "Failed to create dynamic shortcut")
      }
    } catch (e: Exception) {
      promise.reject("ERR_DYNAMIC_SHORTCUT", "Dynamic shortcut creation failed: ${e.message}")
    }
  }

  /**
   * Create legacy shortcut for Android < 8.0
   */
  private fun createLegacyShortcut(promise: Promise) {
    try {
      // Create shortcut intent
      val shortcutIntent = Intent(ctx, MainActivity::class.java).apply {
        action = "com.che1sy.scenelens.TRIGGER_SCENE_ANALYSIS"
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        putExtra("trigger_source", "desktop_shortcut")
      }

      // Create install shortcut intent
      val addIntent = Intent().apply {
        putExtra(Intent.EXTRA_SHORTCUT_INTENT, shortcutIntent)
        putExtra(Intent.EXTRA_SHORTCUT_NAME, ctx.getString(R.string.shortcut_scene_analysis_short))
        putExtra(Intent.EXTRA_SHORTCUT_ICON_RESOURCE, 
          Intent.ShortcutIconResource.fromContext(ctx, R.drawable.ic_shortcut_scene_analysis))
        action = "com.android.launcher.action.INSTALL_SHORTCUT"
        putExtra("duplicate", false) // Don't create duplicate shortcuts
      }

      // Send broadcast to create shortcut
      ctx.sendBroadcast(addIntent)
      
      Log.d(LOG_TAG, "Legacy shortcut creation broadcast sent")
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("ERR_LEGACY_SHORTCUT", "Legacy shortcut creation failed: ${e.message}")
    }
  }

  /**
   * Handle shortcut intent and trigger scene analysis
   */
  fun handleShortcutIntent(intent: Intent?) {
    if (intent?.action == "com.che1sy.scenelens.TRIGGER_SCENE_ANALYSIS") {
      val triggerSource = intent.getStringExtra("trigger_source") ?: "unknown"
      Log.d(LOG_TAG, "Shortcut triggered scene analysis from: $triggerSource")
      
      try {
        // Send event to React Native
        val params = Arguments.createMap().apply {
          putString("trigger", "desktop_shortcut")
          putString("source", triggerSource)
          putDouble("timestamp", System.currentTimeMillis().toDouble())
        }
        
        ctx.getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit("onDesktopShortcutTrigger", params)
          
      } catch (e: Exception) {
        Log.e(LOG_TAG, "Failed to handle shortcut intent", e)
      }
    }
  }
}
