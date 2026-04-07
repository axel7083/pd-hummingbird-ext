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
</script>

{#if object?.error}
  <span class="text-xs text-red-400">Error</span>
{:else if object?.scanning}
  <div class="flex items-center gap-2">
    <Spinner size="20" />
    <span class="text-xs text-[var(--pd-content-text)] opacity-50">Scanning...</span>
  </div>
{:else if object?.local}
  <div class="flex items-center gap-1">
    <span class="text-base font-semibold">{object.local.total}</span>
    <VulnerabilitySummary vulnerabilities={object.local} />
  </div>
{:else}
  <span class="text-xs text-[var(--pd-content-text)] opacity-50">-</span>
{/if}
