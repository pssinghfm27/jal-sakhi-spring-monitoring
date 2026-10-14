// SPDX-License-Identifier: MIT
package org.chirag.jalsakhi.ui.screens.quality

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
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import org.chirag.jalsakhi.R
import org.chirag.jalsakhi.camera.rememberPhotoLauncher
import org.chirag.jalsakhi.ui.theme.ChiragAlert
import org.chirag.jalsakhi.ui.theme.ChiragPrimary
import org.chirag.jalsakhi.ui.theme.ChiragWarning
import org.chirag.jalsakhi.util.Bis
import org.chirag.jalsakhi.util.BisClass

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewQualityScreen(
    onDone: () -> Unit,
    vm: NewQualityViewModel = viewModel(),
) {
    val state by vm.state.collectAsState()
    val ctx = LocalContext.current
    LaunchedEffect(Unit) { vm.startLocation() }
    LaunchedEffect(state.savedOk) { if (state.savedOk) onDone() }

    val (capture, _) = rememberPhotoLauncher(ctx) { f -> vm.setPhoto(f) }

    Scaffold(topBar = { TopAppBar(title = { Text(stringResource(R.string.new_quality)) }) }) { pad ->
        Column(
            Modifier.fillMaxSize().padding(pad).padding(16.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            // Spring dropdown
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
                        DropdownMenuItem(text = { Text("${s.nameHi}  ·  ${s.villageName ?: ""}") }, onClick = { vm.selectSpring(s); expanded = false })
                    }
                }
            }

            // 8 parameter fields
            ParamField("ph", state.ph, vm::setPh, "pH")
            ParamField("tds", state.tds, vm::setTds, "TDS (mg/L)")
            ParamField("turbidity", state.turbidity, vm::setTurb, "Turbidity (NTU)")
            ParamField("hardness", state.hardness, vm::setHard, "Hardness (mg/L)")
            ParamField("alkalinity", state.alkalinity, vm::setAlk, "Alkalinity (mg/L)")
            ParamField("chloride", state.chloride, vm::setCl, "Chloride (mg/L)")
            ParamField("iron", state.iron, vm::setIron, "Iron (mg/L)")
            ParamField("fecal_coliform", state.fecal, vm::setFecal, "Fecal Coliform (MPN/100ml)", isInt = true)

            Spacer(Modifier.height(8.dp))
            OutlinedTextField(value = state.kitBatch, onValueChange = vm::setKitBatch, label = { Text(stringResource(R.string.kit_batch)) }, singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = state.kitExpiry, onValueChange = vm::setKitExpiry, label = { Text(stringResource(R.string.kit_expiry)) }, singleLine = true, modifier = Modifier.fillMaxWidth())
            if (state.kitExpired) Text(stringResource(R.string.kit_expired), color = MaterialTheme.colorScheme.error)

            // Photo
            Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = capture) {
                    Text(stringResource(if (state.photoPath != null) R.string.retake_photo else R.string.take_photo))
                }
                if (state.photoPath != null) AssistChip(onClick = {}, label = { Text("✓ photo") })
            }
            if (state.photoMissing) Text(stringResource(R.string.photo_required), color = MaterialTheme.colorScheme.error)

            state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }

            Spacer(Modifier.height(8.dp))
            Button(onClick = vm::save, enabled = state.canSubmit, modifier = Modifier.fillMaxWidth().height(56.dp)) {
                Text(stringResource(R.string.save))
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ParamField(param: String, value: String, onChange: (String) -> Unit, label: String, isInt: Boolean = false) {
    val cls = Bis.classify(param, value.toDoubleOrNull())
    val colour = when (cls) {
        BisClass.GREEN -> ChiragPrimary
        BisClass.AMBER -> ChiragWarning
        BisClass.RED -> ChiragAlert
        BisClass.UNKNOWN -> Color.Unspecified
    }
    Column {
        OutlinedTextField(
            value = value,
            onValueChange = { v ->
                val clean = if (isInt) v.filter { it.isDigit() } else v.filter { c -> c.isDigit() || c == '.' }
                onChange(clean)
            },
            label = { Text(label) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = if (isInt) KeyboardType.Number else KeyboardType.Decimal),
            modifier = Modifier.fillMaxWidth(),
        )
        Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
            AssistChip(
                onClick = {},
                label = { Text("BIS: ${Bis.rangeLabel(param)}") },
                colors = AssistChipDefaults.assistChipColors(
                    containerColor = if (cls == BisClass.UNKNOWN) MaterialTheme.colorScheme.surface else colour.copy(alpha = 0.15f),
                    labelColor = if (cls == BisClass.UNKNOWN) MaterialTheme.colorScheme.onSurface else colour,
                ),
            )
        }
    }
}
