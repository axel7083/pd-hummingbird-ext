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
import {
  ContainerApi,
  type ContainerInfo,
  type CloneOptions,
  type CloneResult,
} from '@podman-desktop/extension-hummingbird-core-api';
import type { containerEngine } from '@podman-desktop/api';
import type { PodmanService } from '../services/podman-service';

interface Dependencies {
  containersAPI: typeof containerEngine;
  podman: PodmanService;
}

export class ContainerApiImpl extends ContainerApi {
  constructor(protected readonly dependencies: Dependencies) {
    super();
  }

  override async listContainersByImage(engineId: string, imageId: string): Promise<ContainerInfo[]> {
    const allContainers = await this.dependencies.containersAPI.listContainers();

    // Filter containers by image ID and engine ID
    const matchingContainers = allContainers.filter(
      container => container.ImageID === imageId && container.engineId === engineId,
    );

    // Map to our simpler ContainerInfo interface
    return matchingContainers.map(container => ({
      engineId: container.engineId,
      engineType: container.engineType,
      Id: container.Id,
      Names: container.Names,
      Image: container.Image,
      ImageID: container.ImageID,
      State: container.State,
      Status: container.Status,
    }));
  }

  override async getContainer(engineId: string, containerId: string): Promise<ContainerInfo | undefined> {
    const allContainers = await this.dependencies.containersAPI.listContainers();

    const container = allContainers.find(c => c.Id === containerId && c.engineId === engineId);

    if (!container) {
      return undefined;
    }

    return {
      engineId: container.engineId,
      engineType: container.engineType,
      Id: container.Id,
      Names: container.Names,
      Image: container.Image,
      ImageID: container.ImageID,
      State: container.State,
      Status: container.Status,
    };
  }

  override async cloneWithAlternative(
    engineId: string,
    containerId: string,
    alternativeImage: string,
    options: CloneOptions,
  ): Promise<CloneResult> {
    // Get the container inspect info
    const containerInspect = await this.dependencies.containersAPI.inspectContainer(engineId, containerId);

    // Verify this is a podman connection
    const connection = await this.dependencies.podman.getRunningProviderContainerConnectionByEngineId(engineId);
    if (connection.connection.type !== 'podman') {
      throw new Error('Container cloning with alternative images is only supported for Podman connections');
    }

    // Stop the container if requested
    if (options.stopBeforeClone && containerInspect.State.Running) {
      await this.dependencies.containersAPI.stopContainer(engineId, containerId);
    }

    // Clone the container with the alternative image
    return await this.dependencies.podman.clone(containerInspect, alternativeImage);
  }
}
