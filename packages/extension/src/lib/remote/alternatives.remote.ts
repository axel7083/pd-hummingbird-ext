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
import type {
  ImageSummary,
  LocalImageAlternative,
  LocalImageAlternativeReport,
  OptimisationReport,
} from '#lib/models/index.ts';
import { getService } from '#lib/server/inject/container.ts';
import { AlternativeService } from '#lib/server/services/alternative-service.ts';
import { GrypeService } from '#lib/server/services/scanners/grype-service.ts';
import { ImageIdentifierSchema } from '#lib/remote/schemas.ts';

export const isGrypeInstalled = query(async (): Promise<boolean> => {
  return (await getService(GrypeService)).isInstalled();
});

/**
 * Local images having a Hummingbird alternative, re-emitted each time containers or images change.
 */
export const getAlternatives = query.live(async function* (): AsyncGenerator<Array<LocalImageAlternative>> {
  const alternatives = await getService(AlternativeService);
  const updates = fromEvent(alternatives.event, getRequestEvent().request.signal);

  yield await alternatives.getAlternatives();
  while (!(await updates.next()).done) {
    yield await alternatives.getAlternatives();
  }
});

export const getAlternative = query(ImageIdentifierSchema, async ({ engineId, imageId }): Promise<ImageSummary> => {
  return (await getService(AlternativeService)).getAlternative(engineId, imageId);
});

export const getAlternativeReport = query(
  'unchecked',
  async (alternative: LocalImageAlternative): Promise<LocalImageAlternativeReport> => {
    return (await getService(AlternativeService)).getAlternativeReport(alternative);
  },
);

export const getOptimisationReport = query(
  ImageIdentifierSchema,
  async ({ engineId, imageId }): Promise<OptimisationReport> => {
    return (await getService(AlternativeService)).getOptimisationReport(engineId, imageId);
  },
);
