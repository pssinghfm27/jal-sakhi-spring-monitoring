// SPDX-License-Identifier: MIT
package org.chirag.jalsakhi.camera

import android.content.Context
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.core.content.FileProvider
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object CaptureFiles {
    fun newPhotoFile(ctx: Context): File {
        val dir = File(ctx.filesDir, "captures").apply { mkdirs() }
        val stamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        return File(dir, "photo_$stamp.jpg")
    }
    fun newVoiceFile(ctx: Context): File {
        val dir = File(ctx.filesDir, "captures").apply { mkdirs() }
        val stamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        return File(dir, "voice_$stamp.3gp")
    }
    fun uriFor(ctx: Context, f: File): Uri =
        FileProvider.getUriForFile(ctx, ctx.packageName + ".fileprovider", f)
}

@Composable
fun rememberPhotoLauncher(
    ctx: Context,
    onResult: (File?) -> Unit,
): Pair<() -> Unit, File?> {
    val file = remember { CaptureFiles.newPhotoFile(ctx) }
    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.TakePicture(),
    ) { success -> onResult(if (success) file else null) }
    return Pair({ launcher.launch(CaptureFiles.uriFor(ctx, file)) }, file)
}
