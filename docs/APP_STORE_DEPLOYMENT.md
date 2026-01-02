# macOS App Store Deployment Guide
## Cora Novel App

This guide walks you through deploying Cora to the macOS App Store.

---

## Prerequisites

### 1. Apple Developer Account
- **Required**: Enroll in the [Apple Developer Program](https://developer.apple.com/) ($99/year)
- You'll need this to create certificates, provisioning profiles, and publish to the App Store

### 2. Code Signing Setup
You need two certificates from Apple Developer:
- **Mac App Distribution certificate** - for signing the app
- **Mac Installer Distribution certificate** - for signing the .pkg installer

### 3. App Store Connect Setup
1. Go to [App Store Connect](https://appstoreconnect.apple.com/apps)
2. Click "+" and select "New App"
3. Fill in:
   - **Platform**: macOS
   - **Name**: Cora
   - **Primary Language**: English
   - **Bundle ID**: `com.pluton.cora` (must match identifier in tauri.conf.json)
   - **SKU**: Choose a unique identifier (e.g., "cora-novel-app-001")

---

## Step 1: Update Configuration Files

### A. Replace Team ID in Entitlements.plist

**Find your Team ID:**
1. Go to [Apple Developer Identifiers](https://developer.apple.com/account/resources/identifiers/list)
2. Your Team ID is shown in the "App ID Prefix" section

**Edit `src-tauri/Entitlements.plist`:**
```xml
<!-- Replace YOUR_TEAM_ID with your actual Team ID (both places) -->
<key>com.apple.application-identifier</key>
<string>YOUR_TEAM_ID.com.pluton.cora</string>

<key>com.apple.developer.team-identifier</key>
<string>YOUR_TEAM_ID</string>
```

### B. Create Provisioning Profile

1. Go to [Identifiers](https://developer.apple.com/account/resources/identifiers/list)
2. Click "+" to create a new App ID
3. Select "App IDs" and "App" type
4. **Bundle ID**: `com.pluton.cora` (must match tauri.conf.json)
5. Click "Continue" and "Register"

6. Go to [Profiles](https://developer.apple.com/account/resources/profiles/list)
7. Click "+" to create a new profile
8. Select **"Mac App Store Connect"** under "Distribution"
9. Select your App ID (`com.pluton.cora`)
10. Select your **Mac App Distribution certificate**
11. Name it (e.g., "Cora App Store Profile")
12. Download the profile (e.g., `Cora_App_Store.provisionprofile`)

### C. Update Provisioning Profile Path

**Edit `src-tauri/tauri.appstore.conf.json`:**
```json
{
  "bundle": {
    "macOS": {
      "files": {
        "embedded.provisionprofile": "./Cora_App_Store.provisionprofile"
      }
    }
  }
}
```

Save the downloaded profile to `src-tauri/Cora_App_Store.provisionprofile`

---

## Step 2: Set Up App Store Connect API Key

This is needed to upload your app via command line.

1. Go to [App Store Connect > Users and Access](https://appstoreconnect.apple.com/access/users)
2. Click "Integrations" tab, then "Individual Keys" sub-tab
3. Click "+" to generate a new API key
4. **Name**: "Cora Upload Key"
5. **Access**: Developer or higher
6. Click "Generate"
7. **Save these values:**
   - **Issuer ID** (shown above the keys table) → `APPLE_API_ISSUER`
   - **Key ID** (in the table) → `APPLE_API_KEY_ID`
8. **Download the private key** (you can only do this once!)
   - Save as `AuthKey_<APPLE_API_KEY_ID>.p8`

**Move the key to one of these directories:**
```bash
mkdir -p ~/.private_keys
mv ~/Downloads/AuthKey_*.p8 ~/.private_keys/
```

---

## Step 3: Build for App Store

### Option A: Universal Binary (Recommended - supports both Intel and Apple Silicon)

```bash
# Build the app bundle (no code signing yet - will sign during PKG creation)
pnpm tauri build --bundles app --target universal-apple-darwin --config src-tauri/tauri.appstore.conf.json

# The app will be at:
# src-tauri/target/universal-apple-darwin/release/bundle/macos/Cora.app
```

### Option B: Apple Silicon Only (macOS 12.0+)

If you only want to support Apple Silicon:

1. **Update `src-tauri/tauri.conf.json`:**
```json
{
  "bundle": {
    "macOS": {
      "minimumSystemVersion": "12.0"
    }
  }
}
```

2. **Build:**
```bash
# On Apple Silicon Mac:
pnpm tauri build --bundles app --config src-tauri/tauri.appstore.conf.json

# On Intel Mac (cross-compile):
rustup target add aarch64-apple-darwin
pnpm tauri build --bundles app --target aarch64-apple-darwin --config src-tauri/tauri.appstore.conf.json
```

---

## Step 4: Create Signed PKG

Find your **Mac Installer Distribution certificate identity:**
```bash
security find-identity -v -p macappstore
```

Look for a line like:
```
1) 1234567890ABCDEF "3rd Party Mac Developer Installer: Your Name (TEAM_ID)"
```

**Create the PKG:**
```bash
# Universal Binary:
xcrun productbuild \
  --sign "3rd Party Mac Developer Installer: Your Name (TEAM_ID)" \
  --component "src-tauri/target/universal-apple-darwin/release/bundle/macos/Cora.app" \
  /Applications \
  Cora.pkg

# Apple Silicon Only:
xcrun productbuild \
  --sign "3rd Party Mac Developer Installer: Your Name (TEAM_ID)" \
  --component "src-tauri/target/release/bundle/macos/Cora.app" \
  /Applications \
  Cora.pkg
```

---

## Step 5: Upload to App Store

```bash
# Set your API credentials
export APPLE_API_KEY_ID="your_key_id"
export APPLE_API_ISSUER="your_issuer_id"

# Upload
xcrun altool --upload-app \
  --type macos \
  --file Cora.pkg \
  --apiKey $APPLE_API_KEY_ID \
  --apiIssuer $APPLE_API_ISSUER
```

**Or use Transporter app (easier):**
1. Download [Transporter](https://apps.apple.com/app/transporter/id1450874784) from Mac App Store
2. Drag and drop `Cora.pkg`
3. Click "Deliver"

---

## Step 6: App Store Connect - Prepare for Submission

1. Go to [App Store Connect](https://appstoreconnect.apple.com/apps)
2. Select your app
3. Click "+" to create a new version
4. Fill in all required information:
   - **Version Number**: 0.1.0 (or your current version)
   - **App Information**: Description, keywords, support URL, privacy policy URL
   - **Pricing**: Free or Paid
   - **Screenshots**: Required for macOS (1280x800, 1440x900, 2560x1600, or 2880x1800)
   - **App Icon**: 1024x1024 PNG
   - **App Category**: Productivity > Writing Tools
5. Under "Build", select the uploaded build
6. Click "Save"
7. Click "Submit for Review"

---

## Troubleshooting

### Sandbox Issues

If your app crashes or doesn't work in the sandbox:

1. **Test sandbox locally:**
```bash
# Enable App Sandbox in local builds
pnpm tauri build --debug
codesign -s - --entitlements src-tauri/Entitlements.plist --force \
  src-tauri/target/debug/bundle/macos/Cora.app
```

2. **Common issues:**
   - File access: Use `com.apple.security.files.user-selected.read-write`
   - Network access: Add `com.apple.security.network.client`
   - Database files: Should be in `~/Library/Application Support/com.pluton.cora/`

### Upload Errors

**"Invalid Bundle":**
- Make sure provisioning profile matches bundle ID exactly
- Check that Team ID in Entitlements.plist is correct

**"Invalid Signature":**
- Ensure you're using the correct certificates (Mac App Distribution, not Developer ID)
- Verify entitlements are applied: `codesign -d --entitlements - Cora.app`

### Version Conflicts

If you see "Version already exists":
- Increment `bundleVersion` in `tauri.conf.json` (e.g., 100 → 101)
- Apple requires unique build numbers even for the same version

---

## Quick Reference Commands

### Complete build and upload (Universal Binary):
```bash
# 1. Build
pnpm tauri build --bundles app --target universal-apple-darwin \
  --config src-tauri/tauri.appstore.conf.json

# 2. Create PKG
xcrun productbuild \
  --sign "3rd Party Mac Developer Installer: Your Name (TEAM_ID)" \
  --component "src-tauri/target/universal-apple-darwin/release/bundle/macos/Cora.app" \
  /Applications \
  Cora.pkg

# 3. Upload
xcrun altool --upload-app --type macos --file Cora.pkg \
  --apiKey $APPLE_API_KEY_ID --apiIssuer $APPLE_API_ISSUER
```

### Check code signing:
```bash
codesign -vvv --deep --strict Cora.app
codesign -d --entitlements - Cora.app
```

### Check PKG:
```bash
pkgutil --check-signature Cora.pkg
```

---

## Next Steps After Approval

1. **TestFlight**: Your app will be available in TestFlight for internal testing
2. **External Testing**: Invite external testers (optional)
3. **App Review**: Wait for Apple's review (typically 1-7 days)
4. **Release**: Once approved, you can release to the App Store

---

## Important Notes

- **First submission** typically takes 3-7 days for review
- **Updates** usually reviewed within 1-3 days
- Keep your certificates and provisioning profiles up to date
- Bundle version must increment for each submission
- Test thoroughly in sandbox mode before submission

---

## Resources

- [Tauri App Store Guide](https://v2.tauri.app/distribute/app-store/)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [macOS Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/macos)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)

---

## Support

If you encounter issues:
1. Check the Troubleshooting section above
2. Review Tauri documentation: https://v2.tauri.app/
3. Join Tauri Discord: https://discord.com/invite/tauri
4. Apple Developer Forums: https://developer.apple.com/forums/

---

**Last Updated:** January 2, 2026  
**Cora Version:** 0.1.0
