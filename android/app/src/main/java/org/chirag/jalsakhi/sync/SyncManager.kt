// SPDX-License-Identifier: MIT
package org.chirag.jalsakhi.sync

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

class SyncManager(private val ctx: Context) {

    private val wm get() = WorkManager.getInstance(ctx)

    fun schedulePeriodic() {
        val req = PeriodicWorkRequestBuilder<SyncWorker>(2, TimeUnit.HOURS)
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build(),
            )
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
        wm.enqueueUniquePeriodicWork(NAME_PERIODIC, ExistingPeriodicWorkPolicy.KEEP, req)
    }

    fun syncNow() {
        val req = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(
                Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build(),
            )
            .build()
        wm.enqueueUniqueWork(NAME_ONESHOT, ExistingWorkPolicy.REPLACE, req)
    }

    companion object {
        const val NAME_PERIODIC = "jalsakhi.sync.periodic"
        const val NAME_ONESHOT = "jalsakhi.sync.oneshot"
    }
}
