# Build Scripts Reference

Quick reference for all build scripts in the Cora Novel App project.

---

## Development

### `pnpm start`
Start the development server (web-only, no Tauri).
- Hot reload enabled
- Runs at: http://localhost:1420

### `pnpm tauri:dev`
Run the app in development mode with Tauri (recommended).
- Full desktop app experience
- Hot reload enabled
- Opens in maximized window

---

## Standard Builds (Local Distribution)

### `pnpm build:current`
**Script:** `build-current.sh`

Quick build for your current architecture only.
- Fast build time
- Good for local testing
- Detects your Mac architecture automatically

### `pnpm build:release`
**Script:** `build-release.sh`

Full production builds for all architectures.
- Builds Apple Silicon (aarch64)
- Builds Intel (x86_64)
- Builds Universal Binary
- Creates DMG installers
- Takes longer but covers all Mac users

### Individual Architecture Builds

```bash
# Apple Silicon only
pnpm build:mac:silicon

# Intel only  
pnpm build:mac:intel

# Universal Binary
pnpm build:mac:universal
```

---

## App Store Distribution

### `pnpm build:appstore`
**Script:** `build-appstore.sh`

Interactive build for App Store submission.

**Features:**
- Validates App Store configuration
- Choice of architecture (Universal/Apple Silicon/Intel)
- Shows next steps after build
- Checks for common issues

**Requirements:**
- Entitlements.plist configured
- Team ID set
- Provisioning profile downloaded

**Output:**
```
src-tauri/target/{arch}/release/bundle/macos/Cora.app
```

### `pnpm create:pkg`
**Script:** `create-appstore-pkg.sh`

Create signed PKG installer for App Store upload.

**Features:**
- Auto-detects built app
- Finds installer signing certificate
- Verifies signatures
- Shows upload commands

**Requirements:**
- App already built (run `pnpm build:appstore` first)
- Mac Installer Distribution certificate installed

**Output:**
```
Cora.pkg (in project root)
```

---

## Testing

### `pnpm test:unit`
Run Jest unit tests.

### `pnpm test:e2e`
Run Playwright end-to-end tests.
- Requires app to be running (`pnpm start`)

### `pnpm test:e2e:ui`
Run E2E tests with interactive UI.

---

## Typical Workflows

### Local Testing (Quick)
```bash
pnpm tauri:dev
# or for production build:
pnpm build:current
```

### Production Release (All Users)
```bash
pnpm build:release
```
Creates DMG installers in:
- `src-tauri/target/aarch64-apple-darwin/release/bundle/`
- `src-tauri/target/x86_64-apple-darwin/release/bundle/`
- `src-tauri/target/universal-apple-darwin/release/bundle/`

### App Store Submission
```bash
# 1. Build for App Store
pnpm build:appstore
# Choose option 1 (Universal Binary)

# 2. Create PKG
pnpm create:pkg
# Select your installer certificate

# 3. Upload
# Use Transporter app (drag & drop Cora.pkg)
# Or use altool command (shown by create:pkg script)
```

---

## Build Output Locations

### Development Builds
```
src-tauri/target/debug/bundle/macos/Cora.app
```

### Production Builds
```
src-tauri/target/{arch}/release/bundle/macos/Cora.app
src-tauri/target/{arch}/release/bundle/dmg/Cora_0.1.0_{arch}.dmg
```

Where `{arch}` is one of:
- `aarch64-apple-darwin` (Apple Silicon)
- `x86_64-apple-darwin` (Intel)
- `universal-apple-darwin` (Both)

### App Store Builds
```
# App bundle
src-tauri/target/universal-apple-darwin/release/bundle/macos/Cora.app

# PKG installer (after running create:pkg)
./Cora.pkg
```

---

## Configuration Files

### Standard Builds
- `src-tauri/tauri.conf.json` - Main configuration

### App Store Builds
- `src-tauri/tauri.conf.json` - Base configuration
- `src-tauri/tauri.appstore.conf.json` - App Store overrides
- `src-tauri/Entitlements.plist` - Sandbox permissions
- `src-tauri/Info.plist` - App metadata
- `src-tauri/*.provisionprofile` - Provisioning profile

---

## Documentation

- **App Store Guide:** [docs/APP_STORE_DEPLOYMENT.md](./docs/APP_STORE_DEPLOYMENT.md)
- **App Store Checklist:** [docs/APP_STORE_CHECKLIST.md](./docs/APP_STORE_CHECKLIST.md)
- **Setup Summary:** [docs/APP_STORE_SETUP_COMPLETE.md](./docs/APP_STORE_SETUP_COMPLETE.md)
- **Tauri Docs:** https://v2.tauri.app/

---

## Troubleshooting

### Build fails with "could not find tauri.conf.json"
Make sure you're in the project root directory.

### Code signing errors
Check that certificates are installed in Keychain Access.

### "YOUR_TEAM_ID" errors
Replace placeholder in `src-tauri/Entitlements.plist` with your Apple Team ID.

### PKG creation fails
Ensure you have "Mac Installer Distribution" certificate installed.

### Upload fails
- Check API key is in `~/.private_keys/`
- Verify API Key ID and Issuer ID are correct
- Ensure bundle version increments for each upload

---

**Last Updated:** January 2, 2026
