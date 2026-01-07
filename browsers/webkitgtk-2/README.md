# WebKitGTK 2.2.6

## Quick Start

```bash
chmod +x build-host.sh
./build-host.sh full
```

## Commands

```bash
./build-host.sh build-image  # Build Docker image
./build-host.sh sync         # Sync source code
./build-host.sh build        # Compile WebKitGTK
./build-host.sh shell        # Interactive shell
./build-host.sh full         # Complete process
./build-host.sh cleanup      # Remove image and volume
```

## Binaries

After build, binaries are in `/workspace/build/Programs/`:
- `GtkLauncher`
- `MiniBrowser`
- `jsc`