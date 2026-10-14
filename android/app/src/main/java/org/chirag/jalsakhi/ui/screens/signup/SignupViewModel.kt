// SPDX-License-Identifier: MIT
package org.chirag.jalsakhi.ui.screens.signup

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.chirag.jalsakhi.JalSakhiApp
import org.chirag.jalsakhi.data.remote.dto.VillageDto

data class SignupState(
    val name: String = "",
    val phone: String = "",
    val password: String = "",
    val note: String = "",
    val villages: List<VillageDto> = emptyList(),
    val loadingVillages: Boolean = true,
    val selectedVillage: VillageDto? = null,
    val selectedVillageLabel: String? = null,
    val loading: Boolean = false,
    val error: String? = null,
    val successMessage: String? = null,
) {
    val canSubmit: Boolean
        get() = name.length >= 2 &&
            phone.length >= 10 &&
            password.length >= 6 &&
            selectedVillage != null
}

class SignupViewModel : ViewModel() {
    private val repo = JalSakhiApp.instance.authRepo
    private val _state = MutableStateFlow(SignupState())
    val state: StateFlow<SignupState> = _state

    init {
        viewModelScope.launch {
            runCatching { repo.villages() }
                .onSuccess { vs -> _state.update { it.copy(villages = vs, loadingVillages = false) } }
                .onFailure { e ->
                    _state.update { it.copy(loadingVillages = false, error = "Couldn't load villages: ${e.message}") }
                }
        }
    }

    fun setName(v: String) = _state.update { it.copy(name = v, error = null) }
    fun setPhone(v: String) = _state.update { it.copy(phone = v.filter { c -> c.isDigit() || c == '+' }, error = null) }
    fun setPassword(v: String) = _state.update { it.copy(password = v, error = null) }
    fun setNote(v: String) = _state.update { it.copy(note = v) }
    fun selectVillage(v: VillageDto) = _state.update {
        it.copy(selectedVillage = v, selectedVillageLabel = "${v.name} · ${v.block ?: ""}")
    }

    fun submit() = viewModelScope.launch {
        val s = _state.value
        if (!s.canSubmit) return@launch
        _state.update { it.copy(loading = true, error = null) }
        runCatching {
            repo.signup(
                name = s.name.trim(),
                phone = s.phone.trim(),
                password = s.password,
                villageId = s.selectedVillage!!.id,
                note = s.note.takeIf { it.isNotBlank() },
            )
        }
            .onSuccess {
                _state.update { it.copy(
                    loading = false,
                    successMessage = "Your account has been submitted. The CHIRAG manager will approve it shortly. " +
                        "आपका रजिस्ट्रेशन सबमिट हो गया। मैनेजर अनुमति देगा।",
                ) }
            }
            .onFailure { e ->
                _state.update { it.copy(loading = false, error = e.message ?: "Signup failed") }
            }
    }
}
