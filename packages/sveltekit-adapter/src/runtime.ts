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
import * as podmanDesktopAPI from '@podman-desktop/api';
import { Uri, window as windowAPI } from '@podman-desktop/api';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type { KitServer } from './bridge.ts';
import { KitBridge } from './bridge.ts';
import { setExtensionState } from './state.ts';

export interface WebviewOptions {
  /** identifier of the webview panel */
  viewType: string;
  /** title of the webview panel */
  title: string;
}

/**
 * The SvelteKit server instance written by `builder.generateServerInstance`.
 */
export interface KitServerInstance extends KitServer {
  init(options: {
    env: Record<string, string>;
    read?: (file: string) => ReadableStream | Promise<ReadableStream | null> | null;
  }): Promise<void>;
}

export interface Extension {
  activate(context: ExtensionContext): Promise<void>;
  deactivate(): Promise<void>;
}

// folder (relative to the extension root) containing the client written by the adapter
export const MEDIA_FOLDER = 'media';

/**
 * Create the `activate` / `deactivate` functions of the extension:
 * - create the webview panel
 * - initialise the SvelteKit server (running the `init` hook of `hooks.server.ts`)
 * - connect the webview to the server
 * - load the app in the webview
 */
export function createExtension(server: KitServerInstance, options: WebviewOptions): Extension {
  // the SvelteKit server code imports a shim of @podman-desktop/api forwarding to this one (see the adapter)
  (globalThis as Record<symbol, unknown>)[Symbol.for('@podman-desktop/sveltekit-adapter/api')] = podmanDesktopAPI;

  return {
    async activate(context: ExtensionContext): Promise<void> {
      const media = Uri.joinPath(context.extensionUri, MEDIA_FOLDER);

      const panel = windowAPI.createWebviewPanel(options.viewType, options.title, {
        localResourceRoots: [media],
      });
      context.subscriptions.push(panel);

      const state = { context, panel };
      setExtensionState(state);

      await server.init({
        env: process.env as Record<string, string>,
        read: file => Readable.toWeb(createReadStream(join(media.fsPath, file))) as ReadableStream,
      });

      const bridge = new KitBridge(panel.webview, server, state);
      bridge.init();
      context.subscriptions.push(bridge);

      // only load the app once the server is ready to answer
      panel.webview.html = await loadHtml(panel, media);
    },

    async deactivate(): Promise<void> {
      // panel & bridge are disposed with the context subscriptions
      setExtensionState(undefined);
    },
  };
}

/**
 * Read the index.html written by the adapter, and rewrite the local scripts & stylesheets URLs to webview URIs.
 */
export async function loadHtml(panel: WebviewPanel, media: Uri): Promise<string> {
  let html = await readFile(Uri.joinPath(media, 'index.html').fsPath, 'utf8');

  const rewrite = (tag: RegExp, attribute: string): void => {
    for (const [element] of html.matchAll(tag)) {
      const value = new RegExp(`${attribute}="(.*?)"`).exec(element)?.[1];
      // ignore inline data and absolute URLs
      if (!value || /^(data:|https?:|#)/.test(value)) continue;
      const uri = panel.webview.asWebviewUri(Uri.joinPath(media, value)).toString();
      html = html.replace(element, element.replace(`${attribute}="${value}"`, `${attribute}="${uri}"`));
    }
  };

  rewrite(/<script[^>]*\bsrc="[^"]*"[^>]*>/g, 'src');
  rewrite(/<link[^>]*\bhref="[^"]*"[^>]*>/g, 'href');

  return html;
}
