<script lang="ts">
import { Button } from '@podman-desktop/ui-svelte';
import type { ContainerInfo } from '@podman-desktop/extension-hummingbird-core-api';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

interface Props {
  object: ContainerInfo;
}

let { object }: Props = $props();

async function cloneContainer(): Promise<void> {
  return goto(
    resolve('/containers/[engineId]/[id]/clone', {
      engineId: object.engineId,
      id: object.Id,
    }),
  );
}
</script>

<div class="flex justify-end">
  <Button type="link" onclick={cloneContainer}>Clone with Hummingbird</Button>
</div>
