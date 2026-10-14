// SPDX-License-Identifier: MIT
package org.chirag.jalsakhi

import android.app.Application
import androidx.work.Configuration
import org.chirag.jalsakhi.data.local.AppDb
import org.chirag.jalsakhi.data.prefs.AuthStore
import org.chirag.jalsakhi.data.remote.ApiClient
import org.chirag.jalsakhi.data.repo.AuthRepo
import org.chirag.jalsakhi.data.repo.ReadingsRepo
import org.chirag.jalsakhi.data.repo.SpringsRepo
import org.chirag.jalsakhi.sync.SyncManager

class JalSakhiApp : Application(), Configuration.Provider {

    lateinit var db: AppDb
        private set
    lateinit var authStore: AuthStore
        private set
    lateinit var api: ApiClient
        private set
    lateinit var authRepo: AuthRepo
        private set
    lateinit var springsRepo: SpringsRepo
        private set
    lateinit var readingsRepo: ReadingsRepo
        private set
    lateinit var sync: SyncManager
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this
        db = AppDb.build(this)
        authStore = AuthStore(this)
        api = ApiClient(BuildConfig.API_BASE_URL, authStore)
        authRepo = AuthRepo(api, authStore, db.userDao())
        springsRepo = SpringsRepo(api, db.springDao())
        readingsRepo = ReadingsRepo(api, db.dischargeDao(), db.qualityDao())
        sync = SyncManager(this)
        sync.schedulePeriodic()
    }

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder().setMinimumLoggingLevel(android.util.Log.INFO).build()

    companion object {
        lateinit var instance: JalSakhiApp
            private set
    }
}
