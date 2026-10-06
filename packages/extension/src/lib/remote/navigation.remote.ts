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

import { command } from '$app/server';
import { navigation as navigationAPI } from '@podman-desktop/api';
import { z } from 'zod';
import { getService } from '#lib/server/inject/container.ts';
import { DialogService } from '#lib/server/services/dialog-service.ts';
import { ContainerIdentifierSchema } from '#lib/remote/schemas.ts';

// navigation outside the webview: Podman Desktop pages & external links

export const navigateToCatalog = command(z.string().optional(), async (searchTerm): Promise<void> => {
  return navigationAPI.navigateToExtensionsCatalog({ searchTerm });
});

export const navigateToContainerDetails = command(ContainerIdentifierSchema, async ({ containerId }): Promise<void> => {
  return navigationAPI.navigateToContainer(containerId);
});

export const openExternal = command(z.url(), async (href): Promise<boolean> => {
  return (await getService(DialogService)).openExternal(href);
});
