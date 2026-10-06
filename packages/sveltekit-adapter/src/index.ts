/**********************************************************************
 * Copyright (C) 2026 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { builtinModules, createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import type { Adapter, Builder } from '@sveltejs/kit';
import type { Plugin } from 'vite';
import { build } from 'vite';

export interface AdapterOptions {
  /** the webview panel showing the app */
  webview: {
    viewType: string;
    title: string;
  };
  /** extension root, receiving `dist/extension.cjs` and the `media` folder (default: the vite root) */
  out?: string;
  /** additional modules not to bundle */
  external?: Array<string>;
  /** minify the extension bundle (default: false) */
  minify?: boolean;
}

/**
 * SvelteKit adapter for Podman Desktop extensions.
 *
 * - the client (the app loaded in the webview) is written to `<out>/media`, with a SPA fallback `index.html`
 * - the server and a generated extension entry (`activate` / `deactivate`) are bundled into `<out>/dist/extension.cjs`
 *
 * At runtime, the webview `fetch` requests to the SvelteKit server (remote functions, server loads, form actions)
 * are sent to the extension through the webview postMessage channel, see `@podman-desktop/sveltekit-adapter/client`.
 */
export default function adapter(options: AdapterOptions): Adapter {
  // provided by Podman Desktop at runtime
  const external = [API_MODULE, ...(options.external ?? [])];

  return {
    name: 'adapter-podman-desktop',

    vite: {
      plugins: [apiShim(), externals(options.external ?? []), inlineClient()],
    },

    async adapt(builder: Builder): Promise<void> {
      const out = resolve(options.out ?? '.');
      const media = join(out, 'media');
      const dist = join(out, 'dist');
      const tmp = builder.getBuildDirectory('adapter-podman-desktop');

      for (const dir of [media, tmp]) {
        rmSync(dir, { recursive: true, force: true });
        mkdirSync(dir, { recursive: true });
      }

      builder.log.minor(`Writing client to ${media}`);
      builder.writeClient(media);
      await builder.generateFallback(join(media, 'index.html'));
      inlineStylesheets(join(media, 'index.html'), builder.getClientDirectory());

      builder.log.minor(`Bundling extension to ${dist}`);
      builder.generateServerInstance(join(tmp, 'server.js'));
      writeFileSync(
        join(tmp, 'extension.js'),
        [
          `import { server } from './server.js';`,
          `import { createExtension } from '@podman-desktop/sveltekit-adapter/runtime';`,
          `export const { activate, deactivate } = createExtension(server, ${JSON.stringify(options.webview)});`,
          '',
        ].join('\n'),
      );

      await build({
        configFile: false,
        envDir: false,
        root: tmp,
        logLevel: 'warn',
        mode: 'production',
        define: {
          // the bundle is CommonJS
          'import.meta.dirname': '__dirname',
          'import.meta.filename': '__filename',
        },
        resolve: {
          // server builds of svelte & co, not the browser ones
          conditions: ['node', 'module', 'production'],
        },
        build: {
          outDir: dist,
          emptyOutDir: true,
          target: 'node22',
          sourcemap: true,
          minify: options.minify ?? false,
          reportCompressedSize: false,
          lib: {
            entry: join(tmp, 'extension.js'),
            formats: ['cjs'],
          },
          rollupOptions: {
            external: [...external, ...builtinModules.flatMap(module => [module, `node:${module}`])],
            output: {
              entryFileNames: 'extension.cjs',
              chunkFileNames: 'chunks/[name]-[hash].cjs',
            },
          },
        },
      });
    },

    supports: {
      read: (): boolean => true,
    },
  };
}

/**
 * Keep the given modules external in the SvelteKit server build, they are resolved by the extension host.
 */
function externals(modules: Array<string>): Plugin {
  return {
    name: 'adapter-podman-desktop:externals',
    enforce: 'pre',
    applyToEnvironment: (environment): boolean => environment.config.consumer === 'server',
    resolveId(id): { id: string; external: true } | undefined {
      if (modules.includes(id)) return { id, external: true };
      return undefined;
    },
  };
}

/**
 * With the `inline` bundle strategy, SvelteKit inlines the client stylesheet in the pages it renders, but not in
 * watch mode builds (the stylesheet is then emitted as a file, never loaded by the client): inline it ourselves.
 */
function inlineStylesheets(html: string, client: string): void {
  const content = readFileSync(html, 'utf8');
  const head = content.slice(0, content.indexOf('</head>'));
  if (head.includes('<style')) return;

  const manifest = join(client, '.vite', 'manifest.json');
  if (!existsSync(manifest)) return;

  const chunks = Object.values(JSON.parse(readFileSync(manifest, 'utf8')) as Record<string, { file: string }>);
  const styles = chunks
    .map(({ file }) => join(client, file))
    .filter(file => file.endsWith('.css') && existsSync(file))
    .map(file => readFileSync(file, 'utf8'));
  if (styles.length === 0) return;

  writeFileSync(html, content.replace('</head>', `<style>${styles.join('\n')}</style>\n</head>`));
}

/**
 * The client is inlined in the webview html (`output.bundleStrategy: 'inline'`) as a classic script, where
 * `import.meta` is not available (SvelteKit reads `import.meta.url` in development mode).
 */
function inlineClient(): Plugin {
  return {
    name: 'adapter-podman-desktop:inline-client',
    configEnvironment(name): { define: Record<string, string> } | undefined {
      if (name !== 'client') return undefined;
      return { define: { 'import.meta.url': 'location.href' } };
    },
  };
}

const API_MODULE = '@podman-desktop/api';
const API_SHIM = '\0podman-desktop-api';
// where the runtime exposes the API, see runtime.ts
const API_KEY = '@podman-desktop/sveltekit-adapter/api';

/**
 * In the SvelteKit server build, resolve `@podman-desktop/api` to a shim forwarding (lazily) to the API exposed
 * on globalThis by the runtime at activation.
 *
 * - the API only exists in Podman Desktop: SvelteKit can import (analyse) the server code at build time
 * - the extension entry (runtime.ts) is the only module requiring the real API
 */
function apiShim(): Plugin {
  return {
    name: 'adapter-podman-desktop:api-shim',
    enforce: 'pre',
    applyToEnvironment: (environment): boolean => environment.config.consumer === 'server',
    resolveId(id): string | undefined {
      return id === API_MODULE ? API_SHIM : undefined;
    },
    load(id): string | undefined {
      return id === API_SHIM ? shimSource() : undefined;
    },
  };
}

function shimSource(): string {
  const require = createRequire(join(process.cwd(), 'package.json'));
  const manifest = require.resolve(`${API_MODULE}/package.json`);
  const { types } = JSON.parse(readFileSync(manifest, 'utf8')) as { types: string };
  const declarations = readFileSync(join(dirname(manifest), types), 'utf8');

  const names = new Set(
    Array.from(
      declarations.matchAll(/^\s{2}export (?:namespace|class|const|function|enum|abstract class) (\w+)/gm),
      match => match[1],
    ),
  );

  return `
const KEY = Symbol.for(${JSON.stringify(API_KEY)});
// accept any usage when the API is not available (build time)
const inert = new Proxy(function () {}, {
  get: (_target, property) => (property === Symbol.toPrimitive ? () => '' : inert),
  apply: () => inert,
  construct: () => inert,
});
function resolve(name) {
  const api = globalThis[KEY];
  return api ? api[name] : inert;
}
function lazy(name) {
  const proxy = new Proxy(function () {}, {
    get(_target, property) {
      const target = resolve(name);
      const value = Reflect.get(Object(target), property);
      // bind methods (not classes) to their namespace
      return typeof value === 'function' && !value.prototype ? value.bind(target) : value;
    },
    has: (_target, property) => property in Object(resolve(name)),
    apply: (_target, thisArg, args) => Reflect.apply(resolve(name), thisArg, args),
    construct: (_target, args, newTarget) =>
      Reflect.construct(resolve(name), args, newTarget === proxy ? resolve(name) : newTarget),
  });
  return proxy;
}
${Array.from(names, name => `export const ${name} = lazy(${JSON.stringify(name)});`).join('\n')}
`;
}
