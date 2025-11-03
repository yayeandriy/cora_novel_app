# Building Production Releases

This guide explains how to build production releases of Cora Novel App for macOS.

## Prerequisites

1. **Rust and Cargo** - Install from [rustup.rs](https://rustup.rs/)
2. **Node.js and pnpm** - Required for Angular frontend
3. **Xcode Command Line Tools** - For macOS development
   ```bash
   xcode-select --install
   ```

## Install Build Targets

Before building, ensure you have the required Rust targets installed:

```bash
# For Apple Silicon (M1/M2/M3) Macs
rustup target add aarch64-apple-darwin

# For Intel Macs
rustup target add x86_64-apple-darwin
```

## Building Methods

### Quick Build - All Platforms

Build for both Apple Silicon and Intel Macs with one command:

```bash
pnpm run build:release
```

Or directly:
```bash
./build-release.sh
```

This will create:
- Apple Silicon (aarch64) build
- Intel (x86_64) build
- Universal Binary (contains both architectures)

### Individual Platform Builds

Build for specific platforms:

```bash
# Apple Silicon only (M1/M2/M3)
pnpm run build:mac:silicon

# Intel only (x86_64)
pnpm run build:mac:intel

# Universal Binary (both architectures)
pnpm run build:mac:universal
```

## Build Output

After building, you'll find the artifacts in:

```
src-tauri/target/
├── aarch64-apple-darwin/
│   └── release/
│       ├── bundle/
│       │   ├── dmg/          # DMG installer
│       │   └── macos/        # .app bundle
│       └── cora-novel-app    # Binary
├── x86_64-apple-darwin/
│   └── release/
│       ├── bundle/
│       │   ├── dmg/          # DMG installer
│       │   └── macos/        # .app bundle
│       └── cora-novel-app    # Binary
└── universal-apple-darwin/
    └── release/
        ├── bundle/
        │   ├── dmg/          # DMG installer (Universal)
        │   └── macos/        # .app bundle (Universal)
        └── cora-novel-app    # Binary (Universal)
```

## Distribution Files

For distribution, use the **DMG installers** located in:
- `src-tauri/target/{arch}/release/bundle/dmg/`

### Which Build to Distribute?

**Option 1: Universal Binary (Recommended)**
- File: `universal-apple-darwin/release/bundle/dmg/*.dmg`
- **Pros**: Single file works on both Intel and Apple Silicon
- **Cons**: Larger file size (~2x)

**Option 2: Separate Builds**
- Files:
  - `aarch64-apple-darwin/release/bundle/dmg/*.dmg` (Apple Silicon)
  - `x86_64-apple-darwin/release/bundle/dmg/*.dmg` (Intel)
- **Pros**: Smaller individual file sizes
- **Cons**: Need to distribute two files and users must choose correctly

## Code Signing & Notarization

For official distribution, you'll need to sign and notarize your app:

1. **Apple Developer Account** - Required for signing
2. **Developer ID Certificate** - For distribution outside App Store
3. **Notarization** - Required for macOS Gatekeeper

See [Tauri's code signing guide](https://tauri.app/v1/guides/distribution/sign-macos) for details.

## Troubleshooting

### Build Fails with "target not found"
Install the missing target:
```bash
rustup target add <target-name>
```

### "No such file or directory" for cross-compilation
Make sure Xcode Command Line Tools are installed:
```bash
xcode-select --install
```

### Build is slow
First build will be slow as Rust compiles all dependencies. Subsequent builds are much faster.

## Testing Builds

Before distributing:

1. **Test on target architecture**: Install the DMG on the appropriate Mac
2. **Test app functionality**: Ensure all features work
3. **Test database**: Verify SQLite database operations
4. **Test file permissions**: Check file system access works correctly

## Version Management

Update version in:
1. `package.json` - `"version": "0.1.0"`
2. `src-tauri/Cargo.toml` - `version = "0.1.0"`
3. `src-tauri/tauri.conf.json` - `"version": "0.1.0"`

Keep all versions in sync!
