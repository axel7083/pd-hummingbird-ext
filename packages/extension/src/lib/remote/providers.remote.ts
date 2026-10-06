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

import { getRequestEvent, query } from '$app/server';
import { fromEvent } from '@podman-desktop/sveltekit-adapter/server';
import type { ProviderContainerConnectionDetailedInfo } from '#lib/models/index.ts';
import { getService } from '#lib/server/inject/container.ts';
import { ProviderService } from '#lib/server/services/provider-service.ts';

/**
 * The container provider connections, re-emitted each time a connection is registered, updated or removed.
 */
export const getConnections = query.live(async function* (): AsyncGenerator<
  Array<ProviderContainerConnectionDetailedInfo>
> {
  const providers = await getService(ProviderService);
  const updates = fromEvent(providers.event, getRequestEvent().request.signal);

  yield providers.all();
  yield* updates;
});
