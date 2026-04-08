<script lang="ts">
import type { PageProps } from './$types';
import OptimisationReport from '$lib/report/OptimisationReport.svelte';
import { Table, TableColumn, TableRow } from '@podman-desktop/ui-svelte';
import type { ContainerInfo } from '@podman-desktop/extension-hummingbird-core-api';
import ContainerNameCell from '$lib/table/ContainerNameCell.svelte';
import CloneContainerCell from '$lib/table/CloneContainerCell.svelte';

interface ContainerRow extends ContainerInfo {
  name: string;
}

let { data }: PageProps = $props();

const containerColumns = [
  new TableColumn<ContainerRow>('Container', {
    width: '1fr',
    renderer: ContainerNameCell,
    overflow: true,
  }),
  new TableColumn<ContainerRow, string>('Status', {
    width: '200px',
    renderMapping: (row: ContainerRow): string => row.Status,
  }),
  new TableColumn<ContainerRow>('', {
    width: '200px',
    renderer: CloneContainerCell,
    align: 'right',
  }),
];

const containerRow = new TableRow<ContainerRow>({});
</script>

<div class="w-full h-full">
    {#await data.report}
        <span>Loading...</span>
    {:then report}
        <div class="mx-5 mt-5">
            <OptimisationReport object={report} />

            {#await data.containers}
                <div class="mt-8">
                    <h2 class="text-lg font-semibold mb-4">Containers using this image</h2>
                    <span>Loading containers...</span>
                </div>
            {:then containers}
                {#if containers.length > 0}
                    {@const containerRows: ContainerRow[] = containers.map(c => ({
                        ...c,
                        name: c.Names?.[0]?.replace(/^\//, '') || c.Id.substring(0, 12),
                    }))}
                    <div class="mt-8">
                        <h2 class="text-lg font-semibold mb-4">Containers using this image</h2>
                        <Table kind="containers" data={containerRows} columns={containerColumns} row={containerRow} />
                    </div>
                {/if}
            {/await}
        </div>
    {/await}
</div>
