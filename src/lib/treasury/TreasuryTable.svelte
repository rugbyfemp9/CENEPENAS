<script>
  // Tabla de movimientos (Comi Tesoreria y Comi Tercer Temps). La cabecera y los
  // tipos van siempre en castellano, como en el código antiguo. La cabecera sólo tiene
  // columna de acciones (papelera) cuando está activo el modo edición.
  import { formatEuro } from '../format.js';

  let { treasury, headId, bodyId } = $props();
  const view = $derived(treasury.view);

  function shortDate(iso) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y.slice(2)}`;
  }
</script>

<table class="treasury-table">
  <thead id={headId}>
    <tr>
      <th class="col-date">Fecha</th><th class="col-concept">Concepto</th><th class="col-type">Tipo</th><th class="col-amount" style="text-align:right;">Importe</th>
      {#if view.editMode}<th class="col-actions"></th>{/if}
    </tr>
  </thead>
  <tbody id={bodyId}>
    {#if !view.rows.length}
      <tr><td colspan={view.editMode ? 5 : 4} class="treasury-table-empty">Todavía no hay movimientos registrados.</td></tr>
    {:else if !view.editMode}
      {#each view.rows as e (e.id)}
        <tr>
          <td class="col-date">{shortDate(e.iso)}</td>
          <td class="col-concept" title={e.concept}>
            {e.concept}
            {#if e.responsible}<span class="tv-responsible">{e.responsible}</span>{/if}
          </td>
          <td class="col-type"><span class="type-pill {e.type}">{e.type === 'ingreso' ? 'Ingreso' : 'Gasto'}</span></td>
          <td class="col-amount amount-{e.type}" style="text-align:right;">{e.type === 'ingreso' ? '+' : '−'}{formatEuro(e.amount)}</td>
        </tr>
      {/each}
    {:else}
      <!-- Modo edición: fecha/concepto/importe editables, tipo con un toque y papelera para borrar -->
      {#each view.rows as e (e.id)}
        <tr>
          <td class="col-date"><input type="date" class="tv-input" value={e.iso} onchange={(ev) => treasury.updateField(e.id, 'iso', ev.currentTarget.value)}></td>
          <td class="col-concept"><input type="text" class="tv-input" value={e.concept} oninput={(ev) => treasury.updateField(e.id, 'concept', ev.currentTarget.value)}></td>
          <td class="col-type">
            <button type="button" class="type-pill clickable {e.type}" onclick={() => treasury.toggleEntryType(e.id)}>{e.type === 'ingreso' ? 'Ingreso' : 'Gasto'}</button>
          </td>
          <td class="col-amount">
            <input type="number" class="tv-input tv-amount" value={e.amount} min="0" step="0.01" oninput={(ev) => treasury.updateField(e.id, 'amount', ev.currentTarget.value)}>
          </td>
          <td class="col-actions">
            <button type="button" class="tv-del-btn" onclick={() => treasury.openDeleteConfirm(e.id)} aria-label="Eliminar movimiento" title="Eliminar movimiento">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
            </button>
          </td>
        </tr>
      {/each}
    {/if}
  </tbody>
</table>
