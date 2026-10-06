<script lang="ts">
import type { LocalContainer } from '#lib/models/index.ts';

interface Props {
  object: LocalContainer;
}

let { object }: Props = $props();
</script>

<div class="text-[var(--pd-table-body-text-highlight)] max-w-full overflow-hidden text-ellipsis">
  {object.name.startsWith('/') ? object.name.substring(1) : object.name}
</div>
<div class="flex flex-row text-sm gap-1">
  <div class="text-[var(--pd-table-body-text)]">
    {object.id.substring(0, 8)}
  </div>
</div>
