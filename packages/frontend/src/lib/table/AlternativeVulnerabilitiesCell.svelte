<script lang="ts">
import { Spinner } from '@podman-desktop/ui-svelte';
import VulnerabilitySummary from '$lib/report/VulnerabilitySummary.svelte';
import type { VulnerabilitiesSummary } from '@podman-desktop/extension-hummingbird-core-api';

interface VulnState {
  local?: VulnerabilitiesSummary;
  alternative?: VulnerabilitiesSummary;
  scanning: boolean;
  error?: string;
}

interface Props {
  object: VulnState | undefined;
}

let { object }: Props = $props();

let reduction = $derived.by(() => {
  if (!object?.local || !object?.alternative) return 0;
  return object.local.total - object.alternative.total;
});
</script>

{#if object?.error}
  <span class="text-xs text-red-400">Error</span>
{:else if object?.scanning}
  <div class="flex items-center gap-2">
    <Spinner size="20" />
  </div>
{:else if object?.alternative}
  <div class="flex items-center gap-1">
    <span class="text-base font-semibold text-green-400">{object.alternative.total}</span>
    <VulnerabilitySummary vulnerabilities={object.alternative} />
    {#if reduction > 0}
      <span class="text-xs text-green-400 font-medium">(-{reduction})</span>
    {/if}
  </div>
{:else}
  <span class="text-xs text-[var(--pd-content-text)] opacity-50">-</span>
{/if}
