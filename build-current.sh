#!/bin/bash

# Quick build script for current architecture only
# Useful for faster testing builds

set -e

./scripts/release-manager.sh --auto

CURRENT_ARCH=$(uname -m)

echo "🚀 Building Cora Novel App for current architecture..."
echo ""

if [ "$CURRENT_ARCH" = "arm64" ]; then
    echo "📦 Detected Apple Silicon (arm64)"
    echo "Building for aarch64-apple-darwin..."
    pnpm tauri build --target aarch64-apple-darwin
    echo ""
    echo "✅ Build complete!"
    echo "Output: src-tauri/target/aarch64-apple-darwin/release/bundle/"
elif [ "$CURRENT_ARCH" = "x86_64" ]; then
    echo "📦 Detected Intel (x86_64)"
    echo "Building for x86_64-apple-darwin..."
    pnpm tauri build --target x86_64-apple-darwin
    echo ""
    echo "✅ Build complete!"
    echo "Output: src-tauri/target/x86_64-apple-darwin/release/bundle/"
else
    echo "❌ Unknown architecture: $CURRENT_ARCH"
    exit 1
fi
