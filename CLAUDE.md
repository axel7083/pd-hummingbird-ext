# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hummingbird is a Podman Desktop extension that provides container image optimization recommendations and vulnerability scanning. It integrates with the Grype extension for security scanning and communicates with the Hummingbird Project API to suggest smaller, more secure alternative images.

## Build Commands

**Prerequisites**: Node.js >=24.0.0, npm >=10.2.3, pnpm 10.15.0

```bash
# Install dependencies (from root)
pnpm install

# Build all packages (shared, then frontend + backend in parallel)
npm run build

# Watch mode for development (all packages)
npm run watch

# Build individual packages
npm run build:shared
npm run build:frontend
npm run build:backend
```

## Testing

```bash
# Run all unit tests
npm run test:unit

# Run tests for specific packages
npm run test:backend    # Backend tests with coverage
npm run test:frontend   # Frontend tests
npm run test:shared     # Shared package tests

# Watch mode (from package directories)
cd packages/backend && npm run test:watch
cd packages/frontend && npm run test
```

Test configuration uses Vitest with projects defined in root `vitest.config.ts`. Backend tests mock `@podman-desktop/api` via `__mocks__/@podman-desktop/api.js`.

## Linting and Formatting

```bash
# Check formatting (Prettier)
npm run format:check

# Fix formatting
npm run format:fix

# Check linting (ESLint)
npm run lint:check

# Fix linting issues
npm run lint:fix

# Type checking (all packages)
npm run typecheck
```

## Architecture

### Three-Package Monorepo

1. **packages/backend** - Podman Desktop extension (Node.js)
   - Entry point: `src/extension.ts` with `activate()` and `deactivate()` functions
   - Service-based architecture initialized in `MainService`
   - Builds to CommonJS (`dist/extension.cjs`)

2. **packages/frontend** - SvelteKit-based UI
   - Uses Svelte 5 with SvelteKit routing
   - Routes in `src/routes/` (main: `+page.svelte`, image details: `image/[engineId]/[id]/+page.svelte`)
   - Builds to static adapter

3. **packages/shared** - Core API types and RPC infrastructure
   - Defines API interfaces (`HummingbirdApi`, `ImageApi`, `ProviderApi`, etc.)
   - Message passing utilities (`RpcExtension`, `RpcBrowser`)
   - Shared models and types
   - Builds to `dist/index.cjs` with TypeScript definitions

### RPC Communication Pattern

Backend and frontend communicate via an RPC-like system:

- **Backend**: `RpcExtension` (in shared) receives messages from webview, dispatches to API implementations
- **Frontend**: `RpcBrowser` creates proxies for API interfaces, sends messages to backend
- API implementations (`*-api-impl.ts`) expose service methods to frontend
- API definitions in shared define the contract between frontend/backend

Example flow:
```
Frontend (client.ts) → RpcBrowser → Webview Messages → RpcExtension → API Impl → Service
```

### Key Services

- **MainService**: Orchestrates extension initialization, creates all other services
- **WebviewService**: Manages the extension's webview panel
- **HummingbirdService**: Communicates with Hummingbird Project API (api-rawhide.hummingbird-project.io)
- **GrypeService**: Integrates with Grype extension for vulnerability scanning
- **ImageService**: Manages container image operations
- **ProviderService**: Handles container provider connections
- **RoutingService**: Manages frontend routing state
- **CommandService**: Registers Podman Desktop commands

## Development Patterns

### Adding a New API Method

1. Define interface in `packages/shared/src/apis/[name]-api.ts`
2. Implement in `packages/backend/src/apis/[name]-api-impl.ts`
3. Register the API implementation with `RpcExtension` in `MainService.init()`
4. Use from frontend via `rpcBrowser.getProxy([Name]Api)` in `packages/frontend/src/api/client.ts`

### Service Dependencies

Services receive dependencies via constructor injection (see `MainService.init()` for pattern). All services implement `Disposable` and are tracked in `MainService.#disposables`.

### Testing with Podman Desktop API

Backend tests use a mock in `__mocks__/@podman-desktop/api.js`. The vitest config automatically aliases `@podman-desktop/api` to this mock for all backend tests.

## External Integrations

- **Grype Extension API**: `@podman-desktop/grype-extension-api` - vulnerability scanning
- **Hummingbird Project API**: `https://api-rawhide.hummingbird-project.io` - image alternatives and SBOM data
- **Podman Desktop API**: `@podman-desktop/api` - extension host API

## Code Generation

The shared package includes swagger-typescript-api for generating types from OpenAPI specs (see `packages/shared/src/generated/`).
