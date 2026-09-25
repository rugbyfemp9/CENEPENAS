<script>
  // Modal "Añadir movimiento" (Comi Tesoreria y Comi Tercer Temps: mismo marcado,
  // cambian los ids, los placeholders y el aviso de "nadie en la comisión").
  import Modal from '../Modal.svelte';

  let { treasury, ids, conceptPlaceholder, amountPlaceholder, noMembersText } = $props();
  const form = $derived(treasury.addForm);
  // Hasta que se abre por primera vez, el desplegable se ve y el aviso no.
  const noMembers = $derived(!!form.members && !form.members.length);

  const labelStyle = 'display:flex; flex-direction:column; gap:5px; font-size:12.5px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.04em;';
  const inputStyle = "font-family:'Roboto',sans-serif; font-size:14px; padding:10px 12px; border-radius:10px; border:1.5px solid var(--line); color:var(--navy);";
</script>

<Modal id={ids.modal} bind:open={form.open} boxStyle="max-width:380px;">
  <h3 style="margin-top:0;">Añadir movimiento</h3>
  <div class="field-group" style="display:flex; flex-direction:column; gap:12px; margin:14px 0 18px;">
    <label style={labelStyle}>
      Fecha
      <input type="date" id={ids.date} bind:value={form.iso} style={inputStyle}>
    </label>
    <label style={labelStyle}>
      Concepto
      <input type="text" id={ids.concept} placeholder={conceptPlaceholder} bind:value={form.concept} style={inputStyle}>
    </label>
    <!-- svelte-ignore a11y_label_has_associated_control -->
    <label style={labelStyle}>
      Tipo
      <div class="tx-type-toggle">
        <button type="button" class="tx-type-btn gasto" id={ids.typeGasto} class:active={form.type === 'gasto'} onclick={() => treasury.setType('gasto')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7 7 7-7"/></svg>
          Gastos
        </button>
        <button type="button" class="tx-type-btn ingreso" id={ids.typeIngreso} class:active={form.type === 'ingreso'} onclick={() => treasury.setType('ingreso')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7-7 7 7"/></svg>
          Ingresos
        </button>
      </div>
      <input type="hidden" id={ids.type} value={form.type}>
    </label>
    <label style={labelStyle}>
      Importe (€)
      <input type="number" id={ids.amount} placeholder={amountPlaceholder} min="0" step="0.01" bind:value={form.amount} style={inputStyle}>
    </label>
    <label style={labelStyle}>
      Responsable
      <select id={ids.responsible} bind:value={form.responsibleId} style="{inputStyle} background:var(--white);" style:display={noMembers ? 'none' : null}>
        {#each form.members || [] as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
      </select>
      <span id={ids.responsibleEmpty} style="display:{noMembers ? 'block' : 'none'}; font-size:12px; font-weight:500; text-transform:none; letter-spacing:normal; color:var(--text-muted);">
        {noMembersText}
      </span>
    </label>
  </div>
  <div class="modal-actions">
    <button class="btn-ghost" onclick={treasury.closeAdd}>Cancelar</button>
    <button class="btn" onclick={treasury.save}>Guardar</button>
  </div>
</Modal>
