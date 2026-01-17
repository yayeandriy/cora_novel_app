#!/bin/bash

# Script to convert src/assets/icon_file.png to ICNS format for .cora file association
# Usage: ./create-file-icon.sh

set -e

SOURCE_PNG="src/assets/icon_file.png"
OUTPUT_ICNS="src-tauri/icons/file.icns"
TEMP_ICONSET="file.iconset"

echo "🎨 Creating .cora file icon from ${SOURCE_PNG}..."

# Check if source PNG exists
if [ ! -f "$SOURCE_PNG" ]; then
    echo "❌ Error: Source PNG not found at ${SOURCE_PNG}"
    exit 1
fi

# Create temporary iconset directory
rm -rf "$TEMP_ICONSET"
mkdir "$TEMP_ICONSET"

# Generate all required sizes for macOS iconset
echo "📐 Generating icon sizes..."

sips -z 16 16     "$SOURCE_PNG" --out "${TEMP_ICONSET}/icon_16x16.png" >/dev/null
sips -z 32 32     "$SOURCE_PNG" --out "${TEMP_ICONSET}/icon_16x16@2x.png" >/dev/null
sips -z 32 32     "$SOURCE_PNG" --out "${TEMP_ICONSET}/icon_32x32.png" >/dev/null
sips -z 64 64     "$SOURCE_PNG" --out "${TEMP_ICONSET}/icon_32x32@2x.png" >/dev/null
sips -z 128 128   "$SOURCE_PNG" --out "${TEMP_ICONSET}/icon_128x128.png" >/dev/null
sips -z 256 256   "$SOURCE_PNG" --out "${TEMP_ICONSET}/icon_128x128@2x.png" >/dev/null
sips -z 256 256   "$SOURCE_PNG" --out "${TEMP_ICONSET}/icon_256x256.png" >/dev/null
sips -z 512 512   "$SOURCE_PNG" --out "${TEMP_ICONSET}/icon_256x256@2x.png" >/dev/null
sips -z 512 512   "$SOURCE_PNG" --out "${TEMP_ICONSET}/icon_512x512.png" >/dev/null
sips -z 1024 1024 "$SOURCE_PNG" --out "${TEMP_ICONSET}/icon_512x512@2x.png" >/dev/null

# Convert iconset to icns
echo "🔨 Converting to ICNS format..."
iconutil -c icns "$TEMP_ICONSET" -o "$OUTPUT_ICNS"

# Clean up
rm -rf "$TEMP_ICONSET"

echo "✅ Success! File icon created at ${OUTPUT_ICNS}"
echo ""
echo "Next steps:"
echo "1. Update src-tauri/tauri.conf.json to reference the icon in fileAssociations"
echo "2. Rebuild the app: pnpm tauri build"
echo "3. .cora files will now use the custom icon"
