<script>
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import { legacy } from '../../lib/legacy.js';
  import { rmHistory, closeGymRmHistoryModal } from './gym.svelte.js';

  // Al cerrarlo por fuera (clic en el fondo o "atrás") también se olvida el ejercicio,
  // para que una respuesta de Supabase que llegue tarde no se pinte.
</script>

<Modal id="gym-rm-history-modal" bind:open={() => rmHistory.open, (v) => { if (v) rmHistory.open = true; else closeGymRmHistoryModal(); }} boxStyle="max-width:360px;">
  <h3 style="margin-top:0;" id="gym-rm-history-modal-title">{rmHistory.title === null ? 'Histórico' : 'Histórico — ' + rmHistory.title}</h3>
  <p class="modal-sub">{t('gym.historySub')}</p>
  <div id="gym-rm-history-list">
    {#if rmHistory.status === 'loading'}
      <div class="gym-rm-history-loading">Cargando histórico…</div>
    {:else if rmHistory.status === 'empty'}
      <div class="gym-rm-history-empty">Todavía no hay marcas registradas para este ejercicio.</div>
    {:else if rmHistory.status === 'list'}
      {#if rmHistory.loadFailed}
        <div class="gym-rm-history-empty" style="color:var(--bad); padding:0 2px 12px; text-align:left;">No se ha podido traer el histórico completo desde Supabase — se muestra solo lo guardado en esta sesión.</div>
      {/if}
      <div class="gym-rm-history-list-inner">
        {#each rmHistory.entries as e, i (i)}
          <div class="gym-rm-history-row{i === 0 ? ' latest' : ''}">
            <span class="w">{e.weight} kg</span>
            <span class="d">{e.updatedAt ? legacy.formatShortDate(e.updatedAt) : '—'}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
  <div class="modal-actions">
    <button class="btn" onclick={closeGymRmHistoryModal}>{t('att.close')}</button>
  </div>
</Modal>
