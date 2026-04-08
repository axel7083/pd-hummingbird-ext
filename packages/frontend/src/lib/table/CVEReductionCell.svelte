<script lang="ts">
import { Spinner } from '@podman-desktop/ui-svelte';
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
  if (!object?.local || !object?.alternative) return undefined;
  return object.local.total - object.alternative.total;
});

let reductionPercent = $derived.by(() => {
  if (!object?.local || !object?.alternative || object.local.total === 0) return undefined;
  return Math.round(((object.local.total - object.alternative.total) / object.local.total) * 100);
});
</script>

{#if object?.error}
  <span class="text-xs text-red-400">Error scanning</span>
{:else if object?.scanning}
  <div class="flex items-center gap-2">
    <Spinner size="20" />
    <span class="text-xs text-[var(--pd-content-text)] opacity-50">Scanning...</span>
  </div>
{:else if object?.local && object?.alternative}
  <div class="flex flex-col items-center">
    <div class="flex items-center gap-2">
      <span class="text-base font-semibold" class:text-red-400={object.local.total > 0}>
        {object.local.total}
      </span>
      <span class="text-[var(--pd-content-text)] opacity-30">→</span>
      <span class="text-base font-semibold text-green-400">{object.alternative.total}</span>
    </div>
    {#if reduction !== undefined && reduction > 0}
      <div class="flex items-center gap-1">
        <span class="text-base text-[var(--pd-content-text)]">{reduction} CVEs eliminated</span>
        {#if reductionPercent !== undefined}
          <span class="text-base text-[var(--pd-content-text)]">({reductionPercent}%)</span>
        {/if}
      </div>
    {:else if reduction === 0}
      <span class="text-base text-[var(--pd-content-text)] opacity-50">No change</span>
    {/if}
  </div>
{:else}
  <span class="text-base text-[var(--pd-content-text)] opacity-50">-</span>
{/if}
