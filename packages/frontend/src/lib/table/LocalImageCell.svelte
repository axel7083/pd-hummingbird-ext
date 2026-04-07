<script lang="ts">
import type { LocalImage } from '@podman-desktop/extension-hummingbird-core-api';

interface Props {
  object: { localImage: LocalImage };
}

let { object }: Props = $props();
</script>

<div class="flex flex-col">
  <div class="text-sm font-medium text-[var(--pd-content-header)]">
    {object.localImage.name.split('/').pop()}
  </div>
  <div class="text-xs text-[var(--pd-content-text)] opacity-50">
    {object.localImage.name}:{object.localImage.tag}
  </div>
</div>
