<script lang="ts">
import { Button } from '@podman-desktop/ui-svelte';
import type { LocalImage } from '@podman-desktop/extension-hummingbird-core-api';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

interface Props {
  object: { localImage: LocalImage };
}

let { object }: Props = $props();

async function viewDetails(): Promise<void> {
  return goto(
    resolve('/image/[engineId]/[id]', {
      engineId: object.localImage.engineId,
      id: object.localImage.id,
    }),
  );
}
</script>

<div class="flex justify-end">
  <Button type="link" onclick={viewDetails}>View Details</Button>
</div>
