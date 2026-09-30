<script>
  // Un partido de la lista de Tercer tiempo o de "Pasados" (origin: la sección a la que
  // vuelve el detalle).
  import { openTercerDetail } from './tercer-tiempo.svelte.js';

  let { row, origin } = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="att-event" onclick={() => openTercerDetail(row.id, origin)}>
  <div class="left">
    <div class="cal-date"><div class="d">{row.date}</div><div class="m">{row.month}</div></div>
    <div class="info">
      <b>{row.rival}</b>
      <span>{row.when}</span>
      <span class="tt-list-role {row.roleCls}">{row.roleText}</span>
    </div>
  </div>
  <div class="actions">
    <span class="tt-list-status {row.statusCode}">{row.statusText}</span>
  </div>
</div>
