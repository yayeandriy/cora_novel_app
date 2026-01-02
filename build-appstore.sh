#!/bin/bash

# Build script for macOS App Store submission
# This script builds Cora for the App Store with proper configuration

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}🍎 Building Cora for macOS App Store${NC}"
echo "======================================"
echo ""

# Check if required files exist
if [ ! -f "src-tauri/Entitlements.plist" ]; then
    echo -e "${RED}❌ Error: Entitlements.plist not found${NC}"
    echo "Please ensure src-tauri/Entitlements.plist exists"
    exit 1
fi

if [ ! -f "src-tauri/tauri.appstore.conf.json" ]; then
    echo -e "${RED}❌ Error: tauri.appstore.conf.json not found${NC}"
    echo "Please ensure src-tauri/tauri.appstore.conf.json exists"
    exit 1
fi

# Check for YOUR_TEAM_ID placeholder
if grep -q "YOUR_TEAM_ID" src-tauri/Entitlements.plist; then
    echo -e "${YELLOW}⚠️  Warning: YOUR_TEAM_ID placeholder found in Entitlements.plist${NC}"
    echo "Please replace YOUR_TEAM_ID with your actual Apple Team ID"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Detect architecture
CURRENT_ARCH=$(uname -m)
echo -e "${BLUE}Current architecture: ${CURRENT_ARCH}${NC}"
echo ""

# Choose build target
echo "Select build target:"
echo "1) Universal Binary (recommended - supports both Intel and Apple Silicon)"
echo "2) Apple Silicon only (aarch64)"
echo "3) Intel only (x86_64)"
echo ""
read -p "Enter choice (1-3) [1]: " choice
choice=${choice:-1}

case $choice in
    1)
        TARGET="universal-apple-darwin"
        TARGET_DIR="universal-apple-darwin"
        echo -e "${GREEN}Building Universal Binary...${NC}"
        ;;
    2)
        TARGET="aarch64-apple-darwin"
        TARGET_DIR="aarch64-apple-darwin"
        echo -e "${GREEN}Building for Apple Silicon...${NC}"
        ;;
    3)
        TARGET="x86_64-apple-darwin"
        TARGET_DIR="x86_64-apple-darwin"
        echo -e "${GREEN}Building for Intel...${NC}"
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${BLUE}📦 Building frontend...${NC}"
pnpm build

echo ""
echo -e "${BLUE}📦 Building app bundle...${NC}"
pnpm tauri build --bundles app --target $TARGET --config ./src-tauri/tauri.appstore.conf.json

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Build complete!${NC}"
    echo ""
    echo "App bundle location:"
    echo "  src-tauri/target/$TARGET_DIR/release/bundle/macos/Cora.app"
    echo ""
    
    # Check if code signing succeeded
    APP_PATH="src-tauri/target/$TARGET_DIR/release/bundle/macos/Cora.app"
    if [ -d "$APP_PATH" ]; then
        echo -e "${BLUE}🔍 Verifying code signature...${NC}"
        codesign -vvv --deep --strict "$APP_PATH" 2>&1 | head -5
        echo ""
        
        echo -e "${BLUE}📋 Next steps:${NC}"
        echo ""
        echo "1. Create signed PKG installer:"
        echo ""
        echo "   xcrun productbuild \\"
        echo "     --sign \"3rd Party Mac Developer Installer: Your Name (TEAM_ID)\" \\"
        echo "     --component \"$APP_PATH\" \\"
        echo "     /Applications \\"
        echo "     Cora.pkg"
        echo ""
        echo "2. Upload to App Store:"
        echo ""
        echo "   xcrun altool --upload-app --type macos --file Cora.pkg \\"
        echo "     --apiKey \$APPLE_API_KEY_ID --apiIssuer \$APPLE_API_ISSUER"
        echo ""
        echo "Or use Transporter app (easier): https://apps.apple.com/app/transporter/id1450874784"
        echo ""
        echo -e "${BLUE}📚 Documentation:${NC} docs/APP_STORE_DEPLOYMENT.md"
    fi
else
    echo ""
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo ""
