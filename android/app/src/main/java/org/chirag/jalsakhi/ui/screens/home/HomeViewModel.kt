// SPDX-License-Identifier: MIT
package org.chirag.jalsakhi.ui.screens.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.chirag.jalsakhi.JalSakhiApp
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

data class HomeState(
    val userName: String? = null,
    val pendingCount: Int = 0,
    val unseenReminders: Int = 0,
    val nextDueLabel: String? = null,
)

class HomeViewModel : ViewModel() {
    private val app = JalSakhiApp.instance
    private val _state = MutableStateFlow(HomeState())
    val state: StateFlow<HomeState> = _state

    init {
        _state.update { it.copy(userName = app.authStore.userName) }
        viewModelScope.launch { app.readingsRepo.pendingCount().collect { c -> _state.update { it.copy(pendingCount = c) } } }
        viewModelScope.launch { app.db.reminderDao().all().collect { rs -> _state.update { it.copy(unseenReminders = rs.count { !it.seen }) } } }
        viewModelScope.launch { computeNextDue() }
    }

    private suspend fun computeNextDue() {
        val qDao = app.db.qualityDao()
        val springs = app.db.springDao().all().first()
        if (springs.isEmpty()) return
        var earliest: LocalDate? = null
        for (s in springs) {
            val last = qDao.lastTestTime(s.id)
            val due = last?.let {
                Instant.ofEpochMilli(it).atZone(ZoneId.systemDefault()).toLocalDate().plusDays(90)
            } ?: LocalDate.now()
            if (earliest == null || due.isBefore(earliest)) earliest = due
        }
        _state.update { it.copy(nextDueLabel = earliest?.toString()) }
    }
}
