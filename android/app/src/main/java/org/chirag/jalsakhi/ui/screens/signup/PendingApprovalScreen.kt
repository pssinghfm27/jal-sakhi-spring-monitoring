// SPDX-License-Identifier: MIT
package org.chirag.jalsakhi.ui.screens.signup

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun PendingApprovalScreen(message: String, onBackToLogin: () -> Unit) {
    Scaffold { pad ->
        Box(Modifier.fillMaxSize().padding(pad).padding(24.dp), contentAlignment = Alignment.Center) {
            Column(
                Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Text("⏳", fontSize = 72.sp)
                Text(
                    "Waiting for manager approval",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.SemiBold,
                    textAlign = TextAlign.Center,
                )
                Text(
                    "मैनेजर की अनुमति का इंतज़ार है",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.secondary,
                    textAlign = TextAlign.Center,
                )
                Text(
                    message,
                    style = MaterialTheme.typography.bodyLarge,
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    "Try logging in again later.\nबाद में फिर से लॉगिन करें।",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.secondary,
                    textAlign = TextAlign.Center,
                )
                Button(onClick = onBackToLogin, modifier = Modifier.fillMaxWidth()) {
                    Text("Back to login / वापस लॉगिन")
                }
            }
        }
    }
}
