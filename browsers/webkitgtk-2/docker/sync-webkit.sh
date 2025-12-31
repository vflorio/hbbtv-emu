#!/bin/bash
# ==============================================================================
# CONTAINER SCRIPT: sync-webkit.sh
# Sincronizza il codice sorgente di WebKitGTK 2.2.6
# ==============================================================================

set -e

BUILD_DIR="/workspace/build"
SOURCE_TAR="webkitgtk-2.2.6a.tar.xz"
SOURCE_URL="https://webkitgtk.org/releases/$SOURCE_TAR"
 
echo "[SYNC] Starting WebKitGTK 2.2.6 sync process..."

cd "$BUILD_DIR"

if [ -d "webkitgtk-2.2.6" ]; then
    echo "[SYNC] Source already synced at: $BUILD_DIR/webkitgtk-2.2.6"
    exit 0
fi

# Download tarball if not present
if [ ! -f "$SOURCE_TAR" ]; then
    echo "[SYNC] Downloading $SOURCE_TAR from $SOURCE_URL..."
    curl -L -o "$SOURCE_TAR" "$SOURCE_URL" || {
        echo "[SYNC] ERROR: Failed to download $SOURCE_TAR"
        echo "[SYNC] You can manually download it from: $SOURCE_URL"
        echo "[SYNC] And place it in the build directory"
        exit 1
    }
    echo "[SYNC] ✓ Download completed"
else
    echo "[SYNC] Using existing tarball: $SOURCE_TAR"
fi

echo "[SYNC] Extracting $SOURCE_TAR..."
tar -xf "$SOURCE_TAR"

echo ""
echo "[SYNC] ✓ Sync completed successfully!"
echo "[SYNC] Source ready at: $BUILD_DIR/webkitgtk-2.2.6"
