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

import { render, within } from '@testing-library/svelte';

import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { ImageSummary, ProviderContainerConnectionDetailedInfo } from '#lib/models/index.ts';
import Page from './+page.svelte';
import { getRepositories } from '#lib/remote/catalog.remote.ts';
import { getConnections } from '#lib/remote/providers.remote.ts';
import { getPulledImages } from '#lib/remote/images.remote.ts';
import { goto } from '$app/navigation';

vi.mock(import('$app/navigation'));
vi.mock(import('$app/state'), () => ({
  page: { url: new URL('http://localhost/') } as never,
}));
vi.mock(import('#lib/remote/catalog.remote.ts'), () => ({ getRepositories: vi.fn() }) as never);
vi.mock(import('#lib/remote/providers.remote.ts'), () => ({ getConnections: vi.fn() }) as never);
vi.mock(
  import('#lib/remote/images.remote.ts'),
  () =>
    ({
      getPulledImages: vi.fn(),
      pullImage: vi.fn(),
      getImage: vi.fn(),
      navigateToImageDetails: vi.fn(),
      navigateToImageRun: vi.fn(),
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

const REPOSITORIES: Array<ImageSummary> = [
  {
    name: 'curl',
    architectures: [],
    description: '',
    latest_tag: '',
    pull_url: '',
    streams: [],
    tag_count: 0,
    variants: [],
    application_category: '',
    summary: '',
  },
];

const CONNECTION: ProviderContainerConnectionDetailedInfo = {
  providerId: 'podman',
  name: 'podman-machine-default',
  status: 'started',
} as ProviderContainerConnectionDetailedInfo;

/**
 * Fake remote function resource (query / query.live)
 */
function resource<T>(state: { current?: T; error?: Error }): never {
  const ready = state.current !== undefined;
  const promise = state.error ? Promise.reject(state.error) : Promise.resolve(state.current);
  promise.catch(() => {});
  return Object.assign(promise, {
    current: state.current,
    error: state.error,
    ready,
    loading: !ready && !state.error,
    refresh: vi.fn().mockResolvedValue(undefined),
  }) as never;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getConnections).mockReturnValue(resource({ current: [] }));
  vi.mocked(getPulledImages).mockReturnValue(resource({ current: [] }));
});

describe('error', () => {
  const ERROR_MOCK = new Error('Something went wrong with network');

  test('query error should display empty screen with error', async () => {
    vi.mocked(getRepositories).mockReturnValue(resource({ error: ERROR_MOCK }));
    const { getByLabelText } = render(Page);

    const emptyScreen = await vi.waitFor(() => {
      return getByLabelText('Error while fetching the Hummingbird catalog');
    });
    const element = within(emptyScreen).getByText(ERROR_MOCK.message);
    expect(element).toBeDefined();
  });

  test('retry button should refresh the repositories', async () => {
    const repositories = resource<Array<ImageSummary>>({ error: ERROR_MOCK }) as { refresh: () => Promise<void> };
    vi.mocked(getRepositories).mockReturnValue(repositories as never);
    const { getByLabelText } = render(Page);

    const emptyScreen = await vi.waitFor(() => {
      return getByLabelText('Error while fetching the Hummingbird catalog');
    });
    const retryBtn = within(emptyScreen).getByRole('button', { name: 'Retry' });
    retryBtn.click();

    await vi.waitFor(() => {
      expect(repositories.refresh).toHaveBeenCalledOnce();
    });
  });
});

describe('loading', () => {
  test('should display 10 skeletons when repositories are not ready', async () => {
    vi.mocked(getRepositories).mockReturnValue(resource({}));
    const { getAllByLabelText } = render(Page);

    const skeletons = getAllByLabelText('Loading repository card');
    expect(skeletons).toHaveLength(10);
  });
});

describe('data', () => {
  test('should display repositories when ready', async () => {
    vi.mocked(getRepositories).mockReturnValue(resource({ current: REPOSITORIES }));
    const { getByLabelText } = render(Page);

    await vi.waitFor(() => {
      expect(getByLabelText(REPOSITORIES[0].name)).toBeDefined();
    });
  });

  test('should select the first started connection', async () => {
    vi.mocked(goto).mockResolvedValue(undefined);
    vi.mocked(getRepositories).mockReturnValue(resource({ current: REPOSITORIES }));
    vi.mocked(getConnections).mockReturnValue(resource({ current: [CONNECTION] }));
    render(Page);

    await vi.waitFor(() => {
      expect(goto).toHaveBeenCalledOnce();
    });
    const url = vi.mocked(goto).mock.calls[0][0] as URL;
    expect(url.searchParams.get('providerId')).toBe('podman');
    expect(url.searchParams.get('connection')).toBe('podman-machine-default');
  });
});
