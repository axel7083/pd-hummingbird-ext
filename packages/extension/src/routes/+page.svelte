<script lang="ts">
import { NavPage, EmptyScreen, Button } from '@podman-desktop/ui-svelte';
import RepositoryCard from '#lib/cards/RepositoryCard.svelte';
import HummingbirdBanner from '#lib/banners/HummingbirdBanner.svelte';
import RepositoryCardSkeleton from '#lib/skeleton/RepositoryCardSkeleton.svelte';
import { faWarning } from '@fortawesome/free-solid-svg-icons/faWarning';
import { goto } from '$app/navigation';
import ContainerProviderConnectionSelect from '#lib/selects/ContainerProviderConnectionSelect.svelte';
import type { ProviderContainerConnectionDetailedInfo } from '#lib/models/index.ts';
import { page } from '$app/state';
import { getConnections } from '#lib/remote/providers.remote.ts';
import { getRepositories } from '#lib/remote/catalog.remote.ts';
import { getPulledImages } from '#lib/remote/images.remote.ts';

// executed in the extension, connections & pulled images are pushed again on changes
const connections = getConnections();
const repositories = getRepositories();

let searchTerm: string = $state('');

// using the query parameters
let selectedContainerProviderConnection: ProviderContainerConnectionDetailedInfo | undefined = $derived(
  (connections.current ?? []).find(
    provider =>
      provider.providerId === page.url.searchParams.get('providerId') &&
      provider.name === page.url.searchParams.get('connection'),
  ),
);

let pulled = $derived(
  selectedContainerProviderConnection
    ? getPulledImages({
        providerId: selectedContainerProviderConnection.providerId,
        name: selectedContainerProviderConnection.name,
      })
    : undefined,
);

$effect(() => {
  // ensure we always have a selected provider connection
  const all = connections.current ?? [];
  if (!selectedContainerProviderConnection && all.length > 0) {
    onContainerProviderConnectionChange(all.find(({ status }) => status === 'started') ?? all[0]);
  }
});

function onContainerProviderConnectionChange(value: ProviderContainerConnectionDetailedInfo | undefined): void {
  const nURL = new URL(page.url.href);

  if (value) {
    nURL.searchParams.set('providerId', value.providerId);
    nURL.searchParams.set('connection', value.name);
  } else {
    nURL.searchParams.entries().forEach(([name]) => {
      nURL.searchParams.delete(name);
    });
  }

  // eslint-disable-next-line svelte/no-navigation-without-resolve
  goto(nURL).catch(console.error);
}

function refresh(): Promise<void> {
  return repositories.refresh();
}
</script>

<NavPage title="Hummingbird Catalog" searchEnabled={true} bind:searchTerm={searchTerm}>
  {#snippet bottomAdditionalActions()}
    {#if (connections.current?.length ?? 0) > 1}
      <div class="w-full flex justify-end">
        <div class="w-[250px]">
          <ContainerProviderConnectionSelect
            clearable={false}
            onChange={onContainerProviderConnectionChange}
            value={selectedContainerProviderConnection}
            containerProviderConnections={connections.current ?? []} />
        </div>
      </div>
    {/if}
  {/snippet}
  {#snippet content()}
    <div class="flex flex-col grow px-5 py-3">
      <HummingbirdBanner />

      <div class="flex flex-col w-full h-full">
        <!-- while we fetch the repositories we display skeleton cards -->
        {#if repositories.error}
          <EmptyScreen
            icon={faWarning}
            title="Something went wrong while fetching the Hummingbird catalog"
            aria-label="Error while fetching the Hummingbird catalog"
            message={repositories.error?.message ?? String(repositories.error)}>
            <div class="flex gap-2 justify-center">
              <Button title="Retry" type="link" onclick={refresh}>Retry</Button>
            </div>
          </EmptyScreen>
        {:else if !repositories.ready}
          <div class="grid min-[720px]:grid-cols-2 min-[980px]:grid-cols-3 gap-3">
            {#each Array.from({ length: 10 }) as _, index (index)}
              <RepositoryCardSkeleton />
            {/each}
          </div>
        {:else}
          {@const filtered =
            searchTerm.length > 0
              ? repositories.current.filter(({ name }) => name.toLowerCase().includes(searchTerm.toLowerCase()))
              : repositories.current}
          <div class="grid min-[720px]:grid-cols-2 min-[980px]:grid-cols-3 gap-3">
            {#each filtered as repository (repository.name)}
              <RepositoryCard
                object={repository}
                pending={!pulled?.ready}
                pulled={pulled?.current?.find(image => image.name.startsWith(`quay.io/hummingbird/${repository.name}`))}
                connection={selectedContainerProviderConnection} />
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/snippet}
</NavPage>
