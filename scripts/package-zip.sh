#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Parse args
SKIP_BUILD=false
STORE=false
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    --store) STORE=true ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

# Read version from extension/package.json.
#
# The path goes in as an ARGUMENT, not interpolated into the code string. Under
# Git Bash on Windows, MSYS rewrites POSIX paths to Windows ones for arguments
# to a native binary, but never inside `-p`/`-e` source — so the old form asked
# Windows node to require '/c/Users/…' and died with MODULE_NOT_FOUND. This
# script had only ever run on the Linux CI runner, where both forms work.
VERSION=$(node -p 'require(process.argv[1]).version' "$PROJECT_DIR/extension/package.json")
STAGE_DIR="$PROJECT_DIR/.zip-stage"
if [ "$STORE" = true ]; then
  ZIP_NAME="My-Community-v${VERSION}-store.zip"
  echo "==> Packaging My Community v${VERSION} (Chrome Web Store upload)"
else
  ZIP_NAME="My-Community-v${VERSION}.zip"
  echo "==> Packaging My Community v${VERSION} (zip)"
fi

# Build
if [ "$SKIP_BUILD" = false ]; then
  echo "==> Installing dependencies and building..."
  cd "$PROJECT_DIR/extension"
  npm ci
  npm run build
else
  echo "==> Skipping build (--skip-build)"
fi

# Verify dist exists
if [ ! -d "$PROJECT_DIR/extension/dist" ]; then
  echo "Error: extension/dist/ directory not found. Run npm run build first."
  exit 1
fi

# Clean previous staging
rm -rf "$STAGE_DIR"

if [ "$STORE" = true ]; then
  # The Chrome Web Store requires manifest.json at the ZIP ROOT. The sideload
  # bundle below nests it under "My Community/extension/" alongside an
  # INSTALL.txt, which the store rejects as a missing manifest — so the two
  # artifacts genuinely differ and cannot be the same file.
  mkdir -p "$STAGE_DIR"
  cp -R "$PROJECT_DIR/extension/dist/." "$STAGE_DIR/"

  # Strip the `key` field. It pins the extension ID for unpacked installs, and
  # a dev key has no business in a store package: the store assigns its own ID
  # from its own key at upload time. Reports differ on whether it is ignored or
  # rejected outright, so do not find out in review.
  #
  # Stripped ONLY here. Removing it from extension/public/manifest.json would
  # give every "Load unpacked" install a path-derived ID, breaking the OAuth
  # relay for exactly the sideloaded users this project still runs on.
  node -e '
    const fs = require("fs");
    const f = process.argv[1];
    const j = JSON.parse(fs.readFileSync(f, "utf8"));
    if (!("key" in j)) { console.log("==> no key field to strip"); process.exit(0); }
    delete j.key;
    fs.writeFileSync(f, JSON.stringify(j, null, 2) + "\n");
    console.log("==> stripped the dev key from the store manifest");
  ' "$STAGE_DIR/manifest.json"
else
  mkdir -p "$STAGE_DIR/My Community/extension"

  # Copy built extension
  cp -R "$PROJECT_DIR/extension/dist/." "$STAGE_DIR/My Community/extension/"
fi

# Generate INSTALL.txt (sideload bundle only — the store installs for the user)
if [ "$STORE" = false ]; then
cat > "$STAGE_DIR/My Community/INSTALL.txt" <<'EOF'
My Community — Installation Guide
===================================

1. Open Google Chrome (or Brave)
2. Go to chrome://extensions
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked"
5. Select the "extension" folder from this My Community folder
6. Done! Open a new tab to see your community dashboard

Getting started:
- Click the gear icon to select your communities
- Connect your Bluesky account to see network feed (optional)
- Toggle which tabs to show: Digest, Bluesky, Participation
EOF
fi

# Remove old zip if present
rm -f "$PROJECT_DIR/$ZIP_NAME"

# Create zip
echo "==> Creating $ZIP_NAME..."
cd "$STAGE_DIR"

# Store mode zips the stage CONTENTS so manifest.json lands at the archive root,
# which is where the Chrome Web Store looks for it. Sideload mode zips the
# wrapper folder, which is what the INSTALL.txt steps tell people to unpack.
if command -v zip >/dev/null 2>&1; then
  if [ "$STORE" = true ]; then
    zip -r "$PROJECT_DIR/$ZIP_NAME" .
  else
    zip -r "$PROJECT_DIR/$ZIP_NAME" "My Community"
  fi
elif command -v powershell.exe >/dev/null 2>&1; then
  # Git Bash on Windows ships no Info-ZIP. Compress-Archive is equivalent here,
  # and needs Windows-shaped paths. Without this the script only ever completed
  # on the Linux CI runner.
  echo "==> 'zip' not found, using PowerShell Compress-Archive"
  if [ "$STORE" = true ]; then
    SRC="$(cygpath -w "$STAGE_DIR")\\*"
  else
    SRC="$(cygpath -w "$STAGE_DIR/My Community")"
  fi
  powershell.exe -NoProfile -NonInteractive -Command \
    "Compress-Archive -Path '$SRC' -DestinationPath '$(cygpath -w "$PROJECT_DIR/$ZIP_NAME")' -Force"
else
  echo "Error: neither 'zip' nor PowerShell is available to create the archive." >&2
  exit 1
fi

# Cleanup staging
rm -rf "$STAGE_DIR"

echo "==> Done: $PROJECT_DIR/$ZIP_NAME"
if [ "$STORE" = true ]; then
  echo "==> Upload this to the Developer Dashboard. See Citizen-Infra/my-community#79"
  echo "    for the sequence — read the store's public key before publishing."
fi
