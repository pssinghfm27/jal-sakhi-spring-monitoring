// SPDX-License-Identifier: MIT
package org.chirag.jalsakhi.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "springs")
data class SpringEntity(
    @PrimaryKey val id: String,
    val code: String?,
    val nameEn: String,
    val nameHi: String,
    val lat: Double,
    val lon: Double,
    val altitudeM: Int?,
    val springType: String?,
    val projectName: String?,
    val villageName: String?,
    val block: String?,
    val district: String?,
    val villageId: String? = null,
    val refreshedAt: Long,
)

@Entity(tableName = "users")
data class UserEntity(
    @PrimaryKey val id: String,
    val name: String,
    val role: String,
    val phone: String?,
    val villageId: String?,
    val villageName: String?,
)

@Entity(tableName = "discharge_readings")
data class DischargeReadingEntity(
    @PrimaryKey val clientUuid: String,
    val springId: String,
    val recordedAt: Long,
    val lat: Double,
    val lon: Double,
    val gpsAccuracyM: Float,
    val method: String,                 // v_notch | volumetric | float
    val durationSec: Int?,
    val dischargeLpm: Float,
    val weather: String,                // dry | light_rain | heavy_rain | post_monsoon
    val photoPath: String,
    val voicePath: String?,
    val notes: String?,
    val syncedAt: Long? = null,
    val lastSyncError: String? = null,
)

@Entity(tableName = "quality_readings")
data class QualityReadingEntity(
    @PrimaryKey val clientUuid: String,
    val springId: String,
    val recordedAt: Long,
    val lat: Double,
    val lon: Double,
    val ph: Float?,
    val tds: Float?,
    val turbidity: Float?,
    val hardness: Float?,
    val alkalinity: Float?,
    val chloride: Float?,
    val iron: Float?,
    val fecalColiform: Int?,
    val kitBatch: String?,
    val kitExpiry: String?,             // ISO yyyy-MM-dd
    val photoPath: String,
    val syncedAt: Long? = null,
    val lastSyncError: String? = null,
)

@Entity(tableName = "reminders")
data class ReminderEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val springId: String,
    val dueDate: String,                // yyyy-MM-dd
    val kind: String,                   // pre7 | due | overdue7
    val seen: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
)
