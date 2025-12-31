#!/bin/bash
# ==============================================================================
# CONTAINER SCRIPT: entrypoint.sh
# Eseguito automaticamente all'avvio del container
# ==============================================================================

set -e

echo "==================================================================="
echo "  Chromium 47 Build Environment"
echo "==================================================================="
echo "depot_tools version: $(cd /home/chromium/depot_tools && git rev-parse --short HEAD)"
echo "DEPOT_TOOLS_UPDATE: $DEPOT_TOOLS_UPDATE"
echo "Python version: $(python --version 2>&1)"
echo "GCC version: $(gcc --version | head -n1)"
echo "==================================================================="
echo ""

# Execute the command passed to the container
exec "$@"
