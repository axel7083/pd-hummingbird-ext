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
import type { Plugin } from 'vite';
import { generateApi } from 'swagger-typescript-api';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const HUMMINGBIRD_SERVER_OPEN_API_URL = 'https://api-hummingbird.hummingbird-project.io/v1/openapi.json';
export const HUMMINGBIRD_OPENAPI_LOCAL_ENV = 'HUMMINGBIRD_OPENAPI_LOCAL';

// SvelteKit resolves the config several times per build (server, analysis, client...) and on every watch rebuild:
// generate once per process
let generation: Promise<void> | undefined;

export function openapi(): Plugin {
  return {
    name: 'vite-plugin-openapi',
    enforce: 'pre',
    configResolved: async (resolved): Promise<void> => {
      generation ??= generate(join(resolved.root, 'src', 'lib', 'generated'));
      await generation;
    },
  };
}

async function generate(generated: string): Promise<void> {
  await mkdir(generated, { recursive: true });

  const localPath = process.env[HUMMINGBIRD_OPENAPI_LOCAL_ENV];
  let spec: unknown;
  if (localPath) {
    console.log(`[vite-plugin-openapi] using local OpenAPI spec from ${localPath}`);
    spec = JSON.parse(await readFile(localPath, 'utf-8'));
  } else {
    console.log(`[vite-plugin-openapi] fetching OpenAPI spec from ${HUMMINGBIRD_SERVER_OPEN_API_URL}`);
    spec = await (await fetch(HUMMINGBIRD_SERVER_OPEN_API_URL)).json();
  }

  const { files } = await generateApi({
    spec,
    output: false,
    fileName: 'hummingbird-project.ts',
    silent: true,
  });

  // the generated files are imported by the app: only write on change, not to trigger the watch mode
  for (const { fileName, fileExtension, fileContent } of files) {
    const path = join(generated, `${fileName}${fileExtension}`);
    const current = await readFile(path, 'utf-8').catch(() => undefined);
    if (current !== fileContent) await writeFile(path, fileContent, 'utf-8');
  }
}
