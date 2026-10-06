<script lang="ts">
import { NavPage, EmptyScreen, Button } from '@podman-desktop/ui-svelte';
import { faWarning } from '@fortawesome/free-solid-svg-icons/faWarning';
import AlternativeTable from '#routes/alternatives/(components)/AlternativeTable.svelte';
import TableSkeleton from '#lib/skeleton/TableSkeleton.svelte';
import GrypeBanner from '#routes/alternatives/(components)/banner/GrypeBanner.svelte';
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons/faMagnifyingGlass';
import type { LocalImageAlternativeReport } from '#lib/models/index.ts';
import { SvelteMap } from 'svelte/reactivity';
import { getAlternatives, getAlternativeReport, isGrypeInstalled } from '#lib/remote/alternatives.remote.ts';

// both are executed in the extension backend, alternatives are pushed again on container / image changes
const alternatives = getAlternatives();
const grype = isGrypeInstalled();

let reports: Map<string, Promise<LocalImageAlternativeReport>> = new SvelteMap();
let reporting: boolean = $state(false);

let columns = $derived([
  {
    name: 'Status',
    width: '70px',
  },
  {
    name: '',
    width: '2fr',
  },
  {
    name: 'Actions',
    width: '50px',
  },
]);

async function analyze(): Promise<void> {
  reporting = true;
  reports.clear();

  const promises: Array<Promise<LocalImageAlternativeReport>> = [];

  (alternatives.current ?? []).forEach(alternative => {
    const promise = getAlternativeReport(alternative);
    promises.push(promise);

    reports.set(alternative.localImage.id, promise);
  });

  await Promise.allSettled(promises);
  reporting = false;
}
</script>

<NavPage title="Hardened Image Alternatives" searchEnabled={false}>
  {#snippet additionalActions()}
    <Button
      disabled={!grype.current || reporting || reports.size > 0}
      inProgress={reporting}
      onclick={analyze}
      icon={faMagnifyingGlass}
      title="Analyze images">Analyze</Button>
  {/snippet}
  {#snippet content()}
    {#if alternatives.error}
      <EmptyScreen
        icon={faWarning}
        title="Error loading alternatives"
        aria-label="Error loading alternatives"
        message={alternatives.error.message ?? String(alternatives.error)}>
      </EmptyScreen>
    {:else if !alternatives.ready}
      <TableSkeleton count={10} columns={columns} />
    {:else if alternatives.current.length === 0}
      <EmptyScreen
        icon={faWarning}
        title="No alternatives found"
        aria-label="No alternatives found"
        message="No local images with Hummingbird alternatives were found. Pull some common images like nginx, postgres, or python to see alternatives.">
      </EmptyScreen>
    {:else}
      <div class="flex flex-col w-full h-full">
        {#if grype.ready && !grype.current}
          <GrypeBanner class="mx-5" />
        {/if}

        <div class="w-full flex">
          <AlternativeTable alternatives={alternatives.current} reports={reports} />
        </div>
      </div>
    {/if}
  {/snippet}
</NavPage>
