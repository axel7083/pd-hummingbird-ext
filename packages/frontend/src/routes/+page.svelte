<script lang="ts">
import { NavPage } from '@podman-desktop/ui-svelte';
import type { PageProps } from './$types';
import RepositoryCard from '$lib/cards/RepositoryCard.svelte';
import type { Repository } from '@podman-desktop/extension-hummingbird-core-api';
import HummingbirdBanner from '$lib/banners/HummingbirdBanner.svelte';

let { data }: PageProps = $props();

let searchTerm: string = $state('');
let sortKey: 'name' | 'last_modified' = $state('name');
let sortDirection: 'asc' | 'desc' = $state('asc');

let displayed: Array<Repository> = $derived(
  (() => {
    const base = searchTerm.length > 0
      ? data.repositories.filter(({ name }) => name.toLowerCase().includes(searchTerm.toLowerCase()))
      : [...data.repositories];

    base.sort((a, b) => {
      let res = 0;
      if (sortKey === 'name') {
        res = a.name.localeCompare(b.name);
      } else if (sortKey === 'last_modified') {
        res = (a.last_modified || 0) - (b.last_modified || 0);
      }
      return sortDirection === 'asc' ? res : -res;
    });

    return base;
  })(),
);
</script>

<NavPage title="Hummingbird Catalog" searchEnabled={true} bind:searchTerm={searchTerm}>
  {#snippet content()}
    <div class="flex flex-col grow px-5 py-3">
      <HummingbirdBanner />

      <div class="flex flex-col w-full">
        <div class="flex items-center justify-end gap-2 mb-2">
          <label class="text-(--pd-content-text) mr-2">Sort by</label>
          <select bind:value={sortKey} class="rounded border px-2 py-1 bg-[var(--pd-content-card-bg)] text-(--pd-content-text)">
            <option value="name">Name</option>
            <option value="last_modified">Last updated</option>
          </select>
          <button on:click={() => sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'} aria-label="Toggle sort direction" class="px-2 py-1 rounded border">
            {sortDirection === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        <div
          class="grid min-[920px]:grid-cols-2 min-[1180px]:grid-cols-3 gap-3"
          role="region"
          aria-label="Hummingbird extensions">
          {#each displayed as repository (repository.name)}
            <RepositoryCard object={repository} />
          {/each}
        </div>
      </div>
    </div>
  {/snippet}
</NavPage>
