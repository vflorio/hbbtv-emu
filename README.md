# HbbTV Emulator

![Architecture](./schema.svg)

## Prerequisites

Install [pnpm](https://pnpm.io/):

```bash
npm install -g pnpm
```

## Setup

```bash
pnpm install
```

## Development

Build all packages:

```bash
pnpm build
```

Run all packages in watch mode:

```bash
pnpm dev
```

### Running Specific Applications

**Chrome Extension**

Run the extension in development mode:

```bash
pnpm --filter @hbb-emu/chrome-v3-extension dev
```

Load the extension in Chrome by pointing to the `apps/chrome-v3/dist` directory.

**Demo UI**

Run the demo web application:

```bash
pnpm --filter @hbb-emu/demo-ui dev:app
```

**Runtime Demo**

Run the standalone runtime demo:

```bash
pnpm --filter @hbb-emu/runtime-demo dev
```

Clean build artifacts:

```bash
pnpm clean
```

Format code:

```bash
pnpm format
```

Lint code:

```bash
pnpm lint
```

## Package Management

Check for version mismatches:

```bash
pnpm syncpack:check
```

Fix version mismatches:

```bash
pnpm syncpack:fix
```

## Packages

**Applications**
- `@hbb-emu/chrome-v3-extension` - Chrome (Manifest V3) extension with HbbTV runtime integration
- `@hbb-emu/demo-ui` - Demo web application for testing settings-ui
- `@hbb-emu/runtime-demo` - Standalone runtime demo with AVControl and Player UI

**Core Libraries**
- `@hbb-emu/core` - Shared utilities, DOM helpers, storage, and functional programming helpers
- `@hbb-emu/oipf` - OIPF object models, validation, and type definitions
- `@hbb-emu/runtime` - HbbTV runtime implementation with OIPF APIs and subsystems

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