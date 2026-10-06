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

/**
 * Messages exchanged between the webview and the extension host to tunnel
 * SvelteKit `fetch` requests (remote functions, `__data.json`, form actions)
 * through the Podman Desktop webview postMessage channel.
 *
 * Bodies are transferred as text: SvelteKit responses (JSON, SSE) are textual,
 * and strings survive any serialization performed by the webview IPC.
 */
export interface KitRequestMessage {
  kind: 'kit-request';
  id: string;
  url: string;
  method: string;
  headers: Array<[string, string]>;
  body?: string;
}

export interface KitAbortMessage {
  kind: 'kit-abort';
  id: string;
}

export interface KitResponseHeadMessage {
  kind: 'kit-response-head';
  id: string;
  status: number;
  statusText: string;
  headers: Array<[string, string]>;
}

export interface KitResponseChunkMessage {
  kind: 'kit-response-chunk';
  id: string;
  chunk: string;
}

export interface KitResponseEndMessage {
  kind: 'kit-response-end';
  id: string;
}

export interface KitResponseErrorMessage {
  kind: 'kit-response-error';
  id: string;
  message: string;
}

export type KitBrowserMessage = KitRequestMessage | KitAbortMessage;

export type KitExtensionMessage =
  KitResponseHeadMessage | KitResponseChunkMessage | KitResponseEndMessage | KitResponseErrorMessage;

export type KitMessage = KitBrowserMessage | KitExtensionMessage;

export function isKitMessage(content: unknown): content is KitMessage {
  return (
    !!content &&
    typeof content === 'object' &&
    'kind' in content &&
    typeof content.kind === 'string' &&
    content.kind.startsWith('kit-') &&
    'id' in content
  );
}

export function isKitBrowserMessage(content: unknown): content is KitBrowserMessage {
  return isKitMessage(content) && (content.kind === 'kit-request' || content.kind === 'kit-abort');
}

export function isKitExtensionMessage(content: unknown): content is KitExtensionMessage {
  return isKitMessage(content) && content.kind.startsWith('kit-response-');
}
