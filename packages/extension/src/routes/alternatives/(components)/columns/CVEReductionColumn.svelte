<script lang="ts">
import SimpleLocalImageAlternativeReport from '../cves/SimpleLocalImageAlternativeReport.svelte';
import type { LocalImageAlternativeReport } from '#lib/models/index.ts';
import TableColumnSkeleton from '#lib/skeleton/TableColumnSkeleton.svelte';

interface Props {
  object: Promise<LocalImageAlternativeReport> | undefined;
}

let { object }: Props = $props();
</script>

{#if object}
  {#await object}
    <TableColumnSkeleton object={{ name: 'CVEs' }} />
  {:then report}
    <SimpleLocalImageAlternativeReport object={report} />
  {:catch error}
    <span class="text-xs text-red-400">Error scanning {error}</span>
  {/await}
{/if}
