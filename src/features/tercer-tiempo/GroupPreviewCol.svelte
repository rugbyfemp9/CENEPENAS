<script>
  // Columna con los integrantes de un grupo (avatar + nombre): vista vacía de la lista
  // de Tercer tiempo y modal "Grupos del tercer tiempo".
  import Avatar from '../../lib/Avatar.svelte';

  let { col } = $props();
</script>

<div class="tt-groups-preview-col">
  <div class="tt-groups-preview-title">{col.title}</div>
  {#each col.rows as r}
    <div class="tt-groups-preview-row">
      <span class="avatar"><Avatar {...r.avatar} /></span>
      <div class="info"><b>{r.name}</b></div>
    </div>
  {:else}
    <div class="tt-groups-preview-empty">{col.empty}</div>
  {/each}
</div>
