# 🍎 App Store Deployment - Setup Complete!

Your Cora Novel App is now configured for macOS App Store deployment.

## What's Been Set Up

### ✅ Configuration Files Created

1. **`src-tauri/Info.plist`**
   - App metadata for App Store
   - Encryption export compliance
   - File type associations
   - High resolution support

2. **`src-tauri/Entitlements.plist`**
   - App Sandbox configuration (required for App Store)
   - File access permissions
   - Network permissions
   - ⚠️ **ACTION REQUIRED:** Replace `YOUR_TEAM_ID` with your Apple Team ID

3. **`src-tauri/tauri.appstore.conf.json`**
   - App Store specific Tauri configuration
   - Merges with main config during build
   - ⚠️ **ACTION REQUIRED:** Update provisioning profile path

### ✅ Main Configuration Updated

**`src-tauri/tauri.conf.json`** now includes:
- `category: "Productivity"` (required for App Store)
- `bundleVersion: "100"` (separate from app version)
- `minimumSystemVersion: "11.0"` (macOS Big Sur and later)

### ✅ Build Scripts

1. **`build-appstore.sh`** - Interactive script for App Store builds
   - Validates configuration
   - Offers target selection (Universal/Intel/Apple Silicon)
   - Shows next steps after build
   - Available as: `pnpm build:appstore`

2. **npm script added:** `pnpm build:appstore`

### ✅ Documentation

1. **`docs/APP_STORE_DEPLOYMENT.md`** - Complete step-by-step guide
   - All prerequisites and setup
   - Detailed instructions for each step
   - Troubleshooting section
   - Quick reference commands

2. **`docs/APP_STORE_CHECKLIST.md`** - Interactive checklist
   - Track your progress
   - Quick commands reference
   - Common issues to check

---

## 🚀 Quick Start - What to Do Next

### Step 1: Complete Configuration (Required)

1. **Get your Apple Team ID:**
   - Go to: https://developer.apple.com/account/resources/identifiers/list
   - Your Team ID is in the "App ID Prefix" section

2. **Update Entitlements.plist:**
   ```bash
   # Edit src-tauri/Entitlements.plist
   # Replace both instances of YOUR_TEAM_ID with your actual Team ID
   ```

3. **Create and download provisioning profile:**
   - Follow instructions in `docs/APP_STORE_DEPLOYMENT.md` → Step 1B
   - Save to `src-tauri/` folder
   - Update path in `src-tauri/tauri.appstore.conf.json`

### Step 2: Set Up App Store Connect

1. Create app in App Store Connect
2. Create API key for uploads
3. Save private key to `~/.private_keys/`

### Step 3: Build and Upload

```bash
# Build for App Store
pnpm build:appstore

# Create signed PKG (follow on-screen instructions)

# Upload to App Store (follow on-screen instructions)
```

---

## 📋 Your Action Items

- [ ] Join Apple Developer Program ($99/year) if not already
- [ ] Get your Team ID from Apple Developer Portal
- [ ] Replace `YOUR_TEAM_ID` in `src-tauri/Entitlements.plist`
- [ ] Create provisioning profile and download it
- [ ] Update provisioning profile path in `src-tauri/tauri.appstore.conf.json`
- [ ] Create App Store Connect API key
- [ ] Read full deployment guide: `docs/APP_STORE_DEPLOYMENT.md`
- [ ] Use checklist to track progress: `docs/APP_STORE_CHECKLIST.md`

---

## 📚 Documentation

- **[Complete Deployment Guide](./APP_STORE_DEPLOYMENT.md)** - Read this first!
- **[Deployment Checklist](./APP_STORE_CHECKLIST.md)** - Track your progress
- **[Tauri Official Guide](https://v2.tauri.app/distribute/app-store/)**
- **[Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)**

---

## 🆘 Need Help?

1. **Check the Troubleshooting section** in `docs/APP_STORE_DEPLOYMENT.md`
2. **Review the checklist** to ensure all steps are completed
3. **Tauri Discord:** https://discord.com/invite/tauri
4. **Apple Developer Forums:** https://developer.apple.com/forums/

---

## 🎯 Important Notes

- **Sandbox Testing**: Test your app thoroughly in sandbox mode before submitting
- **Bundle Version**: Must increment for each App Store submission (e.g., 100 → 101)
- **Code Signing**: Both app and installer require different certificates
- **Review Time**: First submission typically takes 3-7 days
- **File Access**: App stores files in `~/Library/Application Support/com.pluton.cora/`

---

## 🎉 Ready to Ship!

Your app is configured for App Store deployment. Follow the checklist and deployment guide to submit your app.

**Good luck with your submission!** 🚀

---

**Files Modified/Created:**
- ✅ src-tauri/Info.plist
- ✅ src-tauri/Entitlements.plist
- ✅ src-tauri/tauri.appstore.conf.json
- ✅ src-tauri/tauri.conf.json
- ✅ build-appstore.sh
- ✅ package.json
- ✅ docs/APP_STORE_DEPLOYMENT.md
- ✅ docs/APP_STORE_CHECKLIST.md
- ✅ docs/APP_STORE_SETUP_COMPLETE.md (this file)

**Next:** Open `docs/APP_STORE_DEPLOYMENT.md` and start with Step 1!
