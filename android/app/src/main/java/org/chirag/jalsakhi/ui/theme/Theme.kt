// SPDX-License-Identifier: MIT
package org.chirag.jalsakhi.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

private val LightColors = lightColorScheme(
    primary = ChiragPrimary,
    onPrimary = ChiragSurface,
    secondary = ChiragWaterBlue,
    background = ChiragBg,
    surface = ChiragSurface,
    onBackground = ChiragOnSurface,
    onSurface = ChiragOnSurface,
    error = ChiragAlert,
)

// Large, readable type — KRPs use this in the field, often on small low-end screens.
private val ChiragTypography = Typography(
    titleLarge = TextStyle(fontSize = 24.sp, fontWeight = FontWeight.SemiBold),
    titleMedium = TextStyle(fontSize = 18.sp, fontWeight = FontWeight.SemiBold),
    bodyLarge = TextStyle(fontSize = 17.sp),
    bodyMedium = TextStyle(fontSize = 15.sp),
    labelLarge = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Medium),
)

@Composable
fun JalSakhiTheme(content: @Composable () -> Unit) {
    @Suppress("UNUSED_VARIABLE") val dark = isSystemInDarkTheme() // hook for future dark theme
    MaterialTheme(colorScheme = LightColors, typography = ChiragTypography, content = content)
}
