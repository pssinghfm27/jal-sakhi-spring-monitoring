// SPDX-License-Identifier: MIT
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
}

android {
    namespace = "org.chirag.jalsakhi"
    compileSdk = 35

    defaultConfig {
        applicationId = "org.chirag.jalsakhi"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        vectorDrawables.useSupportLibrary = true
        // API base URL — override at build time with -PapiBaseUrl=https://api.chirag.example.org
        buildConfigField("String", "API_BASE_URL",
            "\"" + (project.findProperty("apiBaseUrl") as String? ?: "http://10.0.2.2:8080") + "\"")
        // Locale list: English + Hindi (default = system, falls back to en)
        resourceConfigurations += listOf("en", "hi")
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            // Signing config left to the developer; see README.
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        // Polyfill MethodHandle.invoke etc. so libraries like Apache POI (log4j-api)
        // can run on Android 7+ (minSdk 24) without bumping minSdk to 26.
        isCoreLibraryDesugaringEnabled = true
    }
    kotlinOptions { jvmTarget = "17" }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources.excludes += setOf(
            "META-INF/{AL2.0,LGPL2.1}",
            "META-INF/DEPENDENCIES",
            "META-INF/LICENSE*",
            "META-INF/NOTICE*",
            "META-INF/*.kotlin_module",
        )
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.material.icons.extended)
    implementation(libs.androidx.navigation.compose)

    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)

    implementation(libs.androidx.work.runtime)

    implementation(libs.androidx.camera.core)
    implementation(libs.androidx.camera.camera2)
    implementation(libs.androidx.camera.lifecycle)
    implementation(libs.androidx.camera.view)

    implementation(libs.play.services.location)

    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)
    implementation(libs.kotlinx.coroutines.android)
    // JSON parsing: using Android's built-in org.json (no extra dep needed).

    // Excel export uses a hand-rolled OOXML writer in export/ExcelExporter.kt —
    // ~150 LOC, no extra dependency. Saves ~1.6 MB vs Apache POI.

    implementation(libs.androidx.datastore.preferences)
    implementation(libs.androidx.security.crypto)

    // Core library desugaring runtime (used by isCoreLibraryDesugaringEnabled above)
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.2")
}
