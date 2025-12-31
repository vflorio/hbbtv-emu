#!/bin/bash
# ==============================================================================
# CONTAINER SCRIPT: sync-chromium.sh
# Sincronizza il codice sorgente di Chromium 47
# ==============================================================================

set -e

CHROMIUM_DIR="/home/chromium"
CHROMIUM_TAG="47.0.2526.111"  # Last stable Chromium 47 release

echo "[SYNC] Starting Chromium 47 sync process..."
echo "[SYNC] Target: $CHROMIUM_TAG"

cd "$CHROMIUM_DIR"

# Initialize gclient if not already done
if [ ! -f .gclient ]; then
    echo "[SYNC] Initializing gclient..."
    mkdir -p src
    cd "$CHROMIUM_DIR"
    
    cat > .gclient << EOF
solutions = [
  {
    "name": "src",
    "url": "https://chromium.googlesource.com/chromium/src.git",
    "managed": False,
    "custom_deps": {},
    "custom_vars": {},
  },
]
EOF
    echo "[SYNC] ✓ .gclient created"
fi

# Navigate to src directory
cd "$CHROMIUM_DIR/src" || {
    echo "[SYNC] Creating src directory..."
    mkdir -p "$CHROMIUM_DIR/src"
    cd "$CHROMIUM_DIR/src"
}

# Clone or update Chromium source
if [ ! -d .git ]; then
    echo "[SYNC] Cloning Chromium repository..."
    git clone https://chromium.googlesource.com/chromium/src.git .
else
    echo "[SYNC] Chromium repository already exists"
fi

# Get the commit date for the target tag
echo "[SYNC] Checking out tag: $CHROMIUM_TAG"
git fetch --tags
git checkout "tags/$CHROMIUM_TAG"

COMMIT_DATE=$(git log -n 1 --pretty=format:%ci)
echo "[SYNC] Commit date: $COMMIT_DATE"

# Update depot_tools to matching version (already done in Dockerfile, but verify)
echo "[SYNC] Verifying depot_tools version..."
DEPOT_TOOLS_DIR="/home/chromium/depot_tools"
cd "$DEPOT_TOOLS_DIR"
CURRENT_COMMIT=$(git rev-parse --short HEAD)
echo "[SYNC] depot_tools at: $CURRENT_COMMIT"

# Clean working directory
echo "[SYNC] Cleaning working directory..."
cd "$CHROMIUM_DIR/src"
git clean -ffd || true
git clean -ffd || true  # Run twice as per instructions

# Sync dependencies
echo "[SYNC] Syncing dependencies with gclient..."
cd "$CHROMIUM_DIR"
gclient sync -D --force --reset --with_branch_heads

# Run install-build-deps if it exists
if [ -f "$CHROMIUM_DIR/src/build/install-build-deps.sh" ]; then
    echo "[SYNC] Running install-build-deps.sh..."
    sudo "$CHROMIUM_DIR/src/build/install-build-deps.sh" --no-prompt --no-chromeos-fonts || {
        echo "[SYNC] Warning: install-build-deps.sh failed, continuing anyway..."
    }
fi

# Verify the checkout
echo "[SYNC] Verification:"
cd "$CHROMIUM_DIR/src"
echo "  - Current branch/tag: $(git describe --tags)"
echo "  - Commit: $(git rev-parse --short HEAD)"
echo "  - Date: $(git log -n 1 --pretty=format:%ci)"

echo ""
echo "[SYNC] ✓ Sync completed successfully!"
echo "[SYNC] Source ready at: $CHROMIUM_DIR/src"
