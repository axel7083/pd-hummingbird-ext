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
import type { OptimisationReport } from '#lib/models/index.ts';
import type { PageLoad } from './$types';
import { getOptimisationReport, isGrypeInstalled as isGrypeInstalledQuery } from '#lib/remote/alternatives.remote.ts';
import { IMAGE_QUERY_KEY } from '#routes/images/[engineId]/[imageId]/report/constants.ts';

interface Data {
  engineId: string;
  image: string;
  isGrypeInstalled: boolean;
  report: Promise<OptimisationReport>;
}

export const load: PageLoad = async ({ params, url }): Promise<Data> => {
  const engineId = decodeURIComponent(params.engineId);
  const imageId = decodeURIComponent(params.imageId);

  const isGrypeInstalled = await isGrypeInstalledQuery();

  return {
    engineId,
    isGrypeInstalled,
    image: url.searchParams.get(IMAGE_QUERY_KEY) ?? '<unknown>',
    report: getOptimisationReport({ engineId, imageId }),
  };
};
