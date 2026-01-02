# App Store Deployment Checklist
## Cora Novel App - Quick Start

Use this checklist to track your progress through the App Store deployment process.

---

## ✅ Pre-Deployment Setup

- [ ] **Apple Developer Account enrolled** ($99/year)
- [ ] **Two certificates created:**
  - [ ] Mac App Distribution certificate
  - [ ] Mac Installer Distribution certificate
- [ ] **App registered in App Store Connect**
  - Bundle ID: `com.pluton.cora`
  - App name: Cora
  - Category: Productivity

---

## ✅ Configuration Files

- [x] **Info.plist created** (`src-tauri/Info.plist`)
- [x] **Entitlements.plist created** (`src-tauri/Entitlements.plist`)
  - [ ] **ACTION REQUIRED:** Replace `YOUR_TEAM_ID` with your actual Team ID (2 places)
- [x] **tauri.appstore.conf.json created** (`src-tauri/tauri.appstore.conf.json`)
  - [ ] **ACTION REQUIRED:** Update provisioning profile path
- [x] **tauri.conf.json updated** with category and macOS settings

---

## ✅ Provisioning Profile

- [ ] **App ID created** in Apple Developer Portal
  - Bundle ID: `com.pluton.cora`
- [ ] **Provisioning Profile created**
  - Type: Mac App Store Connect
  - Linked to App ID and Mac App Distribution certificate
- [ ] **Profile downloaded** and saved to `src-tauri/`
- [ ] **Profile path updated** in `tauri.appstore.conf.json`

---

## ✅ App Store Connect API Key

- [ ] **API Key created** in App Store Connect
- [ ] **Values saved:**
  - [ ] Issuer ID → `APPLE_API_ISSUER`
  - [ ] Key ID → `APPLE_API_KEY_ID`
- [ ] **Private key downloaded** (`AuthKey_*.p8`)
- [ ] **Private key moved** to `~/.private_keys/`

---

## ✅ Build and Package

- [ ] **App built** with command:
  ```bash
  pnpm tauri build --bundles app --target universal-apple-darwin \
    --config src-tauri/tauri.appstore.conf.json
  ```
- [ ] **App bundle verified** at:
  - `src-tauri/target/universal-apple-darwin/release/bundle/macos/Cora.app`

- [ ] **PKG created** with command:
  ```bash
  xcrun productbuild --sign "3rd Party Mac Developer Installer: Your Name (TEAM_ID)" \
    --component "src-tauri/target/universal-apple-darwin/release/bundle/macos/Cora.app" \
    /Applications Cora.pkg
  ```

---

## ✅ Upload

- [ ] **Environment variables set:**
  ```bash
  export APPLE_API_KEY_ID="your_key_id"
  export APPLE_API_ISSUER="your_issuer_id"
  ```

- [ ] **Upload completed** with one of:
  - [ ] Command line: `xcrun altool --upload-app --type macos --file Cora.pkg ...`
  - [ ] Transporter app

- [ ] **Upload confirmation received**

---

## ✅ App Store Connect Submission

- [ ] **New version created** (0.1.0)
- [ ] **App Information filled:**
  - [ ] Description
  - [ ] Keywords
  - [ ] Support URL
  - [ ] Privacy Policy URL
- [ ] **Screenshots uploaded** (required sizes)
- [ ] **App Icon uploaded** (1024x1024)
- [ ] **Build selected**
- [ ] **Pricing set**
- [ ] **Submitted for Review**

---

## ✅ Testing

- [ ] **Sandbox testing completed locally**
- [ ] **TestFlight internal testing** (optional)
- [ ] **External beta testing** (optional)

---

## ✅ Post-Submission

- [ ] **Review status monitored** in App Store Connect
- [ ] **Review feedback addressed** (if any)
- [ ] **App approved**
- [ ] **Release date set**
- [ ] **App live on App Store**

---

## 🚨 Common Issues to Check

- [ ] Team ID replaced in Entitlements.plist
- [ ] Provisioning profile path correct
- [ ] Bundle ID matches everywhere (`com.pluton.cora`)
- [ ] Certificates are for App Store (not Developer ID)
- [ ] Bundle version increments for each build
- [ ] App works in sandbox mode
- [ ] All required entitlements included

---

## 📝 Quick Commands Reference

**Build:**
```bash
pnpm tauri build --bundles app --target universal-apple-darwin \
  --config src-tauri/tauri.appstore.conf.json
```

**Create PKG:**
```bash
xcrun productbuild --sign "CERTIFICATE_NAME" \
  --component "src-tauri/target/universal-apple-darwin/release/bundle/macos/Cora.app" \
  /Applications Cora.pkg
```

**Upload:**
```bash
xcrun altool --upload-app --type macos --file Cora.pkg \
  --apiKey $APPLE_API_KEY_ID --apiIssuer $APPLE_API_ISSUER
```

**Check Signing:**
```bash
codesign -vvv --deep --strict Cora.app
codesign -d --entitlements - Cora.app
```

---

## 📚 Documentation

- **Full Guide:** [docs/APP_STORE_DEPLOYMENT.md](./APP_STORE_DEPLOYMENT.md)
- **Tauri Docs:** https://v2.tauri.app/distribute/app-store/
- **Apple Guidelines:** https://developer.apple.com/app-store/review/guidelines/

---

**Next Steps:**
1. Complete the "ACTION REQUIRED" items above
2. Follow the checklist in order
3. Refer to the full deployment guide for detailed instructions

Good luck with your App Store submission! 🚀
