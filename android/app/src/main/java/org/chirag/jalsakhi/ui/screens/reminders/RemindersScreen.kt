// SPDX-License-Identifier: MIT
package org.chirag.jalsakhi.ui.screens.reminders

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.chirag.jalsakhi.JalSakhiApp
import org.chirag.jalsakhi.R
import androidx.lifecycle.ViewModel
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.MutableStateFlow
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch
import org.chirag.jalsakhi.data.local.entity.ReminderEntity

class RemindersViewModel : ViewModel() {
    private val _state = MutableStateFlow<List<ReminderEntity>>(emptyList())
    val state: StateFlow<List<ReminderEntity>> = _state
    init {
        viewModelScope.launch {
            JalSakhiApp.instance.db.reminderDao().all().collect { _state.value = it }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RemindersScreen(onBack: () -> Unit, vm: RemindersViewModel = viewModel()) {
    val items by vm.state.collectAsState()
    Scaffold(topBar = {
        TopAppBar(
            title = { Text(stringResource(R.string.reminders_title)) },
            navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, null) } },
        )
    }) { pad ->
        if (items.isEmpty()) {
            Column(Modifier.fillMaxSize().padding(pad).padding(16.dp)) {
                Text(stringResource(R.string.no_reminders))
            }
        } else {
            LazyColumn(
                Modifier.fillMaxSize().padding(pad).padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                items(items, key = { it.id }) { r ->
                    Card(Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(12.dp)) {
                            Text(r.kind.uppercase(), style = MaterialTheme.typography.titleMedium)
                            Text("Spring ${r.springId.take(8)} · due ${r.dueDate}", fontSize = 12.sp, color = MaterialTheme.colorScheme.secondary)
                        }
                    }
                }
            }
        }
    }
}
