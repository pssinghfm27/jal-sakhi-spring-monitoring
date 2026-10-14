// SPDX-License-Identifier: MIT
package org.chirag.jalsakhi

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import org.chirag.jalsakhi.ui.nav.AppNav
import org.chirag.jalsakhi.ui.theme.JalSakhiTheme

@Suppress("InvalidFragmentVersionForActivityResult")
class MainActivity : ComponentActivity() {

    private val perms = arrayOf(
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.CAMERA,
        Manifest.permission.RECORD_AUDIO,
    ).let { if (Build.VERSION.SDK_INT >= 33) it + Manifest.permission.POST_NOTIFICATIONS else it }

    private val askPerms = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {}

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val missing = perms.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) askPerms.launch(missing.toTypedArray())

        setContent {
            JalSakhiTheme { AppNav() }
        }
    }
}
