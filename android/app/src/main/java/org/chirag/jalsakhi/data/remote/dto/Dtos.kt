// SPDX-License-Identifier: MIT
// Plain data classes — parsed from JSONObject in ApiClient.
package org.chirag.jalsakhi.data.remote.dto

data class UserDto(
    val id: String,
    val name: String,
    val role: String,
    val phone: String?,
    val email: String?,
    val villageId: String?,
    val villageName: String?,
    val block: String?,
    val district: String?,
)

data class AuthResponseDto(
    val token: String,
    val user: UserDto,
)

/** Returned by /auth/signup and the 202 case of /auth/login. */
data class PendingResponse(val message: String)

sealed class LoginResult {
    data class Success(val auth: AuthResponseDto) : LoginResult()
    data class Pending(val message: String) : LoginResult()
}

data class VillageDto(
    val id: String,
    val name: String,
    val gp: String?,
    val block: String?,
    val district: String?,
)

data class SpringDto(
    val id: String,
    val code: String?,
    val nameEn: String,
    val nameHi: String,
    val lat: Double,
    val lon: Double,
    val altitude: Int?,
    val springType: String?,
    val projectName: String?,
    val villageId: String?,
    val villageName: String?,
    val block: String?,
    val district: String?,
)

data class SpringMasterResponse(val items: List<SpringDto>, val count: Int)

data class ReadingPostResponse(val ok: Boolean, val anomaly: Boolean)
