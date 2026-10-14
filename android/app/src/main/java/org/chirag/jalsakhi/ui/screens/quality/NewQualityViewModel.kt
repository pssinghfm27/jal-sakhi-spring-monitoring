// SPDX-License-Identifier: MIT
package org.chirag.jalsakhi.ui.screens.quality

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.chirag.jalsakhi.JalSakhiApp
import org.chirag.jalsakhi.data.local.entity.QualityReadingEntity
import org.chirag.jalsakhi.data.local.entity.SpringEntity
import org.chirag.jalsakhi.location.LocationProvider
import java.io.File
import java.time.LocalDate
import java.util.UUID

data class QualityState(
    val springs: List<SpringEntity> = emptyList(),
    val selectedSpring: SpringEntity? = null,
    val selectedSpringLabel: String? = null,
    val ph: String = "", val tds: String = "", val turbidity: String = "", val hardness: String = "",
    val alkalinity: String = "", val chloride: String = "", val iron: String = "", val fecal: String = "",
    val kitBatch: String = "", val kitExpiry: String = "",
    val kitExpired: Boolean = false,
    val photoPath: String? = null, val photoMissing: Boolean = false,
    val gpsAccuracy: Float? = null, val lat: Double? = null, val lon: Double? = null,
    val error: String? = null, val savedOk: Boolean = false,
) {
    val canSubmit: Boolean
        get() = selectedSpring != null && photoPath != null && (gpsAccuracy?.let { it <= 50f } ?: false)
}

class NewQualityViewModel : ViewModel() {
    private val app = JalSakhiApp.instance
    private val locationProvider = LocationProvider(app)
    private val _state = MutableStateFlow(QualityState())
    val state: StateFlow<QualityState> = _state

    init {
        viewModelScope.launch {
            val villageId = app.authStore.villageId
            val springsFlow = if (!villageId.isNullOrBlank()) {
                app.springsRepo.observeForVillage(villageId)
            } else {
                app.springsRepo.observe()
            }
            springsFlow.collect { _state.update { st -> st.copy(springs = it) } }
        }
    }

    fun startLocation() = viewModelScope.launch {
        locationProvider.stream().collect { loc ->
            _state.update { it.copy(gpsAccuracy = loc.accuracy, lat = loc.latitude, lon = loc.longitude) }
        }
    }

    fun selectSpring(s: SpringEntity) = _state.update { it.copy(selectedSpring = s, selectedSpringLabel = "${s.nameHi} · ${s.villageName ?: ""}") }
    fun setPh(v: String) = _state.update { it.copy(ph = v) }
    fun setTds(v: String) = _state.update { it.copy(tds = v) }
    fun setTurb(v: String) = _state.update { it.copy(turbidity = v) }
    fun setHard(v: String) = _state.update { it.copy(hardness = v) }
    fun setAlk(v: String) = _state.update { it.copy(alkalinity = v) }
    fun setCl(v: String) = _state.update { it.copy(chloride = v) }
    fun setIron(v: String) = _state.update { it.copy(iron = v) }
    fun setFecal(v: String) = _state.update { it.copy(fecal = v) }
    fun setKitBatch(v: String) = _state.update { it.copy(kitBatch = v) }
    fun setKitExpiry(v: String) = _state.update {
        val expired = runCatching { LocalDate.parse(v).isBefore(LocalDate.now()) }.getOrDefault(false)
        it.copy(kitExpiry = v, kitExpired = expired)
    }
    fun setPhoto(f: File?) = _state.update { it.copy(photoPath = f?.absolutePath, photoMissing = f == null) }

    fun save() = viewModelScope.launch {
        val s = _state.value
        if (!s.canSubmit) {
            _state.update { it.copy(photoMissing = it.photoPath == null) }
            return@launch
        }
        val r = QualityReadingEntity(
            clientUuid = UUID.randomUUID().toString(),
            springId = s.selectedSpring!!.id,
            recordedAt = System.currentTimeMillis(),
            lat = s.lat!!, lon = s.lon!!,
            ph = s.ph.toFloatOrNull(),
            tds = s.tds.toFloatOrNull(),
            turbidity = s.turbidity.toFloatOrNull(),
            hardness = s.hardness.toFloatOrNull(),
            alkalinity = s.alkalinity.toFloatOrNull(),
            chloride = s.chloride.toFloatOrNull(),
            iron = s.iron.toFloatOrNull(),
            fecalColiform = s.fecal.toIntOrNull(),
            kitBatch = s.kitBatch.takeIf { it.isNotBlank() },
            kitExpiry = s.kitExpiry.takeIf { it.isNotBlank() },
            photoPath = s.photoPath!!,
        )
        app.readingsRepo.saveQualityLocal(r)
        app.sync.syncNow()
        _state.update { it.copy(savedOk = true) }
    }
}
