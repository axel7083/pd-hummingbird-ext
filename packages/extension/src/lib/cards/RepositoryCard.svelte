<script lang="ts">
import type { ProviderContainerConnectionDetailedInfo, ImageSummary, SimpleImageInfo } from '#lib/models/index.ts';
import { Button, TableDurationColumn } from '@podman-desktop/ui-svelte';
import { faDownload } from '@fortawesome/free-solid-svg-icons/faDownload';
import { faExternalLink } from '@fortawesome/free-solid-svg-icons/faExternalLink';
import RepositoryIcon from '#lib/icons/RepositoryIcon.svelte';
import { faPlay } from '@fortawesome/free-solid-svg-icons/faPlay';
import { navigateToImageDetails, navigateToImageRun, pullImage } from '#lib/remote/images.remote.ts';
import { openExternal } from '#lib/remote/navigation.remote.ts';

interface Props {
  object: ImageSummary;
  // the pulled image matching this repository, if any
  pulled?: SimpleImageInfo;
  // true while the pulled images are being listed
  pending?: boolean;
  connection?: ProviderContainerConnectionDetailedInfo;
}

let { object: image, pulled, pending = false, connection }: Props = $props();

let loading: boolean = $state(false);
// the image we just pulled, until the pulled images are refreshed
let justPulled: SimpleImageInfo | undefined = $state(undefined);
let result: SimpleImageInfo | undefined = $derived(pulled ?? justPulled);

async function pull(): Promise<void> {
  if (!connection) throw new Error('connection is not defined');

  loading = true;
  try {
    justPulled = await pullImage({
      image: `quay.io/hummingbird/${image.name}:latest`,
      connection: { providerId: connection.providerId, name: connection.name },
    });
  } finally {
    loading = false;
  }
}

function moreDetails(): Promise<boolean> {
  return openExternal(`https://quay.io/repository/hummingbird/${image.name}`);
}
</script>

<div
  class="rounded-lg border border-[var(--pd-content-bg)] flex flex-col bg-[var(--pd-content-card-bg)] hover:border-[var(--pd-content-card-border-selected)] min-h-48 max-h-48"
  role="group"
  aria-label={image.name}>
  <div class="p-3 h-full w-full flex flex-col gap-y-4 justify-between">
    <!-- card body -->
    <div class="flex flex-col w-full">
      <div class="flex flex-row items-center gap-x-2">
        <RepositoryIcon />
        <div class="flex flex-col">
          <div class="text-(--pd-content-header)">
            {image.name}
          </div>
          <div class="text-(--pd-link)">
            quay.io/hummingbird/{image.name}
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-y-2 divide-y divide-[var(--pd-content-divider)]">
        {#if image.description}
          <div class="py-2 text-(--pd-content-text)">
            <article class="line-clamp-2 overflow-hidden">
              <span>{image.description}</span>
            </article>
          </div>
        {/if}
        {#if image.oldest_created}
          <div class="flex">
            <div class="flex flex row justify-between w-full text-(--pd-content-text)">
              <span>Last updated</span>
              <span class="flex gap-x-1">
                <TableDurationColumn object={new Date(image.oldest_created)} />
                ago
              </span>
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- card footer -->
    <div class="flex justify-end">
      {#if pending && !result}
        <div class="animate-pulse grow rounded-[4px] bg-gray-900"></div>
      {:else if result}
        <div class="flex flex-row grow items-center gap-x-2">
          <Button
            type="secondary"
            class="grow"
            aria-label="Open"
            onclick={navigateToImageDetails.bind(undefined, result)}>Open</Button>

          <Button
            icon={faPlay}
            type="primary"
            class="grow"
            aria-label="Run"
            onclick={navigateToImageRun.bind(undefined, result)}>Run</Button>
        </div>
      {:else}
        <Button
          inProgress={loading}
          type="primary"
          disabled={!connection}
          class="grow"
          icon={faDownload}
          aria-label="Pull"
          onclick={pull}>Pull</Button>
      {/if}

      <Button type="link" icon={faExternalLink} aria-label="More details" onclick={moreDetails}>More details</Button>
    </div>
  </div>
</div>
