#!/bin/bash
# ==============================================================================
# HOST SCRIPT: build-host.sh
# Da eseguire in WSL/Linux con Docker installato
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_NAME="chromium47-builder"
CONTAINER_NAME="chromium47-build"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[HOST]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[HOST]${NC} $1"
}

log_error() {
    echo -e "${RED}[HOST]${NC} $1"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    log_error "Docker non trovato. Installa Docker prima di continuare."
    exit 1
fi

# Build the Docker image
build_image() {
    log_info "Building Docker image: $IMAGE_NAME"
    docker build -t "$IMAGE_NAME" "$SCRIPT_DIR"
    log_info "✓ Docker image built successfully"
}

# Create volume for persistent chromium source
create_volume() {
    if ! docker volume inspect chromium47-src &> /dev/null; then
        log_info "Creating Docker volume: chromium47-src"
        docker volume create chromium47-src
    else
        log_info "Volume chromium47-src already exists"
    fi
}

# Run container interactively
run_interactive() {
    log_info "Starting interactive container"
    docker run -it --rm \
        --name "$CONTAINER_NAME" \
        -v chromium47-src:/home/chromium \
        "$IMAGE_NAME" bash
}

# Sync chromium source
sync_chromium() {
    log_info "Syncing Chromium 47 source code..."
    docker run --rm \
        --name "$CONTAINER_NAME-sync" \
        -v chromium47-src:/home/chromium \
        "$IMAGE_NAME" /home/chromium/sync-chromium.sh
}

# Build chromium
build_chromium() {
    log_info "Building Chromium 47..."
    docker run --rm \
        --name "$CONTAINER_NAME-build" \
        -v chromium47-src:/home/chromium \
        "$IMAGE_NAME" /home/chromium/build-chromium.sh "$@"
}

# Clean up
cleanup() {
    log_warn "Removing Docker image and volume..."
    docker rmi "$IMAGE_NAME" 2>/dev/null || true
    docker volume rm chromium47-src 2>/dev/null || true
    log_info "✓ Cleanup complete"
}

# Show usage
usage() {
    cat << EOF
Usage: $0 [command]

Commands:
    build-image     Build the Docker image
    sync            Sync Chromium 47 source code
    build           Build Chromium 47
    shell           Open interactive shell in container
    cleanup         Remove Docker image and volume
    full            Run complete process (build image + sync + build)

Examples:
    $0 build-image      # Solo build dell'immagine Docker
    $0 sync             # Solo sync del codice sorgente
    $0 build            # Solo build di Chromium
    $0 shell            # Shell interattiva nel container
    $0 full             # Processo completo

EOF
}

# Main
case "${1:-}" in
    build-image)
        build_image
        ;;
    sync)
        create_volume
        sync_chromium
        ;;
    build)
        shift
        build_chromium "$@"
        ;;
    shell)
        create_volume
        run_interactive
        ;;
    cleanup)
        cleanup
        ;;
    full)
        build_image
        create_volume
        sync_chromium
        build_chromium
        ;;
    *)
        usage
        exit 1
        ;;
esac

log_info "Done!"
