// SPDX-License-Identifier: MIT
package org.chirag.jalsakhi.ui.screens.discharge

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import org.chirag.jalsakhi.R
import org.chirag.jalsakhi.camera.rememberPhotoLauncher

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewDischargeScreen(
    onDone: () -> Unit,
    vm: NewDischargeViewModel = viewModel(),
) {
    val state by vm.state.collectAsState()
    val ctx = LocalContext.current
    LaunchedEffect(Unit) { vm.startLocation() }
    LaunchedEffect(state.savedOk) { if (state.savedOk) onDone() }

    val (capture, photoFile) = rememberPhotoLauncher(ctx) { f -> vm.setPhoto(f) }

    Scaffold(topBar = { TopAppBar(title = { Text(stringResource(R.string.new_discharge)) }) }) { pad ->
        Column(
            Modifier.fillMaxSize().padding(pad).padding(16.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // GPS status
            when {
                state.gpsAccuracy == null -> Text(stringResource(R.string.gps_locking))
                state.gpsAccuracy!! > 20f -> Text(
                    stringResource(R.string.gps_too_poor),
                    color = MaterialTheme.colorScheme.error,
                )
                else -> {
                    val acc = state.gpsAccuracy ?: 0f
                    Text(
                        stringResource(R.string.gps_accuracy, acc),
                        color = MaterialTheme.colorScheme.secondary,
                    )
                }
            }

            // Spring picker
            var expanded by remember { mutableStateOf(false) }
            ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
                OutlinedTextField(
                    value = state.selectedSpringLabel ?: stringResource(R.string.select_spring),
                    onValueChange = {},
                    readOnly = true,
                    label = { Text(stringResource(R.string.spring)) },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                    modifier = Modifier.fillMaxWidth().menuAnchor(),
                )
                ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                    state.springs.forEach { s ->
                        DropdownMenuItem(
                            text = { Text("${s.nameHi}  ·  ${s.villageName ?: ""}") },
                            onClick = { vm.selectSpring(s); expanded = false },
                        )
                    }
                }
            }

            // Method
            Text(stringResource(R.string.method))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("v_notch" to R.string.method_v_notch, "volumetric" to R.string.method_volumetric, "float" to R.string.method_float).forEach { (id, label) ->
                    FilterChip(selected = state.method == id, onClick = { vm.setMethod(id) }, label = { Text(stringResource(label)) })
                }
            }

            OutlinedTextField(
                value = state.dischargeLpm,
                onValueChange = vm::setDischarge,
                label = { Text(stringResource(R.string.discharge_lpm)) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = state.durationSec,
                onValueChange = vm::setDuration,
                label = { Text(stringResource(R.string.duration_sec)) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )

            // Weather
            Text(stringResource(R.string.weather))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("dry" to R.string.weather_dry, "light_rain" to R.string.weather_light_rain, "heavy_rain" to R.string.weather_heavy_rain, "post_monsoon" to R.string.weather_post_monsoon).forEach { (id, label) ->
                    FilterChip(selected = state.weather == id, onClick = { vm.setWeather(id) }, label = { Text(stringResource(label)) })
                }
            }

            // Photo
            Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = capture) {
                    Text(stringResource(if (state.photoPath != null) R.string.retake_photo else R.string.take_photo))
                }
                if (state.photoPath != null) AssistChip(onClick = {}, label = { Text("✓ photo") })
            }
            if (state.photoMissing) Text(stringResource(R.string.photo_required), color = MaterialTheme.colorScheme.error)

            OutlinedTextField(
                value = state.notes,
                onValueChange = vm::setNotes,
                label = { Text(stringResource(R.string.notes)) },
                modifier = Modifier.fillMaxWidth().height(96.dp),
            )

            state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }

            Spacer(Modifier.height(8.dp))
            Button(
                onClick = vm::save,
                enabled = state.canSubmit,
                modifier = Modifier.fillMaxWidth().height(56.dp),
            ) { Text(stringResource(R.string.save)) }
        }
    }
}
