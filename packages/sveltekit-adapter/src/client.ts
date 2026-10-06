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

import type { KitBrowserMessage, KitExtensionMessage } from './protocol.ts';
import { isKitExtensionMessage } from './protocol.ts';

/**
 * The API Podman Desktop exposes to webviews.
 */
export interface PodmanDesktopApi {
  getState: () => unknown;
  postMessage: (msg: unknown) => void;
  setState: (newState: unknown) => void;
}

declare global {
  interface Window {
    acquirePodmanDesktopApi?: () => PodmanDesktopApi;
  }
}

const API_KEY = Symbol.for('@podman-desktop/sveltekit-adapter/api');

/**
 * Podman Desktop only allows acquiring the webview API once: get the shared instance.
 */
export function getPodmanDesktopApi(): PodmanDesktopApi {
  const holder = window as Window & { [API_KEY]?: PodmanDesktopApi };
  if (!holder[API_KEY]) {
    if (!window.acquirePodmanDesktopApi) throw new Error('not running in a Podman Desktop webview');
    holder[API_KEY] = window.acquirePodmanDesktopApi();
  }
  return holder[API_KEY];
}

let installed = false;

/**
 * Route the SvelteKit server requests (remote functions, server loads, form actions) to the extension.
 * Must be called before the SvelteKit router starts (e.g. at the top of `hooks.client.ts`).
 */
export function installFetch(): void {
  if (installed) return;
  installed = true;
  window.fetch = createKitFetch(window, getPodmanDesktopApi());
}

/**
 * Requests SvelteKit sends to its server: remote functions, server load data,
 * route resolution and form actions (any non GET/HEAD request).
 */
export function isKitServerRequest(url: URL, method: string): boolean {
  return (
    url.pathname.includes('/_app/remote/') ||
    url.pathname.endsWith('/__data.json') ||
    url.pathname.endsWith('/__route.js') ||
    (method !== 'GET' && method !== 'HEAD')
  );
}

interface Pending {
  resolve: (response: Response) => void;
  reject: (reason: unknown) => void;
  stream: ReadableStreamDefaultController<Uint8Array> | undefined;
  responded: boolean;
}

// statuses for which a Response cannot have a body
const NULL_BODY_STATUSES = [101, 103, 204, 205, 304];

/**
 * Create a `fetch` implementation that sends SvelteKit server requests to the
 * extension backend over postMessage, and delegates everything else to `fallback`.
 */
export function createKitFetch(
  window: Window,
  api: PodmanDesktopApi,
  fallback: typeof fetch = window.fetch.bind(window),
): typeof fetch {
  const pending = new Map<string, Pending>();
  const encoder = new TextEncoder();

  const post = (message: KitBrowserMessage): void => api.postMessage(message);

  // eslint-disable-next-line sonarjs/post-message
  window.addEventListener('message', (event: MessageEvent) => {
    const message: unknown = event.data;
    if (!isKitExtensionMessage(message)) return;

    const entry = pending.get(message.id);
    if (!entry) return;

    handleMessage(entry, message);
  });

  function handleMessage(entry: Pending, message: KitExtensionMessage): void {
    switch (message.kind) {
      case 'kit-response-head': {
        entry.responded = true;
        const body = NULL_BODY_STATUSES.includes(message.status)
          ? undefined
          : new ReadableStream<Uint8Array>({
              start(controller): void {
                entry.stream = controller;
              },
              cancel(): void {
                pending.delete(message.id);
                post({ kind: 'kit-abort', id: message.id });
              },
            });
        entry.resolve(
          new Response(body, { status: message.status, statusText: message.statusText, headers: message.headers }),
        );
        break;
      }
      case 'kit-response-chunk':
        entry.stream?.enqueue(encoder.encode(message.chunk));
        break;
      case 'kit-response-end':
        entry.stream?.close();
        pending.delete(message.id);
        break;
      case 'kit-response-error': {
        const error = new TypeError(message.message);
        if (entry.responded) {
          entry.stream?.error(error);
        } else {
          entry.reject(error);
        }
        pending.delete(message.id);
        break;
      }
    }
  }

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // resolve relative URLs (e.g. `/_app/remote/...`) against the webview location
    const resource = input instanceof Request ? input : new URL(String(input), window.location.href);
    const request = new Request(resource, init);
    const url = new URL(request.url);

    if (url.origin !== window.location.origin || !isKitServerRequest(url, request.method)) {
      return fallback(input, init);
    }

    const id = crypto.randomUUID();
    const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text();

    return new Promise<Response>((resolve, reject) => {
      const entry: Pending = { resolve, reject, stream: undefined, responded: false };

      const signal = request.signal;
      if (signal.aborted) {
        reject(signal.reason);
        return;
      }
      signal.addEventListener(
        'abort',
        () => {
          if (!pending.has(id)) return;
          pending.delete(id);
          post({ kind: 'kit-abort', id });
          if (entry.responded) {
            entry.stream?.error(signal.reason);
          } else {
            reject(signal.reason);
          }
        },
        { once: true },
      );

      pending.set(id, entry);
      // `origin` is a forbidden header for scripts, the browser adds it on the wire: add it ourselves,
      // as SvelteKit rejects mutating remote requests (commands, forms) without it
      const headers = new Headers(request.headers);
      if (!headers.has('origin')) headers.set('origin', window.location.origin);

      post({
        kind: 'kit-request',
        id,
        url: request.url,
        method: request.method,
        headers: Array.from(headers.entries()),
        body,
      });
    });
  };
}
