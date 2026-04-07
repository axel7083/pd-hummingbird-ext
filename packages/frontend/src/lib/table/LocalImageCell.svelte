<script lang="ts">
import type { LocalImage } from '@podman-desktop/extension-hummingbird-core-api';

interface Props {
  object: { localImage: LocalImage };
}

let { object }: Props = $props();

let shortName = $derived(object.localImage.name.split('/').pop() ?? object.localImage.name);
let fullPath = $derived(`${object.localImage.name}:${object.localImage.tag}`);
</script>

<div class="flex flex-col">
  <div class="text-base font-medium text-[var(--pd-content-header)]">
    {shortName}
  </div>
  <div class="text-sm text-[var(--pd-content-text)] opacity-50">
    {fullPath}
  </div>
</div>
