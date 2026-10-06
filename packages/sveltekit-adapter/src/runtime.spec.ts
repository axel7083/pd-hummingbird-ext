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

import { beforeEach, expect, test, vi } from 'vitest';
import type { ExtensionContext, Uri as UriType, WebviewPanel } from '@podman-desktop/api';
import { Uri, window as windowAPI } from '@podman-desktop/api';
import { readFile } from 'node:fs/promises';
import { createExtension, loadHtml } from './runtime.ts';
import type { KitServerInstance } from './runtime.ts';
import { getExtensionState } from './state.ts';

vi.mock(import('node:fs/promises'));
vi.mock(
  import('@podman-desktop/api'),
  () =>
    ({
      Uri: {
        joinPath: vi.fn((base: { fsPath: string }, ...parts: string[]) => ({
          fsPath: [base.fsPath, ...parts].join('/'),
        })),
      },
      window: { createWebviewPanel: vi.fn() },
    }) as never,
);

const PANEL = {
  webview: {
    html: '',
    onDidReceiveMessage: vi.fn(() => ({ dispose: vi.fn() })),
    postMessage: vi.fn(),
    asWebviewUri: vi.fn((uri: { fsPath: string }) => ({ toString: (): string => `webview:${uri.fsPath}` })),
  },
  dispose: vi.fn(),
} as unknown as WebviewPanel;

const SERVER: KitServerInstance = {
  init: vi.fn(),
  respond: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  PANEL.webview.html = '';
  vi.mocked(windowAPI.createWebviewPanel).mockReturnValue(PANEL);
  vi.mocked(readFile).mockResolvedValue('<html><script src="/_app/a.js"></script><link href="/_app/b.css"></html>');
});

test('loadHtml should rewrite local scripts and stylesheets to webview URIs', async () => {
  vi.mocked(readFile).mockResolvedValue(
    '<script src="/_app/a.js"></script><link rel="stylesheet" href="/_app/b.css"><link href="https://example.com/x.css"><script>inline()</script>',
  );

  const html = await loadHtml(PANEL, { fsPath: '/ext/media' } as UriType);

  expect(readFile).toHaveBeenCalledWith('/ext/media/index.html', 'utf8');
  expect(html).toBe(
    '<script src="webview:/ext/media//_app/a.js"></script><link rel="stylesheet" href="webview:/ext/media//_app/b.css"><link href="https://example.com/x.css"><script>inline()</script>',
  );
});

test('activate should create the panel, init the server, then load the html', async () => {
  const subscriptions: Array<{ dispose(): unknown }> = [];
  const context = { extensionUri: { fsPath: '/ext' }, subscriptions } as unknown as ExtensionContext;
  vi.mocked(SERVER.init).mockImplementation(async () => {
    // the state is available to the init hook, the html is not loaded yet
    expect(getExtensionState()).toEqual({ context, panel: PANEL });
    expect(PANEL.webview.html).toBe('');
  });

  const extension = createExtension(SERVER, { viewType: 'my-view', title: 'My View' });
  await extension.activate(context);

  expect(windowAPI.createWebviewPanel).toHaveBeenCalledWith('my-view', 'My View', {
    localResourceRoots: [{ fsPath: '/ext/media' }],
  });
  expect(SERVER.init).toHaveBeenCalledOnce();
  expect(PANEL.webview.onDidReceiveMessage).toHaveBeenCalledOnce();
  expect(PANEL.webview.html).toContain('webview:/ext/media//_app/a.js');
  // panel & bridge
  expect(subscriptions).toHaveLength(2);
  expect(Uri.joinPath).toHaveBeenCalled();

  await extension.deactivate();
  expect(() => getExtensionState()).toThrow('the extension is not activated');
});
