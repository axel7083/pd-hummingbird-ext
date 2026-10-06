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

import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import adapter from '@podman-desktop/sveltekit-adapter';
import { openapi } from './vite-plugins/openapi.ts';

const API_MOCK = new URL('./__mocks__/@podman-desktop/api.ts', import.meta.url).pathname;

export default defineConfig({
  mode: process.env.MODE,
  // inversify (services in #lib/server) relies on legacy decorators & their metadata
  oxc: {
    decorator: {
      legacy: true,
      emitDecoratorMetadata: true,
    },
  },
  plugins: [
    openapi(),
    tailwindcss(),
    sveltekit({
      adapter: adapter({
        webview: {
          viewType: 'hummingbird',
          title: 'Hummingbird',
        },
        external: ['ssh2'],
        minify: process.env.MODE === 'production',
      }),
      paths: {
        relative: false,
      },
      output: {
        bundleStrategy: 'inline',
      },
      experimental: {
        remoteFunctions: true,
      },
      compilerOptions: {
        experimental: {
          async: true,
        },
      },
    }),
  ],
  build: {
    // vite module preload option create dynamically a <link rel="modulepreload" ../>
    // preloading a module do not send referrer header
    // due to limitation with how podman-desktop serve static content, we cannot make request without referrer
    modulePreload: false,
    sourcemap: true,
  },
  test: {
    projects: [
      {
        // the code running in the extension host
        extends: true,
        test: {
          name: 'server',
          include: ['src/lib/server/**/*.spec.ts', 'src/**/*.remote.spec.ts'],
          environment: 'node',
          alias: {
            '@podman-desktop/api': API_MOCK,
          },
        },
      },
      {
        // the code running in the webview
        extends: true,
        plugins: [svelteTesting()],
        test: {
          name: 'client',
          include: ['src/**/*.spec.ts'],
          exclude: ['src/lib/server/**', 'src/**/*.remote.spec.ts'],
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./vite.tests.setup.ts'],
          alias: [{ find: '@testing-library/svelte', replacement: '@testing-library/svelte/svelte5' }],
        },
      },
    ],
  },
});
