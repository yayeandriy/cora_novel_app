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

# -------- Version / build number helpers --------
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

PKG_JSON="$ROOT_DIR/package.json"
TAURI_CONF="$ROOT_DIR/src-tauri/tauri.conf.json"
TAURI_APPSTORE_CONF="$ROOT_DIR/src-tauri/tauri.appstore.conf.json"
CARGO_TOML="$ROOT_DIR/src-tauri/Cargo.toml"

read_json_path() {
        local file="$1"
        local dotted_path="$2"
        node - "$file" "$dotted_path" <<'NODE'
const fs = require('fs');

// When invoked as `node - ...`, argv[1] is "-" (stdin placeholder).
const file = process.argv[2];
const dottedPath = process.argv[3] || '';

const obj = JSON.parse(fs.readFileSync(file, 'utf8'));
const value = dottedPath
    .split('.')
    .filter(Boolean)
    .reduce((acc, key) => (acc && Object.prototype.hasOwnProperty.call(acc, key) ? acc[key] : undefined), obj);

process.stdout.write(value == null ? '' : String(value));
NODE
}

update_json_paths() {
    local file="$1"
    local updates_json="$2"
    UPDATES="$updates_json" node - <<'NODE' "$file"
const fs = require('fs');
// When invoked as `node - ...`, argv[1] is "-" (stdin placeholder).
const path = process.argv[2];
const updates = JSON.parse(process.env.UPDATES);

function setPath(obj, dottedPath, value) {
    const parts = dottedPath.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i];
        if (cur[key] == null || typeof cur[key] !== 'object') cur[key] = {};
        cur = cur[key];
    }
    cur[parts[parts.length - 1]] = value;
}

const data = JSON.parse(fs.readFileSync(path, 'utf8'));
for (const [p, v] of Object.entries(updates)) {
    setPath(data, p, v);
}
fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
NODE
}

bump_patch() {
    local v="$1"
    node -e "
    const v = process.argv[1] || '';
    const m = v.match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
    if (!m) { process.stdout.write(v); process.exit(0); }
    const major = Number(m[1]);
    const minor = Number(m[2]);
    const patch = Number(m[3]) + 1;
    const suffix = m[4] || '';
    process.stdout.write(String(major) + '.' + String(minor) + '.' + String(patch) + String(suffix));
    " "$v"
}

prompt_for_next_version() {
    # Current values
    local current_version
    current_version="$(read_json_path "$TAURI_CONF" "version")"
    if [ -z "$current_version" ]; then
        current_version="$(read_json_path "$PKG_JSON" "version")"
    fi
    local current_bundle_version
    current_bundle_version="$(read_json_path "$TAURI_APPSTORE_CONF" "bundle.macOS.bundleVersion")"
    if [ -z "$current_bundle_version" ]; then
        current_bundle_version="$(read_json_path "$TAURI_CONF" "bundle.macOS.bundleVersion")"
    fi

    # Defaults
    local default_version
    default_version="$(bump_patch "$current_version")"
    local default_bundle_version="$current_bundle_version"
    if [[ "$current_bundle_version" =~ ^[0-9]+$ ]]; then
        default_bundle_version=$((current_bundle_version + 1))
    fi

    echo -e "${BLUE}🔢 Versioning${NC}"
    echo "Current version:        ${current_version:-<unknown>}"
    echo "Current build number:   ${current_bundle_version:-<unknown>}"
    echo ""

    local next_version
    read -p "Next version (default ${default_version}): " next_version
    next_version="${next_version:-$default_version}"

    local next_bundle_version
    read -p "Next build number / bundleVersion (default ${default_bundle_version}): " next_bundle_version
    next_bundle_version="${next_bundle_version:-$default_bundle_version}"

    if [ -z "$next_version" ]; then
        echo -e "${RED}❌ Version cannot be empty${NC}"
        exit 1
    fi
    if [ -z "$next_bundle_version" ]; then
        echo -e "${RED}❌ Build number cannot be empty${NC}"
        exit 1
    fi

    export NEXT_VERSION="$next_version"
    export NEXT_BUNDLE_VERSION="$next_bundle_version"

    echo ""
    echo -e "${BLUE}✍️  Writing version to source configs...${NC}"

    # package.json
    update_json_paths "$PKG_JSON" "{\"version\":\"$NEXT_VERSION\"}"

    # tauri.conf.json
    update_json_paths "$TAURI_CONF" "{\"version\":\"$NEXT_VERSION\",\"bundle.macOS.bundleVersion\":\"$NEXT_BUNDLE_VERSION\"}"

    # tauri.appstore.conf.json (only contains bundleVersion)
    update_json_paths "$TAURI_APPSTORE_CONF" "{\"bundle.macOS.bundleVersion\":\"$NEXT_BUNDLE_VERSION\"}"

    # Cargo.toml [package].version (only first occurrence in [package] section)
    NEXT_VERSION="$NEXT_VERSION" perl -0777 -i -pe 's/(\[package\][^\[]*?\nversion\s*=\s*")[^"]+("\s*\n)/$1$ENV{NEXT_VERSION}$2/s' "$CARGO_TOML"

    echo -e "${GREEN}✅ Updated:${NC} version=$NEXT_VERSION, bundleVersion=$NEXT_BUNDLE_VERSION"
    echo -e "${YELLOW}⚠️  Note:${NC} the existing built .app bundle will NOT change until you rebuild (e.g. run ./build-appstore.sh again)."
    echo ""
}

# Ask for the *next* version/build before packaging so configs stay in sync.
prompt_for_next_version

get_app_plist_value() {
    local app_path="$1"
    local key="$2"
    local plist="$app_path/Contents/Info.plist"
    if [ ! -f "$plist" ]; then
        echo ""
        return 0
    fi
    /usr/libexec/PlistBuddy -c "Print :$key" "$plist" 2>/dev/null || echo ""
}

maybe_rebuild_appstore() {
    echo -e "${BLUE}🔨 Rebuild (recommended)${NC}"
    echo "To make the app bundle reflect the new version/build, a rebuild is required."
    read -p "Run ./build-appstore.sh now? (Y/n) " rebuild_now
    rebuild_now="${rebuild_now:-Y}"
    if [[ "$rebuild_now" =~ ^[Yy]$ ]]; then
        (cd "$ROOT_DIR" && ./build-appstore.sh)
    fi
    echo ""
}

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
        # Offer to rebuild automatically now that versions are set
        maybe_rebuild_appstore

        # Re-check after rebuild attempt
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
            exit 1
        fi
fi

echo -e "${GREEN}Found app bundle:${NC} $BUILD_TYPE"
echo "  $APP_PATH"
echo ""

# Validate that the built app matches the requested version/build.
APP_CF_BUNDLE_VERSION="$(get_app_plist_value "$APP_PATH" "CFBundleVersion")"
APP_CF_SHORT_VERSION="$(get_app_plist_value "$APP_PATH" "CFBundleShortVersionString")"

if [ -n "$NEXT_BUNDLE_VERSION" ] && [ -n "$APP_CF_BUNDLE_VERSION" ] && [ "$APP_CF_BUNDLE_VERSION" != "$NEXT_BUNDLE_VERSION" ]; then
    echo -e "${YELLOW}⚠️  App bundle build number mismatch${NC}"
    echo "Requested bundleVersion: $NEXT_BUNDLE_VERSION"
    echo "App CFBundleVersion:     $APP_CF_BUNDLE_VERSION"
    echo ""
    echo "This will likely be rejected by App Store/Transporter (must be higher than previous uploads)."
    maybe_rebuild_appstore
fi

if [ -n "$NEXT_VERSION" ] && [ -n "$APP_CF_SHORT_VERSION" ] && [ "$APP_CF_SHORT_VERSION" != "$NEXT_VERSION" ]; then
    echo -e "${YELLOW}⚠️  App bundle version mismatch${NC}"
    echo "Requested version:            $NEXT_VERSION"
    echo "App CFBundleShortVersionString: $APP_CF_SHORT_VERSION"
    echo ""
    maybe_rebuild_appstore
fi

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
