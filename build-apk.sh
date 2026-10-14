#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
#
# One-command build script for the Jal Sakhi APK.
#
# Usage:
#   ./build-apk.sh                              # debug APK, no server URL baked in
#                                                # (KRP picks URL at first launch)
#   ./build-apk.sh https://api.chirag.org       # release APK with default URL baked in
#   ./build-apk.sh --debug                      # explicit debug build
#
# Output: APK + adb-install instructions printed at the end.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
ANDROID_DIR="$ROOT/android"
DIST_DIR="$ROOT/dist"

# ────────── tool discovery ──────────
if [ -z "${JAVA_HOME:-}" ]; then
  # macOS Android Studio JBR
  AS_JBR="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  if [ -d "$AS_JBR" ]; then
    JAVA_HOME="$AS_JBR"
  elif command -v java >/dev/null; then
    # Try to resolve java path
    JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$(command -v java)" || command -v java)")")"
  fi
fi

if [ -z "${JAVA_HOME:-}" ] || [ ! -x "$JAVA_HOME/bin/java" ]; then
  echo "❌ JAVA_HOME is not set correctly. Install JDK 17+ or open Android Studio once." >&2
  exit 1
fi
export JAVA_HOME
export PATH="$JAVA_HOME/bin:$PATH"

ANDROID_SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
if [ ! -d "$ANDROID_SDK" ]; then
  echo "❌ Android SDK not found at $ANDROID_SDK. Set ANDROID_HOME." >&2
  exit 1
fi
export ANDROID_HOME="$ANDROID_SDK"

echo "✓ JAVA_HOME = $JAVA_HOME"
echo "✓ ANDROID_HOME = $ANDROID_HOME"

# ────────── parse args ──────────
MODE="debug"
URL=""
if [ $# -gt 0 ]; then
  case "$1" in
    --debug) MODE="debug" ;;
    --release) MODE="release" ;;
    http*://*) MODE="release"; URL="$1" ;;
    *) echo "Unknown arg: $1 (expected URL or --debug/--release)"; exit 1 ;;
  esac
fi

# ────────── ensure local.properties ──────────
echo "sdk.dir=$ANDROID_HOME" > "$ANDROID_DIR/local.properties"

# ────────── build ──────────
cd "$ANDROID_DIR"

GRADLE_ARGS=("-Dorg.gradle.jvmargs=-Xmx2048m")
if [ -n "$URL" ]; then
  GRADLE_ARGS+=("-PapiBaseUrl=$URL")
fi

if [ "$MODE" = "debug" ]; then
  echo ""
  echo "→ Building debug APK (no signing needed, OK for sharing during pilot)…"
  ./gradlew clean "${GRADLE_ARGS[@]}" :app:assembleDebug
  OUT="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
else
  echo ""
  echo "→ Building release APK with URL=$URL …"
  # Generate a keystore if there isn't one.
  KS="$ROOT/jalsakhi-release.jks"
  if [ ! -f "$KS" ]; then
    echo "  No release keystore found. Generating one at $KS"
    "$JAVA_HOME/bin/keytool" -genkeypair -v \
      -keystore "$KS" -storepass jalsakhi -keypass jalsakhi \
      -alias jalsakhi -keyalg RSA -keysize 2048 -validity 10000 \
      -dname "CN=CHIRAG, OU=Springshed, O=CHIRAG, L=Almora, ST=Uttarakhand, C=IN"
  fi
  ./gradlew clean "${GRADLE_ARGS[@]}" :app:assembleRelease

  RAW="$ANDROID_DIR/app/build/outputs/apk/release/app-release-unsigned.apk"
  if [ ! -f "$RAW" ]; then
    echo "❌ release APK not produced — check the gradle log above"; exit 1
  fi

  # Find build tools
  BUILD_TOOLS_VER=$(ls "$ANDROID_HOME/build-tools" | sort -V | tail -1)
  ZIPALIGN="$ANDROID_HOME/build-tools/$BUILD_TOOLS_VER/zipalign"
  APKSIGNER="$ANDROID_HOME/build-tools/$BUILD_TOOLS_VER/apksigner"

  # Zipalign
  ALIGNED="$ANDROID_DIR/app/build/outputs/apk/release/app-release-aligned.apk"
  if [ -x "$ZIPALIGN" ]; then
    echo "→ Aligning APK..."
    "$ZIPALIGN" -f -v 4 "$RAW" "$ALIGNED"
    SIGN_TARGET="$ALIGNED"
  else
    echo "⚠️ zipalign not found at $ZIPALIGN, skipping optimization..."
    SIGN_TARGET="$RAW"
  fi

  # Sign
  if [ ! -x "$APKSIGNER" ]; then
    echo "❌ apksigner not found at $APKSIGNER"; exit 1
  fi
  OUT="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
  "$APKSIGNER" sign --ks "$KS" --ks-pass pass:jalsakhi --key-pass pass:jalsakhi \
    --out "$OUT" "$SIGN_TARGET"
  "$APKSIGNER" verify "$OUT"
fi

# ────────── copy to dist/ ──────────
mkdir -p "$DIST_DIR"
STAMP=$(date +%Y%m%d-%H%M)
DEST="$DIST_DIR/jalsakhi-$MODE-$STAMP.apk"
cp "$OUT" "$DEST"

# Also copy mapping file if it exists (for release)
MAPPING="$ANDROID_DIR/app/build/outputs/mapping/release/mapping.txt"
if [ "$MODE" = "release" ] && [ -f "$MAPPING" ]; then
  cp "$MAPPING" "$DIST_DIR/jalsakhi-release-$STAMP-mapping.txt"
  echo "✓ Mapping file saved: jalsakhi-release-$STAMP-mapping.txt"
fi

SIZE_KB=$(du -k "$DEST" | awk '{print $1}')
echo ""
echo "════════════════════════════════════════════════════════════"
echo "✓ APK ready:"
echo "    $DEST"
echo "    ${SIZE_KB} KB ($((SIZE_KB / 1024)) MB)"
echo ""
echo "Share via:"
echo "  • WhatsApp / Telegram — just send the .apk file"
echo "  • adb install \"$DEST\"   (KRP phone connected via USB)"
echo "  • Email or Bluetooth"
echo ""
if [ -z "$URL" ]; then
  echo "ℹ KRP will be asked for the server URL at first launch."
else
  echo "ℹ Server URL baked in: $URL"
fi
echo "════════════════════════════════════════════════════════════"
