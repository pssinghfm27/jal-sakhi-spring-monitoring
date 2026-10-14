// SPDX-License-Identifier: MIT
package org.chirag.jalsakhi.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import org.chirag.jalsakhi.JalSakhiApp

class SyncWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        val app = applicationContext as JalSakhiApp
        val repo = app.readingsRepo

        var anyFailed = false
        for (r in repo.pendingDischarge()) {
            if (repo.syncDischarge(r).isFailure) anyFailed = true
        }
        for (r in repo.pendingQuality()) {
            if (repo.syncQuality(r).isFailure) anyFailed = true
        }

        // Refresh spring master list from server
        try {
            app.springsRepo.refreshFromServer()
        } catch (_: Exception) {
            // Non-fatal — springs will refresh on next app open
        }

        return if (anyFailed) Result.retry() else Result.success()
    }
}
