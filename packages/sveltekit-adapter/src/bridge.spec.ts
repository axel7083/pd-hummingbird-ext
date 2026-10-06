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
import type { Webview } from '@podman-desktop/api';
import type { KitExtensionMessage, KitRequestMessage } from './protocol.ts';
import { KitBridge } from './bridge.ts';
import type { KitServer } from './bridge.ts';

const URL_MOCK = 'http://uuid.webview.localhost:8080/_app/remote/abc/getAlternatives';

let send: (message: unknown) => void;
let posted: Array<KitExtensionMessage>;

const WEBVIEW_MOCK = {
  onDidReceiveMessage: vi.fn(),
  postMessage: vi.fn(),
} as unknown as Webview;

const SERVER_MOCK: KitServer = {
  respond: vi.fn(),
};

beforeEach(() => {
  vi.resetAllMocks();
  posted = [];
  vi.mocked(WEBVIEW_MOCK.onDidReceiveMessage).mockImplementation(listener => {
    send = listener;
    return { dispose: vi.fn() };
  });
  vi.mocked(WEBVIEW_MOCK.postMessage).mockImplementation(async message => {
    posted.push(message as KitExtensionMessage);
    return true;
  });
});

function getBridge(): KitBridge {
  const bridge = new KitBridge(WEBVIEW_MOCK, SERVER_MOCK);
  bridge.init();
  return bridge;
}

function request(id: string, init?: Partial<KitRequestMessage>): KitRequestMessage {
  return { kind: 'kit-request', id, url: URL_MOCK, method: 'GET', headers: [['accept', 'text/plain']], ...init };
}

test('request should be answered with head, chunks and end', async () => {
  vi.mocked(SERVER_MOCK.respond).mockResolvedValue(
    new Response('hello world', { status: 201, headers: { 'content-type': 'text/plain' } }),
  );
  getBridge();

  send(request('1', { method: 'POST', body: '{"a":1}' }));

  await vi.waitFor(() => expect(posted.at(-1)?.kind).toBe('kit-response-end'));

  const [req] = vi.mocked(SERVER_MOCK.respond).mock.calls[0];
  expect(req.url).toBe(URL_MOCK);
  expect(req.method).toBe('POST');
  expect(req.headers.get('accept')).toBe('text/plain');
  expect(await req.text()).toBe('{"a":1}');

  expect(posted[0]).toEqual(
    expect.objectContaining({
      kind: 'kit-response-head',
      id: '1',
      status: 201,
      headers: [['content-type', 'text/plain']],
    }),
  );
  const body = posted
    .filter(message => message.kind === 'kit-response-chunk')
    .map(message => message.chunk)
    .join('');
  expect(body).toBe('hello world');
});

test('server error should be reported', async () => {
  vi.mocked(SERVER_MOCK.respond).mockRejectedValue(new Error('boom'));
  getBridge();

  send(request('2'));

  await vi.waitFor(() => expect(posted).toEqual([{ kind: 'kit-response-error', id: '2', message: 'boom' }]));
});

test('abort should abort the request signal and stop streaming', async () => {
  let signal: AbortSignal | undefined;
  vi.mocked(SERVER_MOCK.respond).mockImplementation(async req => {
    signal = req.signal;
    // never ending stream
    return new Response(new ReadableStream({ start: (controller): void => controller.enqueue(new Uint8Array([104])) }));
  });
  getBridge();

  send(request('3'));
  await vi.waitFor(() => expect(posted.some(message => message.kind === 'kit-response-chunk')).toBeTruthy());

  send({ kind: 'kit-abort', id: '3' });

  await vi.waitFor(() => expect(signal?.aborted).toBeTruthy());
  expect(posted.some(message => message.kind === 'kit-response-end')).toBeFalsy();
});

test('non kit messages should be ignored', async () => {
  getBridge();

  send({ id: 1, channel: 'alternatives-api-getAlternatives', args: [] });

  expect(SERVER_MOCK.respond).not.toHaveBeenCalled();
});

test('platform should be given to the server', async () => {
  vi.mocked(SERVER_MOCK.respond).mockResolvedValue(new Response(undefined, { status: 204 }));
  const platform = { foo: 'bar' };
  const bridge = new KitBridge(WEBVIEW_MOCK, SERVER_MOCK, platform);
  bridge.init();

  send(request('4'));

  await vi.waitFor(() => expect(posted.at(-1)?.kind).toBe('kit-response-end'));
  expect(vi.mocked(SERVER_MOCK.respond).mock.calls[0][1].platform).toBe(platform);
  // no body for 204
  expect(posted.some(message => message.kind === 'kit-response-chunk')).toBeFalsy();
});
