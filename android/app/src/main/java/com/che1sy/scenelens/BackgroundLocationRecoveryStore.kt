package com.che1sy.scenelens

import android.content.Context

data class BackgroundLocationRuntimeTelemetry(
  val lastStartReason: String?,
  val lastStartAt: Long?,
  val lastStopReason: String?,
  val lastStopAt: Long?,
  val lastRecoveryReason: String?,
  val lastRecoveryAt: Long?,
  val lastRecoveryScheduleAt: Long?,
  val nextRecoveryDueAt: Long?,
  val nextRecoveryKind: String?,
  val lastWorkerRunAt: Long?,
  val lastWorkerOutcome: String?,
  val lastWorkerDetail: String?,
  val lastFailureReason: String?,
  val lastFailureAt: Long?,
  val lastPolicyBlockerReason: String?,
  val lastPolicyBlockerAt: Long?,
  val restartCount: Int,
  val lastLocation: SceneLocationForegroundService.LocationSnapshot?,
)

data class BackgroundLocationRecoveryState(
  val enabled: Boolean,
  val intervalMs: Long,
  val serviceIntervalMs: Long,
  val telemetry: BackgroundLocationRuntimeTelemetry,
)

object BackgroundLocationRecoveryStore {
  private const val PREFS_NAME = "scene_background_location_recovery"
  private const val KEY_ENABLED = "enabled"
  private const val KEY_INTERVAL_MS = "interval_ms"
  private const val KEY_SERVICE_INTERVAL_MS = "service_interval_ms"
  private const val KEY_LAST_START_REASON = "last_start_reason"
  private const val KEY_LAST_START_AT = "last_start_at"
  private const val KEY_LAST_STOP_REASON = "last_stop_reason"
  private const val KEY_LAST_STOP_AT = "last_stop_at"
  private const val KEY_LAST_RECOVERY_REASON = "last_recovery_reason"
  private const val KEY_LAST_RECOVERY_AT = "last_recovery_at"
  private const val KEY_LAST_RECOVERY_SCHEDULE_AT = "last_recovery_schedule_at"
  private const val KEY_NEXT_RECOVERY_DUE_AT = "next_recovery_due_at"
  private const val KEY_NEXT_RECOVERY_KIND = "next_recovery_kind"
  private const val KEY_LAST_WORKER_RUN_AT = "last_worker_run_at"
  private const val KEY_LAST_WORKER_OUTCOME = "last_worker_outcome"
  private const val KEY_LAST_WORKER_DETAIL = "last_worker_detail"
  private const val KEY_LAST_FAILURE_REASON = "last_failure_reason"
  private const val KEY_LAST_FAILURE_AT = "last_failure_at"
  private const val KEY_LAST_POLICY_BLOCKER_REASON = "last_policy_blocker_reason"
  private const val KEY_LAST_POLICY_BLOCKER_AT = "last_policy_blocker_at"
  private const val KEY_RESTART_COUNT = "restart_count"
  private const val KEY_LAST_LOCATION_LATITUDE = "last_location_latitude"
  private const val KEY_LAST_LOCATION_LONGITUDE = "last_location_longitude"
  private const val KEY_LAST_LOCATION_ACCURACY = "last_location_accuracy"
  private const val KEY_LAST_LOCATION_TIMESTAMP = "last_location_timestamp"
  private const val KEY_LAST_LOCATION_PROVIDER = "last_location_provider"
  private const val KEY_LAST_LOCATION_SOURCE = "last_location_source"
  private const val DEFAULT_INTERVAL_MS = 10 * 60 * 1000L
  private const val MIN_INTERVAL_MS = 60_000L

  fun read(context: Context): BackgroundLocationRecoveryState {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val recoveryIntervalMs = prefs.getLong(KEY_INTERVAL_MS, DEFAULT_INTERVAL_MS)
      .coerceAtLeast(MIN_INTERVAL_MS)
    val serviceIntervalMs = prefs.getLong(KEY_SERVICE_INTERVAL_MS, recoveryIntervalMs)
      .coerceAtLeast(MIN_INTERVAL_MS)

    return BackgroundLocationRecoveryState(
      enabled = prefs.getBoolean(KEY_ENABLED, false),
      intervalMs = recoveryIntervalMs,
      serviceIntervalMs = serviceIntervalMs,
      telemetry = BackgroundLocationRuntimeTelemetry(
        lastStartReason = prefs.getString(KEY_LAST_START_REASON, null),
        lastStartAt = readOptionalLong(prefs.getLong(KEY_LAST_START_AT, 0L)),
        lastStopReason = prefs.getString(KEY_LAST_STOP_REASON, null),
        lastStopAt = readOptionalLong(prefs.getLong(KEY_LAST_STOP_AT, 0L)),
        lastRecoveryReason = prefs.getString(KEY_LAST_RECOVERY_REASON, null),
        lastRecoveryAt = readOptionalLong(prefs.getLong(KEY_LAST_RECOVERY_AT, 0L)),
        lastRecoveryScheduleAt = readOptionalLong(prefs.getLong(KEY_LAST_RECOVERY_SCHEDULE_AT, 0L)),
        nextRecoveryDueAt = readOptionalLong(prefs.getLong(KEY_NEXT_RECOVERY_DUE_AT, 0L)),
        nextRecoveryKind = prefs.getString(KEY_NEXT_RECOVERY_KIND, null),
        lastWorkerRunAt = readOptionalLong(prefs.getLong(KEY_LAST_WORKER_RUN_AT, 0L)),
        lastWorkerOutcome = prefs.getString(KEY_LAST_WORKER_OUTCOME, null),
        lastWorkerDetail = prefs.getString(KEY_LAST_WORKER_DETAIL, null),
        lastFailureReason = prefs.getString(KEY_LAST_FAILURE_REASON, null),
        lastFailureAt = readOptionalLong(prefs.getLong(KEY_LAST_FAILURE_AT, 0L)),
        lastPolicyBlockerReason = prefs.getString(KEY_LAST_POLICY_BLOCKER_REASON, null),
        lastPolicyBlockerAt = readOptionalLong(prefs.getLong(KEY_LAST_POLICY_BLOCKER_AT, 0L)),
        restartCount = prefs.getInt(KEY_RESTART_COUNT, 0).coerceAtLeast(0),
        lastLocation = readLastLocationSnapshotInternal(context),
      ),
    )
  }

  fun write(context: Context, enabled: Boolean, intervalMs: Long) {
    val boundedIntervalMs = intervalMs.coerceAtLeast(MIN_INTERVAL_MS)
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    prefs.edit()
      .putBoolean(KEY_ENABLED, enabled)
      .putLong(KEY_INTERVAL_MS, boundedIntervalMs)
      .putLong(KEY_SERVICE_INTERVAL_MS, boundedIntervalMs)
      .apply()
  }

  fun recordServiceInterval(context: Context, intervalMs: Long) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    prefs.edit()
      .putLong(KEY_SERVICE_INTERVAL_MS, intervalMs.coerceAtLeast(MIN_INTERVAL_MS))
      .apply()
  }

  fun markServiceStarted(
    context: Context,
    reason: String,
    timestamp: Long = System.currentTimeMillis(),
    resetRestartCount: Boolean = false,
  ) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val currentRestartCount = prefs.getInt(KEY_RESTART_COUNT, 0).coerceAtLeast(0)
    val restartCount = if (resetRestartCount) {
      0
    } else if (reason == SceneLocationForegroundService.START_REASON_MANUAL) {
      currentRestartCount
    } else {
      currentRestartCount + 1
    }

    prefs.edit()
      .putString(KEY_LAST_START_REASON, reason)
      .putLong(KEY_LAST_START_AT, timestamp)
      .putInt(KEY_RESTART_COUNT, restartCount)
      .apply()
  }

  fun markServiceStopped(context: Context, reason: String, timestamp: Long = System.currentTimeMillis()) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    prefs.edit()
      .putString(KEY_LAST_STOP_REASON, reason)
      .putLong(KEY_LAST_STOP_AT, timestamp)
      .apply()
  }

  fun markRecoveryTrigger(context: Context, reason: String, timestamp: Long = System.currentTimeMillis()) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    prefs.edit()
      .putString(KEY_LAST_RECOVERY_REASON, reason)
      .putLong(KEY_LAST_RECOVERY_AT, timestamp)
      .apply()
  }

  fun markRecoveryScheduled(
    context: Context,
    kind: String,
    dueAt: Long? = null,
    scheduledAt: Long = System.currentTimeMillis(),
  ) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val editor = prefs.edit()
      .putLong(KEY_LAST_RECOVERY_SCHEDULE_AT, scheduledAt)
      .putString(KEY_NEXT_RECOVERY_KIND, kind)

    if (dueAt != null && dueAt > 0L) {
      editor.putLong(KEY_NEXT_RECOVERY_DUE_AT, dueAt)
    } else {
      editor.remove(KEY_NEXT_RECOVERY_DUE_AT)
    }

    editor.apply()
  }

  fun clearRecoverySchedule(context: Context) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    prefs.edit()
      .remove(KEY_LAST_RECOVERY_SCHEDULE_AT)
      .remove(KEY_NEXT_RECOVERY_DUE_AT)
      .remove(KEY_NEXT_RECOVERY_KIND)
      .apply()
  }

  fun markWorkerRun(
    context: Context,
    outcome: String,
    detail: String? = null,
    timestamp: Long = System.currentTimeMillis(),
  ) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    prefs.edit()
      .putLong(KEY_LAST_WORKER_RUN_AT, timestamp)
      .putString(KEY_LAST_WORKER_OUTCOME, outcome)
      .putString(KEY_LAST_WORKER_DETAIL, detail)
      .apply()
  }

  fun markFailure(context: Context, reason: String, timestamp: Long = System.currentTimeMillis()) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    prefs.edit()
      .putString(KEY_LAST_FAILURE_REASON, reason)
      .putLong(KEY_LAST_FAILURE_AT, timestamp)
      .apply()
  }

  fun markPolicyBlocker(
    context: Context,
    reason: String,
    timestamp: Long = System.currentTimeMillis(),
  ) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    prefs.edit()
      .putString(KEY_LAST_POLICY_BLOCKER_REASON, reason)
      .putLong(KEY_LAST_POLICY_BLOCKER_AT, timestamp)
      .apply()
  }

  fun writeLastLocationSnapshot(
    context: Context,
    snapshot: SceneLocationForegroundService.LocationSnapshot,
  ) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    prefs.edit()
      .putString(KEY_LAST_LOCATION_LATITUDE, snapshot.latitude.toString())
      .putString(KEY_LAST_LOCATION_LONGITUDE, snapshot.longitude.toString())
      .putString(KEY_LAST_LOCATION_ACCURACY, snapshot.accuracy.toString())
      .putLong(KEY_LAST_LOCATION_TIMESTAMP, snapshot.timestamp)
      .putString(KEY_LAST_LOCATION_PROVIDER, snapshot.provider)
      .putString(KEY_LAST_LOCATION_SOURCE, snapshot.source)
      .apply()
  }

  fun readLastLocationSnapshot(context: Context): SceneLocationForegroundService.LocationSnapshot? {
    return readLastLocationSnapshotInternal(context)
  }

  private fun readLastLocationSnapshotInternal(
    context: Context,
  ): SceneLocationForegroundService.LocationSnapshot? {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val latitude = prefs.getString(KEY_LAST_LOCATION_LATITUDE, null)?.toDoubleOrNull() ?: return null
    val longitude = prefs.getString(KEY_LAST_LOCATION_LONGITUDE, null)?.toDoubleOrNull() ?: return null
    val accuracy = prefs.getString(KEY_LAST_LOCATION_ACCURACY, null)?.toFloatOrNull() ?: return null
    val timestamp = prefs.getLong(KEY_LAST_LOCATION_TIMESTAMP, 0L).takeIf { it > 0L } ?: return null
    val source = prefs.getString(KEY_LAST_LOCATION_SOURCE, null) ?: "foreground_service"

    return SceneLocationForegroundService.LocationSnapshot(
      latitude = latitude,
      longitude = longitude,
      accuracy = accuracy,
      timestamp = timestamp,
      provider = prefs.getString(KEY_LAST_LOCATION_PROVIDER, null),
      source = source,
    )
  }

  private fun readOptionalLong(value: Long): Long? {
    return value.takeIf { it > 0L }
  }
}
