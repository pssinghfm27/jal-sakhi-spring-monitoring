// SPDX-License-Identifier: MIT
package org.chirag.jalsakhi.ui.screens.discharge

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.chirag.jalsakhi.JalSakhiApp
import org.chirag.jalsakhi.data.local.entity.DischargeReadingEntity
import org.chirag.jalsakhi.data.local.entity.SpringEntity
import org.chirag.jalsakhi.location.LocationProvider
import java.io.File
import java.util.UUID

data class DischargeState(
    val springs: List<SpringEntity> = emptyList(),
    val selectedSpring: SpringEntity? = null,
    val selectedSpringLabel: String? = null,
    val method: String = "v_notch",
    val weather: String = "dry",
    val dischargeLpm: String = "",
    val durationSec: String = "",
    val notes: String = "",
    val photoPath: String? = null,
    val photoMissing: Boolean = false,
    val gpsAccuracy: Float? = null,
    val lat: Double? = null,
    val lon: Double? = null,
    val error: String? = null,
    val savedOk: Boolean = false,
) {
    val canSubmit: Boolean
        get() = selectedSpring != null &&
            dischargeLpm.toFloatOrNull() != null &&
            photoPath != null &&
            (gpsAccuracy?.let { it <= 20f } ?: false)
}

class NewDischargeViewModel : ViewModel() {
    private val app = JalSakhiApp.instance
    private val locationProvider = LocationProvider(app)

    private val _state = MutableStateFlow(DischargeState())
    val state: StateFlow<DischargeState> = _state

    init {
        viewModelScope.launch {
            val villageId = app.authStore.villageId
            val springsFlow = if (!villageId.isNullOrBlank()) {
                app.springsRepo.observeForVillage(villageId)
            } else {
                app.springsRepo.observe()
            }
            springsFlow.collect { list -> _state.update { it.copy(springs = list) } }
        }
    }

    fun startLocation() = viewModelScope.launch {
        locationProvider.stream().collect { loc ->
            _state.update { it.copy(gpsAccuracy = loc.accuracy, lat = loc.latitude, lon = loc.longitude) }
        }
    }

    fun selectSpring(s: SpringEntity) = _state.update { it.copy(selectedSpring = s, selectedSpringLabel = "${s.nameHi} · ${s.villageName ?: ""}") }
    fun setMethod(v: String) = _state.update { it.copy(method = v) }
    fun setWeather(v: String) = _state.update { it.copy(weather = v) }
    fun setDischarge(v: String) = _state.update { it.copy(dischargeLpm = v.filter { c -> c.isDigit() || c == '.' }) }
    fun setDuration(v: String) = _state.update { it.copy(durationSec = v.filter { it.isDigit() }) }
    fun setNotes(v: String) = _state.update { it.copy(notes = v) }
    fun setPhoto(f: File?) = _state.update { it.copy(photoPath = f?.absolutePath, photoMissing = f == null) }

    fun save() = viewModelScope.launch {
        val s = _state.value
        if (!s.canSubmit) {
            _state.update { it.copy(photoMissing = it.photoPath == null) }
            return@launch
        }
        val r = DischargeReadingEntity(
            clientUuid = UUID.randomUUID().toString(),
            springId = s.selectedSpring!!.id,
            recordedAt = System.currentTimeMillis(),
            lat = s.lat!!,
            lon = s.lon!!,
            gpsAccuracyM = s.gpsAccuracy!!,
            method = s.method,
            durationSec = s.durationSec.toIntOrNull(),
            dischargeLpm = s.dischargeLpm.toFloat(),
            weather = s.weather,
            photoPath = s.photoPath!!,
            voicePath = null,
            notes = s.notes.takeIf { it.isNotBlank() },
        )
        app.readingsRepo.saveDischargeLocal(r)
        app.sync.syncNow()
        _state.update { it.copy(savedOk = true) }
    }
}
