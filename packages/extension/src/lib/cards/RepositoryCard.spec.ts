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

import '@testing-library/jest-dom/vitest';
import { render } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { ImageSummary, ProviderContainerConnectionDetailedInfo, SimpleImageInfo } from '#lib/models/index.ts';
import RepositoryCard from './RepositoryCard.svelte';
import { pullImage } from '#lib/remote/images.remote.ts';
import userEvent from '@testing-library/user-event';

vi.mock(
  import('#lib/remote/images.remote.ts'),
  () =>
    ({
      pullImage: vi.fn(),
      navigateToImageDetails: vi.fn(),
      navigateToImageRun: vi.fn(),
      getImage: vi.fn(),
      getPulledImages: vi.fn(),
    }) as never,
);
vi.mock(
  import('#lib/remote/navigation.remote.ts'),
  () =>
    ({
      openExternal: vi.fn(),
      navigateToCatalog: vi.fn(),
      navigateToContainerDetails: vi.fn(),
    }) as never,
);

const IMAGE_SUMMARY: ImageSummary = {
  name: 'curl',
  architectures: [],
  description: 'A curl image',
  latest_tag: 'latest',
  pull_url: '',
  streams: [],
  tag_count: 1,
  variants: [],
  application_category: '',
  summary: '',
};

const SIMPLE_IMAGE_INFO: SimpleImageInfo = {
  id: 'image1',
  name: 'quay.io/hummingbird/curl',
  connection: { name: 'conn1', providerId: 'podman' },
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('RepositoryCard', () => {
  test('should display the image name', async () => {
    const { getByText } = render(RepositoryCard, {
      object: IMAGE_SUMMARY,
    });

    expect(getByText('curl')).toBeDefined();
  });

  test('should display the description when provided', async () => {
    const { getByText } = render(RepositoryCard, {
      object: IMAGE_SUMMARY,
    });

    expect(getByText('A curl image')).toBeDefined();
  });

  test('should show Run button when version >= 1.29', async () => {
    const { getByRole } = render(RepositoryCard, {
      object: IMAGE_SUMMARY,
      pulled: SIMPLE_IMAGE_INFO,
    });

    await vi.waitFor(() => {
      expect(getByRole('button', { name: 'Run' })).toBeDefined();
    });
  });

  test('should show Pull button when image is not pulled', async () => {
    const { getByRole } = render(RepositoryCard, {
      object: IMAGE_SUMMARY,
      pulled: undefined,
    });

    await vi.waitFor(() => {
      expect(getByRole('button', { name: 'Pull' })).toBeDefined();
    });
  });

  test('should show a skeleton while the pulled images are pending', async () => {
    const { queryByRole } = render(RepositoryCard, {
      object: IMAGE_SUMMARY,
      pending: true,
    });

    expect(queryByRole('button', { name: 'Pull' })).toBeNull();
    expect(queryByRole('button', { name: 'Run' })).toBeNull();
  });

  test('pull should call the pullImage command with the connection identifier', async () => {
    vi.mocked(pullImage).mockResolvedValue(SIMPLE_IMAGE_INFO as never);
    const connection = {
      providerId: 'podman',
      name: 'conn1',
      status: 'started',
    } as ProviderContainerConnectionDetailedInfo;

    const { getByRole } = render(RepositoryCard, {
      object: IMAGE_SUMMARY,
      connection,
    });

    await userEvent.click(getByRole('button', { name: 'Pull' }));

    expect(pullImage).toHaveBeenCalledExactlyOnceWith({
      image: 'quay.io/hummingbird/curl:latest',
      connection: { providerId: 'podman', name: 'conn1' },
    });
    // the pulled image is displayed until the pulled images are refreshed
    await vi.waitFor(() => {
      expect(getByRole('button', { name: 'Run' })).toBeDefined();
    });
  });
});
