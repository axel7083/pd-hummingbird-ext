<script lang="ts">
import type { PageProps } from './$types';
import { Button, EmptyScreen } from '@podman-desktop/ui-svelte';
import { faWarning } from '@fortawesome/free-solid-svg-icons/faWarning';
import { containerAPI } from '/@/api/client';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

let { data }: PageProps = $props();

let stopBeforeClone = $state(true);
let loading = $state(false);
let error = $state<string | undefined>(undefined);

async function proceedWithClone(alternativeImageName: string): Promise<void> {
  loading = true;
  error = undefined;

  try {
    await containerAPI.cloneWithAlternative(
      data.engineId,
      data.containerId,
      alternativeImageName,
      { stopBeforeClone },
    );

    // Navigate to the containers page or show success message
    // For now, let's navigate back to the home page
    await goto(resolve('/'));
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  } finally {
    loading = false;
  }
}
</script>

<div class="w-full h-full p-5">
  {#await Promise.all([data.container, data.report])}
    <div class="flex justify-center items-center h-64">
      <span>Loading container information...</span>
    </div>
  {:then [container, report]}
    {#if !container}
      <EmptyScreen
        icon={faWarning}
        title="Container not found"
        aria-label="Container not found"
        message="The specified container could not be found.">
      </EmptyScreen>
    {:else if !report?.alternative}
      <EmptyScreen
        icon={faWarning}
        title="No Hummingbird alternative available"
        aria-label="No alternative"
        message="No Hummingbird alternative image is available for this container's base image.">
      </EmptyScreen>
    {:else}
      <div class="max-w-2xl">
        <h1 class="text-2xl font-bold mb-4">Clone Container with Hummingbird</h1>

        <div class="bg-[var(--pd-invert-content-card-bg)] p-4 rounded-lg mb-6">
          <div class="flex items-start gap-3">
            <div class="text-yellow-400 mt-1">
              <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="flex-1">
              <h3 class="font-semibold text-lg mb-2">Important Information</h3>
              <p class="text-[var(--pd-content-text)] opacity-80 mb-2">
                This will clone the container <strong>{container.Names?.[0]?.replace(/^\//, '') || container.Id.substring(0, 12)}</strong>
                and replace its base image with the Hummingbird hardened alternative:
              </p>
              <p class="text-[var(--pd-content-text)] font-mono text-sm bg-[var(--pd-content-bg)] px-2 py-1 rounded mb-2">
                {report.alternative.image.name}:{report.alternative.image.latest_tag}
              </p>
              <p class="text-[var(--pd-content-text)] opacity-80">
                The cloned container will have a new ID and name. Your original container will remain unchanged.
              </p>
            </div>
          </div>
        </div>

        <div class="mb-6">
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={stopBeforeClone}
              class="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <span class="text-[var(--pd-content-text)]">
              Stop existing container before proceeding (recommended)
            </span>
          </label>
        </div>

        {#if error}
          <div class="bg-red-500 bg-opacity-10 border border-red-500 text-red-400 px-4 py-3 rounded mb-6">
            <p class="font-semibold">Error cloning container</p>
            <p class="text-sm">{error}</p>
          </div>
        {/if}

        <div class="flex gap-3">
          <Button
            type="primary"
            onclick={(): Promise<void> => proceedWithClone(`quay.io/hummingbird/${report.alternative!.image.name}:${report.alternative!.image.latest_tag}`)}
            disabled={loading}>
            {loading ? 'Cloning...' : 'Proceed with Clone'}
          </Button>
          <Button type="secondary" onclick={(): void => window.history.back()}>
            Cancel
          </Button>
        </div>
      </div>
    {/if}
  {:catch err}
    <EmptyScreen
      icon={faWarning}
      title="Error loading information"
      aria-label="Error"
      message={err instanceof Error ? err.message : String(err)}>
    </EmptyScreen>
  {/await}
</div>
