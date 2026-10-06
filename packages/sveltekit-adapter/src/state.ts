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

import type { ExtensionContext, WebviewPanel } from '@podman-desktop/api';

/**
 * What the extension runtime hands over to the SvelteKit server code.
 */
export interface ExtensionState {
  context: ExtensionContext;
  panel: WebviewPanel;
}

// The adapter package may be bundled more than once (in the SvelteKit server output and in the
// extension entry), so the state lives on globalThis rather than in a module variable.
const STATE_KEY = Symbol.for('@podman-desktop/sveltekit-adapter/state');

type GlobalWithState = typeof globalThis & { [STATE_KEY]?: ExtensionState };

export function setExtensionState(state: ExtensionState | undefined): void {
  (globalThis as GlobalWithState)[STATE_KEY] = state;
}

export function getExtensionState(): ExtensionState {
  const state = (globalThis as GlobalWithState)[STATE_KEY];
  if (!state) throw new Error('the extension is not activated');
  return state;
}
