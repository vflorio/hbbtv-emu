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
- [ ] `ExtensionState.enabledTabIds` è un `Set`, ma `chrome.storage` serializza in JSON: dopo un riavvio del service worker MV3 torna come `{}` e il primo aggiornamento lancia `enabledTabIds is not iterable`. Fissato con `it.fails` in `state.test.ts`; si risolve con D5 (TvSession) + codec io-ts.
- [ ] `TabsManager` usa `webRequest.onHeadersReceived` con `"blocking"` anche in **MV3**: non è consentito per estensioni non installate via policy. Su MV3 serve `declarativeNetRequest` (come in `main/apps/chrome-v3/public/rules.json`), quindi il rewrite del content-type va dietro una **port** con implementazioni diverse.
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
- [ ] `ScriptInjection` (nuova): `scripting.executeScript({ world: "MAIN" })` (MV3), `<script>` iniettato a `document_start` dal content script (MV2/Firefox), hook di preload (WebKit fork).
- [ ] `UserAgentOverride` (nuova): DNR / `webRequest` / flag di lancio del browser.

### 1.2 Servizi
- [ ] **Background**: completare routing dei messaggi, propagazione dello stato a tutti i tab/UI, ciclo di vita tab (oggi solo `onTabAdded/Removed` con TODO).
- [ ] **Separare lo stato** in `Scenario` (condiviso) e `TvSession` (per tab), secondo D5; la sessione sopravvive alle navigazioni dello stesso tab e al riavvio del service worker MV3.
- [ ] **Bridge** (ISOLATED world): inoltro MAIN ↔ background con contesto `tabId`.
- [ ] **Content / page bootstrap**: avvio della page runtime, richiesta stato iniziale, sottoscrizione agli aggiornamenti.
- [ ] **UI**: settings-ui collegata via port di messaging, montabile come side panel (MV3 ≥ 114), popup/pagina opzioni (MV2), pagina web esterna (WebKit/standalone).

### 1.3 Porting della runtime OIPF (da `main`)
- [ ] Riscrivere `VideoBroadcast` e `AVControlVideo` secondo D1 (oggi `compose(BaseVideoBroadcast, WithChannel, WithComponent, …)`), una parte alla volta sul modello di `volume.ts`: ~~`volume`~~ ✅, ~~`display`~~ ✅, `channel`, `component`, `streamEvent`, `misc`, `controller`.
- [x] **Finestra video fedele alla spec per `video/broadcast`**: attach `visual-embedded`, con il video montato *dentro* l'`<object>` come fallback content, così tutto il CSS dell'app (fogli di stile, attributi, posizionamento, z-index) si applica in modo nativo. `width`/`height` sono lo `style` dell'oggetto; il full-screen copre il viewport mantenendo lo z-index. Verificato su Chromium 155 e Firefox 158 con un harness che usa i moduli reali.
- [ ] Verificare `visual-embedded` sui motori legacy (Chromium 47, WebKit).
- [ ] Portare **AVControl** su `visual-embedded`: oggi usa ancora il container accanto all'oggetto, che copia solo lo `style` inline e ignora i fogli di stile. Prima va verificato che un `<object type="video/mp4" data="…">` non carichi il media in modo nativo (doppio audio).
- [ ] Dimensione di un `video/broadcast` senza CSS: oggi 0×0. Da verificare cosa fanno le TV (probabile 300×150 come un elemento sostituito, o il full-screen).
- [ ] Il `<video>` montato è visibile all'app in `object.childNodes`/`innerHTML`. Accettabile finché nessuna app ne dipende.
- [ ] **Eventi OIPF**: oggi sono solo callback sincrone verso le proprietà `onXxx` dell'elemento. Da verificare e allineare alla spec: dispatch asincrono e DOM events (`addEventListener("FullScreenChange", …)`, richiesti da HbbTV 2.0).
- [ ] Il volume è della TV, non del singolo oggetto: con D5 lo `volumeState` va preso dalla TvSession (un `IORef` condiviso iniettato nell'env) invece di crearne uno per ogni `video/broadcast`.
- [ ] Rendere la runtime indipendente da `ExtensionState`: riceve uno stato tipizzato tramite port.
- [ ] Portare i sottosistemi così come sono dove già "puliti" (channelRegistry, streamEventScheduler, provider/detection).
- [ ] **Fix telecomando** (bug noto su `main`). *Probabile causa trovata e corretta*: l'attach `non-visual` non esponeva mai i metodi sugli `<object>` (ApplicationManager, Capabilities, Configuration), quindi `appMgr.getOwnerApplication(document).privateData.keyset.setValue(…)` falliva per le app che dichiarano gli oggetti nel markup. Da confermare con un'app reale. Altri punti da controllare: verificare `dispatchKeyEvent` (eventi sintetici con `keyCode` non impostato in molti engine → usare `Object.defineProperty` su `keyCode/which` o `initKeyboardEvent` legacy) e il percorso UI → background → pagina.
- [ ] Rimuovere `core/src/mixin.ts`.

### 1.4 Host
- [ ] `chrome-v3` — parità funzionale con `main`.
- [ ] `chrome-v2` — target Chromium 47 → (Chrome < 128 se confermato).
- [ ] `firefox-v2` — target Firefox ESR recente.

### 1.4b Più avanti: WebKit legacy
- [ ] Hook di preload JS in una build di WebKit r152340 / WebKitGTK 2.2.6 (non esiste ancora: da realizzare come patch versionata in `browsers/webkitgtk-2`; esiste solo un esperimento locale di log da JS).
- [ ] Control plane esterno via WebSocket (D2).

### 1.5 Build per target
- [ ] Bundle della page runtime per target con Babel preset-env + core-js, riusando la pipeline di `origin/webkit-r152340` (`ie >= 9` come proxy ES5).
- [ ] Verifica automatica della sintassi in output (es. `es-check es5`) per i target legacy.
- [ ] Audit delle dipendenze in pagina: fp-ts/io-ts/ts-pattern traspilati; React in pagina solo opzionale (overlay debug).

### 1.6 Test
- [ ] Suite di app HbbTV di prova (pagine statiche) che esercitano le API: ApplicationManager/Keyset, VideoBroadcast (setChannel, stream events), AVControl, Capabilities/Configuration.
- [ ] E2E automatizzati su host moderni (Playwright con estensione caricata: Chromium, Firefox).
- [ ] Smoke test su engine legacy (script di lancio dei binari in `browsers/`).

**Done quando:** la stessa app HbbTV di prova passa la suite su Chrome recente (MV3), Chromium 47 (MV2) e Firefox ESR, con lo stesso codice di page runtime.

## Fase 2 — TV emulata

### 2.1 Modello del dispositivo
- [ ] Device profile: versione HbbTV (1.5 / 2.0.x), UA, capabilities XML, keyset supportato, risoluzione, quirk.
- [ ] Libreria di profili predefiniti (es. "Samsung Tizen 2.4", "LG webOS x", …), generati a partire dalla tabella di UA reali.

### 2.2 Lineup canali e AIT
- [ ] Lineup multi-canale (triplet ONID/TSID/SID, LCN, nome, stream associato) — base già presente in `channelRegistry`.
- [ ] AIT virtuale per canale: applicazioni, control code (AUTOSTART / PRESENT / KILL), URL, priorità, broadcast-related vs broadcast-independent.
- [ ] Import di AIT reali (XML AIT; poi da MPEG-TS).
- [ ] Ciclo di vita delle app conforme alla spec al cambio canale: chiusura/avvio app secondo l'AIT, `createApplication`/`destroyApplication`, app che sopravvivono al cambio canale.
- [ ] Cambio canale tramite navigazione del tab (D5), con ritardo configurabile di "acquisizione AIT". Caso di test di riferimento: app *linear* che naviga da DMAX (52) a HGTV (56).

### 2.3 Shell TV
- [ ] `tv.html` (pagina dell'estensione): la "TV senza app", cioè canale senza AIT, menu e lista canali, punto d'ingresso "Accendi la TV".
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
