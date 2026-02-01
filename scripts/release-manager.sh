#!/bin/bash

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKG_JSON="$ROOT_DIR/package.json"
TAURI_JSON="$ROOT_DIR/src-tauri/tauri.conf.json"
APPSTORE_JSON="$ROOT_DIR/src-tauri/tauri.appstore.conf.json"
CARGO_TOML="$ROOT_DIR/src-tauri/Cargo.toml"

read_json_value() {
  local file="$1"
  local expr="$2"
  node -e "const data=require('${file}'); const val=${expr}; console.log(val ?? '');"
}

get_package_version() {
  read_json_value "$PKG_JSON" "data.version"
}

get_tauri_version() {
  read_json_value "$TAURI_JSON" "data.version"
}

get_bundle_version() {
  read_json_value "$TAURI_JSON" "data.bundle && data.bundle.macOS && data.bundle.macOS.bundleVersion"
}

write_package_version() {
  local version="$1"
  node -e "const fs=require('fs'); const file='${PKG_JSON}'; const data=JSON.parse(fs.readFileSync(file,'utf8')); data.version='${version}'; fs.writeFileSync(file, JSON.stringify(data,null,2)+'\n');"
}

write_tauri_version_and_bundle() {
  local version="$1"
  local bundle_version="$2"
  node -e "const fs=require('fs'); const file='${TAURI_JSON}'; const data=JSON.parse(fs.readFileSync(file,'utf8')); data.version='${version}'; data.bundle=data.bundle||{}; data.bundle.macOS=data.bundle.macOS||{}; data.bundle.macOS.bundleVersion='${bundle_version}'; fs.writeFileSync(file, JSON.stringify(data,null,2)+'\n');"
  if [[ -f "$APPSTORE_JSON" ]]; then
    node -e "const fs=require('fs'); const file='${APPSTORE_JSON}'; const data=JSON.parse(fs.readFileSync(file,'utf8')); data.bundle=data.bundle||{}; data.bundle.macOS=data.bundle.macOS||{}; data.bundle.macOS.bundleVersion='${bundle_version}'; fs.writeFileSync(file, JSON.stringify(data,null,2)+'\n');"
  fi
}

write_cargo_version() {
  local version="$1"
  VERSION="$version" perl -0pi -e 's/(\[package\][\s\S]*?\nversion = ")[^"]+("\n)/$1$ENV{VERSION}$2/' "$CARGO_TOML"
}

bump_semver() {
  local version="$1"
  local part="$2"
  IFS='.' read -r major minor patch <<< "$version"
  major=${major:-0}
  minor=${minor:-0}
  patch=${patch:-0}
  case "$part" in
    major)
      major=$((major + 1))
      minor=0
      patch=0
      ;;
    minor)
      minor=$((minor + 1))
      patch=0
      ;;
    patch)
      patch=$((patch + 1))
      ;;
    *)
      echo "$version"
      return
      ;;
  esac
  echo "${major}.${minor}.${patch}"
}

bump_bundle_version() {
  local current="$1"
  if [[ -z "$current" ]]; then
    echo "1"
  else
    echo $((current + 1))
  fi
}

print_status() {
  local pkg_version
  local tauri_version
  local bundle_version
  pkg_version=$(get_package_version)
  tauri_version=$(get_tauri_version)
  bundle_version=$(get_bundle_version)
  echo "Current versions:"
  echo "  package.json: ${pkg_version}"
  echo "  tauri.conf.json: ${tauri_version}"
  echo "  bundleVersion: ${bundle_version}"
}

apply_versions() {
  local version="$1"
  local bundle_version="$2"
  write_package_version "$version"
  write_tauri_version_and_bundle "$version" "$bundle_version"
  write_cargo_version "$version"
}

auto_bump() {
  local current_version
  local current_bundle
  current_version=$(get_package_version)
  current_bundle=$(get_bundle_version)
  local new_version
  local new_bundle
  new_version=$(bump_semver "$current_version" "patch")
  new_bundle=$(bump_bundle_version "$current_bundle")
  apply_versions "$new_version" "$new_bundle"
  echo "Bumped version to ${new_version} (bundleVersion ${new_bundle})."
}

bump_with_part() {
  local part="$1"
  local current_version
  local current_bundle
  current_version=$(get_package_version)
  current_bundle=$(get_bundle_version)
  local new_version
  local new_bundle
  new_version=$(bump_semver "$current_version" "$part")
  new_bundle=$(bump_bundle_version "$current_bundle")
  apply_versions "$new_version" "$new_bundle"
  echo "Bumped ${part} version to ${new_version} (bundleVersion ${new_bundle})."
}

build_only_bump() {
  local current_version
  local current_bundle
  current_version=$(get_package_version)
  current_bundle=$(get_bundle_version)
  local new_bundle
  new_bundle=$(bump_bundle_version "$current_bundle")
  apply_versions "$current_version" "$new_bundle"
  echo "Bumped bundleVersion to ${new_bundle} (version ${current_version})."
}

set_version() {
  local new_version="$1"
  local current_bundle
  current_bundle=$(get_bundle_version)
  local new_bundle
  new_bundle=$(bump_bundle_version "$current_bundle")
  apply_versions "$new_version" "$new_bundle"
  echo "Set version to ${new_version} (bundleVersion ${new_bundle})."
}

run_interactive() {
  while true; do
    echo ""
    print_status
    echo ""
    echo "Release Manager"
    echo "1) Bump patch + build"
    echo "2) Bump minor + build"
    echo "3) Bump major + build"
    echo "4) Build only (increment bundleVersion)"
    echo "5) Set version manually"
    echo "6) Exit"
    echo ""
    read -p "Choose an option [1-6]: " choice

    case "$choice" in
      1)
        local current
        local bundle
        current=$(get_package_version)
        bundle=$(get_bundle_version)
        apply_versions "$(bump_semver "$current" "patch")" "$(bump_bundle_version "$bundle")"
        echo "Bumped patch version."
        ;;
      2)
        local current
        local bundle
        current=$(get_package_version)
        bundle=$(get_bundle_version)
        apply_versions "$(bump_semver "$current" "minor")" "$(bump_bundle_version "$bundle")"
        echo "Bumped minor version."
        ;;
      3)
        local current
        local bundle
        current=$(get_package_version)
        bundle=$(get_bundle_version)
        apply_versions "$(bump_semver "$current" "major")" "$(bump_bundle_version "$bundle")"
        echo "Bumped major version."
        ;;
      4)
        build_only_bump
        ;;
      5)
        read -p "Enter new version (x.y.z): " manual_version
        if [[ "$manual_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
          set_version "$manual_version"
        else
          echo "Invalid version format."
        fi
        ;;
      6)
        exit 0
        ;;
      *)
        echo "Invalid choice."
        ;;
    esac
  done
}

case "$1" in
  --auto)
    auto_bump
    ;;
  --bump)
    if [[ -z "$2" ]]; then
      echo "Missing bump part (major|minor|patch)."
      exit 1
    fi
    bump_with_part "$2"
    ;;
  --build-only)
    build_only_bump
    ;;
  --set-version)
    if [[ -z "$2" ]]; then
      echo "Missing version value."
      exit 1
    fi
    set_version "$2"
    ;;
  --print)
    print_status
    ;;
  *)
    run_interactive
    ;;
esac
