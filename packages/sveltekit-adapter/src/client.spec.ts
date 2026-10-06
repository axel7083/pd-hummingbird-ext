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
import { createKitFetch, isKitServerRequest } from './client.ts';
import type { PodmanDesktopApi } from './client.ts';
import type { KitBrowserMessage, KitExtensionMessage } from './protocol.ts';

const ORIGIN = 'http://uuid.webview.localhost:8080';

let target: EventTarget;
let windowMock: Window;
let posted: Array<KitBrowserMessage>;
const fallback = vi.fn<typeof fetch>();

const api = {
  postMessage: vi.fn(),
} as unknown as PodmanDesktopApi;

beforeEach(() => {
  vi.resetAllMocks();
  posted = [];
  target = new EventTarget();
  windowMock = Object.assign(target, { location: { origin: ORIGIN, href: `${ORIGIN}/` } }) as unknown as Window;
  vi.mocked(api.postMessage).mockImplementation(message => posted.push(message as KitBrowserMessage));
});

function reply(message: KitExtensionMessage): void {
  target.dispatchEvent(new MessageEvent('message', { data: message }));
}

test.each([
  ['/_app/remote/abc/getAlternatives', 'GET', true],
  ['/alternatives/__data.json', 'GET', true],
  ['/alternatives?/clone', 'POST', true],
  ['/icon.png', 'GET', false],
])('isKitServerRequest %s %s should be %s', (path, method, expected) => {
  expect(isKitServerRequest(new URL(path, ORIGIN), method)).toBe(expected);
});

test('non kit request should use fallback', async () => {
  const response = new Response('ok');
  fallback.mockResolvedValue(response);
  const kitFetch = createKitFetch(windowMock, api, fallback);

  await expect(kitFetch(`${ORIGIN}/icon.png`)).resolves.toBe(response);
  await kitFetch('https://quay.io/_app/remote/abc/x');
  expect(fallback).toHaveBeenCalledTimes(2);
  expect(posted).toHaveLength(0);
});

test('kit request should be sent to the extension and streamed back', async () => {
  const kitFetch = createKitFetch(windowMock, api, fallback);

  const promise = kitFetch(`${ORIGIN}/_app/remote/abc/save`, {
    method: 'POST',
    body: '{"a":1}',
    headers: { 'content-type': 'application/json' },
  });

  await vi.waitFor(() => expect(posted).toHaveLength(1));
  const request = posted[0];
  expect(request).toEqual(
    expect.objectContaining({
      kind: 'kit-request',
      url: `${ORIGIN}/_app/remote/abc/save`,
      method: 'POST',
      body: '{"a":1}',
    }),
  );
  expect(request.kind === 'kit-request' && request.headers).toContainEqual(['content-type', 'application/json']);
  // the browser does not expose the origin header to scripts, it must be added for SvelteKit CSRF checks
  expect(request.kind === 'kit-request' && request.headers).toContainEqual(['origin', ORIGIN]);

  const id = request.id;
  reply({ kind: 'kit-response-head', id, status: 200, statusText: 'OK', headers: [['content-type', 'text/plain']] });
  reply({ kind: 'kit-response-chunk', id, chunk: 'hello ' });
  reply({ kind: 'kit-response-chunk', id, chunk: 'world' });
  reply({ kind: 'kit-response-end', id });

  const response = await promise;
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('text/plain');
  expect(await response.text()).toBe('hello world');
  expect(fallback).not.toHaveBeenCalled();
});

test('error before head should reject', async () => {
  const kitFetch = createKitFetch(windowMock, api, fallback);

  const promise = kitFetch(`${ORIGIN}/_app/remote/abc/x`);
  await vi.waitFor(() => expect(posted).toHaveLength(1));
  reply({ kind: 'kit-response-error', id: posted[0].id, message: 'boom' });

  await expect(promise).rejects.toThrow('boom');
});

test('abort should notify the extension and reject', async () => {
  const kitFetch = createKitFetch(windowMock, api, fallback);
  const controller = new AbortController();

  const promise = kitFetch(`${ORIGIN}/_app/remote/abc/x`, { signal: controller.signal });
  await vi.waitFor(() => expect(posted).toHaveLength(1));
  controller.abort();

  await expect(promise).rejects.toThrow();
  expect(posted[1]).toEqual({ kind: 'kit-abort', id: posted[0].id });
});

test('cancelling the response body should notify the extension', async () => {
  const kitFetch = createKitFetch(windowMock, api, fallback);

  const promise = kitFetch(`${ORIGIN}/_app/remote/abc/live`);
  await vi.waitFor(() => expect(posted).toHaveLength(1));
  const id = posted[0].id;
  reply({ kind: 'kit-response-head', id, status: 200, statusText: 'OK', headers: [] });

  const response = await promise;
  await response.body?.cancel();

  expect(posted[1]).toEqual({ kind: 'kit-abort', id });
});

test('relative kit URLs should be resolved against the webview location', async () => {
  const kitFetch = createKitFetch(windowMock, api, fallback);

  kitFetch('/_app/remote/abc/getConnections').catch(() => {});

  await vi.waitFor(() => expect(posted).toHaveLength(1));
  expect(posted[0]).toEqual(
    expect.objectContaining({ kind: 'kit-request', url: `${ORIGIN}/_app/remote/abc/getConnections` }),
  );
  expect(fallback).not.toHaveBeenCalled();
});
