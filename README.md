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

**Browser Extension (`app-extension`)**

Run the extension in development mode to access the side panel:

```bash
pnpm --filter @hbb-emu/app-extension dev
```

Load the extension in your browser by pointing to the `packages/app-extension/dist` directory.

**Web Application (`app-web`)**

Run the standalone web app that loads the HbbTV API into the DOM of a non-HbbTV HTML application:

```bash
pnpm --filter @hbb-emu/app-web dev
```

Clean build artifacts:

```bash
pnpm clean
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

- `@hbb-emu/core` - Shared utilities and types
- `@hbb-emu/hbbtv-api` - HbbTV API implementation
- `@hbb-emu/message-bus` - Extension messaging system
- `@hbb-emu/ui` - React UI components
- `@hbb-emu/app-extension` - Browser extension
- `@hbb-emu/app-web` - Web application