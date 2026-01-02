#!/bin/bash

# Create signed PKG installer for App Store submission
# This script packages the built app into a signed PKG file

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${BLUE}📦 Creating App Store PKG Installer${NC}"
echo "======================================"
echo ""

# Detect available app bundles
UNIVERSAL_APP="src-tauri/target/universal-apple-darwin/release/bundle/macos/Cora.app"
ARM_APP="src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Cora.app"
INTEL_APP="src-tauri/target/x86_64-apple-darwin/release/bundle/macos/Cora.app"
RELEASE_APP="src-tauri/target/release/bundle/macos/Cora.app"

APP_PATH=""
BUILD_TYPE=""

if [ -d "$UNIVERSAL_APP" ]; then
    APP_PATH="$UNIVERSAL_APP"
    BUILD_TYPE="Universal"
elif [ -d "$ARM_APP" ]; then
    APP_PATH="$ARM_APP"
    BUILD_TYPE="Apple Silicon"
elif [ -d "$RELEASE_APP" ]; then
    APP_PATH="$RELEASE_APP"
    BUILD_TYPE="Current Architecture"
elif [ -d "$INTEL_APP" ]; then
    APP_PATH="$INTEL_APP"
    BUILD_TYPE="Intel"
else
    echo -e "${RED}❌ Error: No app bundle found${NC}"
    echo ""
    echo "Please build your app first using one of:"
    echo "  pnpm build:appstore"
    echo "  pnpm tauri build --bundles app --config src-tauri/tauri.appstore.conf.json"
    echo ""
    exit 1
fi

echo -e "${GREEN}Found app bundle:${NC} $BUILD_TYPE"
echo "  $APP_PATH"
echo ""

# Verify code signing
echo -e "${BLUE}🔍 Verifying app code signature...${NC}"
if ! codesign -vvv --deep --strict "$APP_PATH" 2>&1 | grep -q "valid on disk"; then
    echo -e "${YELLOW}⚠️  Warning: App may not be properly signed for App Store${NC}"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Find Mac Installer Distribution certificate
echo ""
echo -e "${BLUE}🔑 Finding installer signing certificate...${NC}"
CERT_LIST=$(security find-identity -v -p basic)

# Filter for installer certificates
INSTALLER_CERTS=$(echo "$CERT_LIST" | grep -i "Mac Installer Distribution\|3rd Party Mac Developer Installer" || true)

if [ -z "$INSTALLER_CERTS" ]; then
    echo -e "${RED}❌ Error: No Mac Installer Distribution certificate found${NC}"
    echo ""
    echo "You need a 'Mac Installer Distribution' certificate to create an App Store PKG."
    echo ""
    echo "To create one:"
    echo "1. Go to: https://developer.apple.com/account/resources/certificates/list"
    echo "2. Click '+' to add a new certificate"
    echo "3. Select 'Mac Installer Distribution'"
    echo "4. Follow the instructions to create and download the certificate"
    echo "5. Double-click the downloaded certificate to install it in Keychain"
    echo ""
    exit 1
fi

echo "Available installer signing identities:"
echo "$INSTALLER_CERTS"
echo ""

# Count number of certificates
CERT_COUNT=$(echo "$INSTALLER_CERTS" | wc -l | tr -d ' ')

if [ "$CERT_COUNT" -eq 1 ]; then
    # Only one certificate, use it
    SIGNING_IDENTITY=$(echo "$INSTALLER_CERTS" | sed -n 's/.*"\(.*\)".*/\1/p')
    echo -e "${GREEN}Using certificate:${NC} $SIGNING_IDENTITY"
else
    # Multiple certificates, ask user to choose
    echo "Multiple certificates found. Please enter the number of the certificate to use:"
    echo "$INSTALLER_CERTS" | nl -w1 -s') '
    echo ""
    read -p "Enter certificate number: " CERT_NUM
    
    SIGNING_IDENTITY=$(echo "$INSTALLER_CERTS" | sed -n "${CERT_NUM}p" | sed -n 's/.*"\(.*\)".*/\1/p')
    
    if [ -z "$SIGNING_IDENTITY" ]; then
        echo -e "${RED}❌ Invalid selection${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}Selected certificate:${NC} $SIGNING_IDENTITY"
fi

# Output PKG path
OUTPUT_PKG="Cora.pkg"
echo ""
echo -e "${BLUE}📦 Creating signed PKG...${NC}"
echo ""

# Create the PKG
xcrun productbuild \
    --sign "$SIGNING_IDENTITY" \
    --component "$APP_PATH" \
    /Applications \
    "$OUTPUT_PKG"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ PKG created successfully!${NC}"
    echo ""
    echo "Output: $OUTPUT_PKG"
    echo "Size: $(du -h "$OUTPUT_PKG" | cut -f1)"
    echo ""
    
    # Verify PKG signature
    echo -e "${BLUE}🔍 Verifying PKG signature...${NC}"
    pkgutil --check-signature "$OUTPUT_PKG"
    echo ""
    
    echo -e "${BLUE}📤 Next steps:${NC}"
    echo ""
    echo "Option 1: Upload via command line"
    echo "  xcrun altool --upload-app --type macos --file $OUTPUT_PKG \\"
    echo "    --apiKey \$APPLE_API_KEY_ID --apiIssuer \$APPLE_API_ISSUER"
    echo ""
    echo "Option 2: Upload via Transporter app (recommended)"
    echo "  1. Download Transporter from Mac App Store"
    echo "  2. Open Transporter"
    echo "  3. Drag and drop $OUTPUT_PKG"
    echo "  4. Click 'Deliver'"
    echo ""
    echo -e "${BLUE}📚 Documentation:${NC} docs/APP_STORE_DEPLOYMENT.md"
    echo ""
else
    echo ""
    echo -e "${RED}❌ Failed to create PKG${NC}"
    exit 1
fi
