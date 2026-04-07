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
  AlternativesApi,
  type LocalImage,
  type LocalImageAlternative,
  type VulnerabilitiesSummary,
  type Tag,
} from '@podman-desktop/extension-hummingbird-core-api';
import type { HummingbirdService } from '../services/hummingbird-service';
import type { containerEngine } from '@podman-desktop/api';
import alt from '../assets/alt.json' with { type: 'json' };

interface Dependencies {
  hummingbird: HummingbirdService;
  containersAPI: typeof containerEngine;
}

export class AlternativesApiImpl extends AlternativesApi {
  #altMap: Map<string, string>;

  constructor(protected readonly dependencies: Dependencies) {
    super();

    // Create reverse mapping: from alternative repo to hummingbird image name
    this.#altMap = new Map(
      Object.entries(alt).reduce(
        (accumulator, [key, { alts }]) => {
          alts.forEach(altRepo => {
            accumulator.push([altRepo, key]);
          });
          return accumulator;
        },
        [] as [string, string][],
      ),
    );
  }

  override async getLocalImagesWithAlternatives(): Promise<LocalImageAlternative[]> {
    const results: LocalImageAlternative[] = [];

    // Get all images from all engines
    const images = await this.dependencies.containersAPI.listImages();

    // Get all Hummingbird images from API
    const hummingbirdImages = await this.dependencies.hummingbird.getImages();
    const hummingbirdMap = new Map(hummingbirdImages.map(img => [img.name, img]));

    for (const image of images) {
      if (!image.RepoTags || image.RepoTags.length === 0) continue;

      for (const repoTag of image.RepoTags) {
        const [repo, tag] = repoTag.split(':');

        // Check if this image has a Hummingbird alternative
        const hummingbirdImageName = this.#altMap.get(repo);
        if (hummingbirdImageName) {
          const hummingbirdImage = hummingbirdMap.get(hummingbirdImageName);

          // https://github.com/podman-desktop/podman-desktop/issues/16967
          if (!('Arch' in image) || typeof image.Arch !== 'string') {
            console.warn('missing arch on image');
            continue;
          }

          if (hummingbirdImage) {
            // Only add if we have a valid alternative
            results.push({
              localImage: {
                id: image.Id,
                engineId: image.engineId,
                name: repo,
                tag: tag || 'latest',
                size: image.Size,
                architecture: image.Arch,
              },
              alternative: hummingbirdImage,
            });
          }

          // Only add once per image
          break;
        }
      }
    }

    return results;
  }

  override async scanLocalImage(image: LocalImage): Promise<VulnerabilitiesSummary> {
    const imageInspect = await this.dependencies.containersAPI.getImageInspect(image.engineId, image.id);
    const vulnerabilities = await this.dependencies.hummingbird.findVulnerabilities(imageInspect);

    if (!vulnerabilities) {
      throw new Error('Grype extension not available');
    }

    return vulnerabilities;
  }

  override async fetchAlternativeVulnerabilities(imageName: string, tag: string): Promise<VulnerabilitiesSummary> {
    const { data: vulnerabilities } = await this.dependencies.hummingbird.getClient().v1.getVulnerabilities(
      imageName,
      tag,
    );
    return vulnerabilities.summary;
  }

  override async fetchAlternativeTags(imageName: string): Promise<Tag[]> {
    console.log('fetchAlternativeTags', imageName);
    const { data: tagsResponse } = await this.dependencies.hummingbird.getClient().v1.getTags(imageName);
    console.log(tagsResponse.tags);
    return tagsResponse.tags;
  }
}
