#!/bin/bash

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v git >/dev/null 2>&1; then
  echo "git not found"
  exit 1
fi

git -C "$ROOT_DIR" config core.hooksPath .githooks

echo "Git hooks path set to .githooks"
