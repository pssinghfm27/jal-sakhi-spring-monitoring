// SPDX-License-Identifier: MIT
package org.chirag.jalsakhi.ui.screens.sync

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
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
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import org.chirag.jalsakhi.JalSakhiApp
import org.chirag.jalsakhi.R
import org.chirag.jalsakhi.export.ExcelExporter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SyncStatusScreen(onBack: () -> Unit, vm: SyncViewModel = viewModel()) {
    val state by vm.state.collectAsState()
    val ctx = LocalContext.current
    val fmt = remember { SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US) }

    Scaffold(topBar = {
        TopAppBar(
            title = { Text(stringResource(R.string.home_sync_status)) },
            navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, null) } },
        )
    }) { pad ->
        Column(
            Modifier.fillMaxSize().padding(pad).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(stringResource(R.string.sync_pending, state.pending), style = MaterialTheme.typography.titleMedium)
            Button(onClick = { JalSakhiApp.instance.sync.syncNow() }, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.sync_now))
            }
            Button(
                onClick = { vm.exportExcel(ctx) },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Export Excel & Share / निर्यात और भेजें") }
            state.exportedPath?.let {
                Text(
                    "✓ Ready — choose WhatsApp / Email to send the file.\n" +
                        "✓ तैयार — फ़ाइल भेजने के लिए WhatsApp / Email चुनें।",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.secondary,
                )
            }

            Text("Recent local records", style = MaterialTheme.typography.titleMedium)
            LazyColumn(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                items(state.recent, key = { it.id }) { row ->
                    Card(Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(8.dp)) {
                            Text(row.label)
                            Text(
                                "${fmt.format(Date(row.recordedAt))} · ${if (row.synced) "synced" else "pending"}",
                                fontSize = 12.sp,
                                color = if (row.synced) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.error,
                            )
                            row.error?.let { Text("Error: $it", fontSize = 11.sp, color = MaterialTheme.colorScheme.error) }
                        }
                    }
                }
            }
        }
    }
}
