<script lang="ts">
import type { LocalImage } from '@podman-desktop/extension-hummingbird-core-api';

interface Props {
  object: { localImage: LocalImage };
}

let { object }: Props = $props();

let shortName = $derived(object.localImage.name.split('/').pop() ?? object.localImage.name);
let fullPath = $derived(`${object.localImage.name}:${object.localImage.tag}`);
</script>

<div class="flex flex-col gap-y-1">
  <div class="text-base font-medium bg-[var(--pd-label-bg)] px-1 py-0.5 rounded-md text-[var(--pd-label-text)] w-fit">
    {shortName}
  </div>
  <div class="text-sm text-[var(--pd-content-text)] opacity-50">
    {fullPath}
  </div>
</div>
