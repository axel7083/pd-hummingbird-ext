<script lang="ts">
import { NavPage, EmptyScreen, Button, Spinner, Table, TableColumn, TableRow } from '@podman-desktop/ui-svelte';
import { alternativesAPI } from '/@/api/client';
import type { LocalImageAlternative, VulnerabilitiesSummary } from '@podman-desktop/extension-hummingbird-core-api';
import { onMount } from 'svelte';
import { faWarning } from '@fortawesome/free-solid-svg-icons/faWarning';
import AlternativeImageCell from '$lib/table/AlternativeImageCell.svelte';
import LocalImageCell from '$lib/table/LocalImageCell.svelte';
import CVEReductionCell from '$lib/table/CVEReductionCell.svelte';
import SizeReductionCell from '$lib/table/SizeReductionCell.svelte';
import ViewDetailsCell from '$lib/table/ViewDetailsCell.svelte';
import { SvelteMap } from 'svelte/reactivity';

interface VulnState {
  local?: VulnerabilitiesSummary;
  alternative?: VulnerabilitiesSummary;
  scanning: boolean;
  error?: string;
}

interface SizeState {
  localSize?: number;
  alternativeSize?: number;
  scanning: boolean;
  error?: string;
}

interface AlternativeRow extends LocalImageAlternative {
  name: string;
  selected?: boolean;
  vulnState?: VulnState;
  sizeState?: SizeState;
}

let alternatives: LocalImageAlternative[] = $state([]);
let loading = $state(true);
let error: Error | undefined = $state(undefined);
let vulnMap = new SvelteMap<string, VulnState>();
let sizeMap = new SvelteMap<string, SizeState>();

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
    sizeMap.set(key, { scanning: true });

    try {
      // Scan local image and fetch alternative data in parallel
      const [localVulns, altVulns, tags] = await Promise.all([
        alternativesAPI.scanLocalImage($state.snapshot(alt.localImage)),
        alternativesAPI.fetchAlternativeVulnerabilities(
          $state.snapshot(alt.alternative.name),
          $state.snapshot(alt.alternative.latest_tag),
        ),
        alternativesAPI.fetchAlternativeTags($state.snapshot(alt.alternative.name)),
      ]);

      console.log('local', alt.localImage);
      console.log('alternative', alt.alternative);

      // Find the tag matching the latest_tag for the correct architecture
      const matchingTag = tags.find(t => t.canonical === alt.alternative.latest_tag);
      if(matchingTag) {
          console.log('Found matching tag', matchingTag);
      } else {
          console.log(`No matching tag found for ${alt.alternative.latest_tag} in tags`, tags);
      }

      const altSize = matchingTag?.sizes?.[alt.localImage.architecture] ?? 0;

      vulnMap.set(key, {
        local: localVulns,
        alternative: altVulns,
        scanning: false,
      });

      sizeMap.set(key, {
        localSize: alt.localImage.size,
        alternativeSize: altSize,
        scanning: false,
      });
    } catch (err) {
      console.error(`Error scanning image ${alt.localImage.name}`, err);
      vulnMap.set(key, {
        scanning: false,
        error: err instanceof Error ? err.message : String(err),
      });
      sizeMap.set(key, {
        scanning: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

const columns = [
  new TableColumn<AlternativeRow>('Original Image', {
    width: '1.5fr',
    renderer: LocalImageCell,
    overflow: true,
  }),
  new TableColumn<AlternativeRow>('Alternative', {
    width: '1.5fr',
    renderer: AlternativeImageCell,
    overflow: true,
  }),
  new TableColumn<AlternativeRow, VulnState | undefined>('CVEs', {
    width: '1fr',
    renderer: CVEReductionCell,
    renderMapping: (row: AlternativeRow): VulnState | undefined => row.vulnState,
    overflow: true,
  }),
  new TableColumn<AlternativeRow, SizeState | undefined>('Size Reduction', {
    width: '1fr',
    renderer: SizeReductionCell,
    renderMapping: (row: AlternativeRow): SizeState | undefined => row.sizeState,
    overflow: true,
  }),
  new TableColumn<AlternativeRow>('', {
    width: '150px',
    renderer: ViewDetailsCell,
    align: 'right',
  }),
];

const row: TableRow<AlternativeRow> = new TableRow<AlternativeRow>({});

let data: AlternativeRow[] = $derived(
  alternatives.map(alt => ({
    ...alt,
    vulnState: vulnMap.get(alt.localImage.id),
    sizeState: sizeMap.get(alt.localImage.id),
    name: alt.localImage.name,
  })),
);

let empty = $derived(alternatives.length === 0);
</script>

<NavPage title="Hardened Image Alternatives" searchEnabled={false}>
  {#snippet content()}
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
        </EmptyScreen>
      {:else}
        <Table kind="alternatives" data={data} columns={columns} row={row} />
      {/if}
  {/snippet}
</NavPage>
