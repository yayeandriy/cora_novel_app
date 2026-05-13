#!/bin/bash

# Quick build script for current architecture only
# Useful for faster testing builds

set -e

./scripts/release-manager.sh --auto

CURRENT_ARCH=$(uname -m)

echo "🚀 Building Cora Novel App for current architecture..."
echo ""

SIGNING_IDENTITY="58A68059DD87DC8AC8568E110D52203A712FBC1A"
PROFILE_SRC="src-tauri/Cora.mobileprovision"
ENTITLEMENTS="src-tauri/Entitlements.plist"

inject_profile_and_resign_bundle() {
    local APP="$1"
    if [[ ! -f "$PROFILE_SRC" ]]; then return; fi

    echo "📋 Injecting provisioning profile..."
    cp "$PROFILE_SRC" "$APP/Contents/embedded.provisionprofile"

    # Re-sign using the exact same command sequence Tauri uses:
    # 1. Sign binary with entitlements + runtime option
    # 2. Sign outer bundle with entitlements + runtime option
    echo "✍️  Re-signing with Tauri-compatible commands..."
    codesign --force -s "$SIGNING_IDENTITY" \
        --options runtime \
        --entitlements "$ENTITLEMENTS" \
        "$APP/Contents/MacOS/cora"
    codesign --force -s "$SIGNING_IDENTITY" \
        --options runtime \
        --entitlements "$ENTITLEMENTS" \
        "$APP"

    echo "🔍 Verifying..."
    codesign --verify --deep --strict "$APP" 2>&1 && echo "✅ Signature valid." || echo "❌ Signature invalid!"
}

if [ "$CURRENT_ARCH" = "arm64" ]; then
    echo "📦 Detected Apple Silicon (arm64)"
    echo "Building for aarch64-apple-darwin..."
    pnpm tauri build --target aarch64-apple-darwin --bundles app
    inject_profile_and_resign_bundle "src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Cora.app"
    echo ""
    echo "✅ Build complete!"
    echo "Output: src-tauri/target/aarch64-apple-darwin/release/bundle/"
elif [ "$CURRENT_ARCH" = "x86_64" ]; then
    echo "📦 Detected Intel (x86_64)"
    echo "Building for x86_64-apple-darwin..."
    pnpm tauri build --target x86_64-apple-darwin --bundles app
    sign_app "src-tauri/target/x86_64-apple-darwin/release/bundle/macos/Cora.app"
    echo ""
    echo "✅ Build complete!"
    echo "Output: src-tauri/target/x86_64-apple-darwin/release/bundle/"
else
    echo "❌ Unknown architecture: $CURRENT_ARCH"
    exit 1
fi
