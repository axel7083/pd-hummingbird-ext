<script lang="ts">
import { Spinner } from '@podman-desktop/ui-svelte';
import { filesize } from 'filesize';

interface SizeState {
  localSize?: number;
  alternativeSize?: number;
  scanning: boolean;
  error?: string;
}

interface Props {
  object: SizeState | undefined;
}

let { object }: Props = $props();

let reduction = $derived.by(() => {
  if (!object?.localSize || !object?.alternativeSize) return undefined;
  return object.localSize - object.alternativeSize;
});

let reductionPercent = $derived.by(() => {
  if (!object?.localSize || !object?.alternativeSize || object.localSize === 0) return undefined;
  return Math.round(((object.localSize - object.alternativeSize) / object.localSize) * 100);
});

let saved = $derived.by(() => {
  if (!reduction || reduction <= 0) return undefined;
  return filesize(reduction);
});
</script>

{#if object?.error}
  <span class="text-xs text-red-400">Error</span>
{:else if object?.scanning}
  <div class="flex items-center gap-2">
    <Spinner size="20" />
  </div>
{:else if object?.localSize && object?.alternativeSize}
  <div class="flex flex-col items-center">
    <div class="flex items-center gap-2">
      <span class="text-base font-medium">{filesize(object.localSize)}</span>
      <span class="text-[var(--pd-content-text)] opacity-30">→</span>
      <span class="text-base font-medium text-green-400">{filesize(object.alternativeSize)}</span>
    </div>
    {#if reduction !== undefined && reduction > 0}
      <div class="flex items-center gap-1">
        <span class="text-sm text-green-400">-{reductionPercent}% smaller</span>
        <span class="text-xs text-[var(--pd-content-text)] opacity-50">({saved} saved)</span>
      </div>
    {:else if reduction !== undefined && reduction < 0}
      <span class="text-xs text-[var(--pd-content-text)] opacity-50">Larger</span>
    {:else}
      <span class="text-xs text-[var(--pd-content-text)] opacity-50">Same size</span>
    {/if}
  </div>
{:else}
  <span class="text-xs text-[var(--pd-content-text)] opacity-50">-</span>
{/if}
