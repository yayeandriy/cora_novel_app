# Quick Build Reference

## Build All Platforms (Recommended)
```bash
pnpm run build:release
```

## Build Individual Platforms

### Apple Silicon (M1/M2/M3)
```bash
pnpm run build:mac:silicon
```

### Intel
```bash
pnpm run build:mac:intel
```

### Universal Binary
```bash
pnpm run build:mac:universal
```

## Output Locations

### DMG Installers (for distribution):
- Apple Silicon: `src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/`
- Intel: `src-tauri/target/x86_64-apple-darwin/release/bundle/dmg/`
- Universal: `src-tauri/target/universal-apple-darwin/release/bundle/dmg/`

### App Bundles:
- Apple Silicon: `src-tauri/target/aarch64-apple-darwin/release/bundle/macos/`
- Intel: `src-tauri/target/x86_64-apple-darwin/release/bundle/macos/`
- Universal: `src-tauri/target/universal-apple-darwin/release/bundle/macos/`

## First Time Build

Estimated time:
- First build: ~10-15 minutes (compiles all dependencies)
- Subsequent builds: ~2-3 minutes (only recompiles changes)

Building all 3 variants (Silicon + Intel + Universal) takes ~15-20 minutes first time.

## Recommended Distribution Strategy

**For most users:** Distribute the Universal Binary DMG
- Single file works on all Macs
- Located at: `src-tauri/target/universal-apple-darwin/release/bundle/dmg/`

**For bandwidth concerns:** Distribute separate builds
- Users with Apple Silicon use: `aarch64-apple-darwin` DMG
- Users with Intel use: `x86_64-apple-darwin` DMG
