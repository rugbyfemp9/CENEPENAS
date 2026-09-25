<script>
  // Botón "Editar"/"Hecho" de la tabla de movimientos: solo lo ve quien puede
  // gestionar la tesorería de esa comisión.
  import { t } from '../i18n.svelte.js';

  let { treasury, id, labelId } = $props();
  const view = $derived(treasury.view);
</script>

<button class="treasury-edit-btn" {id} class:active={view.editBtnActive} onclick={treasury.toggleEditMode} aria-label={t('comi.editTable')} title={t('comi.editTable')} style:display={treasury.canManage() ? null : 'none'}>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
  <span id={labelId}>{view.editBtnLabel ?? t('comi.edit')}</span>
</button>
