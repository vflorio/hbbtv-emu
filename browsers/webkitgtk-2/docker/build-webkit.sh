#!/bin/bash
# ==============================================================================
# CONTAINER SCRIPT: build-webkit.sh
# Compila WebKitGTK 2.2.6
# ==============================================================================

set -e

BUILD_DIR="/workspace/build"
SOURCE_DIR="$BUILD_DIR/webkitgtk-2.2.6"

echo "[BUILD] Starting WebKitGTK 2.2.6 build..."

if [ ! -d "$SOURCE_DIR" ]; then
    echo "[BUILD] ERROR: Source not found at: $SOURCE_DIR"
    echo "[BUILD] Run extract command first"
    exit 1
fi

cd "$BUILD_DIR"

# Configure if not already done
if [ ! -f Makefile ]; then
    echo "[BUILD] Configuring WebKitGTK..."
    "$SOURCE_DIR/configure" \
        --prefix=/usr/local \
        --disable-gtk-doc \
        --enable-introspection \
        --with-gtk=3.0 || {
        echo "[BUILD] ERROR: Configuration failed"
        exit 1
    }
    echo "[BUILD] ✓ Configuration complete"
else
    echo "[BUILD] Using existing configuration"
fi

# Compile
echo "[BUILD] Compiling WebKitGTK (this will take a while)..."
echo "[BUILD] Using $(nproc) parallel jobs"

make -j$(nproc) || {
    echo "[BUILD] ERROR: Build failed"
    exit 1
}

echo ""
echo "[BUILD] ✓ Build completed successfully!"
echo "[BUILD] Binaries location: $BUILD_DIR/Programs/"
echo ""
echo "[BUILD] Built programs:"
ls -lh "$BUILD_DIR/Programs/" 2>/dev/null || echo "  No programs directory found"
