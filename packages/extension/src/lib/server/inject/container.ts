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

import type { ExtensionContext } from '@podman-desktop/api';
import { env as envAPI } from '@podman-desktop/api';
import { Container } from 'inversify';
import type { ServiceIdentifier } from 'inversify';

import { ExtensionContextSymbol, StartupSymbol, TelemetryLoggerSymbol } from '#lib/server/inject/symbol.ts';
import { module as serviceModule } from '#lib/server/services/$module.ts';

let container: Container | undefined;

/**
 * Create the services container, called once at activation by the `init` hook (see hooks.server.ts).
 */
export async function createContainer(context: ExtensionContext): Promise<Container> {
  const instance = new Container();

  instance.bind(TelemetryLoggerSymbol).toConstantValue(envAPI.createTelemetryLogger());
  instance.bind(ExtensionContextSymbol).toConstantValue(context);

  await instance.load(serviceModule);

  // instantiate all startup services
  await instance.getAllAsync(StartupSymbol);

  container = instance;
  context.subscriptions.push({
    dispose: (): void => {
      container = undefined;
      instance.unbindAll().catch(console.error);
    },
  });

  return instance;
}

/**
 * Get a service, from any server code (remote functions, server loads).
 */
export function getService<T>(identifier: ServiceIdentifier<T>): Promise<T> {
  if (!container) throw new Error('the services container is not initialized');
  return container.getAsync(identifier);
}
