// SPDX-License-Identifier: MIT
package org.chirag.jalsakhi.ui.screens.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.chirag.jalsakhi.JalSakhiApp
import org.chirag.jalsakhi.data.remote.dto.LoginResult

data class LoginState(
    val identifier: String = "",
    val password: String = "",
    val loading: Boolean = false,
    val error: String? = null,
    val success: Boolean = false,
    val pendingMessage: String? = null,
)

class LoginViewModel : ViewModel() {
    private val repo = JalSakhiApp.instance.authRepo
    private val springsRepo = JalSakhiApp.instance.springsRepo

    private val _state = MutableStateFlow(LoginState())
    val state: StateFlow<LoginState> = _state

    fun setIdentifier(v: String) = _state.update { it.copy(identifier = v.trim(), error = null) }
    fun setPassword(v: String) = _state.update { it.copy(password = v, error = null) }

    fun login() = viewModelScope.launch {
        _state.update { it.copy(loading = true, error = null, pendingMessage = null) }
        runCatching { repo.login(_state.value.identifier, _state.value.password) }
            .onSuccess { result ->
                when (result) {
                    is LoginResult.Success -> {
                        // Warm the spring cache so home is usable offline.
                        runCatching { springsRepo.refreshFromServer() }
                        _state.update { it.copy(loading = false, success = true) }
                    }
                    is LoginResult.Pending -> {
                        _state.update { it.copy(loading = false, pendingMessage = result.message) }
                    }
                }
            }
            .onFailure { e ->
                _state.update { it.copy(loading = false, error = e.message ?: "Login failed") }
            }
    }
}
