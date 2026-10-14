// SPDX-License-Identifier: MIT
package org.chirag.jalsakhi.ui.screens.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Opacity
import androidx.compose.material.icons.filled.Science
import androidx.compose.material.icons.filled.Place
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import org.chirag.jalsakhi.R

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onDischarge: () -> Unit,
    onQuality: () -> Unit,
    onSprings: () -> Unit,
    onSync: () -> Unit,
    onReminders: () -> Unit,
    onLogout: () -> Unit,
    vm: HomeViewModel = viewModel(),
) {
    val state by vm.state.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.app_name)) },
                actions = {
                    IconButton(onClick = onLogout) {
                        Icon(Icons.Filled.Logout, contentDescription = stringResource(R.string.logout))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    actionIconContentColor = MaterialTheme.colorScheme.onPrimary,
                ),
            )
        },
    ) { pad ->
        Column(
            Modifier.fillMaxSize().padding(pad).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // Greeting
            state.userName?.let {
                Text("Namaste, $it", style = MaterialTheme.typography.titleMedium)
            }
            state.nextDueLabel?.let { due ->
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondary)) {
                    Text(
                        text = stringResource(R.string.home_next_due, due),
                        color = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier.padding(12.dp),
                    )
                }
            }
            Spacer(Modifier.height(4.dp))

            BigButton(R.string.home_record_discharge, Icons.Filled.Opacity, onDischarge)
            BigButton(R.string.home_record_quality, Icons.Filled.Science, onQuality)
            BigButton(R.string.home_my_springs, Icons.Filled.Place, onSprings)

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MiniButton(Modifier.weight(1f), R.string.home_sync_status, Icons.Filled.Cloud, "${state.pendingCount}", onSync)
                MiniButton(Modifier.weight(1f), R.string.home_reminders, Icons.Filled.Notifications, "${state.unseenReminders}", onReminders)
            }
        }
    }
}

@Composable
private fun BigButton(textRes: Int, icon: ImageVector, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().height(72.dp),
        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
    ) {
        Icon(icon, contentDescription = null, modifier = Modifier.padding(end = 12.dp))
        Text(stringResource(textRes), style = MaterialTheme.typography.titleMedium)
    }
}

@Composable
private fun MiniButton(modifier: Modifier, textRes: Int, icon: ImageVector, badge: String, onClick: () -> Unit) {
    Card(
        modifier = modifier.height(80.dp),
        onClick = onClick,
    ) {
        Column(
            Modifier.fillMaxSize().padding(12.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(icon, contentDescription = null)
                Spacer(Modifier.padding(horizontal = 4.dp))
                Text(stringResource(textRes))
            }
            if (badge != "0") {
                Text(badge, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
            }
        }
    }
}
