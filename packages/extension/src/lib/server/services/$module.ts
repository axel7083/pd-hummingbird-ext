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

import { ContainerModule } from 'inversify';
import { DialogService } from '#lib/server/services/dialog-service.ts';
import { StartupSymbol } from '#lib/server/inject/symbol.ts';
import { HummingbirdService } from '#lib/server/services/hummingbird-service.ts';
import { ImageService } from '#lib/server/services/image-service.ts';
import { ProviderService } from '#lib/server/services/provider-service.ts';
import { GrypeService } from '#lib/server/services/scanners/grype-service.ts';
import { PodmanService } from '#lib/server/services/podman-service.ts';
import { AlternativeService } from '#lib/server/services/alternative-service.ts';
import { ContainerService } from '#lib/server/services/container-service.ts';

const module = new ContainerModule(options => {
  options.bind<GrypeService>(GrypeService).toSelf().inSingletonScope();
  options.bind<AlternativeService>(AlternativeService).toSelf().inSingletonScope();
  options.bind<DialogService>(DialogService).toSelf().inSingletonScope();
  options.bind<HummingbirdService>(HummingbirdService).toSelf().inSingletonScope();
  options.bind<ImageService>(ImageService).toSelf().inSingletonScope();
  options.bind<PodmanService>(PodmanService).toSelf().inSingletonScope();
  options.bind<ProviderService>(ProviderService).toSelf().inSingletonScope();
  options.bind<ContainerService>(ContainerService).toSelf().inSingletonScope();

  // created at activation: they listen to Podman Desktop events
  options.bind(StartupSymbol).toService(DialogService);
  options.bind(StartupSymbol).toService(ProviderService);
  options.bind(StartupSymbol).toService(ImageService);
  options.bind(StartupSymbol).toService(AlternativeService);
});

export { module };
