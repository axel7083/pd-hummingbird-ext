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

import type { Event } from '@podman-desktop/api';
import type { ExtensionState } from './state.ts';
import { getExtensionState } from './state.ts';

export type { ExtensionState };

/**
 * The extension context & webview panel, usable in any server code (hooks, remote functions, server loads).
 */
export function extension(): ExtensionState {
  return getExtensionState();
}

/**
 * Turn a Podman Desktop event into an async iterator, typically to feed a `query.live` remote function.
 *
 * The subscription starts immediately (no event is missed between creating the iterator and consuming it),
 * events fired while the consumer is busy are coalesced into the last one.
 * The iteration ends when the signal is aborted (pass `getRequestEvent().request.signal`).
 */
export function fromEvent<T>(event: Event<T>, signal: AbortSignal): AsyncGenerator<T, void> {
  let pending: { value: T } | undefined;
  let wake: (() => void) | undefined;

  const subscription = event(value => {
    pending = { value };
    wake?.();
  });
  const onAbort = (): void => wake?.();
  signal.addEventListener('abort', onAbort, { once: true });

  async function* iterate(): AsyncGenerator<T, void> {
    try {
      while (!signal.aborted) {
        if (!pending) {
          await new Promise<void>(resolve => (wake = resolve));
          wake = undefined;
        }
        if (signal.aborted || !pending) return;
        const { value } = pending;
        pending = undefined;
        yield value;
      }
    } finally {
      subscription.dispose();
      signal.removeEventListener('abort', onAbort);
    }
  }

  return iterate();
}
