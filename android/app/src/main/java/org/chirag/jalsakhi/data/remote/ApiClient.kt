// SPDX-License-Identifier: MIT
// OkHttp + org.json client. No reflection / no codegen.
package org.chirag.jalsakhi.data.remote

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.logging.HttpLoggingInterceptor
import org.chirag.jalsakhi.data.prefs.AuthStore
import org.chirag.jalsakhi.data.remote.dto.AuthResponseDto
import org.chirag.jalsakhi.data.remote.dto.LoginResult
import org.chirag.jalsakhi.data.remote.dto.ReadingPostResponse
import org.chirag.jalsakhi.data.remote.dto.SpringDto
import org.chirag.jalsakhi.data.remote.dto.SpringMasterResponse
import org.chirag.jalsakhi.data.remote.dto.UserDto
import org.chirag.jalsakhi.data.remote.dto.VillageDto
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit

class ApiException(val status: Int, msg: String) : RuntimeException(msg)

class ApiClient(private val defaultBaseUrl: String, private val authStore: AuthStore) {
    private val baseUrl: String
        get() = (authStore.apiBaseUrl?.trimEnd('/')?.takeIf { it.isNotBlank() }) ?: defaultBaseUrl

    private val authInterceptor = Interceptor { chain ->
        val req = chain.request().newBuilder().apply {
            authStore.token?.let { header("Authorization", "Bearer $it") }
        }.build()
        chain.proceed(req)
    }

    private val client = OkHttpClient.Builder()
        .addInterceptor(authInterceptor)
        .addInterceptor(HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BASIC
        })
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()

    private fun jsonBody(obj: JSONObject): RequestBody =
        obj.toString().toRequestBody("application/json".toMediaType())

    /** Returns (httpStatus, bodyText). Throws ApiException for >= 500 only;
     *  callers handle 4xx / 2xx (incl. 202 pending) themselves. */
    private suspend fun execute(builder: Request.Builder): Pair<Int, String> =
        withContext(Dispatchers.IO) {
            client.newCall(builder.build()).execute().use { res ->
                val body = res.body?.string().orEmpty()
                if (res.code >= 500) throw ApiException(res.code, body.take(400))
                res.code to body
            }
        }

    private suspend fun executeOk(builder: Request.Builder): String {
        val (code, body) = execute(builder)
        if (code !in 200..299) {
            val msg = runCatching { JSONObject(body).getJSONObject("error").getString("message") }
                .getOrNull() ?: body.take(200)
            throw ApiException(code, msg)
        }
        return body
    }

    // ─── auth ───

    /** identifier = phone OR email */
    suspend fun login(identifier: String, password: String): LoginResult {
        val req = Request.Builder()
            .url("$baseUrl/auth/login")
            .post(jsonBody(JSONObject().put("identifier", identifier).put("password", password)))
        val (code, body) = execute(req)
        return when (code) {
            in 200..201 -> {
                val o = JSONObject(body)
                LoginResult.Success(AuthResponseDto(
                    token = o.getString("token"),
                    user = parseUser(o.getJSONObject("user")),
                ))
            }
            202 -> {
                val msg = JSONObject(body).optString("message", "Awaiting manager approval.")
                LoginResult.Pending(msg)
            }
            else -> {
                val msg = runCatching { JSONObject(body).getJSONObject("error").getString("message") }
                    .getOrNull() ?: "Login failed"
                throw ApiException(code, msg)
            }
        }
    }

    suspend fun signup(name: String, phone: String, password: String, villageId: String, note: String?) {
        val req = Request.Builder()
            .url("$baseUrl/auth/signup")
            .post(jsonBody(JSONObject()
                .put("name", name)
                .put("phone", phone)
                .put("password", password)
                .put("village_id", villageId)
                .apply { if (!note.isNullOrBlank()) put("note", note) }))
        executeOk(req)   // 201 OK or 4xx throws
    }

    suspend fun villages(): List<VillageDto> {
        val req = Request.Builder().url("$baseUrl/krp/villages").get()
        val obj = JSONObject(executeOk(req))
        val arr = obj.getJSONArray("items")
        val out = mutableListOf<VillageDto>()
        for (i in 0 until arr.length()) {
            val v = arr.getJSONObject(i)
            out.add(VillageDto(
                id = v.getString("id"),
                name = v.optString("name", ""),
                gp = v.optStringOrNull("gp"),
                block = v.optStringOrNull("block"),
                district = v.optStringOrNull("district"),
            ))
        }
        return out
    }

    // ─── springs ───
    suspend fun springsMaster(): SpringMasterResponse {
        val req = Request.Builder().url("$baseUrl/springs/master").get()
        val obj = JSONObject(executeOk(req))
        val items = mutableListOf<SpringDto>()
        val arr = obj.getJSONArray("items")
        for (i in 0 until arr.length()) items.add(parseSpring(arr.getJSONObject(i)))
        return SpringMasterResponse(items = items, count = obj.optInt("count", items.size))
    }

    // ─── readings (multipart) ───
    suspend fun postDischarge(
        fields: Map<String, String>,
        photo: File,
        voice: File? = null,
    ): ReadingPostResponse {
        val mp = MultipartBody.Builder().setType(MultipartBody.FORM)
        fields.forEach { (k, v) -> mp.addFormDataPart(k, v) }
        mp.addFormDataPart("photo", photo.name, photo.asRequestBody("image/jpeg".toMediaType()))
        voice?.let { mp.addFormDataPart("voice", it.name, it.asRequestBody("audio/3gpp".toMediaType())) }
        val req = Request.Builder().url("$baseUrl/readings/discharge").post(mp.build())
        return parseReadingResponse(executeOk(req))
    }

    suspend fun postQuality(
        fields: Map<String, String>,
        photo: File,
    ): ReadingPostResponse {
        val mp = MultipartBody.Builder().setType(MultipartBody.FORM)
        fields.forEach { (k, v) -> mp.addFormDataPart(k, v) }
        mp.addFormDataPart("photo", photo.name, photo.asRequestBody("image/jpeg".toMediaType()))
        val req = Request.Builder().url("$baseUrl/readings/quality").post(mp.build())
        return parseReadingResponse(executeOk(req))
    }

    // ─── parsing helpers ───
    private fun parseUser(o: JSONObject): UserDto = UserDto(
        id = o.getString("id"),
        name = o.optString("name", ""),
        role = o.optString("role", "krp"),
        phone = o.optStringOrNull("phone"),
        email = o.optStringOrNull("email"),
        villageId = o.optStringOrNull("village_id"),
        villageName = o.optStringOrNull("village_name"),
        block = o.optStringOrNull("block"),
        district = o.optStringOrNull("district"),
    )

    private fun parseSpring(o: JSONObject): SpringDto = SpringDto(
        id = o.getString("id"),
        code = o.optStringOrNull("code"),
        nameEn = o.optString("name_en", ""),
        nameHi = o.optString("name_hi", ""),
        lat = o.optDouble("lat", 0.0),
        lon = o.optDouble("lon", 0.0),
        altitude = if (o.isNull("altitude_m")) null else o.optInt("altitude_m"),
        springType = o.optStringOrNull("spring_type"),
        projectName = o.optStringOrNull("project_name"),
        villageId = o.optStringOrNull("village_id"),
        villageName = o.optStringOrNull("village_name"),
        block = o.optStringOrNull("block"),
        district = o.optStringOrNull("district"),
    )

    private fun parseReadingResponse(body: String): ReadingPostResponse {
        val o = JSONObject(body)
        return ReadingPostResponse(ok = o.optBoolean("ok", true), anomaly = o.optBoolean("anomaly", false))
    }
}

private fun JSONObject.optStringOrNull(key: String): String? =
    if (isNull(key) || !has(key)) null else optString(key, null)
