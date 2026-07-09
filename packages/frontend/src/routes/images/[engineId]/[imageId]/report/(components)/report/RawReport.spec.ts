/**********************************************************************
 * Copyright (C) 2024-2026 Red Hat, Inc.
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
import { render, screen } from '@testing-library/svelte';
import { describe, expect, test } from 'vitest';
import RawReport from './RawReport.svelte';
import type { AlternativeReport, ImageReport, LocalContainer } from '@podman-desktop/extension-hummingbird-core-api';

const MOCK_ALTERNATIVE_MOCK: AlternativeReport = {
  image: {
    name: 'alt-image',
    latest_tag: '1.0.0',
  },
  tags: [{ name: '1.0.0', sizes: { amd64: 50000000 } }],
  vulnerabilities: {
    summary: { total: 5, critical: 0, high: 1, medium: 2, low: 2 },
  },
} as unknown as AlternativeReport;

const IMAGE_REPORT_MOCK: ImageReport = {
  inspect: {
    RepoTags: ['original-image:latest'],
    Size: 100000000,
    Architecture: 'amd64',
    Created: '2024-01-01T00:00:00Z',
  },
  vulnerabilities: { total: 20, critical: 2, high: 4, medium: 8, low: 6, negligible: 0, unknown: 0 },
  containers: [],
} as unknown as ImageReport;

test('Expect that RawReport displays both image cards', async () => {
  render(RawReport, {
    alternative: MOCK_ALTERNATIVE_MOCK,
    image: IMAGE_REPORT_MOCK,
  });

  expect(screen.getByText('alt-image')).toBeInTheDocument();
  expect(screen.getByText('original-image:latest')).toBeInTheDocument();
  expect(screen.getByText('Hardened Alternative Found!')).toBeInTheDocument();
});

describe('ClonableContainerTable visibility', () => {
  test('should not display container table when containers array is empty', async () => {
    expect(IMAGE_REPORT_MOCK.containers).toHaveLength(0);

    render(RawReport, {
      alternative: MOCK_ALTERNATIVE_MOCK,
      image: IMAGE_REPORT_MOCK,
    });

    expect(screen.queryByText(/Container.*using original-image:latest image/)).not.toBeInTheDocument();
  });

  test('should display container table and title when containers exist', async () => {
    const containers: LocalContainer[] = [
      { id: 'abcd1234', name: '/my-container', state: 'running' } as unknown as LocalContainer,
    ];

    render(RawReport, {
      alternative: MOCK_ALTERNATIVE_MOCK,
      image: {
        ...IMAGE_REPORT_MOCK,
        containers,
      },
    });

    expect(screen.getByText(/Container using original-image:latest image/)).toBeInTheDocument();
  });
});
