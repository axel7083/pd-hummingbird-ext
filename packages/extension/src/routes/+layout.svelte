<script lang="ts">
// app.css includes tailwind css dependencies that we use
import '../app.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import Navigation from '#lib/navigations/Navigation.svelte';

let { children } = $props();
</script>

<div class="flex flex-row w-full h-full">
  <Navigation />
  {@render children()}
</div>
