# Jal Sakhi — Android KRP app

Kotlin + Jetpack Compose, offline-first, Hindi-first.

## Status

**Built in this turn:**
- ✅ Full Gradle project (version catalogue, root + app build files, gradle.properties).
- ✅ AndroidManifest with permissions, FileProvider, network security config.
- ✅ Theme + colours + Hindi (Devanagari) and English string resources.
- ✅ Room DB: 5 entities, 5 DAOs.
- ✅ OkHttp + kotlinx-serialization API client (no Retrofit — smaller APK).
- ✅ Encrypted JWT storage (EncryptedSharedPreferences).
- ✅ FusedLocation streaming (callback-flow), 20 m accuracy gate.
- ✅ CameraX-via-Intent photo capture (no full CameraX UI — saves ~2 MB).
- ✅ WorkManager periodic + on-demand sync, exponential backoff.
- ✅ All 7 screens: Login, Home, NewDischarge, NewQuality, MySprings (with sparkline), Sync, Reminders.
- ✅ BIS classifier mirroring backend (`util/Bis.kt`).
- ✅ Apache POI Excel exporter (Discharge / Quality / Metadata sheets) → `files/exports/jalsakhi_YYYYMMDD_HHMMSS.xlsx`.
- ✅ R8 + resource shrinking + tailored ProGuard keep rules.

**Tested:** This code has **not** been compiled in this session (no Android SDK locally). Treat as v0 — expect a few small import/typing fixes on first `./gradlew assembleDebug`.

## Build

### Prerequisites
- JDK 17
- Android SDK with API 34 (`compileSdk = 34`)
- Set `ANDROID_HOME` or `local.properties → sdk.dir=/path/to/Android/sdk`

### Generate the Gradle wrapper
```bash
cd android
# Use any Gradle 8.7+ on PATH for this one-off:
gradle wrapper --gradle-version 8.7
```

### Debug APK (points at emulator host `10.0.2.2:8080`)
```bash
./gradlew :app:assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk
```

### Release APK against your CHIRAG server
```bash
./gradlew :app:assembleRelease -PapiBaseUrl=https://api.chirag.example.org
# Output: app/build/outputs/apk/release/app-release-unsigned.apk
# Sign with your key:
apksigner sign --ks <keystore> --out jalsakhi-0.1.0.apk app-release-unsigned.apk
```

## APK size

The dependency stack is chosen specifically to land under 15 MB:

| Cut | Approx size |
|---|---|
| Compose BOM + Material3 + nav | ~6 MB |
| Room | ~0.5 MB |
| WorkManager | ~0.3 MB |
| CameraX (camera-view) — used for previewing only via intent today | ~0.5 MB |
| Play-services-location | ~0.4 MB |
| OkHttp + kotlinx-serialization | ~0.9 MB |
| **POI (`poi-ooxml-lite`)** | ~1.6 MB ← biggest single piece |
| Coroutines + lifecycle | ~0.6 MB |
| App code + resources | ~0.5 MB |
| **Total est. (after R8 + shrinkResources)** | **~12-14 MB** |

If you need to drop below 10 MB: replace POI with a hand-rolled XLSX writer (XLSX is a ZIP of small XML files — ~250 LOC for the subset we use). The interface in [`ExcelExporter.kt`](app/src/main/java/org/chirag/jalsakhi/export/ExcelExporter.kt) is one method, so it's a clean swap.

## Architecture

```
JalSakhiApp (Application)
   ├── AppDb (Room)
   ├── AuthStore (Encrypted prefs)
   ├── ApiClient (OkHttp)
   ├── AuthRepo / SpringsRepo / ReadingsRepo
   └── SyncManager → WorkManager → SyncWorker

UI: single-Activity MVVM
   MainActivity → AppNav (Navigation Compose)
     ├── LoginScreen + VM
     ├── HomeScreen + VM
     ├── NewDischargeScreen + VM     (GPS gate, photo intent, weather/method chips)
     ├── NewQualityScreen + VM       (8 params w/ inline BIS green/amber/red)
     ├── MySpringsScreen + VM        (per-spring discharge sparkline)
     ├── SyncStatusScreen + VM       (pending count, sync now, Excel export)
     └── RemindersScreen + VM
```

### Offline-first contract

1. Every screen writes to Room before doing anything else.
2. `ReadingsRepo.saveXLocal()` returns immediately — never blocks on network.
3. `SyncManager.syncNow()` (and the 2-hour periodic worker) drains the pending queue.
4. Each row has a `client_uuid` so the backend dedupes on retry.
5. Failed syncs store `lastSyncError` for display in the Sync screen.

### What's deliberately *not* in this v0
- **In-app push notifications.** Reminders are server-side SMS only for now. Adding FCM later is a clean add (token endpoint exists in the spec; backend dispatch is the only TODO).
- **Voice notes.** UI surface is wired but the actual recorder Composable is a follow-up (~80 LOC; `MediaRecorder` + a hold-to-record button).
- **Spring detail screen.** Sparklines per spring live on `MySpringsScreen`; a dedicated detail page with 4-quality sparklines is a follow-up.

## Connecting to the backend

- **Emulator**: default `API_BASE_URL=http://10.0.2.2:8080` (host's localhost).
- **Real device on same Wi-Fi as backend**: build with `-PapiBaseUrl=http://192.168.x.y:8080`. Update `network_security_config.xml` to allow that domain in cleartext, OR put a self-signed cert on the server.
- **Production**: `-PapiBaseUrl=https://api.chirag.example.org`. HTTPS required.

## Demo login

The seed script creates `+919999900001` as a KRP for the village `Lakhmar`. Request OTP, look at the backend container logs (`docker compose logs api`) for the printed code in dev mode, enter it in the app.
