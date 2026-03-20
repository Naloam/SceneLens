package com.che1sy.scenelens

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException

class SceneLocationRecoveryWorker(
  appContext: Context,
  workerParams: WorkerParameters,
) : Worker(appContext, workerParams) {

  companion object {
    data class RecoveryQueueStatus(
      val immediateWorkerState: String?,
      val immediateWorkerRunAttemptCount: Int,
      val periodicWorkerState: String?,
      val periodicWorkerRunAttemptCount: Int,
    )

    private const val TAG = "SceneLocationRecovery"
    private const val PERIODIC_WORK_NAME = "scene_location_recovery_periodic"
    private const val IMMEDIATE_WORK_NAME = "scene_location_recovery_immediate"
    private const val MIN_IMMEDIATE_DELAY_MS = 60_000L
    private const val PERIODIC_INTERVAL_MS = 15 * 60 * 1000L
    private const val WORK_INFO_TIMEOUT_MS = 1500L

    fun schedule(context: Context, intervalMs: Long) {
      val request = PeriodicWorkRequestBuilder<SceneLocationRecoveryWorker>(15, TimeUnit.MINUTES)
        .build()

      WorkManager.getInstance(context).enqueueUniquePeriodicWork(
        PERIODIC_WORK_NAME,
        ExistingPeriodicWorkPolicy.UPDATE,
        request,
      )

      scheduleImmediate(context, intervalMs)
    }

    fun scheduleImmediate(context: Context, intervalMs: Long) {
      val delayMs = intervalMs.coerceAtMost(5 * 60 * 1000L).coerceAtLeast(MIN_IMMEDIATE_DELAY_MS)
      val request = OneTimeWorkRequestBuilder<SceneLocationRecoveryWorker>()
        .setInitialDelay(delayMs, TimeUnit.MILLISECONDS)
        .build()

      WorkManager.getInstance(context).enqueueUniqueWork(
        IMMEDIATE_WORK_NAME,
        ExistingWorkPolicy.REPLACE,
        request,
      )

      BackgroundLocationRecoveryStore.markRecoveryScheduled(
        context,
        kind = "immediate",
        dueAt = System.currentTimeMillis() + delayMs,
      )
    }

    fun cancel(context: Context) {
      WorkManager.getInstance(context).cancelUniqueWork(PERIODIC_WORK_NAME)
      WorkManager.getInstance(context).cancelUniqueWork(IMMEDIATE_WORK_NAME)
      BackgroundLocationRecoveryStore.clearRecoverySchedule(context)
    }

    fun readQueueStatus(context: Context): RecoveryQueueStatus {
      val immediateInfo = readUniqueWorkInfo(context, IMMEDIATE_WORK_NAME)
      val periodicInfo = readUniqueWorkInfo(context, PERIODIC_WORK_NAME)

      return RecoveryQueueStatus(
        immediateWorkerState = immediateInfo?.state?.name,
        immediateWorkerRunAttemptCount = immediateInfo?.runAttemptCount ?: 0,
        periodicWorkerState = periodicInfo?.state?.name,
        periodicWorkerRunAttemptCount = periodicInfo?.runAttemptCount ?: 0,
      )
    }

    private fun readUniqueWorkInfo(context: Context, uniqueWorkName: String): WorkInfo? {
      return try {
        val workInfos = WorkManager.getInstance(context)
          .getWorkInfosForUniqueWork(uniqueWorkName)
          .get(WORK_INFO_TIMEOUT_MS, TimeUnit.MILLISECONDS)

        pickMostRelevantWorkInfo(workInfos)
      } catch (error: TimeoutException) {
        Log.w(TAG, "Timed out while reading WorkManager status for $uniqueWorkName")
        null
      } catch (error: Throwable) {
        Log.w(TAG, "Failed to read WorkManager status for $uniqueWorkName: ${error.message}")
        null
      }
    }

    private fun pickMostRelevantWorkInfo(workInfos: List<WorkInfo>): WorkInfo? {
      if (workInfos.isEmpty()) {
        return null
      }

      return workInfos.firstOrNull { !it.state.isFinished }
        ?: workInfos.maxByOrNull { it.runAttemptCount }
        ?: workInfos.lastOrNull()
    }
  }

  override fun doWork(): Result {
    val recoveryState = BackgroundLocationRecoveryStore.read(applicationContext)
    if (!recoveryState.enabled) {
      BackgroundLocationRecoveryStore.markWorkerRun(applicationContext, "worker_disabled")
      BackgroundLocationRecoveryStore.clearRecoverySchedule(applicationContext)
      cancel(applicationContext)
      return Result.success()
    }

    if (SceneLocationForegroundService.isServiceRunning()) {
      BackgroundLocationRecoveryStore.markWorkerRun(applicationContext, "worker_already_running")
      BackgroundLocationRecoveryStore.markRecoveryScheduled(
        applicationContext,
        kind = "periodic",
        dueAt = System.currentTimeMillis() + PERIODIC_INTERVAL_MS,
      )
      return Result.success()
    }

    BackgroundLocationRecoveryStore.markRecoveryTrigger(applicationContext, "worker_tick")
    val policyReason = BackgroundExecutionPolicy.toBlockerReason(
      BackgroundExecutionPolicy.read(applicationContext)
    )
    if (policyReason != null) {
      BackgroundLocationRecoveryStore.markPolicyBlocker(applicationContext, policyReason)
    }

    if (!hasRecoveryPermissions()) {
      Log.w(TAG, "Skipping recovery because location/background permission is missing")
      BackgroundLocationRecoveryStore.markWorkerRun(applicationContext, "worker_missing_permissions")
      BackgroundLocationRecoveryStore.markFailure(applicationContext, "worker_missing_permissions")
      BackgroundLocationRecoveryStore.markRecoveryScheduled(
        applicationContext,
        kind = "periodic",
        dueAt = System.currentTimeMillis() + PERIODIC_INTERVAL_MS,
      )
      return Result.success()
    }

    return try {
      val intent = SceneLocationForegroundService.buildStartIntent(
        applicationContext,
        recoveryState.intervalMs,
        SceneLocationForegroundService.START_REASON_RECOVERY_WORKER,
      )
      BackgroundLocationRecoveryStore.markWorkerRun(
        applicationContext,
        "worker_restart_requested",
        recoveryState.intervalMs.toString(),
      )
      BackgroundLocationRecoveryStore.markRecoveryScheduled(
        applicationContext,
        kind = "periodic",
        dueAt = System.currentTimeMillis() + PERIODIC_INTERVAL_MS,
      )
      ContextCompat.startForegroundService(applicationContext, intent)
      Result.success()
    } catch (error: Throwable) {
      Log.e(TAG, "Failed to restart foreground location service", error)
      BackgroundLocationRecoveryStore.markWorkerRun(
        applicationContext,
        "worker_retry_scheduled",
        error.javaClass.simpleName,
      )
      BackgroundLocationRecoveryStore.markRecoveryScheduled(
        applicationContext,
        kind = "retry_pending",
      )
      BackgroundLocationRecoveryStore.markFailure(
        applicationContext,
        "worker_restart_failed:${error.javaClass.simpleName}",
      )
      Result.retry()
    }
  }

  private fun hasRecoveryPermissions(): Boolean {
    val hasForegroundLocation = permissionGranted(
      Manifest.permission.ACCESS_COARSE_LOCATION,
      Manifest.permission.ACCESS_FINE_LOCATION,
    )
    val hasBackgroundLocation = Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
      || permissionGranted(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
    return hasForegroundLocation && hasBackgroundLocation
  }

  private fun permissionGranted(vararg permissions: String): Boolean {
    return permissions.any {
      ContextCompat.checkSelfPermission(applicationContext, it) == PackageManager.PERMISSION_GRANTED
    }
  }
}
