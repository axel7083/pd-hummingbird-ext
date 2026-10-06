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

import type { Disposable, Webview } from '@podman-desktop/api';
import type { KitExtensionMessage, KitRequestMessage } from './protocol.ts';
import { isKitBrowserMessage } from './protocol.ts';

/**
 * Subset of the SvelteKit `Server` used by the bridge.
 */
export interface KitServer {
  respond(request: Request, options: { getClientAddress(): string; platform?: unknown }): Promise<Response>;
}

/**
 * Answer the SvelteKit requests sent by the webview (see `createKitFetch`) using the SvelteKit server,
 * running in the extension host.
 */
export class KitBridge implements Disposable {
  readonly #webview: Webview;
  readonly #server: KitServer;
  readonly #platform: unknown;
  readonly #inflight = new Map<string, AbortController>();
  #disposable: Disposable | undefined;

  constructor(webview: Webview, server: KitServer, platform?: unknown) {
    this.#webview = webview;
    this.#server = server;
    this.#platform = platform;
  }

  init(): void {
    this.#disposable = this.#webview.onDidReceiveMessage((message: unknown) => {
      if (!isKitBrowserMessage(message)) return;

      switch (message.kind) {
        case 'kit-request':
          this.handle(message).catch((err: unknown) => console.error(`kit request ${message.url} failed`, err));
          break;
        case 'kit-abort':
          this.#inflight.get(message.id)?.abort();
          break;
      }
    });
  }

  protected async post(message: KitExtensionMessage): Promise<void> {
    await this.#webview.postMessage(message);
  }

  protected async handle(message: KitRequestMessage): Promise<void> {
    const { id } = message;
    const controller = new AbortController();
    this.#inflight.set(id, controller);

    try {
      const request = new Request(message.url, {
        method: message.method,
        headers: message.headers,
        body: message.body,
        signal: controller.signal,
      });

      const response = await this.#server.respond(request, {
        getClientAddress: () => '127.0.0.1',
        platform: this.#platform,
      });

      await this.post({
        kind: 'kit-response-head',
        id,
        status: response.status,
        statusText: response.statusText,
        headers: Array.from(response.headers.entries()),
      });

      if (response.body) {
        const decoder = new TextDecoder();
        const reader = response.body.getReader();
        controller.signal.addEventListener(
          'abort',
          () => {
            reader.cancel().catch(() => {});
          },
          { once: true },
        );

        while (!controller.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (chunk) await this.post({ kind: 'kit-response-chunk', id, chunk });
        }
        const rest = decoder.decode();
        if (rest && !controller.signal.aborted) await this.post({ kind: 'kit-response-chunk', id, chunk: rest });
      }

      if (!controller.signal.aborted) await this.post({ kind: 'kit-response-end', id });
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      await this.post({ kind: 'kit-response-error', id, message: err instanceof Error ? err.message : String(err) });
    } finally {
      this.#inflight.delete(id);
    }
  }

  dispose(): void {
    this.#disposable?.dispose();
    this.#inflight.forEach(controller => controller.abort());
    this.#inflight.clear();
  }
}
