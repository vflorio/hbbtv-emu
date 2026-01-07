# Chromium 47

## Quick Start

```bash
chmod +x build-host.sh
./build-host.sh full
```

## Commands

```bash
./build-host.sh build-image            # Build Docker image
./build-host.sh sync                   # Sync source code
./build-host.sh build [Release|Debug]  # Compile Chromium
./build-host.sh shell                  # Interactive shell
./build-host.sh full                   # Complete process
./build-host.sh cleanup                # Remove image and volume
```