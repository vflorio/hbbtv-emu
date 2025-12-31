# WebKitGTK 2.2.6 Docker Build Environment

Sistema Docker per compilare WebKitGTK 2.2.6 in un ambiente isolato e riproducibile.

## 📁 Struttura

```
webkitgtk-2/
├── build-host.sh              # 🖥️  ESEGUI NELL'HOST (WSL/Linux)
├── Dockerfile                 # 🐋 Definizione immagine Docker
├── docker/
│   ├── entrypoint.sh         # 🔧 Script entrypoint container
│   ├── sync-webkit.sh        # 🔄 Script sync (eseguito nel container)
│   └── build-webkit.sh       # 🔨 Script build (eseguito nel container)
└── README.md
```

## 🚀 Quick Start

### 1. Build dell'immagine Docker
```bash
cd webkitgtk-2
chmod +x build-host.sh
./build-host.sh build-image
```

### 2. Sync del codice sorgente
```bash
./build-host.sh sync
```

### 3. Build di WebKitGTK
```bash
./build-host.sh build
```

### Oppure tutto in un comando
```bash
./build-host.sh full
```

## 📝 Comandi Disponibili

### Host (WSL/Linux)

```bash
# Build solo l'immagine Docker
./build-host.sh build-image

# Sincronizza il codice sorgente
./build-host.sh sync

# Compila WebKitGTK 2.2.6
./build-host.sh build

# Shell interattiva nel container
./build-host.sh shell

# Processo completo (build image + sync + build)
./build-host.sh full

# Pulizia completa (rimuove immagine e volume)
./build-host.sh cleanup
```

### Container (esecuzione automatica)

Gli script nel container vengono eseguiti automaticamente dai comandi host:

- `entrypoint.sh` - Inizializzazione ambiente
- `sync-webkit.sh` - Scarica ed estrae webkitgtk-2.2.6a.tar.xz
- `build-webkit.sh` - Compilazione con make

## 🔧 Build Personalizzata

### Shell interattiva per debug
```bash
./build-host.sh shell

# Dentro il container:
cd /workspace/build
../webkitgtk-2.2.6/configure --prefix=/usr/local --disable-gtk-doc
make -j$(nproc)
```

## 🚀 Esecuzione

Dopo la build, i binari sono disponibili in `/workspace/build/Programs/`:
- `GtkLauncher` - Browser launcher per testing
- `MiniBrowser` - Browser minimale
- `jsc` - JavaScript console

Per eseguire da WSL, esporta i binari dal container:
```bash
./build-host.sh shell

# Nel container:
cd /workspace/build/Programs
export LD_LIBRARY_PATH=/workspace/build/.libs:$LD_LIBRARY_PATH
./GtkLauncher --onloaded-script /path/to/script.js http://example.com
```

## 📦 Dettagli Tecnici

### Base
- **OS**: Debian Jessie (repository archived)
- **WebKitGTK**: Version 2.2.6
- **GTK**: 3.0
- **Build system**: autotools + make

### Features
- ✅ Non-root user (webkit) per sicurezza
- ✅ Persistent build volume per velocizzare rebuild
- ✅ Self-contained packaging con tutte le librerie
- ✅ X11 forwarding per GUI testing
- ✅ Separazione host/container scripts

### Storage
- **Volume**: `webkitgtk-2-build`
- **Mount point**: `/workspace/build`
- **Dimensione stimata**: ~5-10 GB dopo build

## 🐛 Troubleshooting

### Se il build fallisce
```bash
# Shell interattiva per debug
./build-host.sh shell

# Nel container, controlla i log:
cd /workspace/build
tail -100 config.log
make V=1  # Verbose mode
```

### Se il sync fallisce
```bash
# Riprova il sync
./build-host.sh sync

# Se il download fallisce, scarica manualmente:
wget https://webkitgtk.org/releases/webkitgtk-2.2.6a.tar.xz
docker run --rm -v webkitgtk-2-build:/workspace/build -v $(pwd):/tmp alpine \
  cp /tmp/webkitgtk-2.2.6a.tar.xz /workspace/build/
./build-host.sh sync
```

### Reset completo
```bash
./build-host.sh cleanup
./build-host.sh full
```

## ⚠️ Note Importanti

1. **Tempo di build**: La build può richiedere 30-120 minuti a seconda dell'hardware
2. **Spazio disco**: Necessari ~10GB per source + build artifacts
3. **RAM**: Raccomandati almeno 4GB, ideali 8GB
4. **CPU**: Il build scala con i core (usa `make -jN` per limitare)

## 📚 Riferimenti

- [WebKitGTK Official Site](https://webkitgtk.org/)
- [WebKitGTK 2.2.6 Release](https://webkitgtk.org/releases/webkitgtk-2.2.6.tar.xz)
- Build environment: Debian Jessie (archived)
