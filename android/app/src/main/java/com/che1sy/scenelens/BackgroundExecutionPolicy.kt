package com.che1sy.scenelens

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import android.os.PowerManager

data class BackgroundExecutionPolicySnapshot(
  val batteryOptimizationIgnored: Boolean,
  val backgroundRestricted: Boolean,
  val powerSaveModeEnabled: Boolean,
)

object BackgroundExecutionPolicy {
  fun read(context: Context): BackgroundExecutionPolicySnapshot {
    val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
    val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager

    val batteryOptimizationIgnored = if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      true
    } else {
      powerManager?.isIgnoringBatteryOptimizations(context.packageName) ?: false
    }

    val backgroundRestricted = if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
      false
    } else {
      activityManager?.isBackgroundRestricted ?: false
    }

    val powerSaveModeEnabled = powerManager?.isPowerSaveMode ?: false

    return BackgroundExecutionPolicySnapshot(
      batteryOptimizationIgnored = batteryOptimizationIgnored,
      backgroundRestricted = backgroundRestricted,
      powerSaveModeEnabled = powerSaveModeEnabled,
    )
  }

  fun toBlockerReason(snapshot: BackgroundExecutionPolicySnapshot): String? {
    val reasons = mutableListOf<String>()
    if (!snapshot.batteryOptimizationIgnored) {
      reasons.add("battery_optimization_active")
    }
    if (snapshot.backgroundRestricted) {
      reasons.add("background_restricted")
    }
    if (snapshot.powerSaveModeEnabled) {
      reasons.add("power_save_mode_enabled")
    }

    return reasons.takeIf { it.isNotEmpty() }?.joinToString("|")
  }
}
