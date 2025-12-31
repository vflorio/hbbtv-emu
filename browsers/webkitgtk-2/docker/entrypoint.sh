#!/bin/bash
# ==============================================================================
# CONTAINER SCRIPT: entrypoint.sh
# Eseguito automaticamente all'avvio del container
# ==============================================================================

set -e

echo "==================================================================="
echo "  WebKitGTK 2.2.6 Build Environment"
echo "==================================================================="
echo "GCC version: $(gcc --version | head -n1)"
echo "Python version: $(python --version 2>&1)"
echo "Make version: $(make --version | head -n1)"
echo "==================================================================="
echo ""

# Execute the command passed to the container
exec "$@"
