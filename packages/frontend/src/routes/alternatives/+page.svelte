<script lang="ts">
import { NavPage, EmptyScreen, Button, Spinner, Table, TableColumn, TableRow } from '@podman-desktop/ui-svelte';
import { alternativesAPI } from '/@/api/client';
import type { LocalImageAlternative, VulnerabilitiesSummary } from '@podman-desktop/extension-hummingbird-core-api';
import { onMount } from 'svelte';
import { faWarning } from '@fortawesome/free-solid-svg-icons/faWarning';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import AlternativeImageCell from '$lib/table/AlternativeImageCell.svelte';
import LocalImageCell from '$lib/table/LocalImageCell.svelte';
import LocalVulnerabilitiesCell from '$lib/table/LocalVulnerabilitiesCell.svelte';
import AlternativeVulnerabilitiesCell from '$lib/table/AlternativeVulnerabilitiesCell.svelte';
import { SvelteMap } from 'svelte/reactivity';

interface VulnState {
  local?: VulnerabilitiesSummary;
  alternative?: VulnerabilitiesSummary;
  scanning: boolean;
  error?: string;
}

interface AlternativeRow extends LocalImageAlternative {
  name: string;
  selected?: boolean;
  vulnState?: VulnState;
}

let alternatives: LocalImageAlternative[] = $state([]);
let loading = $state(true);
let error: Error | undefined = $state(undefined);
let vulnMap = new SvelteMap();

onMount(async () => {
  try {
    alternatives = await alternativesAPI.getLocalImagesWithAlternatives();
    loading = false;

    // Start scanning images one by one
    scanImagesSequentially().catch(console.error);
  } catch (err) {
    error = err instanceof Error ? err : new Error(String(err));
    loading = false;
  }
});

async function scanImagesSequentially(): Promise<void> {
  console.log('Scanning images sequentially');
  for (const alt of alternatives) {
    const key = alt.localImage.id;
    vulnMap.set(key, { scanning: true });

    try {
      // Scan local image
      const localVulns = await alternativesAPI.scanLocalImage($state.snapshot(alt.localImage));

      // Fetch alternative vulnerabilities
      const altVulns = await alternativesAPI.fetchAlternativeVulnerabilities(
        $state.snapshot(alt.alternative.name),
        $state.snapshot(alt.alternative.latest_tag),
      );

      vulnMap.set(key, {
        local: localVulns,
        alternative: altVulns,
        scanning: false,
      });
    } catch (err) {
      console.error(`Error scanning image ${alt.localImage.name}`, err);
      vulnMap.set(key, {
        scanning: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

function navigateToHome(): Promise<void> {
  return goto(resolve('/'));
}

const columns = [
  new TableColumn<AlternativeRow>('Original Image', {
    width: '2fr',
    renderer: LocalImageCell,
    overflow: true,
  }),
  new TableColumn<AlternativeRow>('Hummingbird Alternative', {
    width: '2fr',
    renderer: AlternativeImageCell,
    overflow: true,
  }),
  new TableColumn<AlternativeRow, VulnState | undefined>('Original CVEs', {
    width: '1fr',
    renderer: LocalVulnerabilitiesCell,
    renderMapping: (row: AlternativeRow): VulnState | undefined => row.vulnState,
    overflow: true,
  }),
  new TableColumn<AlternativeRow, VulnState | undefined>('Alternative CVEs', {
    width: '1fr',
    renderer: AlternativeVulnerabilitiesCell,
    renderMapping: (row: AlternativeRow): VulnState | undefined => row.vulnState,
    overflow: true,
  }),
];

const row: TableRow<AlternativeRow> = new TableRow<AlternativeRow>({});

let data: AlternativeRow[] = $derived(
  alternatives.map(alt => ({
    ...alt,
    vulnState: vulnMap.get(alt.localImage.id),
    name: alt.localImage.name,
  })),
);

let empty = $derived(alternatives.length === 0);
</script>

<NavPage title="Hardened Image Alternatives" searchEnabled={false}>
  {#snippet additionalActions()}
    <Button title="Back to Catalog" onclick={navigateToHome}>Back to Catalog</Button>
  {/snippet}
  {#snippet content()}
    <div class="flex flex-col grow px-5 py-3">
      <div class="mb-4 text-[var(--pd-content-text)] opacity-80">
        Discover secure, zero-CVE Hummingbird container images as drop-in replacements for your current images. These
        hardened alternatives provide enhanced security with minimal attack surfaces.
      </div>

      {#if loading}
        <div class="flex justify-center items-center h-64">
          <Spinner />
        </div>
      {:else if error}
        <EmptyScreen
          icon={faWarning}
          title="Error loading alternatives"
          aria-label="Error loading alternatives"
          message={error.message}>
        </EmptyScreen>
      {:else if empty}
        <EmptyScreen
          icon={faWarning}
          title="No alternatives found"
          aria-label="No alternatives found"
          message="No local images with Hummingbird alternatives were found. Pull some common images like nginx, postgres, or python to see alternatives.">
          <div class="flex gap-2 justify-center">
            <Button title="Back to Catalog" type="link" onclick={navigateToHome}>Back to Catalog</Button>
          </div>
        </EmptyScreen>
      {:else}
        <Table kind="alternatives" data={data} columns={columns} row={row} />
      {/if}
    </div>
  {/snippet}
</NavPage>
