package com.che1sy.scenelens

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority

class SceneLocationForegroundService : Service() {

  data class LocationSnapshot(
    val latitude: Double,
    val longitude: Double,
    val accuracy: Float,
    val timestamp: Long,
    val provider: String?,
    val source: String = "foreground_service",
  ) {
    fun toLocation(): Location {
      return Location(provider ?: source).apply {
        latitude = this@LocationSnapshot.latitude
        longitude = this@LocationSnapshot.longitude
        accuracy = this@LocationSnapshot.accuracy
        time = this@LocationSnapshot.timestamp
      }
    }
  }

  companion object {
    private const val TAG = "SceneLocationFGSvc"
    private const val NOTIFICATION_ID = 4101
    private const val CHANNEL_ID = "scene_background_detection"
    private const val CHANNEL_NAME = "SceneLens Background Detection"
    private const val ACTION_START = "com.che1sy.scenelens.action.START_LOCATION_FOREGROUND_SERVICE"
    private const val ACTION_STOP = "com.che1sy.scenelens.action.STOP_LOCATION_FOREGROUND_SERVICE"
    private const val EXTRA_INTERVAL_MS = "interval_ms"
    private const val EXTRA_START_REASON = "start_reason"
    private const val DEFAULT_INTERVAL_MS = 10 * 60 * 1000L

    const val START_REASON_MANUAL = "manual"
    const val START_REASON_RECOVERY_WORKER = "recovery_worker"
    const val START_REASON_SYSTEM_RESTART = "system_restart"

    const val STOP_REASON_EXPLICIT = "explicit_stop"
    const val STOP_REASON_MISSING_PERMISSION = "missing_permission"
    const val STOP_REASON_LOCATION_REQUEST_FAILED = "location_request_failed"
    const val STOP_REASON_DESTROYED = "destroyed"

    @Volatile private var running: Boolean = false
    @Volatile private var requestedIntervalMs: Long = DEFAULT_INTERVAL_MS
    @Volatile private var lastLocationSnapshot: LocationSnapshot? = null

    fun buildStartIntent(
      context: Context,
      intervalMs: Long,
      reason: String = START_REASON_MANUAL,
    ): Intent {
      return Intent(context, SceneLocationForegroundService::class.java).apply {
        action = ACTION_START
        putExtra(EXTRA_INTERVAL_MS, intervalMs)
        putExtra(EXTRA_START_REASON, reason)
      }
    }

    fun buildStopIntent(context: Context): Intent {
      return Intent(context, SceneLocationForegroundService::class.java).apply {
        action = ACTION_STOP
      }
    }

    fun isServiceRunning(): Boolean = running

    fun getRequestedIntervalMs(): Long = requestedIntervalMs

    fun getLastLocationSnapshot(): LocationSnapshot? = lastLocationSnapshot
  }

  private lateinit var fusedLocationClient: FusedLocationProviderClient
  private lateinit var locationCallback: LocationCallback
  private var locationUpdatesActive = false
  private var stopReason: String = STOP_REASON_DESTROYED

  override fun onCreate() {
    super.onCreate()
    fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
    val recoveryState = BackgroundLocationRecoveryStore.read(this)
    requestedIntervalMs = recoveryState.serviceIntervalMs
    lastLocationSnapshot = BackgroundLocationRecoveryStore.readLastLocationSnapshot(this) ?: lastLocationSnapshot
    locationCallback = object : LocationCallback() {
      override fun onLocationResult(result: LocationResult) {
        val latestLocation = result.lastLocation ?: return
        handleLocationUpdate(latestLocation)
      }
    }
    createNotificationChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopForegroundService(STOP_REASON_EXPLICIT)
      return START_NOT_STICKY
    }

    val recoveryState = BackgroundLocationRecoveryStore.read(this)
    val intervalMs = intent?.getLongExtra(EXTRA_INTERVAL_MS, recoveryState.serviceIntervalMs)
      ?.coerceAtLeast(60_000L)
      ?: recoveryState.serviceIntervalMs
    val startReason = when {
      intent == null -> START_REASON_SYSTEM_RESTART
      intent.action == ACTION_START -> intent.getStringExtra(EXTRA_START_REASON) ?: START_REASON_MANUAL
      else -> START_REASON_SYSTEM_RESTART
    }

    val wasRunning = running
    requestedIntervalMs = intervalMs
    stopReason = STOP_REASON_DESTROYED
    BackgroundLocationRecoveryStore.recordServiceInterval(this, intervalMs)
    BackgroundLocationRecoveryStore.markServiceStarted(
      this,
      startReason,
      resetRestartCount = startReason == START_REASON_MANUAL && !wasRunning,
    )
    startForegroundInternal(intervalMs)

    if (!hasForegroundServiceLocationPermissions()) {
      Log.w(TAG, "Missing permissions for foreground location service, stopping")
      BackgroundLocationRecoveryStore.markFailure(this, STOP_REASON_MISSING_PERMISSION)
      stopForegroundService(STOP_REASON_MISSING_PERMISSION)
      return START_NOT_STICKY
    }

    requestLocationUpdates(intervalMs)
    return START_STICKY
  }

  override fun onDestroy() {
    stopLocationUpdates()
    BackgroundLocationRecoveryStore.markServiceStopped(this, stopReason)
    val recoveryState = BackgroundLocationRecoveryStore.read(this)
    if (recoveryState.enabled && stopReason != STOP_REASON_EXPLICIT) {
      SceneLocationRecoveryWorker.schedule(this, recoveryState.intervalMs)
    }
    running = false
    super.onDestroy()
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    val recoveryState = BackgroundLocationRecoveryStore.read(this)
    if (recoveryState.enabled) {
      BackgroundLocationRecoveryStore.markRecoveryTrigger(this, "task_removed")
      SceneLocationRecoveryWorker.scheduleImmediate(this, recoveryState.intervalMs)
    }
    super.onTaskRemoved(rootIntent)
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun hasForegroundServiceLocationPermissions(): Boolean {
    val hasLocationPermission = permissionGranted(
      Manifest.permission.ACCESS_COARSE_LOCATION,
      Manifest.permission.ACCESS_FINE_LOCATION,
    )
    val hasBackgroundPermission = Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
      || permissionGranted(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
    return hasLocationPermission && hasBackgroundPermission
  }

  private fun permissionGranted(vararg permissions: String): Boolean {
    return permissions.any {
      ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED
    }
  }

  private fun startForegroundInternal(intervalMs: Long) {
    val notification = buildNotification(intervalMs)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(
        NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION,
      )
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
    running = true
  }

  private fun stopForegroundService(reason: String) {
    stopLocationUpdates()
    stopReason = reason
    running = false
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(true)
    }
    stopSelf()
  }

  private fun requestLocationUpdates(intervalMs: Long) {
    val request = LocationRequest.Builder(resolvePriority(intervalMs), intervalMs)
      .setMinUpdateIntervalMillis((intervalMs / 2).coerceAtLeast(60_000L))
      .setMaxUpdateDelayMillis(intervalMs)
      .setWaitForAccurateLocation(false)
      .build()

    stopLocationUpdates()

    try {
      fusedLocationClient.requestLocationUpdates(request, locationCallback, mainLooper)
        .addOnSuccessListener {
          locationUpdatesActive = true
          Log.d(TAG, "Foreground location updates started, interval=${intervalMs}ms")
        }
        .addOnFailureListener { error ->
          Log.e(TAG, "Failed to start foreground location updates: ${error.message}", error)
          BackgroundLocationRecoveryStore.markFailure(
            this,
            "location_updates_start_failed:${error.javaClass.simpleName}",
          )
          stopForegroundService(STOP_REASON_LOCATION_REQUEST_FAILED)
        }

      fusedLocationClient.lastLocation
        .addOnSuccessListener { location ->
          if (location != null) {
            handleLocationUpdate(location)
          }
        }
        .addOnFailureListener { error ->
          Log.w(TAG, "Failed to read initial fused last location: ${error.message}")
        }
    } catch (error: SecurityException) {
      Log.e(TAG, "Missing permission while requesting location updates", error)
      BackgroundLocationRecoveryStore.markFailure(this, "location_request_security_exception")
      stopForegroundService(STOP_REASON_MISSING_PERMISSION)
    } catch (error: Throwable) {
      Log.e(TAG, "Unexpected error while requesting location updates", error)
      BackgroundLocationRecoveryStore.markFailure(
        this,
        "location_request_exception:${error.javaClass.simpleName}",
      )
      stopForegroundService(STOP_REASON_LOCATION_REQUEST_FAILED)
    }
  }

  private fun stopLocationUpdates() {
    if (!locationUpdatesActive) {
      return
    }

    try {
      fusedLocationClient.removeLocationUpdates(locationCallback)
      locationUpdatesActive = false
    } catch (error: Throwable) {
      Log.w(TAG, "Failed to remove location updates: ${error.message}", error)
    }
  }

  private fun resolvePriority(intervalMs: Long): Int {
    return if (intervalMs <= 5 * 60 * 1000L) {
      Priority.PRIORITY_HIGH_ACCURACY
    } else {
      Priority.PRIORITY_BALANCED_POWER_ACCURACY
    }
  }

  private fun buildNotification(intervalMs: Long): Notification {
    val openAppIntent = Intent(this, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val pendingIntent = PendingIntent.getActivity(
      this,
      0,
      openAppIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle(getString(R.string.app_name))
      .setContentText("Background scene detection is tracking location every ${intervalMs / 60000} minute(s).")
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentIntent(pendingIntent)
      .setOnlyAlertOnce(true)
      .setOngoing(true)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }

    val channel = NotificationChannel(
      CHANNEL_ID,
      CHANNEL_NAME,
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = "Keeps SceneLens background scene detection active."
      setShowBadge(false)
      lockscreenVisibility = Notification.VISIBILITY_PRIVATE
    }

    val manager = getSystemService(NotificationManager::class.java)
    manager?.createNotificationChannel(channel)
  }

  private fun handleLocationUpdate(location: Location) {
    val snapshot = LocationSnapshot(
      latitude = location.latitude,
      longitude = location.longitude,
      accuracy = location.accuracy,
      timestamp = location.time,
      provider = location.provider,
    )
    lastLocationSnapshot = snapshot
    BackgroundLocationRecoveryStore.writeLastLocationSnapshot(this, snapshot)
    emitLocationUpdate(snapshot)
  }

  private fun emitLocationUpdate(snapshot: LocationSnapshot) {
    try {
      val reactApplication = application as? ReactApplication ?: return
      val reactContext = reactApplication.reactNativeHost.reactInstanceManager.currentReactContext ?: return
      if (!reactContext.hasActiveCatalystInstance()) {
        return
      }

      val payload = Arguments.createMap().apply {
        putDouble("latitude", snapshot.latitude)
        putDouble("longitude", snapshot.longitude)
        putDouble("accuracy", snapshot.accuracy.toDouble())
        putDouble("timestamp", snapshot.timestamp.toDouble())
        putDouble("ageMs", (System.currentTimeMillis() - snapshot.timestamp).coerceAtLeast(0L).toDouble())
        putBoolean("isStale", (System.currentTimeMillis() - snapshot.timestamp) > 2 * 60 * 1000L)
        putString("source", snapshot.source)
        putString("provider", snapshot.provider ?: snapshot.source)
      }

      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("SceneLensBackgroundLocationUpdate", payload)
    } catch (error: Throwable) {
      Log.w(TAG, "Failed to emit background location update to React Native: ${error.message}")
    }
  }
}
