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
- `@hbb-emu/runtime-demo` - Pure runtime demo (no extension dependencies)
pnpm syncpack:fix
```

## Packages

**Applications**
- `@hbb-emu/chrome-v3-extension` - Chrome MV3 extension
- `@hbb-emu/demo-ui` - Demo web application

**Core Libraries**
- `@hbb-emu/core` - Shared utilities, DOM helpers, and storage
- `@hbb-emu/oipf` - OIPF object models and validation
- `@hbb-emu/runtime` - HbbTV runtime implementation
- `@hbb-emu/settings-ui` - Settings UI components
- `@hbb-emu/extension-common` - Shared extension utilities
- `@hbb-emu/runtime-chrome` - Chrome-specific runtime
- `@hbb-emu/runtime-web` - Web-specific runtime