// SPDX-License-Identifier: MIT
package org.chirag.jalsakhi.data.repo

import org.chirag.jalsakhi.data.local.dao.DischargeDao
import org.chirag.jalsakhi.data.local.dao.QualityDao
import org.chirag.jalsakhi.data.local.dao.SpringDao
import org.chirag.jalsakhi.data.local.dao.UserDao
import org.chirag.jalsakhi.data.local.entity.DischargeReadingEntity
import org.chirag.jalsakhi.data.local.entity.QualityReadingEntity
import org.chirag.jalsakhi.data.local.entity.SpringEntity
import org.chirag.jalsakhi.data.local.entity.UserEntity
import org.chirag.jalsakhi.data.prefs.AuthStore
import org.chirag.jalsakhi.data.remote.ApiClient
import org.chirag.jalsakhi.data.remote.dto.LoginResult
import org.chirag.jalsakhi.data.remote.dto.VillageDto

class AuthRepo(
    private val api: ApiClient,
    private val authStore: AuthStore,
    private val userDao: UserDao,
) {
    /** Returns LoginResult.Pending for 202, throws ApiException for credential failures. */
    suspend fun login(identifier: String, password: String): LoginResult {
        val result = api.login(normaliseIfPhone(identifier), password)
        if (result is LoginResult.Success) {
            authStore.token = result.auth.token
            authStore.userId = result.auth.user.id
            authStore.userName = result.auth.user.name
            authStore.villageId = result.auth.user.villageId
            userDao.upsert(
                UserEntity(
                    id = result.auth.user.id,
                    name = result.auth.user.name,
                    role = result.auth.user.role,
                    phone = result.auth.user.phone,
                    villageId = result.auth.user.villageId,
                    villageName = result.auth.user.villageName,
                ),
            )
        }
        return result
    }

    suspend fun signup(name: String, phone: String, password: String, villageId: String, note: String?) =
        api.signup(name, normalisePhone(phone), password, villageId, note)

    suspend fun villages(): List<VillageDto> = api.villages()

    fun logout() = authStore.clear()
    val isLoggedIn get() = authStore.isLoggedIn

    /** Emails pass through; bare digits become E.164 +91. */
    private fun normaliseIfPhone(raw: String): String =
        if (raw.contains('@')) raw.trim().lowercase() else normalisePhone(raw)

    private fun normalisePhone(raw: String): String {
        val digits = raw.trim().filter { it.isDigit() || it == '+' }
        return when {
            digits.startsWith("+") -> digits
            digits.startsWith("91") -> "+$digits"
            else -> "+91$digits"
        }
    }
}

class SpringsRepo(private val api: ApiClient, private val dao: SpringDao) {
    fun observe() = dao.all()
    fun observeForVillage(villageId: String) = dao.byVillage(villageId)
    suspend fun byId(id: String) = dao.byId(id)

    suspend fun refreshFromServer() {
        val res = api.springsMaster()
        val now = System.currentTimeMillis()
        dao.upsertAll(res.items.map {
            SpringEntity(
                id = it.id,
                code = it.code,
                nameEn = it.nameEn,
                nameHi = it.nameHi,
                lat = it.lat,
                lon = it.lon,
                altitudeM = it.altitude,
                springType = it.springType,
                projectName = it.projectName,
                villageName = it.villageName,
                block = it.block,
                district = it.district,
                villageId = it.villageId,
                refreshedAt = now,
            )
        })
    }
}

class ReadingsRepo(
    private val api: ApiClient,
    private val dischargeDao: DischargeDao,
    private val qualityDao: QualityDao,
) {
    suspend fun saveDischargeLocal(r: DischargeReadingEntity) = dischargeDao.insert(r)
    suspend fun saveQualityLocal(r: QualityReadingEntity) = qualityDao.insert(r)

    suspend fun pendingDischarge() = dischargeDao.pending()
    suspend fun pendingQuality() = qualityDao.pending()

    fun pendingCount(): kotlinx.coroutines.flow.Flow<Int> {
        val d = dischargeDao.pendingCount()
        val q = qualityDao.pendingCount()
        return kotlinx.coroutines.flow.combine(d, q) { a, b -> a + b }
    }

    suspend fun syncDischarge(r: DischargeReadingEntity): Result<Unit> = runCatching {
        val photo = java.io.File(r.photoPath)
        val voice = r.voicePath?.let { java.io.File(it) }?.takeIf { it.exists() }
        val fields = buildMap {
            put("spring_id", r.springId)
            put("client_uuid", r.clientUuid)
            put("recorded_at", java.time.Instant.ofEpochMilli(r.recordedAt).toString())
            put("lat", r.lat.toString())
            put("lon", r.lon.toString())
            put("gps_accuracy_m", r.gpsAccuracyM.toString())
            put("method", r.method)
            put("discharge_lpm", r.dischargeLpm.toString())
            put("weather", r.weather)
            r.durationSec?.let { put("duration_sec", it.toString()) }
            r.notes?.let { put("notes", it) }
        }
        api.postDischarge(fields, photo, voice)
        dischargeDao.update(r.copy(syncedAt = System.currentTimeMillis(), lastSyncError = null))
    }.onFailure { e ->
        dischargeDao.update(r.copy(lastSyncError = e.message?.take(200)))
    }

    suspend fun syncQuality(r: QualityReadingEntity): Result<Unit> = runCatching {
        val photo = java.io.File(r.photoPath)
        val fields = buildMap {
            put("spring_id", r.springId)
            put("client_uuid", r.clientUuid)
            put("recorded_at", java.time.Instant.ofEpochMilli(r.recordedAt).toString())
            put("lat", r.lat.toString())
            put("lon", r.lon.toString())
            r.ph?.let { put("ph", it.toString()) }
            r.tds?.let { put("tds", it.toString()) }
            r.turbidity?.let { put("turbidity", it.toString()) }
            r.hardness?.let { put("hardness", it.toString()) }
            r.alkalinity?.let { put("alkalinity", it.toString()) }
            r.chloride?.let { put("chloride", it.toString()) }
            r.iron?.let { put("iron", it.toString()) }
            r.fecalColiform?.let { put("fecal_coliform", it.toString()) }
            r.kitBatch?.let { put("kit_batch", it) }
            r.kitExpiry?.let { put("kit_expiry", it) }
        }
        api.postQuality(fields, photo)
        qualityDao.update(r.copy(syncedAt = System.currentTimeMillis(), lastSyncError = null))
    }.onFailure { e ->
        qualityDao.update(r.copy(lastSyncError = e.message?.take(200)))
    }
}
