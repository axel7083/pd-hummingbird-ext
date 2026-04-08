<script lang="ts">
import type { ContainerInfo } from '@podman-desktop/extension-hummingbird-core-api';

interface Props {
  object: ContainerInfo;
}

let { object }: Props = $props();

let name = $derived(object.Names?.[0]?.replace(/^\//, '') || object.Id.substring(0, 12));
</script>

<div class="flex flex-col">
  <span class="text-sm font-medium">{name}</span>
  <span class="text-xs text-[var(--pd-content-text)] opacity-50">{object.State}</span>
</div>
