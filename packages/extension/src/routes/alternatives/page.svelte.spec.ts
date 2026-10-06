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

import { cleanup, render, within, screen } from '@testing-library/svelte';

import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { LocalImageAlternative } from '#lib/models/index.ts';
import Page from './+page.svelte';
import { getAlternatives, isGrypeInstalled } from '#lib/remote/alternatives.remote.ts';

vi.mock(
  import('#lib/remote/navigation.remote.ts'),
  () =>
    ({
      navigateToCatalog: vi.fn(),
      navigateToContainerDetails: vi.fn(),
      openExternal: vi.fn(),
    }) as never,
);
vi.mock(
  import('#lib/remote/alternatives.remote.ts'),
  () =>
    ({
      getAlternatives: vi.fn(),
      isGrypeInstalled: vi.fn(),
      getAlternativeReport: vi.fn(),
    }) as never,
);

/**
 * Fake remote function resource (query / query.live)
 */
function resource<T>(state: { current?: T; error?: Error }): never {
  const ready = state.current !== undefined;
  return Object.assign(state.error ? Promise.reject(state.error) : Promise.resolve(state.current), {
    current: state.current,
    error: state.error,
    ready,
    loading: !ready && !state.error,
  }) as never;
}

function mockRemotes(options: { alternatives?: Array<LocalImageAlternative>; error?: Error; grype?: boolean }): void {
  const alternatives = resource({ current: options.alternatives, error: options.error });
  // avoid unhandled rejections from the fake promise
  (alternatives as Promise<unknown>).catch(() => {});
  vi.mocked(getAlternatives).mockReturnValue(alternatives);
  vi.mocked(isGrypeInstalled).mockReturnValue(resource({ current: options.grype ?? false }));
}

const ALTERNATIVES: Array<LocalImageAlternative> = [
  {
    localImage: {
      id: 'image1',
      engineId: 'podman',
      name: 'nginx',
      tag: 'latest',
      size: 1024000,
      architecture: 'amd64',
      containers: [],
    },
    alternative: {
      name: 'nginx-hardened',
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
  },
];

beforeEach(() => {
  vi.resetAllMocks();
});

describe('error', () => {
  const ERROR_MOCK = new Error('Failed to fetch alternatives');

  test('query error should display error screen', async () => {
    mockRemotes({ error: ERROR_MOCK });
    const { getByLabelText } = render(Page);

    const emptyScreen = await vi.waitFor(() => {
      return getByLabelText('Error loading alternatives');
    });
    const element = within(emptyScreen).getByText(ERROR_MOCK.message);
    expect(element).toBeDefined();
  });
});

describe('loading', () => {
  test('should display skeleton when alternatives are not ready', async () => {
    mockRemotes({});
    const { getByRole } = render(Page);

    const skeletons = getByRole('table', { name: 'loading' });
    expect(skeletons).toBeInTheDocument();
  });

  test('skeleton table columns should match alternatives table columns', async () => {
    mockRemotes({});
    const { getByRole: getSkeletonRole } = render(Page);

    const skeletonTable = getSkeletonRole('table', { name: 'loading' });
    const skeletonHeaders = within(skeletonTable)
      .getAllByRole('columnheader')
      .map(el => el.textContent?.trim() ?? '');

    cleanup();

    mockRemotes({ alternatives: ALTERNATIVES });
    const { getByRole } = render(Page);

    const alternativesTable = await vi.waitFor(() => getByRole('table', { name: 'alternatives' }));
    const actualHeaders = within(alternativesTable)
      .getAllByRole('columnheader')
      .map(el => el.textContent?.trim() ?? '');

    expect(skeletonHeaders).toEqual(actualHeaders);
  });
});

describe('data', () => {
  test('should display alternatives when ready', async () => {
    mockRemotes({ alternatives: ALTERNATIVES });
    const { getByLabelText } = render(Page);

    await vi.waitFor(() => {
      expect(getByLabelText('nginx')).toBeInTheDocument();
    });
  });

  test('should display empty state when no alternatives found', async () => {
    mockRemotes({ alternatives: [] });
    const { getByLabelText } = render(Page);

    await vi.waitFor(() => {
      expect(getByLabelText('No alternatives found')).toBeDefined();
    });
  });
});

describe('analyze button', () => {
  test('should be disabled when grype is not installed', async () => {
    mockRemotes({ alternatives: ALTERNATIVES, grype: false });
    render(Page);

    const button = await vi.waitFor(() => screen.getByTitle('Analyze images'));
    expect(button).toBeDisabled();
  });

  test('should be enabled when grype is installed', async () => {
    mockRemotes({ alternatives: ALTERNATIVES, grype: true });
    render(Page);

    const button = await vi.waitFor(() => screen.getByTitle('Analyze images'));
    expect(button).toBeEnabled();
  });
});
