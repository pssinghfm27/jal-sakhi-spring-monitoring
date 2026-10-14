// SPDX-License-Identifier: MIT
package org.chirag.jalsakhi.data.prefs

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class AuthStore(context: Context) {
    private val mk = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs = EncryptedSharedPreferences.create(
        context, "jalsakhi.auth", mk,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    var token: String?
        get() = prefs.getString(K_TOKEN, null)
        set(value) = prefs.edit().putString(K_TOKEN, value).apply()

    var userId: String?
        get() = prefs.getString(K_USER_ID, null)
        set(value) = prefs.edit().putString(K_USER_ID, value).apply()

    var userName: String?
        get() = prefs.getString(K_USER_NAME, null)
        set(value) = prefs.edit().putString(K_USER_NAME, value).apply()

    var villageId: String?
        get() = prefs.getString(K_VILLAGE_ID, null)
        set(value) = prefs.edit().putString(K_VILLAGE_ID, value).apply()

    /** Server base URL chosen by the user on first run (e.g. https://api.chirag.org). */
    var apiBaseUrl: String?
        get() = prefs.getString(K_API_BASE, null)
        set(value) = prefs.edit().putString(K_API_BASE, value).apply()

    fun clear() {
        // Preserve apiBaseUrl across logout so the user doesn't re-enter it every time.
        val keepUrl = apiBaseUrl
        prefs.edit().clear().apply()
        if (keepUrl != null) apiBaseUrl = keepUrl
    }

    val isLoggedIn: Boolean get() = !token.isNullOrEmpty()
    val hasServerUrl: Boolean get() = !apiBaseUrl.isNullOrBlank()

    companion object {
        private const val K_TOKEN = "token"
        private const val K_USER_ID = "user_id"
        private const val K_USER_NAME = "user_name"
        private const val K_VILLAGE_ID = "village_id"
        private const val K_API_BASE = "api_base_url"
    }
}
