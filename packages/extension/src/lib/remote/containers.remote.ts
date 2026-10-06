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

import { command, query } from '$app/server';
import { z } from 'zod';
import type { CloneResult, LocalContainer } from '#lib/models/index.ts';
import { getService } from '#lib/server/inject/container.ts';
import { ContainerService } from '#lib/server/services/container-service.ts';
import { ContainerIdentifierSchema } from '#lib/remote/schemas.ts';

export const getContainer = query(
  ContainerIdentifierSchema,
  async ({ engineId, containerId }): Promise<LocalContainer> => {
    return (await getService(ContainerService)).getContainer(engineId, containerId);
  },
);

/**
 * Clone a container with a Hummingbird alternative base image
 */
export const cloneContainer = command(
  ContainerIdentifierSchema.extend({
    alternativeImage: z.string(),
    stopBeforeClone: z.boolean(),
    name: z.string(),
  }),
  async ({ engineId, containerId, alternativeImage, stopBeforeClone, name }): Promise<CloneResult> => {
    return (await getService(ContainerService)).clone(engineId, containerId, alternativeImage, {
      stopBeforeClone,
      name,
    });
  },
);
