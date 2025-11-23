# HbbTV Emulator

![Architecture](./schema.svg)

Browser extension for emulating HbbTV applications with development tools.

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

- `@hbb-emu/lib` - Shared utilities and types
- `@hbb-emu/hbbtv-api` - HbbTV API implementation
- `@hbb-emu/message-bus` - Extension messaging system
- `@hbb-emu/ui` - React UI components
- `@hbb-emu/app-extension` - Browser extension
- `@hbb-emu/app-web` - Web application
