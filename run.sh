#!/bin/bash

pnpm build:current
rm -rf "/Applications/Cora 2.app"
cp -R "/Users/pluton/Developer/erasing/cora_3/cora-novel-app/src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Cora.app" "/Applications/Cora 2.app"
