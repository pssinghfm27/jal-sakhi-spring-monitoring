// SPDX-License-Identifier: MIT
package org.chirag.jalsakhi.ui.screens.login

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
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import org.chirag.jalsakhi.R

@Composable
fun LoginScreen(
    onLoggedIn: () -> Unit,
    onSignup: () -> Unit,
    onPending: (String) -> Unit,
    onChangeServer: () -> Unit = {},
    vm: LoginViewModel = viewModel(),
) {
    val state by vm.state.collectAsState()
    LaunchedEffect(state.success) { if (state.success) onLoggedIn() }
    LaunchedEffect(state.pendingMessage) {
        state.pendingMessage?.let(onPending)
    }

    Scaffold { pad ->
        Column(
            Modifier.fillMaxSize().padding(pad).padding(24.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text(stringResource(R.string.app_name), style = MaterialTheme.typography.titleLarge)
            Text(stringResource(R.string.tagline), color = MaterialTheme.colorScheme.secondary)
            Spacer(Modifier.height(8.dp))

            OutlinedTextField(
                value = state.identifier,
                onValueChange = vm::setIdentifier,
                label = { Text(stringResource(R.string.phone_label)) },
                placeholder = { Text("10-digit phone or email") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = state.password,
                onValueChange = vm::setPassword,
                label = { Text("Password / पासवर्ड") },
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )

            Button(
                onClick = vm::login,
                enabled = state.identifier.length >= 6 && state.password.length >= 6 && !state.loading,
                modifier = Modifier.fillMaxWidth().height(52.dp),
            ) {
                Text(if (state.loading) "Signing in…" else "Sign in / लॉगिन करें")
            }

            TextButton(onClick = onSignup, modifier = Modifier.fillMaxWidth()) {
                Text("New KRP? Create account / नया KRP? यहाँ रजिस्टर करें")
            }

            state.error?.let {
                Text(it, color = MaterialTheme.colorScheme.error)
            }

            Spacer(Modifier.height(16.dp))
            TextButton(onClick = onChangeServer, modifier = Modifier.fillMaxWidth()) {
                Text("Change server URL", color = MaterialTheme.colorScheme.secondary)
            }
        }
    }
}
