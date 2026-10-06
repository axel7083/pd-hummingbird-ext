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

import { expect, test, vi } from 'vitest';
import type { Event } from '@podman-desktop/api';
import { fromEvent } from './server.ts';

function emitter<T>(): { event: Event<T>; fire: (value: T) => void; listeners: () => number } {
  const listeners = new Set<(value: T) => void>();
  const event = ((listener: (value: T) => void) => {
    listeners.add(listener);
    return { dispose: (): boolean => listeners.delete(listener) };
  }) as Event<T>;
  return {
    event,
    fire: (value): void => listeners.forEach(listener => listener(value)),
    listeners: () => listeners.size,
  };
}

test('should subscribe immediately and yield fired values', async () => {
  const { event, fire, listeners } = emitter<number>();
  const controller = new AbortController();

  const iterator = fromEvent(event, controller.signal);
  expect(listeners()).toBe(1);

  // fired before consuming: not lost
  fire(1);
  await expect(iterator.next()).resolves.toEqual({ value: 1, done: false });

  const next = iterator.next();
  fire(2);
  await expect(next).resolves.toEqual({ value: 2, done: false });
});

test('should coalesce values fired while the consumer is busy', async () => {
  const { event, fire } = emitter<number>();
  const iterator = fromEvent(event, new AbortController().signal);

  fire(1);
  fire(2);
  fire(3);

  await expect(iterator.next()).resolves.toEqual({ value: 3, done: false });
});

test('abort should end the iteration and dispose the subscription', async () => {
  const { event, listeners } = emitter<number>();
  const controller = new AbortController();
  const iterator = fromEvent(event, controller.signal);

  const next = iterator.next();
  controller.abort();

  await expect(next).resolves.toEqual({ value: undefined, done: true });
  await vi.waitFor(() => expect(listeners()).toBe(0));
});
