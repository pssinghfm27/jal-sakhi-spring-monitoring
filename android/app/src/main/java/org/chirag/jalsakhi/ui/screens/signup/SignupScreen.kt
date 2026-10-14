// SPDX-License-Identifier: MIT
package org.chirag.jalsakhi.ui.screens.signup

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SignupScreen(
    onDone: (String) -> Unit,
    onBack: () -> Unit,
    vm: SignupViewModel = viewModel(),
) {
    val state by vm.state.collectAsState()
    LaunchedEffect(state.successMessage) {
        state.successMessage?.let(onDone)
    }

    Scaffold(topBar = {
        TopAppBar(
            title = { Text("Sign up / रजिस्टर") },
            navigationIcon = {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
                }
            },
        )
    }) { pad ->
        Column(
            Modifier.fillMaxSize().padding(pad).padding(20.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                "Fill this form. CHIRAG manager will review and approve your account.\n" +
                    "यह फॉर्म भरें। CHIRAG प्रबंधक आपकी अनुमति देगा।",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.secondary,
            )

            OutlinedTextField(
                value = state.name, onValueChange = vm::setName,
                label = { Text("Full name / पूरा नाम") },
                singleLine = true, modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = state.phone, onValueChange = vm::setPhone,
                label = { Text("Mobile number / मोबाइल नंबर") },
                placeholder = { Text("10-digit number") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                singleLine = true, modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = state.password, onValueChange = vm::setPassword,
                label = { Text("Password (min 6) / पासवर्ड") },
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                singleLine = true, modifier = Modifier.fillMaxWidth(),
            )

            // Village dropdown
            var open by remember { mutableStateOf(false) }
            ExposedDropdownMenuBox(expanded = open, onExpandedChange = { open = it }) {
                OutlinedTextField(
                    value = state.selectedVillageLabel ?: "Select your village / गाँव चुनें",
                    onValueChange = {}, readOnly = true,
                    label = { Text("Village / गाँव") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = open) },
                    modifier = Modifier.fillMaxWidth().menuAnchor(),
                )
                ExposedDropdownMenu(expanded = open, onDismissRequest = { open = false }) {
                    if (state.loadingVillages) {
                        DropdownMenuItem(text = { Text("Loading…") }, onClick = {})
                    } else if (state.villages.isEmpty()) {
                        DropdownMenuItem(text = { Text("(No villages — check server URL)") }, onClick = {})
                    } else {
                        state.villages.forEach { v ->
                            DropdownMenuItem(
                                text = { Text("${v.name} · ${v.block ?: ""}") },
                                onClick = { vm.selectVillage(v); open = false },
                            )
                        }
                    }
                }
            }

            OutlinedTextField(
                value = state.note, onValueChange = vm::setNote,
                label = { Text("Note for manager (optional) / प्रबंधक के लिए टिप्पणी") },
                modifier = Modifier.fillMaxWidth().height(96.dp),
            )

            state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }

            Spacer(Modifier.height(8.dp))
            Button(
                onClick = vm::submit,
                enabled = state.canSubmit && !state.loading,
                modifier = Modifier.fillMaxWidth().height(52.dp),
            ) {
                Text(if (state.loading) "Submitting…" else "Submit / जमा करें")
            }
        }
    }
}
