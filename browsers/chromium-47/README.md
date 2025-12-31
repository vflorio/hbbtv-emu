# Chromium 47 Docker Build Environment

Sistema Docker per sincronizzare e compilare Chromium 47 in un ambiente isolato e riproducibile.

## 📁 Struttura

```
chromium47-build/
├── build-host.sh              # 🖥️  ESEGUI NELL'HOST (WSL/Linux)
├── Dockerfile                 # 🐋 Definizione immagine Docker
├── docker/
│   ├── entrypoint.sh         # 🔧 Script entrypoint container
│   ├── sync-chromium.sh      # 🔄 Script sync (eseguito nel container)
│   └── build-chromium.sh     # 🔨 Script build (eseguito nel container)
└── README.md
```

## 🚀 Quick Start

### 1. Build dell'immagine Docker
```bash
cd chromium47-build
chmod +x build-host.sh
./build-host.sh build-image
```

### 2. Sync del codice sorgente
```bash
./build-host.sh sync
```

### 3. Build di Chromium
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

# Sincronizza il codice sorgente di Chromium 47
./build-host.sh sync

# Compila Chromium 47
./build-host.sh build [Release|Debug] [target]

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
- `sync-chromium.sh` - Sync Chromium 47.0.2526.111
- `build-chromium.sh` - Compilazione con ninja

## 🔧 Build Personalizzata

### Debug build
```bash
./build-host.sh build Debug
```

### Build di target specifico
```bash
./build-host.sh build Release content_shell
```

### Shell interattiva per debug
```bash
./build-host.sh shell

# Dentro il container:
cd /home/chromium/src
python build/gyp_chromium
ninja -C out/Release chrome
```

## 📦 Dettagli Tecnici

### Base
- **OS**: Debian Jessie (repository archived)
- **Chromium**: Tag 47.0.2526.111 (ultima versione stabile 47.x)
- **depot_tools**: Checkout del 15 dicembre 2015
- **Build system**: GYP + Ninja

### Protezioni Implementate
1. ✅ depot_tools locked con `DEPOT_TOOLS_UPDATE=0`
2. ✅ gclient sync con flags `-D --force --reset --with_branch_heads`
3. ✅ git clean ripetuto due volte come da documentazione
4. ✅ install-build-deps.sh eseguito automaticamente
5. ✅ GYP configuration con NaCl disabilitato

### Storage
Il codice sorgente è persistente in un Docker volume:
- **Volume**: `chromium47-src`
- **Mount point**: `/home/chromium`
- **Dimensione stimata**: ~30-50 GB

## 🐛 Troubleshooting

### Se il sync fallisce
```bash
# Shell interattiva
./build-host.sh shell

# Nel container, verifica manualmente:
cd /home/chromium/src
git status
git remote -v
```

### Se la build fallisce
```bash
# Controlla i log di build nel container
./build-host.sh shell
cd /home/chromium/src
cat out/Release/build.log
```

### Reset completo
```bash
./build-host.sh cleanup
./build-host.sh full
```

## ⚠️ Note Importanti

1. **Tempo di build**: La prima build può richiedere 2-6 ore a seconda dell'hardware
2. **Spazio disco**: Necessari ~50GB per source + build artifacts
3. **RAM**: Raccomandati almeno 8GB, ideali 16GB
4. **CPU**: Il build scala con i core (usa `ninja -j N` per limitare)

## 📚 Riferimenti

- [Building Old Chromium Versions](https://www.chromium.org/developers/how-tos/get-the-code/working-with-release-branches/)
- [Chromium 47 Release Notes](https://chromereleases.googleblog.com/2015/12/stable-channel-update.html)
- Depot Tools: Locked to December 2015 commit
