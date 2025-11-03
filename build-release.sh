#!/bin/bash

# Build script for Cora Novel App production releases
# Builds for both Apple Silicon (aarch64) and Intel (x86_64) macOS

set -e

echo "🚀 Building Cora Novel App production releases..."
echo ""

# Get current architecture
CURRENT_ARCH=$(uname -m)
echo "Current architecture: $CURRENT_ARCH"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Build for Apple Silicon (aarch64)
echo -e "${BLUE}📦 Building for Apple Silicon (aarch64-apple-darwin)...${NC}"
pnpm tauri build --target aarch64-apple-darwin
echo -e "${GREEN}✅ Apple Silicon build complete!${NC}"
echo ""

# Build for Intel (x86_64)
echo -e "${BLUE}📦 Building for Intel (x86_64-apple-darwin)...${NC}"
pnpm tauri build --target x86_64-apple-darwin
echo -e "${GREEN}✅ Intel build complete!${NC}"
echo ""

# Build Universal Binary (optional - contains both architectures)
echo -e "${BLUE}📦 Building Universal Binary (both architectures)...${NC}"
pnpm tauri build --target universal-apple-darwin
echo -e "${GREEN}✅ Universal build complete!${NC}"
echo ""

echo -e "${GREEN}🎉 All builds completed successfully!${NC}"
echo ""
echo "Build artifacts are located in:"
echo "  - src-tauri/target/aarch64-apple-darwin/release/"
echo "  - src-tauri/target/x86_64-apple-darwin/release/"
echo "  - src-tauri/target/universal-apple-darwin/release/"
echo ""
echo "DMG installers and app bundles are in:"
echo "  - src-tauri/target/aarch64-apple-darwin/release/bundle/"
echo "  - src-tauri/target/x86_64-apple-darwin/release/bundle/"
echo "  - src-tauri/target/universal-apple-darwin/release/bundle/"
