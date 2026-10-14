// SPDX-License-Identifier: MIT
package org.chirag.jalsakhi.ui.screens.setup

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.chirag.jalsakhi.BuildConfig
import org.chirag.jalsakhi.JalSakhiApp

@Composable
fun ServerSetupScreen(onDone: () -> Unit) {
    val store = remember { JalSakhiApp.instance.authStore }
    // First-launch default: any URL the admin chose at build time.
    // Debug builds default to http://10.0.2.2:8080 (Android emulator's host loopback),
    // so testers can just tap "Save" without typing anything.
    var url by remember {
        mutableStateOf(store.apiBaseUrl ?: BuildConfig.API_BASE_URL.ifBlank { "https://" })
    }
    var err by remember { mutableStateOf<String?>(null) }

    Scaffold { pad ->
        Column(
            Modifier.fillMaxSize().padding(pad).padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("CHIRAG Jal Sakhi", style = MaterialTheme.typography.titleLarge)
            Text("Server setup / सर्वर सेटअप", color = MaterialTheme.colorScheme.secondary)

            Spacer(Modifier.height(8.dp))
            Text(
                "Enter the CHIRAG server URL given to you by the administrator. " +
                    "Example: https://api.chirag.org\n\n" +
                    "व्यवस्थापक द्वारा दिया गया CHIRAG सर्वर URL दर्ज करें।",
                fontSize = 14.sp,
            )

            OutlinedTextField(
                value = url,
                onValueChange = { url = it.trim(); err = null },
                label = { Text("Server URL") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )

            err?.let { Text(it, color = MaterialTheme.colorScheme.error) }

            Button(
                onClick = {
                    val clean = url.trim().trimEnd('/')
                    if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
                        err = "URL must start with http:// or https://"
                    } else {
                        store.apiBaseUrl = clean
                        onDone()
                    }
                },
                enabled = url.length > 8,
                modifier = Modifier.fillMaxWidth().height(56.dp),
            ) { Text("Save & continue / सहेजें", fontWeight = FontWeight.SemiBold) }

            Spacer(Modifier.height(16.dp))
            Text(
                "You can change this later from the Settings menu.\n" +
                    "इसे बाद में सेटिंग्स से बदल सकते हैं।",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.secondary,
            )
        }
    }

    // Auto-skip if already configured (when this screen is reached via "Change server URL")
    LaunchedEffect(Unit) {
        if (store.hasServerUrl && (url == "https://" || url == BuildConfig.API_BASE_URL)) onDone()
    }
}
