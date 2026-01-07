#!/bin/bash
set -e

CHROMIUM_DIR="/home/chromium/chromium"
CHROMIUM_TAG="47.0.2526.111"  # Last stable Chromium 47 release

echo "[SYNC] Starting Chromium 47 sync process..."
echo "[SYNC] Target: $CHROMIUM_TAG"
echo ""

mkdir -p "$CHROMIUM_DIR"
cd "$CHROMIUM_DIR"

# Step 1: Initialize gclient configuration if not present
if [ ! -f .gclient ]; then
    echo "[SYNC] Step 1/4: Initializing gclient configuration..."
    cat > .gclient << 'EOF'
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
else
    echo "[SYNC] Step 1/4: Using existing .gclient configuration"
fi

# Step 2: Fetch Chromium source using depot_tools
if [ ! -d src/.git ]; then
    echo "[SYNC] Step 2/4: Fetching Chromium source (this will take a while)..."
    echo "[SYNC] Using fetch tool for efficient initial sync..."
    
    # Use fetch chromium which is more robust than direct git clone
    cd "$CHROMIUM_DIR"
    fetch --nohooks chromium || {
        echo "[SYNC] ERROR: fetch failed. Retrying with gclient sync..."
        mkdir -p src
        cd src
        git init
        git remote add origin https://chromium.googlesource.com/chromium/src.git
        git fetch --depth=1 origin "refs/tags/$CHROMIUM_TAG:refs/tags/$CHROMIUM_TAG"
        git checkout "tags/$CHROMIUM_TAG"
        cd ..
    }
else
    echo "[SYNC] Step 2/4: Chromium source already present"
fi

# Step 3: Checkout the specific tag
echo "[SYNC] Step 3/4: Checking out tag $CHROMIUM_TAG..."
cd "$CHROMIUM_DIR/src"

# Ensure we have the tag
git fetch --tags origin || git fetch --tags

# Checkout the tag
git checkout "tags/$CHROMIUM_TAG" || {
    echo "[SYNC] WARNING: Failed to checkout tag directly, trying with refs..."
    git checkout "refs/tags/$CHROMIUM_TAG"
}

COMMIT_DATE=$(git log -n 1 --pretty=format:%ci)
echo "[SYNC] ✓ Checked out: $CHROMIUM_TAG"
echo "[SYNC] Commit date: $COMMIT_DATE"

# Clean working directory (run twice as per documentation)
echo "[SYNC] Cleaning working directory..."
git clean -ffd || true
git clean -ffd || true

# Step 4: Sync dependencies with gclient
echo "[SYNC] Step 4/4: Syncing dependencies (this will take a long time)..."
cd "$CHROMIUM_DIR"

echo "[SYNC] Running gclient sync -D --force --reset --with_branch_heads..."
gclient sync -D --force --reset --with_branch_heads --verbose || {
    echo "[SYNC] WARNING: gclient sync encountered issues, retrying..."
    # Verify git remote is correct
    cd src
    CURRENT_REMOTE=$(git remote get-url origin)
    if [ "$CURRENT_REMOTE" != "https://chromium.googlesource.com/chromium/src.git" ]; then
        echo "[SYNC] Fixing incorrect remote URL..."
        git remote set-url origin https://chromium.googlesource.com/chromium/src.git
        git fetch origin
    fi
    cd ..
    gclient sync -D --force --reset --with_branch_heads
}

# Run install-build-deps if it exists
if [ -f "$CHROMIUM_DIR/src/build/install-build-deps.sh" ]; then
    echo "[SYNC] Running install-build-deps.sh..."
    cd "$CHROMIUM_DIR/src"
    sudo ./build/install-build-deps.sh --no-prompt --no-chromeos-fonts || {
        echo "[SYNC] Warning: install-build-deps.sh failed, continuing anyway..."
    }
fi

# Verification
echo ""
echo "[SYNC] =========================================="
echo "[SYNC] Verification:"
cd "$CHROMIUM_DIR/src"
echo "[SYNC]   Tag: $(git describe --tags 2>/dev/null || echo $CHROMIUM_TAG)"
echo "[SYNC]   Commit: $(git rev-parse --short HEAD)"
echo "[SYNC]   Date: $(git log -n 1 --pretty=format:%ci)"
echo "[SYNC]   depot_tools: $(cd /home/chromium/depot_tools && git rev-parse --short HEAD)"
echo "[SYNC] =========================================="
echo ""
echo "[SYNC] ✓ Sync completed successfully!"
echo "[SYNC] Source ready at: $CHROMIUM_DIR/src"
echo "[SYNC] Total size: $(du -sh $CHROMIUM_DIR | cut -f1)"
