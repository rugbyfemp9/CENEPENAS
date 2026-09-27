<script>
  // Grupo de "Asistirán" (una posición o un rol) con su contador.
  import RosterRow from './RosterRow.svelte';

  let { group, isSubgroup = false } = $props();
</script>

<div class={isSubgroup ? 'att-roster-group is-subgroup' : 'att-roster-group'}>
  <div class="att-roster-group-title">{group.label} <span class="count">{group.rows.length}</span></div>
  {#each group.rows as row}<RosterRow {row} />{/each}
</div>
