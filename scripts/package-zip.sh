#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Parse args
SKIP_BUILD=false
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

# Read version from extension/package.json
VERSION=$(node -p "require('$PROJECT_DIR/extension/package.json').version")
ZIP_NAME="My-Community-v${VERSION}.zip"
STAGE_DIR="$PROJECT_DIR/.zip-stage"

echo "==> Packaging My Community v${VERSION} (zip)"

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
mkdir -p "$STAGE_DIR/My Community/extension"

# Copy built extension
cp -R "$PROJECT_DIR/extension/dist/." "$STAGE_DIR/My Community/extension/"

# Generate INSTALL.txt
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

# Remove old zip if present
rm -f "$PROJECT_DIR/$ZIP_NAME"

# Create zip
echo "==> Creating $ZIP_NAME..."
cd "$STAGE_DIR"
zip -r "$PROJECT_DIR/$ZIP_NAME" "My Community"

# Cleanup staging
rm -rf "$STAGE_DIR"

echo "==> Done: $PROJECT_DIR/$ZIP_NAME"
