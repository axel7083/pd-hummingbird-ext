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

import type { ServerInit } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { extension } from '@podman-desktop/sveltekit-adapter/server';
import { createContainer } from '#lib/server/inject/container.ts';

/**
 * Called once, when the extension is activated.
 */
export const init: ServerInit = async () => {
  // SvelteKit also initialises the server at build time (e.g. to generate the fallback page)
  if (building) return;
  await createContainer(extension().context);
};
