package com.che1sy.scenelens

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class SceneLocationRecoveryReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    val action = intent?.action ?: return
    if (
      action != Intent.ACTION_BOOT_COMPLETED &&
      action != Intent.ACTION_MY_PACKAGE_REPLACED
    ) {
      return
    }

    val recoveryState = BackgroundLocationRecoveryStore.read(context)
    if (!recoveryState.enabled) {
      SceneLocationRecoveryWorker.cancel(context)
      return
    }

    val recoveryReason = when (action) {
      Intent.ACTION_BOOT_COMPLETED -> "boot_completed"
      Intent.ACTION_MY_PACKAGE_REPLACED -> "package_replaced"
      else -> "receiver"
    }
    BackgroundLocationRecoveryStore.markRecoveryTrigger(context, recoveryReason)
    SceneLocationRecoveryWorker.schedule(context, recoveryState.intervalMs)
  }
}
