// SPDX-License-Identifier: MIT
package org.chirag.jalsakhi.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow
import org.chirag.jalsakhi.data.local.entity.DischargeReadingEntity
import org.chirag.jalsakhi.data.local.entity.QualityReadingEntity
import org.chirag.jalsakhi.data.local.entity.ReminderEntity
import org.chirag.jalsakhi.data.local.entity.SpringEntity
import org.chirag.jalsakhi.data.local.entity.UserEntity

@Dao
interface SpringDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(items: List<SpringEntity>)

    @Query("SELECT * FROM springs ORDER BY district, block, villageName, nameEn")
    fun all(): Flow<List<SpringEntity>>

    @Query("SELECT * FROM springs WHERE id = :id")
    suspend fun byId(id: String): SpringEntity?

    @Query("SELECT * FROM springs WHERE villageId = :vid ORDER BY district, block, villageName, nameEn")
    fun byVillage(vid: String): Flow<List<SpringEntity>>

    @Query("DELETE FROM springs")
    suspend fun clear()
}

@Dao
interface UserDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(user: UserEntity)

    @Query("SELECT * FROM users LIMIT 1")
    suspend fun current(): UserEntity?
}

@Dao
interface DischargeDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(reading: DischargeReadingEntity)

    @Update
    suspend fun update(reading: DischargeReadingEntity)

    @Query("SELECT * FROM discharge_readings WHERE syncedAt IS NULL ORDER BY recordedAt ASC")
    suspend fun pending(): List<DischargeReadingEntity>

    @Query("SELECT COUNT(*) FROM discharge_readings WHERE syncedAt IS NULL")
    fun pendingCount(): Flow<Int>

    @Query("SELECT * FROM discharge_readings WHERE springId = :springId ORDER BY recordedAt DESC LIMIT 12")
    suspend fun lastForSpring(springId: String): List<DischargeReadingEntity>

    @Query("SELECT * FROM discharge_readings ORDER BY recordedAt DESC")
    fun allDesc(): Flow<List<DischargeReadingEntity>>
}

@Dao
interface QualityDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(reading: QualityReadingEntity)

    @Update
    suspend fun update(reading: QualityReadingEntity)

    @Query("SELECT * FROM quality_readings WHERE syncedAt IS NULL ORDER BY recordedAt ASC")
    suspend fun pending(): List<QualityReadingEntity>

    @Query("SELECT COUNT(*) FROM quality_readings WHERE syncedAt IS NULL")
    fun pendingCount(): Flow<Int>

    @Query("SELECT * FROM quality_readings WHERE springId = :springId ORDER BY recordedAt DESC LIMIT 4")
    suspend fun lastForSpring(springId: String): List<QualityReadingEntity>

    @Query("SELECT MAX(recordedAt) FROM quality_readings WHERE springId = :springId")
    suspend fun lastTestTime(springId: String): Long?

    @Query("SELECT * FROM quality_readings ORDER BY recordedAt DESC")
    fun allDesc(): Flow<List<QualityReadingEntity>>
}

@Dao
interface ReminderDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(r: ReminderEntity): Long

    @Query("SELECT * FROM reminders ORDER BY dueDate DESC")
    fun all(): Flow<List<ReminderEntity>>

    @Query("UPDATE reminders SET seen = 1 WHERE id = :id")
    suspend fun markSeen(id: Long)
}
