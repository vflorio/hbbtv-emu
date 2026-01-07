#!/bin/bash

set -e

CHROMIUM_DIR="/home/chromium/src"
BUILD_TYPE="${1:-Release}"  # Release or Debug
TARGET="${2:-chrome}"       # chrome, content_shell, etc.

echo "[BUILD] Starting Chromium 47 build..."
echo "[BUILD] Type: $BUILD_TYPE"
echo "[BUILD] Target: $TARGET"

cd "$CHROMIUM_DIR"

# Verify we're on the correct version
CURRENT_TAG=$(git describe --tags 2>/dev/null || echo "unknown")
echo "[BUILD] Building from: $CURRENT_TAG"

# Setup GYP (Chromium 47 uses GYP, not GN)
export GYP_DEFINES="disable_nacl=1 remove_webcore_debug_symbols=1"
export GYP_GENERATORS="ninja"

# Generate build files
echo "[BUILD] Generating build files with GYP..."
python build/gyp_chromium || {
    echo "[BUILD] ERROR: GYP generation failed"
    exit 1
}

# Determine output directory
if [ "$BUILD_TYPE" = "Debug" ]; then
    OUT_DIR="out/Debug"
else
    OUT_DIR="out/Release"
fi

echo "[BUILD] Output directory: $OUT_DIR"

# Run the build
echo "[BUILD] Starting ninja build (this will take a while)..."
echo "[BUILD] Target: $TARGET"

ninja -C "$OUT_DIR" "$TARGET" -j $(nproc) || {
    echo "[BUILD] ERROR: Build failed"
    echo "[BUILD] Check the output above for errors"
    exit 1
}

# Build succeeded
echo ""
echo "[BUILD] ✓ Build completed successfully!"
echo "[BUILD] Binary location: $CHROMIUM_DIR/$OUT_DIR/$TARGET"
echo ""
echo "[BUILD] Build summary:"
ls -lh "$CHROMIUM_DIR/$OUT_DIR/$TARGET" 2>/dev/null || echo "  Target not found as single file, check $OUT_DIR directory"

# Show output directory contents
echo ""
echo "[BUILD] Output directory contents:"
ls -lh "$CHROMIUM_DIR/$OUT_DIR/" | head -n 20
