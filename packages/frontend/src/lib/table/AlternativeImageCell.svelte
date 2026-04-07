<script lang="ts">
import type { ImageSummary } from '@podman-desktop/extension-hummingbird-core-api';

interface Props {
  object: { alternative: ImageSummary };
}

let { object }: Props = $props();
</script>

<div class="flex flex-col">
  <div class="text-base font-medium text-purple-400">
    Hummingbird {object.alternative.name}
  </div>
  <div class="text-base text-[var(--pd-content-text)] opacity-50">
    quay.io/hummingbird/{object.alternative.name}:{object.alternative.latest_tag}
  </div>
</div>
