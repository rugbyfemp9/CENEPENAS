<script>
  // Sección "Multas": avisos de pagos por confirmar, tarjeta personal y tabla de
  // multas del equipo.
  import Avatar from '../../lib/Avatar.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import { legacy } from '../../lib/legacy.js';
  import { session } from '../../lib/session.svelte.js';
  import {
    multas, fineConfirmRequests, myFinesSummary, finesTable, respondFineConfirmation, payMyFine,
    onFineChipClick, openFinesHistoryModal, toggleFinesEditMode, openFineModal,
  } from './multas.svelte.js';

  const requests = $derived(fineConfirmRequests());
  const summary = $derived(myFinesSummary());
  const rows = $derived(finesTable());
  // Solo Comi Tesoreria (y el admin) ve "Añadir multa" y "Editar multas".
  const canManage = $derived(session.isAdmin || session.comision === 'Comi Tesoreria');

  // "{name} te ha pagado su multa": el nombre va en <b>.
  const paidYouParts = $derived(t('fines.paidYouMsg').split('{name}'));
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="back-link" onclick={() => legacy.setSection('vestuario')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg> <span>{t('fines.backLabel')}</span></div>

<div class="fine-confirm-requests" id="fine-confirm-requests" style:display={requests.length ? 'flex' : 'none'}>
  {#each requests as r}
    <div class="fine-confirm-row">
      <span class="avatar">{#if r.avatar}<Avatar {...r.avatar} />{/if}</span>
      <div class="fine-confirm-msg">
        {paidYouParts[0]}<b>{r.payerName}</b>{paidYouParts[1]}
        <span class="fine-confirm-sub">{r.label} · {r.amount} €</span>
      </div>
      <div class="fine-confirm-actions">
        <button type="button" class="v" onclick={() => respondFineConfirmation(r.id, true)} aria-label={t('fines.confirmPayment')} title={t('fines.confirmPayment')}>✓</button>
        <button type="button" class="x" onclick={() => respondFineConfirmation(r.id, false)} aria-label={t('fines.notTrue')} title={t('fines.notTrue')}>✕</button>
      </div>
    </div>
  {/each}
</div>

<div class="card my-fines-card" id="my-fines-card">
  {#if summary}
    {#if summary.rows.length === 0}
      <div class="my-fines-head clear">
        <div>
          <div class="label">{t('fines.yourSituation')}</div>
          <div class="amount">{t('fines.upToDate')}</div>
        </div>
      </div>
    {:else}
      <div class="my-fines-head owing">
        <div>
          <div class="label">{t('fines.youOwe')}</div>
          <div class="amount">{summary.total} €</div>
        </div>
      </div>
      <div class="my-fines-list">
        {#each summary.rows as f}
          <div class="my-fine-row">
            <div>
              <div class="reason">{f.label}</div>
              <div class="amt">{f.amount} €</div>
            </div>
            {#if f.awaiting}
              <span class="fine-awaiting-badge">{t('fines.awaitingConfirmation')}</span>
            {:else}
              <button class="pay-fine-btn" onclick={() => payMyFine(f.id)}>{t('fines.payTitle')}</button>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<div class="section-head">
  <h2>{t('fines.teamTitle')}</h2>
  <div style="display:flex; align-items:center; gap:8px;">
    <button class="cal-open-btn" onclick={openFinesHistoryModal} aria-label={t('fines.history')} title={t('fines.history')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>
    </button>
    <button class="cal-open-btn" class:active={multas.editMode} id="edit-fines-toggle-btn" onclick={toggleFinesEditMode} aria-label={t('fines.editFines')} title={t('fines.editFines')} style:display={canManage ? null : 'none'}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
    </button>
    <button class="btn" id="add-fine-btn" onclick={openFineModal} style:display={canManage ? null : 'none'}>{t('fines.addFine')}</button>
  </div>
</div>
<div class="card">
  <table class="fines-table">
    <tbody><tr><th>{t('fines.player')}</th><th>{t('fines.reason')}</th><th>{t('fines.amount')}</th><th>{t('fines.colStatus')}</th></tr></tbody>
    <tbody id="fines-table-body">
      {#if rows}
        {#if rows.length === 0}
          <tr><td colspan="4" style="color:var(--text-muted); text-align:center; padding:24px;">{t('fines.noneOwed')}</td></tr>
        {:else}
          {#each rows as row}
            <tr>
              <td class="player-row"><div class="avatar"><Avatar {...row.avatar} /></div><div class="meta"><b>{row.name}</b></div></td>
              <td>{#each row.chips as c}<span class="fine-chip-wrap"><button class="fine-chip" data-reason={c.reasonId} onclick={() => onFineChipClick(c.targetId)} title={c.title}>{c.label}</button></span>{/each}</td>
              <td>{row.total} €</td>
              <td><span class="badge bad">{t('fines.pendingBadge')}</span></td>
            </tr>
          {/each}
        {/if}
      {/if}
    </tbody>
  </table>
</div>
