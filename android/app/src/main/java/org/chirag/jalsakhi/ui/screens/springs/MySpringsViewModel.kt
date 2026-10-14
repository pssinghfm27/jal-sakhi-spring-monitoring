// SPDX-License-Identifier: MIT
package org.chirag.jalsakhi.ui.screens.springs

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.chirag.jalsakhi.JalSakhiApp
import org.chirag.jalsakhi.data.local.entity.DischargeReadingEntity
import org.chirag.jalsakhi.data.local.entity.SpringEntity

data class SpringsListState(val springs: List<SpringEntity> = emptyList())

class MySpringsViewModel : ViewModel() {
    private val app = JalSakhiApp.instance
    private val _state = MutableStateFlow(SpringsListState())
    val state: StateFlow<SpringsListState> = _state

    init {
        viewModelScope.launch {
            app.springsRepo.observe().collect { list -> _state.update { it.copy(springs = list) } }
        }
        viewModelScope.launch { runCatching { app.springsRepo.refreshFromServer() } }
    }

    suspend fun lastDischargesFor(springId: String): List<DischargeReadingEntity> =
        app.db.dischargeDao().lastForSpring(springId).reversed()
}
