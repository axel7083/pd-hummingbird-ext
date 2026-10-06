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

import { command, getRequestEvent, query } from '$app/server';
import { z } from 'zod';
import { fromEvent } from '@podman-desktop/sveltekit-adapter/server';
import type { LocalImage, SimpleImageInfo } from '#lib/models/index.ts';
import { getService } from '#lib/server/inject/container.ts';
import { ImageService } from '#lib/server/services/image-service.ts';
import { ProviderService } from '#lib/server/services/provider-service.ts';
import { ConnectionIdentifierSchema, ImageIdentifierSchema, SimpleImageInfoSchema } from '#lib/remote/schemas.ts';

const HUMMINGBIRD_REGISTRY = 'quay.io';
const HUMMINGBIRD_ORGANISATION = 'hummingbird';

/**
 * The Hummingbird images pulled on a given connection, re-emitted each time the images change.
 */
export const getPulledImages = query.live(ConnectionIdentifierSchema, async function* (identifier): AsyncGenerator<
  Array<SimpleImageInfo>
> {
  const images = await getService(ImageService);
  const connection = (await getService(ProviderService)).getProviderContainerConnection(identifier);
  const updates = fromEvent(images.event, getRequestEvent().request.signal);

  const list = (): Promise<Array<SimpleImageInfo>> =>
    images.all({ registry: HUMMINGBIRD_REGISTRY, organisation: HUMMINGBIRD_ORGANISATION, connection });

  yield await list();
  while (!(await updates.next()).done) {
    yield await list();
  }
});

export const pullImage = command(
  z.object({ image: z.string(), connection: ConnectionIdentifierSchema }),
  async ({ image, connection }): Promise<SimpleImageInfo> => {
    const providerConnection = (await getService(ProviderService)).getProviderContainerConnection(connection);
    return (await getService(ImageService)).pull({ image, connection: providerConnection });
  },
);

export const getImage = query(
  ImageIdentifierSchema,
  async ({ engineId, imageId }): Promise<Omit<LocalImage, 'containers'>> => {
    return (await getService(ImageService)).getImage(engineId, imageId);
  },
);

export const navigateToImageDetails = command(SimpleImageInfoSchema, async (image): Promise<void> => {
  return (await getService(ImageService)).navigateToImageDetails(image);
});

export const navigateToImageRun = command(SimpleImageInfoSchema, async (image): Promise<void> => {
  return (await getService(ImageService)).navigateToImageRun(image);
});
