// SPDX-License-Identifier: MIT
package org.chirag.jalsakhi.ui.screens.sync

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.chirag.jalsakhi.JalSakhiApp
import org.chirag.jalsakhi.export.ExcelExporter
import java.io.File

data class RecentRow(
    val id: String,
    val label: String,
    val recordedAt: Long,
    val synced: Boolean,
    val error: String?,
)

data class SyncState(
    val pending: Int = 0,
    val recent: List<RecentRow> = emptyList(),
    val exportedPath: String? = null,
)

class SyncViewModel : ViewModel() {
    private val app = JalSakhiApp.instance
    private val _state = MutableStateFlow(SyncState())
    val state: StateFlow<SyncState> = _state

    init {
        viewModelScope.launch {
            combine(
                app.db.dischargeDao().allDesc(),
                app.db.qualityDao().allDesc(),
                app.readingsRepo.pendingCount(),
            ) { d, q, pending ->
                val rows = (d.map { RecentRow(it.clientUuid, "Discharge · ${it.dischargeLpm} L/min", it.recordedAt, it.syncedAt != null, it.lastSyncError) } +
                    q.map { RecentRow(it.clientUuid, "Quality · pH ${it.ph ?: "-"}, TDS ${it.tds ?: "-"}", it.recordedAt, it.syncedAt != null, it.lastSyncError) })
                    .sortedByDescending { it.recordedAt }.take(50)
                SyncState(pending = pending, recent = rows, exportedPath = _state.value.exportedPath)
            }.collect { _state.value = it }
        }
    }

    /**
     * Builds the .xlsx in app-private storage, then immediately fires the system
     * Share sheet so the KRP can WhatsApp / email / Drive-upload the file in one tap.
     * No external storage permission needed — FileProvider grants the receiving app
     * read access to the single file via a content:// URI.
     */
    fun exportExcel(ctx: Context) = viewModelScope.launch {
        val path = withContext(Dispatchers.IO) { ExcelExporter.export(ctx, app.db) }
        _state.update { it.copy(exportedPath = path) }
        shareFile(ctx, File(path))
    }

    private fun shareFile(ctx: Context, file: File) {
        val authority = ctx.packageName + ".fileprovider"
        val uri = FileProvider.getUriForFile(ctx, authority, file)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_SUBJECT, "Jal Sakhi data export — ${file.name}")
            putExtra(Intent.EXTRA_TEXT,
                "CHIRAG Jal Sakhi data export\nजल साखी डेटा निर्यात\n\nFile: ${file.name}")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        val chooser = Intent.createChooser(intent, "Share Excel via / द्वारा भेजें").apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        ctx.startActivity(chooser)
    }
}
