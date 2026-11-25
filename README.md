# HbbTV Emulator

![Architecture](./schema.svg)

> Roadmap, decisioni architetturali e stato del progetto: [ROADMAP.md](./ROADMAP.md).

## Prerequisites

[Bun](https://bun.sh/) (see `packageManager` in `package.json`).

## Setup

```bash
bun install
```

## Development

```bash
bun run build        # build all packages (turbo)
bun run dev          # all packages in watch mode
bun run clean        # remove build artifacts
bun run format       # format (biome)
bun run lint         # lint (biome)
```

### Extensions

```bash
bun run extension:build   # builds extensions/{chrome-v3,chrome-v2,firefox-v2}
```

Load the unpacked extension from `extensions/<target>/dist`.

### Demo apps

```bash
bun run --filter @hbb-emu/demo-ui demo:dev
bun run --filter @hbb-emu/runtime-demo demo:dev
```

## Tests

Unit tests use [Vitest](https://vitest.dev/).

```bash
bun run test            # all packages, through turbo (cached)
bun run test:watch      # whole monorepo in watch mode
bun run test:coverage   # coverage report per package (coverage/)
```

Inside a package: `bun run test` / `bun run test:watch`.

Conventions:

- tests live next to the code: `foo.ts` → `foo.test.ts`
- each package has a `vitest.config.ts` that extends the root `vitest.shared.ts` (environment `node` or `jsdom`)
- tests are excluded from the build via `tsconfig.build.json`
- dependencies are faked through their ports / Reader environment, never by mocking modules; shared fakes go in `src/__tests__/`
- a known bug can be pinned with `it.fails(...)` and a comment pointing to the roadmap item that fixes it

## Package Management

```bash
bun run syncpack:check   # check version mismatches
bun run syncpack:fix     # fix version mismatches
```

## Packages

**Applications**
- `@hbb-emu/chrome-v3-extension` - Chrome (Manifest V3) extension with HbbTV runtime integration
- `@hbb-emu/demo-ui` - Demo web application for testing ui components without runtime
- `@hbb-emu/runtime-demo` - Standalone runtime demo with AVControl and Player

**Core Libraries**
- `@hbb-emu/core` - Shared utilities, DOM helpers, storage, miscellaneus abstractions
- `@hbb-emu/oipf` - OIPF object models, validation, and type definitions
- `@hbb-emu/runtime` - Runtime OIPF APIs implementation

**Extension Modules**
- `@hbb-emu/extension-common` - Shared extension state and utilities
- `@hbb-emu/runtime-chrome` - Chrome-specific runtime bridge
- `@hbb-emu/runtime-web` - Web-specific runtime bridge

**Player System**
- `@hbb-emu/player-runtime` - Core player runtime with state management
- `@hbb-emu/player-adapter-web` - Web adapters (Native, HLS.js, dash.js)
- `@hbb-emu/player-adapter-hbbtv` - HbbTV-specific player adapter (AVControl, MediaElementSource)
- `@hbb-emu/player-ui` - Player debug UI overlay with controls and state visualization

**UI Components**
- `@hbb-emu/settings-ui` - Settings UI for configuring HbbTV environment and channels