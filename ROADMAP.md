# HbbTV Emulator — Roadmap

> Documento vivo. Branch di sviluppo: `isomorphic-runtime`. Il branch `main` (0.1.0) è solo **fonte di codice di riferimento**.

## Visione

Un emulatore HbbTV conforme alle API OIPF/HbbTV, abbastanza preciso da sostituire (in fase di sviluppo e QA) una TV reale, **su più motori web**, inclusi quelli molto vecchi presenti sulle TV in commercio (es. Tizen 2.4 → WebKit r152340, non Chromium).

Il progetto cresce in tre fasi:

| Fase | Obiettivo | In una frase |
|------|-----------|--------------|
| **1** | Runtime isomorfo | La stessa runtime OIPF gira su Chrome MV3, Chrome MV2, Firefox e WebKit legacy, cambiando solo l'"host". |
| **2** | TV emulata | Una TV virtuale con più canali, AIT, menu di navigazione, stream reali e Stream Events schedulati (es. per testare DAI e integrazioni tra partner). |
| **3** | App standalone | Un'app che scarica/configura i browser supportati e apre la stessa app HbbTV su N engine in parallelo. |

---

## Concetti chiave (glossario)

- **Page runtime** — il codice iniettato nella pagina HbbTV (MAIN world): oggetti OIPF (`application/oipfApplicationManager`, `video/broadcast`, A/V Control, …), sottosistemi (canali, telecomando, stream events, player). Deve girare sull'engine **più vecchio** supportato.
- **Control plane** — stato condiviso, persistenza, UI di configurazione, orchestrazione dei tab. In un'estensione è il background; dove non ci sono estensioni (WebKit) deve vivere **fuori dal browser**.
- **Host** — la combinazione *engine + meccanismo di iniezione + trasporto messaggi*. Es: `chrome-v3` (service worker + `scripting` + DNR), `chrome-v2` (background page + `webRequestBlocking`), `firefox-v2`, `webkit-preload` (hook nativo nel fork).
- **Port** — interfaccia astratta che la runtime usa e che ogni host implementa (storage, messaging, injection, rewrite del content-type, user agent, ciclo di vita dei tab). Oggi: `packages/extension-runtime/src/adapter/*`.
- **Device profile** — descrizione di una TV specifica: versione HbbTV, UA, capabilities, keyset, risoluzione, quirk noti.
- **Scenario** — configurazione esportabile di una TV emulata: device profile + lineup canali + AIT + stream + schedule degli stream event.

---

## Stato attuale

### `main` (0.1.0) — funzionante su Chrome MV3
- `apps/chrome-v3`: background (service worker), bridge script (ISOLATED), content script (MAIN), side panel UI. Flusso in `initialization-flow.mmd`.
- `packages/runtime`: API OIPF (ApplicationManager, Capabilities, Configuration, VideoBroadcast, AVControl), sottosistemi (channelRegistry, currentChannel, provider/detection, remoteControl, streamEventScheduler, userAgent, videoStream).
- `packages/player/*`: player runtime a state machine (testato), adapter web (native/HLS.js/dash.js) e HbbTV, UI di debug.
- `packages/settings-ui`: UI completa (canali, stream events, telecomando, capabilities, …).
- Pattern a **mixin** (`core/src/mixin.ts` → `compose(...)`) su VideoBroadcast, AVControl e sugli script dell'estensione. **Da abbandonare.**
- Bug noto: il telecomando non funziona.

### `isomorphic-runtime` — struttura nuova, parziale
- `extensions/{chrome-v3,chrome-v2,firefox-v2}`: entrypoint sottili che istanziano lo stesso `BackgroundService` con un `AdapterConfig` diverso. ✅ idea giusta.
- `packages/extension-runtime`: adapter (messaging, storage, tabs, webRequest) parametrizzati per manifest; `BackgroundService` + `StateManager` + `TabsManager` (fp-ts). Servizi `bridge`, `content`, `ui` **ancora commentati**.
- `packages/oipf/{api,runtime}`: copiati da `main`, **ancora a mixin** e ancora dipendenti da `@hbb-emu/extension-common`.
- `packages/core/logger`: nuovo logger configurabile da stato.
- `browsers/{chromium-47,webkitgtk-2}`: build Docker dei motori legacy.
- Vecchia architettura parcheggiata in `apps/chrome-v3_old` e `packages/extension_old`.

### Altri branch
- `origin/webkit-r152340`: `apps/runtime-standalone` con pipeline Babel/Vite per ES5 + polyfill (target Tizen 2.4). **Da riusare** per il build della page runtime legacy.
- `origin/fork/functional-player`: evoluzione del player + integrazione FreeWheel. Progetto separato; valutare in seguito cosa far rientrare (vedi Fase 2, DAI).

### Problemi già individuati sul branch
- [x] Build verde con Bun + turbo (13/13 package, 3 estensioni). Restano le dipendenze verso `packages/extension_old` in 8 package.
- [x] L'attach `non-visual` costruiva l'IO del proxy senza eseguirlo: gli `<object>` non visuali dichiarati nel markup non avevano nessun metodo OIPF (bug presente anche su `main`). Trovato dai test, corretto.
- [x] Il logger stampava anche i livelli disabilitati (`O.fromNullable(false)` è `Some`). Trovato dai test, corretto.
- [x] `ExtensionState.enabledTabIds` (un `Set`, che lo storage JSON restituiva come `{}`: ogni aggiornamento dopo un riavvio del service worker lanciava `enabledTabIds is not iterable`) era scritto e mai letto: rimosso, e il caricamento dello stato salvato scarta la chiave lasciata dalle versioni precedenti. Lo stato per tab arriverà con la TvSession (D5), in `chrome.storage.session`.
- [x] `TabsManager` usava `webRequest.onHeadersReceived` con `"blocking"` anche in **MV3**, che non lo consente: il background andava in errore all'avvio. Ora in MV3 il listener osserva soltanto e il rewrite del content-type lo fa la regola DNR. Resta da portare dietro una **port** `ContentTypeRewrite` vera (1.1).
- [x] **Refactoring "class arrow methods" a metà**: questo branch è nato dopo il commit `301f009` di `main` ma prima del suo revert (`59fa367`). Alcuni metodi sono passati da `x: IO` a `x = (): IO => …` senza aggiornare i chiamanti, e TypeScript non lo segnala (`IO.tap(() => obj.start)` è un `IO<IO>` valido). Risultato: `RuntimeService.start/stop` non avviava né fermava mai provider e scheduler degli stream event, quindi **nessun oggetto OIPF veniva mai collegato**. Corretto; cercati gli altri casi con uno script, non ne risultano altri. Restano possibili negli stessi pattern: attenzione nei porting.
- [x] `Keyset` non esponeva `value` né le costanti OIPF (`RED` … `OTHER`), e i tipi "della spec" avevano valori inventati (`KeysetMask`, `BACK = 8`). Corretto; mancano ancora `maximumValue`, `otherKeys`, `getKey()`, `getKeyIcon()`.
- [x] Tipi della spec: `ChannelIdType` aveva valori inventati (`ID_DVB_T = 2` invece di 12, ecc.). Corretti secondo OIPF DAE (Channel class constants). `Keyset.setValue()` restituisce la maschera dei tasti consegnati.
- [ ] Rivedere gli altri enum/costanti di `oipf-api` contro la spec: diversi sono stati scritti a memoria e sono risultati sbagliati.
  - [x] `ChannelConfig` aveva due metodi inventati (`getChannelWithTriplet`, `getChannelByNumber`), rimossi; `ChannelList.getChannel()`/`getChannelByTriplet()` restituiscono `null`, non `undefined`.
  - [x] I codec numerici dello stato (`model/`) sono generati dagli enum di `specification/` (`enumCodec`), quindi non possono più divergere. Erano sbagliati `ChannelIdTypeCodec` (`ID_DVB_T = 2` invece di 12) e `AVControlErrorCodeCodec` (nomi `MEDIA_ERR_*` di HTML5, mancavano 6 e 7).
  - [x] Verificati sul testo di OIPF DAE R2 v2.3 ([oipf.tv/web-spec/volume5.html](https://oipf.tv/web-spec/volume5.html)): `ChannelIdType`, `PlayState` di video/broadcast e A/V Control, errori di A/V Control (0–6), `ChannelChangeErrorCode`, `DRMRightsErrorState`, `ChannelList` (§7.13.10, `getChannelByTriplet(onid, tsid, sid, nid?)` con `tsid` nullo = qualsiasi), `data` (§7.13.1.2), `nextChannel()`/`prevChannel()` e `bindToCurrentChannel()` (§7.13.1.3). Corretto `bindToCurrentChannel()`: da CONNECTING/PRESENTING non ha effetto (prima riprendeva lo stream), da UNREALIZED senza canale presentato manda `onPlayStateChange(0)`.
  - [ ] Ancora da verificare (sezioni non leggibili dalla pagina, 7.14.13.1 e 7.16.5): valori di `AllocationMethod` (oggi `DYNAMIC = 0`, `STATIC = 1`), gli enum `AudioType`/`SubtitleType` (forse in OIPF sono booleani, `audioDescription`/`hearingImpaired`). Il parametro `quiet` di `setChannel()` non è in OIPF DAE R2: da verificare in HbbTV TS 102 796; così come l'errore 7 di A/V Control (`PARENTAL_CONTROL_BLOCKED`).
- [x] `oipfObjectFactory` (OIPF DAE §7.1) non veniva installato su `window` e i `create*Object` restituivano `null` (anche su `main`; in più l'elemento creato non riceveva nemmeno il `type`, un altro `IO` dentro un `IO`). Ora è `window.oipfObjectFactory` dall'avvio della runtime, quindi c'è già al primo script dell'app (verificato in e2e su Chromium e Firefox). `isObjectSupported()` risponde secondo i predicati dei binding; `createVideoBroadcastObject()`, `createApplicationManagerObject()`, `createCapabilitiesObject()`, `createConfigurationObject()` restituiscono un `<object>` già collegato, che funziona anche senza essere inserito nel documento; `createChannelConfig()` dà la lineup. Gli altri `create…()` non esistono: chiamarli è un `TypeError`, come vuole la spec per un metodo non supportato.
  - [ ] `createVideoBroadcastObject(requiredCapabilities)` ignora le capability richieste, e `allocationMethod` non esiste.
  - [ ] Oggetti HbbTV 2.0 (`createMediaSynchroniser()`, `createCSManager()`), `createVideoMpegObject()`, `createStatusViewObject()`: da fare quando servono.
- [ ] Build: dash.js 5.1 non esporta `Errors`, importato da `player/adapters/web/src/dash.ts` → a runtime è `undefined`.
- [ ] `page-runtime.js` pesa ~1,6 MB (hls.js + dash.js) e viene caricato su ogni pagina http(s), anche se si avvia solo sui documenti HbbTV.
- [ ] La regola DNR con condizione `responseHeaders` richiede un Chrome recente (da verificare: ~128+). Per Chrome < 128 il percorso realistico è MV2 → la matrice target va definita per *versione di engine*, non solo per "manifest".

---

## Principi architetturali

1. **La page runtime non conosce l'host.** Dipende solo da port iniettate (Reader/env, già lo stile del codice). Nessun `chrome.*` fuori dagli adapter.
2. **Due target di build distinti.**
   - *Page runtime*: deve girare sull'engine più vecchio → ES5 + polyfill, bundle singolo, niente dipendenze pesanti obbligatorie (React in pagina solo opzionale).
   - *Control plane / UI*: gira nell'host (o fuori dal browser) → può essere moderno dove l'host lo è.
3. **Messaging come trasporto astratto.** Stesso protocollo di messaggi (discriminated union `_tag`), trasporti diversi: `chrome.runtime`, `window.postMessage` (MAIN↔ISOLATED), **WebSocket** (host senza estensioni e app standalone).
4. **Stato unico e serializzabile.** `ExtensionState` → evolve in `Scenario` (condiviso) + `TvSession` (per tab), vedi D5; codec io-ts come fonte di verità per validazione, import/export e migrazioni (`version`).
5. **La page runtime è usa-e-getta.** La sessione TV vive nel background; la pagina muore a ogni navigazione e la runtime si reidrata dalla sessione al caricamento.
6. **Niente mixin.** Composizione tramite `Reader` di fp-ts (vedi decisione D1).
7. **Unit test come parte del lavoro, non dopo.** Ogni modulo nuovo o portato da `main` arriva con i suoi test (Vitest). Le port e il `Reader` esistono anche per questo: ogni dipendenza si sostituisce con un fake. I test descrivono il *comportamento*, così sopravvivono ai refactoring.
8. **Fedeltà prima della comodità.** Ogni comportamento emulato deve rimandare alla sezione della spec (OIPF DAE / HbbTV TS 102 796) che implementa; le divergenze note di una TV reale vanno nei *device profile* come quirk, non nel codice base.

---

## Decisioni da prendere

- **D1 — Sostituto dei mixin.** ✅ *Deciso:* **`Reader` di fp-ts** per l'environment. Ogni oggetto OIPF è costruito da funzioni `Reader<Env, …>` (o `ReaderIO`/`ReaderTaskEither` dove servono effetti) che dichiarano esattamente le dipendenze di cui hanno bisogno; le parti (`channel`, `volume`, `display`, `streamEvent`, …) si compongono tramite l'environment invece che con l'ordine di ereditarietà, e si testano fornendo un env finto.
- **D2 — Control plane per host senza estensioni.** *Rimandata (WebKit a bassa priorità).* WebKit legacy non ha estensioni → stato e UI dovranno vivere in un processo esterno (server locale + WebSocket), che è anche il primo pezzo della Fase 3. Per ora basta non chiudersi la porta: messaging come trasporto astratto (principio 3).
- **D3 — Matrice target.** ✅ *Decisa per la Fase 1:*
  - Chrome recente → `chrome-v3` (MV3)
  - Chromium legacy (47 → ~127) → `chrome-v2` (MV2)
  - Firefox ESR recente → `firefox-v2` (MV2 resta supportato e mantiene `webRequest` bloccante)
  - WebKit r152340 / WebKitGTK 2.2.6 → più avanti
  L'engine lo sceglie l'utente; non serve una tabella TV → engine. La tabella di ~200k UA reali (disponibile) servirà in Fase 2 per pesare le versioni di engine e generare i preset dei device profile.
- **D4 — Stack app standalone** (Fase 3): Electron / Tauri / CLI + web UI. Si può rimandare, ma influenza D2.
- **D5 — Modello di sessione.** ✅ *Confermato:*
  - **Scenario** (lineup, AIT, device profile, stream, schedule): condiviso tra tutti i tab, persistito.
  - **TvSession** (canale corrente, app attiva, keyset, volume, player): **una per tab** (`tabId → TvSession`), nel background (`storage.session` su MV3, perché il service worker può morire).
  - **Cambio canale = navigazione del tab**, come su una TV reale: `setChannel()` → background → OSD + `onChannelChangeSucceeded` → regola AIT (l'app sopravvive se segnalata anche nel nuovo servizio, altrimenti `tabs.update` sull'app autostart del nuovo canale, oppure `tv.html?channel=N` se il canale non ha app).
  - **Le app restano top-level**, mai in iframe dentro una pagina d'estensione: in iframe sarebbero sempre third-party (cookie SameSite, storage partizionato, `window.top`, `X-Frame-Options`) e i test cross-site tra partner non sarebbero fedeli.
  - **Ingressi**: rilevamento automatico del content-type HbbTV; "Accendi la TV" dalla UI (scelta del canale); "Emula questo tab" manuale (app servite come `text/html`).
  - **Due modalità di sessione**:
    - *App* (tab aperto direttamente su un'app HbbTV, rilevamento automatico o manuale): un solo canale ad-hoc, **nessun cambio canale**. `setChannel()` verso un altro canale risponde con `onChannelChangeError` (proposta: errore 5 "unknown channel", configurabile) e un avviso nella UI.
    - *TV* (avviata da "Accendi la TV" su uno scenario): lineup completa, cambio canale tramite navigazione come sopra.
  - **Limite noto**: un solo profilo browser → i cookie sono condivisi tra tab-TV. In estensione c'è solo il "reset di fabbrica" (via `browsingData`); l'isolamento vero per TV arriva in Fase 3 (un profilo per istanza).

---

## Fase 0 — Consolidamento del branch

- [x] Package manager: pnpm → **Bun** (workspaces nel `package.json` di root, `bun.lock`).
- [x] Infrastruttura di test: config Vitest condivisa (`vitest.shared.ts`), script `test` per package, `bun run test` dalla root via turbo.
- [ ] Ripristinare una build verde (`bun install && bun run build`) su `isomorphic-runtime`.
- [ ] Eliminare la dipendenza da `@hbb-emu/extension-common`: spostare i tipi davvero condivisi (`ExtensionState`, messaggi) in un package nuovo e host-agnostic (es. `@hbb-emu/protocol`).
- [ ] Rimuovere `apps/chrome-v3_old` e `packages/extension_old` dal workspace quando non servono più come riferimento (restano consultabili su `main`).
- [x] Decidere D1 → `Reader` di fp-ts.
- [x] Portare una parte piccola come modello: `volume` del VideoBroadcast in stile `Reader` (`ReaderIO` + `IORef` iniettato), con test unitari e d'integrazione. Collegato alla classe esistente tramite un ponte temporaneo (`WithVolume`), da rimuovere quando VideoBroadcast sarà portato del tutto.
- [x] Definire D3 (matrice target).
- [ ] CI minima: build + lint + test unitari.
- [ ] Assorbire il vecchio file `TODO` in questa roadmap.

## Fase 1 — Runtime isomorfo + host multipli

### 1.1 Port (contratto host)
- [ ] `StorageAdapter` ✅ (MV2/MV3) — aggiungere implementazioni `localStorage` e "remote" (WebSocket).
- [ ] `MessagingAdapter` ✅ base — generalizzare a trasporti: `chrome.runtime`, `postMessage`, WebSocket.
- [ ] `TabsAdapter` ✅ base — gestire anche chiusura tab, reload, navigazione cross-origin.
- [ ] `ContentTypeRewrite` (nuova): `webRequestBlocking` (MV2/Firefox), DNR (MV3), nativo (WebKit fork / app standalone).
- [ ] `ScriptInjection`: content script `world: "MAIN"` (MV3) ✅, `<script>` inline iniettato a `document_start` da un content script solo nei documenti HbbTV (`injectIntoHbbTVDocument`, MV2) ✅ su Firefox, hook di preload (WebKit fork).
  - [ ] **CSP**: una policy senza `'unsafe-inline'` blocca lo script inline (verificato su Firefox 158), quindi la runtime non parte. Strada: col `webRequest` blocking, aggiungere a `script-src` l'hash dello script della runtime, noto al build; la config passa già per `wrappedJSObject`/clone su Firefox oppure con un secondo hash. Le CSP in `<meta>` restano escluse.
- [x] `UserAgentAdapter`: header `User-Agent` su ogni richiesta http(s) (regola DNR di sessione su MV3, `webRequest.onBeforeSendHeaders` blocking su MV2/Firefox). Applicato all'avvio del background e a ogni cambio dalla UI.
  - [ ] Oggi vale per tutto il browser, non solo per i tab TV: restringerlo ai tab della TvSession (D5) quando esiste (`tabIds` nella condizione DNR). Il problema: la prima richiesta di una pagina parte prima di sapere se è HbbTV.
  - [ ] Flag di lancio del browser (app standalone, fase 3).

### 1.2 Servizi
- [ ] **Background**: completare routing dei messaggi, propagazione dello stato a tutti i tab/UI, ciclo di vita tab (oggi solo `onTabAdded/Removed` con TODO).
- [ ] **Separare lo stato** in `Scenario` (condiviso) e `TvSession` (per tab), secondo D5; la sessione sopravvive alle navigazioni dello stesso tab e al riavvio del service worker MV3.
  - [x] **TvSession per tab**, modalità *App*: aperta dal primo `Page/Ready` di un tab, mantenuta tra le navigazioni e i reload, chiusa con il tab (`tabs.onRemoved`; prima "unloaded" contava come chiusura, e ogni "loading" loggava "Tab added"). Persistita in `chrome.storage.session` su MV3, in memoria su MV2 (background persistente); al riavvio si scartano le sessioni dei tab chiusi e quelle non valide. Oggi contiene il canale sintonizzato; la pagina la riceve con `Host/Session`, dopo `Host/Config`. Verificata in e2e su Chromium e Firefox.
  - [x] **Canale iniziale dall'AIT**: la pagina parte sul canale la cui AIT segnala la sua app (URL esatto, altrimenti stessa origine = application boundary di default), il primo della lineup se nessuno la segnala. Con il bootstrap sincrono il primo script dell'app lo legge già giusto (`privateData.currentChannel`, verificato in e2e su Chromium e Firefox); il background apre la sessione del tab con la stessa regola, quindi `Host/Session` non la risintonizza.
  - [x] **Canale per tab nel bootstrap**: il bootstrap è uno solo per tutti i tab (nessun host sa iniettare per tab), quindi porta anche le *tuning* `{ url, channelId }`, cioè la pagina che mostra ogni TV e il suo canale. Regola comune a pagina e background (`initialChannel` in `@hbb-emu/protocol`): TV che mostra quella pagina → canale che la segnala nell'AIT → primo della lineup. Ripubblicato (in serie, solo se cambia) quando una pagina parte, quando la UI cambia canale e quando un tab si chiude. Verificato in e2e su Chromium e Firefox: dopo il reload il primo script vede il canale scelto dalla UI. È anche il meccanismo con cui la modalità *TV* darà il canale prima di navigare (sessione aggiornata con l'URL di destinazione, poi navigazione).
    - Limite: una pagina mostrata da due TV su canali diversi non ha indicazione (vale l'AIT, poi `Host/Session` corregge). Un tab nuovo aperto sulla pagina di un'altra TV ne prende il canale (pagina e sessione concordano).
    - Il bootstrap ora espone i dati solo nei documenti HbbTV (su MV3 lo user script gira in tutte le pagine).
  - [x] **Modalità *TV***: "Turn on the TV" dalla settings UI (per canale) apre un tab nuovo con una sessione in modalità `tv`. La sessione, con l'URL di destinazione, e il bootstrap sono pronti *prima* della navigazione (il tab nasce su `about:blank`), quindi il primo script dell'app vede il canale giusto anche quando più canali segnalano la stessa app allo stesso URL. Il tab carica l'app AUTOSTART del canale, oppure `tv.html?channel=<id>` se il canale non ne ha.
    - Cambio canale dalla UI ("Play here") secondo l'AIT (`changeChannel`): l'app in esecuzione (stessi `orgId`/`appId`) sopravvive se il nuovo canale la segnala e si risintonizza; altrimenti il tab carica l'app autostart del nuovo canale o la pagina TV. In modalità *app* il cambio canale risintonizza soltanto la pagina, come prima.
    - Verificato in e2e su Chromium e Firefox: DMAX e HGTV segnalano la stessa app allo stesso URL; acceso su HGTV, il primo script vede HGTV; passando a DMAX l'app resta in esecuzione; su un canale senza AIT il tab passa a `tv.html`.
    - [x] `setChannel()` dell'app verso un altro servizio della lineup: la page runtime chiede al background (`Page/SetChannel`), che applica la stessa regola della UI (`changeTabChannel`) e risponde con la nuova sessione (`Host/Session`: l'app resta e si risintonizza), con una navigazione, o con `Host/ChannelChangeError`. In modalità *app* l'errore è 5 ("unknown channel") e l'app resta sul suo canale; la UI invece può ancora risintonizzarla. Verso il servizio su cui la TV è già, o un canale fuori lineup (errore 5), la pagina decide da sola. Senza host (`tuneAlone`) l'oggetto si sintonizza e basta. La sintonizzazione dell'host (`tune`) non passa più da `setChannel()`, quindi non chiede nulla. `createChannelObject()` restituisce il canale della lineup per il triplet DVB (oppure un canale sconosciuto). Verificato in e2e su Chromium e Firefox: da DMAX a HGTV l'app resta in esecuzione e la UI mostra HGTV; verso NEWS il tab carica la sua app, già su NEWS al primo script; un'app aperta da sola riceve l'errore 5.
      - [ ] Manca l'avviso nella UI quando un'app in modalità *app* chiede un altro canale (oggi c'è solo un warning nel log del background), e l'errore non è configurabile.
      - [x] Ogni richiesta ha una risposta. Quando il nuovo canale mostra un'altra pagina, il background manda alla pagina la nuova sessione *prima* di navigare, come una TV che si sintonizza e solo dopo chiude l'app per l'AIT del nuovo servizio: il `setChannel()` dell'app riesce. Una richiesta il cui messaggio si perde (bridge non ancora in ascolto, background che non risponde) fallisce dopo 10 s con l'errore 100 (`UNIDENTIFIED_ERROR`) e un warning nel log della pagina.
      - [x] `getChannelConfig()`: `channelList` è la lineup, nell'ordine della lineup (finché non c'è l'LCN), letta a ogni chiamata; `item()`, accesso per indice, `getChannel(ccid)` e `getChannelByTriplet()` (`null` se manca). Niente liste preferiti: come su DTVKit, i terminali HbbTV espongono solo `channelList`. `nextChannel()`/`prevChannel()` sono un `setChannel()` al canale vicino nella lineup, con giro agli estremi; da UNREALIZED o con la lineup vuota l'app riceve l'errore 10 (`NO_CHANNEL_LIST`). Verificato in e2e su Chromium e Firefox: la lista vista dall'app, DMAX → HGTV → DMAX con l'app che resta in esecuzione, e NEWS che carica la sua app.
      - [ ] Canali `hidden` da saltare in `nextChannel()`/`prevChannel()`, quando lo scenario potrà nasconderli.
    - [ ] La cronologia del tab contiene `about:blank` e le pagine dei canali precedenti (il "Back" del browser non è quello della TV).
  - [ ] Keyset, volume, app attiva nella sessione.
- [ ] **Bridge** (ISOLATED world): inoltro MAIN ↔ background con contesto `tabId`.
- [x] **Page runtime** (`@hbb-emu/page-runtime`): si avvia da sola solo nei documenti HbbTV, una volta per finestra. Su chrome-v3 è un content script `world: "MAIN"` a `document_start`, quindi **le API OIPF esistono prima del primo script dell'app**. Su `main` arrivavano solo dopo `DOMContentLoaded` e una richiesta asincrona al background.
- [x] **Bridge** (chrome-v3): content script ISOLATED che collega la page runtime (canale DOM: `CustomEvent` con JSON, invisibile ai listener `message` dell'app) al background. Protocollo in `@hbb-emu/protocol`: `Page/Ready` → `Host/Config`; `Host/Hello` per l'ordine di avvio; `Host/DispatchKey`; `Page/SetChannel` → `Host/Session` oppure `Host/ChannelChangeError`. La runtime non aspetta mai l'host.
- [x] **L'host non spinge lo stato degli oggetti OIPF alla pagina**, solo configurazione e comandi. `main` applicava all'avvio tutto `DEFAULT_HBBTV_STATE`: keyset azzerato dopo il `setValue` dell'app, `video/broadcast` forzato a 1280×720, `playState` e volume reimpostati.
- [x] Configurazione applicata dal vivo: lista canali (registry letto a ogni uso) e `navigator.userAgent` si aggiornano quando arriva `Host/Config`.
- [x] **Configurazione sincrona a `document_start`** su chrome-v3: il background pubblica `configBootstrapScript(config)` con `chrome.userScripts` (mondo MAIN, `document_start`) all'avvio e a ogni cambio; la page runtime la prende all'avvio o, se lo script gira dopo di lei (l'ordine di Chromium, verificato), viene notificata prima del primo script dell'app. Verificato in e2e: il primo script inline vede lo UA configurato.
  - Richiede Chrome 120+ e il toggle "Allow User Scripts" (modalità sviluppatore prima di Chrome 138). Senza, si ripiega su `Host/Config` asincrono; il background ritenta a ogni `Page/Ready`, quindi attivare il toggle ha effetto dalla pagina successiva.
  - [ ] Mostrare nella UI se il bootstrap è attivo (oggi solo un warning nel log del service worker).
  - [ ] Verificare il comportamento su pagine con una CSP restrittiva.
  - [x] Firefox MV2: `browser.contentScripts.register({ js: [{ code }] })` con codice che inietta il bootstrap inline nei documenti HbbTV; Firefox lo esegue dopo i content script del manifest e prima degli script della pagina (verificato). Nessun permesso o toggle in più.
  - [ ] Chromium legacy MV2: nessuna API equivalente; da valutare.
  - Scartate: cookie via DNR (sporca i cookie, che sono oggetto di test), `Server-Timing` (esposto solo in contesti sicuri, le app sono spesso http), `localStorage`/`sessionStorage` (condivisi con l'app), XHR sincrona verso l'estensione (il service worker non la intercetta).
- [x] **Settings UI nella side panel** di chrome-v3 (`settings-ui` condivisa, collegata tramite `createUiClient`). Il background trasforma ogni salvataggio in: configurazione → tutti i tab aperti; patch minima dello stato degli oggetti (`Host/ApplyState`, calcolata con `diffPatch`) → solo il tab attivo. Telecomando e "play channel" → tab attivo. Le pagine dell'estensione si riconoscono dall'origine del mittente, anche se aperte in un tab.
- [ ] La UI mostra lo stato degli oggetti salvato nel background, non quello reale della pagina (es. il keyset impostato dall'app). Serve un messaggio pagina → host con lo stato corrente del tab attivo.
- [x] Il canale corrente della UI è quello della sessione del tab attivo (`null` se il tab non è una TV); "play" sintonizza solo quel tab e non è più salvato nello stato condiviso (`runtime.currentChannel` rimosso, scartato dagli stati salvati).
  - [ ] La UI non si aggiorna quando cambia il tab attivo.
- [x] Iniezione della page runtime su Firefox MV2: il content script `injector.js` contiene il bundle della page runtime e lo esegue inline. Il bundle è lo stesso di chrome-v3.
- [ ] Lo stesso su Chromium legacy (chrome-v2).
- [ ] **UI**: settings-ui collegata via port di messaging, montabile come side panel (MV3 ≥ 114), popup/pagina opzioni (MV2), pagina web esterna (WebKit/standalone).

### 1.3 Porting della runtime OIPF (da `main`)
- [x] Riscrivere `VideoBroadcast` secondo D1, una parte alla volta sul modello di `volume.ts`: ~~`volume`~~, ~~`display`~~, ~~`channel`~~, ~~`component`~~, ~~`streamEvent`~~, ~~`misc`~~, ~~`controller`~~ (assorbito da `channel`: `followStream`, `startChannel`). ✅ `createVideoBroadcast` compone le API `Reader` delle parti in un solo oggetto (accessor compresi), senza ereditarietà né `compose`; lo schema di stato della UI legge e scrive tramite gli stessi moduli, non più tramite proprietà `_xxx`. I ponti temporanei (`WithVolume`, `WithDisplay`, `WithChannel`) sono rimossi.
  - Lo stato `streamEventListeners` è ora di sola lettura per la UI: sono le iscrizioni dell'app (prima la UI poteva sovrascrivere la lista senza effetto reale).
  - Sull'`<object>` non finiscono più i dettagli interni della vecchia classe (`env`, `stateful`, `_playState`, …).
- [ ] Riscrivere `AVControlVideo` secondo D1 (oggi una classe unica, senza mixin).
  - `onChannelChangeSucceeded` arriva una volta per cambio canale, quando lo stream del nuovo canale inizia a presentare (OIPF DAE §7.13.1.4). Prima arrivava a ogni ripresa dello stream (dopo un buffering, una pausa).
  - `channel`: `playState` e `currentChannel` in un `IORef`, player, TV (`getTunedChannel`, `requestChannelChange`) ed eventi iniettati; `tuneTo` esposto per la runtime. Lo stato applicato dalla UI (`applyChannelState`) propaga il canale al resto della pagina come prima faceva `VideoBroadcast.applyState`.
  - [x] `bindToCurrentChannel()` da UNREALIZED si lega al canale su cui è la TV (OIPF DAE §7.13.1.3): un'app che fa `release()` e poi `bindToCurrentChannel()` (es. dopo un VOD) riavrà il video. Prima restituiva `null`.
- [x] **Finestra video fedele alla spec per `video/broadcast`**: attach `visual-embedded`, con il video montato *dentro* l'`<object>` come fallback content, così tutto il CSS dell'app (fogli di stile, attributi, posizionamento, z-index) si applica in modo nativo. `width`/`height` sono lo `style` dell'oggetto; il full-screen copre il viewport mantenendo lo z-index. Verificato su Chromium 155 e Firefox 158 con un harness che usa i moduli reali.
- [ ] Verificare `visual-embedded` sui motori legacy (Chromium 47, WebKit).
- [ ] Portare **AVControl** su `visual-embedded`: oggi usa ancora il container accanto all'oggetto, che copia solo lo `style` inline e ignora i fogli di stile. Prima va verificato che un `<object type="video/mp4" data="…">` non carichi il media in modo nativo (doppio audio).
- [ ] Dimensione di un `video/broadcast` senza CSS: oggi 0×0. Da verificare cosa fanno le TV (probabile 300×150 come un elemento sostituito, o il full-screen).
- [ ] Il `<video>` montato è visibile all'app in `object.childNodes`/`innerHTML`. Accettabile finché nessuna app ne dipende.
- [ ] **Eventi OIPF**: oggi sono solo callback sincrone verso le proprietà `onXxx` dell'elemento. Da verificare e allineare alla spec: dispatch asincrono e DOM events (`addEventListener("FullScreenChange", …)`, richiesti da HbbTV 2.0).
- [x] Un `video/broadcast` presenta il canale su cui è sintonizzata la TV (prima: una tripletta fissa 1/1/1), e `privateData.currentChannel` lo restituisce anche senza `video/broadcast`. Quando la sessione cambia canale, ogni `video/broadcast` non rilasciato dall'app lo segue (anche quelli fermi: uno stream fallito finisce in STOPPED).
- [ ] Il volume è della TV, non del singolo oggetto: con D5 lo `volumeState` va preso dalla TvSession (un `IORef` condiviso iniettato nell'env) invece di crearne uno per ogni `video/broadcast`.
- [ ] Rendere la runtime indipendente da `ExtensionState`: riceve uno stato tipizzato tramite port.
- [ ] Portare i sottosistemi così come sono dove già "puliti" (channelRegistry, streamEventScheduler, provider/detection).
- [x] **Tasti del telecomando come quelli veri, per engine**: destinatario come la tastiera reale dell'engine ospite. Con nulla a fuoco Blink e WebKit consegnano al `body` solo nei documenti HTML e a `<html>` negli XHTML, Gecko sempre al `body` (verificato in e2e su Chromium e Firefox). Gecko si riconosce da una feature (`mozInnerScreenX`), non dallo UA che sovrascriviamo.
- [x] **Fix telecomando** (bug noto su `main`). *Causa principale*: nella settings UI `useRemoteControl().dispatchKey` restituiva un `Task` che i pulsanti non eseguivano, quindi il telecomando della UI non mandava mai niente. Ora l'e2e clicca `RED` nella UI e l'app nel tab attivo riceve 403. Il percorso host → pagina → `keydown` è verificato anche direttamente dal background. *Cause trovate e corrette, verificate dal test e2e con un'app di prova*: l'attach `non-visual` non esponeva i metodi sugli `<object>`; la runtime arrivava dopo gli script dell'app; il `Keyset` non aveva `value`/costanti; su questo branch inoltre la runtime non collegava proprio gli oggetti. Da confermare con un'app reale. Restano da fare: i tasti colore/VCR dalla tastiera (mappatura) e il filtro dei tasti in base al keyset. Altri punti da controllare: verificare `dispatchKeyEvent` (eventi sintetici con `keyCode` non impostato in molti engine → usare `Object.defineProperty` su `keyCode/which` o `initKeyboardEvent` legacy) e il percorso UI → background → pagina.
- [ ] Rimuovere `core/src/mixin.ts`: la runtime OIPF non lo usa più; restano `WithDomObserver` in `core` e i pacchetti parcheggiati `extension_old` (Fase 0).

### 1.4 Host
- [ ] `chrome-v3` — parità funzionale con `main`.
- [ ] `chrome-v2` — target Chromium 47 → (Chrome < 128 se confermato).
- [x] `firefox-v2` — riscrittura del content-type, runtime, bridge, background, UA HTTP, config sincrona. Verificato su Firefox 158.
  - [x] Settings UI nella sidebar (`sidebar_action`, aperta dal pulsante in toolbar), con lo stesso client UI di chrome-v3. Verificata in e2e: stato caricato, telecomando verso il tab attivo, UA cambiato dalla UI visto dal primo script della pagina successiva.
  - [ ] Verificare sull'ESR effettivo (oggi solo Firefox 158) e fissare `strict_min_version`.
  - [ ] ID dell'add-on: oggi `hbbtv-emulator@example.com`.

### 1.4b Più avanti: WebKit legacy
- [ ] Hook di preload JS in una build di WebKit r152340 / WebKitGTK 2.2.6 (non esiste ancora: da realizzare come patch versionata in `browsers/webkitgtk-2`; esiste solo un esperimento locale di log da JS).
- [ ] Control plane esterno via WebSocket (D2).

### 1.5 Build per target
- [ ] Bundle della page runtime per target con Babel preset-env + core-js, riusando la pipeline di `origin/webkit-r152340` (`ie >= 9` come proxy ES5).
- [ ] Verifica automatica della sintassi in output (es. `es-check es5`) per i target legacy.
- [ ] Audit delle dipendenze in pagina: fp-ts/io-ts/ts-pattern traspilati; React in pagina solo opzionale (overlay debug).
- [ ] API web usate dalla page runtime da verificare sui motori legacy: `URL` (confronto con l'AIT) va coperto da polyfill dove manca.

### 1.6 Test
- [ ] Suite di app HbbTV di prova (pagine statiche in `e2e/fixtures`) che esercitano le API: ~~ApplicationManager/Keyset~~ (base ✅), VideoBroadcast (setChannel, stream events), AVControl, Capabilities/Configuration.
- [x] E2E con Playwright su chrome-v3: estensione compilata caricata in Chromium, app servite con il content-type HbbTV vero (`bun run test:e2e`).
- [x] E2E su Firefox (`firefox-v2`): Puppeteer + WebDriver BiDi, che installa l'add-on non firmato come temporaneo; Playwright non supporta estensioni su Firefox.
- [ ] E2E sugli altri host (chrome-v2 / Chromium legacy, WebKit).
- [ ] Smoke test su engine legacy (script di lancio dei binari in `browsers/`).

**Done quando:** la stessa app HbbTV di prova passa la suite su Chrome recente (MV3), Chromium 47 (MV2) e Firefox ESR, con lo stesso codice di page runtime.

## Fase 2 — TV emulata

### 2.1 Modello del dispositivo
- [ ] Device profile: versione HbbTV (1.5 / 2.0.x), UA, capabilities XML, keyset supportato, risoluzione, quirk.
  - [ ] Coerenza con lo UA: header `Sec-CH-UA*` e `navigator.userAgentData` oggi rivelano il Chrome reale (una TV con un browser vecchio non li ha).
- [ ] Libreria di profili predefiniti (es. "Samsung Tizen 2.4", "LG webOS x", …), generati a partire dalla tabella di UA reali.

### 2.2 Lineup canali e AIT
- [ ] Lineup multi-canale (triplet ONID/TSID/SID, LCN, nome, stream associato) — base già presente in `channelRegistry`.
- [x] AIT virtuale per canale (`ait` del canale, codec in `@hbb-emu/oipf-api`, editor nella settings UI): applicazioni con `orgId`/`appId`, control code (AUTOSTART / PRESENT / KILL / DISABLED, TS 102 796 Tabella 7), URL, nome, priorità. `autostartApplication` (AUTOSTART con priorità più alta) e `channelSignalling` (il canale a cui una pagina è broadcast-related).
  - [ ] Ancora da modellare: `service_bound_flag`, visibilità, `simple_application_boundary_descriptor` (origini in più), versione dell'AIT, app broadcast-independent.
- [ ] Import di AIT reali (XML AIT; poi da MPEG-TS).
- [ ] Ciclo di vita delle app conforme alla spec al cambio canale: chiusura/avvio app secondo l'AIT, `createApplication`/`destroyApplication`, app che sopravvivono al cambio canale.
- [ ] Cambio canale tramite navigazione del tab (D5), con ritardo configurabile di "acquisizione AIT". Caso di test di riferimento: app *linear* che naviga da DMAX (52) a HGTV (56).
  - [x] Dalla settings UI e da `setChannel()` dell'app, in modalità *TV* (sezione 1.2). Manca il ritardo di acquisizione.

### 2.3 Shell TV
- [ ] `tv.html` (pagina dell'estensione): la "TV senza app", cioè canale senza AIT, menu e lista canali, punto d'ingresso "Accendi la TV".
  - [x] Versione minima (`startTvShell`): lo stream del canale a tutto schermo (muto: l'autoplay con audio richiede un gesto dell'utente) e il banner con numero (posizione nella lineup, finché non c'è l'LCN) e nome. Mancano menu, lista canali e telecomando (i tasti verso `tv.html` oggi falliscono: non c'è page runtime).
- [ ] OSD iniettato nella pagina dell'app: banner del cambio canale, numero canale, volume.
- [ ] Menu/OSD della TV: lista canali, channel up/down, numero canale, info programma.
- [ ] Telecomando virtuale + mappatura tastiera configurabile, gestione keyset (tasti consegnati all'app solo se nel keyset).
- [ ] Gestione focus tra shell TV e app (tasti riservati alla TV).

### 2.4 Stream e Stream Events
- [ ] Stream reali per canale (HLS/DASH/MP4) come "broadcast" del VideoBroadcast.
- [ ] **Layer broadcast** iniettato dietro la pagina dell'app (come su una TV: il video scorre sotto l'app anche senza oggetto `video/broadcast`, che ne controlla solo la finestra).
- [ ] **Live simulato**: posizione del canale = f(tempo reale), es. `(now − epoch) mod durata`, così il video riprende dallo stesso punto dopo una navigazione e gli stream event schedulati restano coerenti.
- [ ] Scheduler degli stream event configurabile: per tempo assoluto, per tempo media, ricorrenti, con payload predefiniti (base già presente in `streamEventScheduler`).
- [ ] Import MPEG-TS + parsing del carousel DSM-CC (dal vecchio TODO).
- [ ] Scenari per Dynamic Ad Insertion: eventi pilotati da marker (es. SCTE-35 → stream event); valutare cosa riprendere da `fork/functional-player`.

### 2.5 Storage, cookie, multi-partner
- [ ] "Reset di fabbrica": cancellazione di cookie e storage dei domini dello scenario (`browsingData`). L'isolamento vero per TV (un profilo per istanza) è possibile solo in Fase 3.
- [ ] Comportamento cross-site realistico (policy cookie di terze parti delle TV vecchie vs browser moderni), per testare integrazioni tra partner/canali diversi.
- [ ] Ispettore di cookie/storage per app/canale.

### 2.6 Strumenti
- [ ] Scenari import/export (JSON validato da codec) e condivisibili tra team/partner.
- [ ] Logger controllabile dalla UI (dal vecchio TODO).
- [ ] Import di file locali nello storage dell'estensione (dal vecchio TODO).
- [ ] Player: TagGroup `Playable` corretto in errore/waiting; source switching automatico tra provider (dal vecchio TODO).

## Fase 3 — App standalone

- [ ] **Browser registry**: manifest versionato delle build supportate (engine, versione, OS, checksum, URL) ospitato su server proprio.
- [ ] Download, cache e verifica delle build; lancio con profilo isolato e runtime iniettata automaticamente (estensione caricata o preload, a seconda dell'host).
- [ ] Control plane centrale (evoluzione di D2): stato, scenari, UI in un unico posto, connessione WebSocket a ogni istanza.
- [ ] **Vista multi-browser**: stessa app HbbTV aperta su N engine (es. Chrome 56, Firefox, WebKit, Chrome 120, Opera) con telecomando e cambio canale sincronizzati.
- [ ] Aggregazione log/errori per istanza, eventuale remote inspector (CDP su Chromium, remote inspector su WebKit).
- [ ] Packaging per Linux/macOS/Windows.
- [ ] Aspetti legali e di sicurezza: licenze delle build ridistribuite (WebKit LGPL → sorgenti disponibili), codec proprietari (H.264/AAC), engine vecchi non patchati → esecuzione isolata.

---

## Riuso da `main`

| Area | Azione |
|------|--------|
| `packages/oipf/api` (spec, model, validate) | Già portato. Mantenere. |
| `runtime/subsystems/*` | Portare quasi invariato, togliere dipendenze dall'estensione. |
| `runtime/apis/*` (VideoBroadcast, AVControl) | **Riscrivere** senza mixin (D1). |
| `player/*` | Mantenere; allineare con `fork/functional-player` più avanti. |
| `settings-ui` | Mantenere; collegare tramite port di messaging invece di `extension-common`. |
| `apps/chrome-v3/*` (bridge/content/ui con mixin) | Usare come riferimento di comportamento, non come codice. |
| `extension/common/message-bus` | Riferimento per il protocollo; reimplementare sui trasporti astratti. |

## Domande aperte

- App *linear* (in modalità TV): DMAX e HGTV segnalano la **stessa** app (stessi orgId/appId) con URL diversi, o due app distinte? Determina se al cambio canale l'app sopravvive o viene ricaricata.
- Fase 3: la vista multi-browser va su una sola macchina o anche remota (browser su un'altra macchina/container)?

### Risolte
- ~~Fork WebKit con hook di preload~~ → non esiste; WebKit a bassa priorità (sezione 1.4b).
- ~~Tabella TV → engine~~ → non serve per la Fase 1, l'engine lo sceglie l'utente; la tabella UA servirà in Fase 2.
- ~~Firefox 45~~ → target Firefox ESR recente.
- ~~Stato condiviso o per tab~~ → D5.
- ~~Sostituto dei mixin~~ → D1, `Reader` di fp-ts.
