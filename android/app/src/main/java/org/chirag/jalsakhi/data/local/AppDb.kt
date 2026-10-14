// SPDX-License-Identifier: MIT
package org.chirag.jalsakhi.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import org.chirag.jalsakhi.data.local.dao.DischargeDao
import org.chirag.jalsakhi.data.local.dao.QualityDao
import org.chirag.jalsakhi.data.local.dao.ReminderDao
import org.chirag.jalsakhi.data.local.dao.SpringDao
import org.chirag.jalsakhi.data.local.dao.UserDao
import org.chirag.jalsakhi.data.local.entity.DischargeReadingEntity
import org.chirag.jalsakhi.data.local.entity.QualityReadingEntity
import org.chirag.jalsakhi.data.local.entity.ReminderEntity
import org.chirag.jalsakhi.data.local.entity.SpringEntity
import org.chirag.jalsakhi.data.local.entity.UserEntity

@Database(
    entities = [
        SpringEntity::class,
        UserEntity::class,
        DischargeReadingEntity::class,
        QualityReadingEntity::class,
        ReminderEntity::class,
    ],
    version = 2,
    exportSchema = false,
)
abstract class AppDb : RoomDatabase() {
    abstract fun springDao(): SpringDao
    abstract fun userDao(): UserDao
    abstract fun dischargeDao(): DischargeDao
    abstract fun qualityDao(): QualityDao
    abstract fun reminderDao(): ReminderDao

    companion object {
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE springs ADD COLUMN villageId TEXT")
            }
        }

        fun build(ctx: Context): AppDb =
            Room.databaseBuilder(ctx, AppDb::class.java, "jalsakhi.db")
                .addMigrations(MIGRATION_1_2)
                .fallbackToDestructiveMigrationOnDowngrade()
                .build()
    }
}

