// SPDX-License-Identifier: MIT
package org.chirag.jalsakhi.ui.screens.springs

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import org.chirag.jalsakhi.JalSakhiApp
import org.chirag.jalsakhi.data.local.entity.DischargeReadingEntity
import org.chirag.jalsakhi.data.local.entity.SpringEntity
import org.chirag.jalsakhi.ui.theme.ChiragWaterBlue

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MySpringsScreen(onBack: () -> Unit, vm: MySpringsViewModel = viewModel()) {
    val state by vm.state.collectAsState()
    val cache = remember { mutableStateMapOf<String, List<DischargeReadingEntity>>() }

    Scaffold(topBar = {
        TopAppBar(
            title = { Text("My Springs") },
            navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, null) } },
        )
    }) { pad ->
        LazyColumn(
            Modifier.fillMaxSize().padding(pad).padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            items(state.springs, key = { it.id }) { s ->
                LaunchedEffect(s.id) {
                    if (!cache.containsKey(s.id)) cache[s.id] = vm.lastDischargesFor(s.id)
                }
                SpringCard(s, cache[s.id].orEmpty())
            }
        }
    }
}

@Composable
private fun SpringCard(s: SpringEntity, recent: List<DischargeReadingEntity>) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp)) {
            Text(s.nameHi, style = MaterialTheme.typography.titleMedium)
            Text("${s.nameEn} · ${s.villageName ?: ""} · ${s.block ?: ""}", fontSize = 12.sp, color = MaterialTheme.colorScheme.secondary)
            Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                Box(Modifier.weight(1f)) { Sparkline(recent.map { it.dischargeLpm }) }
                Text(
                    text = recent.firstOrNull()?.let { "${"%.1f".format(it.dischargeLpm)} L/min" } ?: "—",
                    color = ChiragWaterBlue,
                    style = MaterialTheme.typography.titleMedium,
                )
            }
        }
    }
}

@Composable
private fun Sparkline(values: List<Float>) {
    Canvas(Modifier.fillMaxWidth().height(40.dp)) {
        if (values.size < 2) return@Canvas
        val maxV = values.max()
        val minV = values.min()
        val span = (maxV - minV).coerceAtLeast(0.0001f)
        val w = size.width
        val h = size.height
        val step = w / (values.size - 1)
        val path = Path()
        values.forEachIndexed { i, v ->
            val x = i * step
            val y = h - ((v - minV) / span) * h
            if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        drawPath(path, ChiragWaterBlue, style = androidx.compose.ui.graphics.drawscope.Stroke(width = 3f))
        drawCircle(ChiragWaterBlue, radius = 4f, center = Offset((values.size - 1) * step, h - ((values.last() - minV) / span) * h))
    }
}
