<script>
  // Tarjeta "Acta del partido" del detalle de un partido: botones de crear a mano /
  // subir PDF / eliminar (según permisos) y la tabla de jugadoras.
  import { t } from '../../lib/i18n.svelte.js';
  import { actas, matchReportView, cardBadge } from './actas.svelte.js';
  import { openMatchReportUploadModal, deleteMatchReport } from './upload.svelte.js';
  import { openMatchReportBuilderModal } from './builder.svelte.js';

  const view = $derived(matchReportView());
  const canEdit = $derived(actas.view > 0 && actas.canEdit);
</script>

<div class="card" style="margin-bottom:16px;">
  <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:4px;">
    <h3 style="margin:0; font-size:15px; text-transform:uppercase;">{t('partido.actaTitle')}</h3>
    <div style="display:flex; align-items:center; gap:6px;">
      <button class="cal-open-btn small" id="match-report-create-btn" onclick={openMatchReportBuilderModal} aria-label={t('partido.createManual')} title={t('partido.createManual')} style:display={canEdit ? 'flex' : 'none'}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>
      </button>
      <button class="cal-open-btn small" id="match-report-upload-btn" onclick={openMatchReportUploadModal} aria-label={t('partido.uploadPdf')} title={t('partido.uploadPdf')} style:display={canEdit ? 'flex' : 'none'}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3"/></svg>
      </button>
      <button class="cal-open-btn small" id="match-report-delete-btn" onclick={deleteMatchReport} aria-label={t('partido.deleteActa')} title={t('partido.deleteActa')} style:display={canEdit && view ? 'flex' : 'none'}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
      </button>
    </div>
  </div>
  <div id="match-report-box">
    {#if actas.view > 0}
      {#if !view}
        <div class="gym-routine-empty">
          <p>{t('partido.noActaYet')}</p>
          {#if canEdit}
            <div style="display:flex; gap:8px; justify-content:center; flex-wrap:wrap;">
              <button class="btn" onclick={openMatchReportUploadModal}>{t('partido.uploadPdf')}</button>
              <button class="btn-ghost" onclick={openMatchReportBuilderModal}>{t('partido.createManual')}</button>
            </div>
          {/if}
        </div>
      {:else}
        {#if view.estimated}<div class="gym-split-note" style="margin-bottom:12px;"><span class="dot"></span> {t('partido.durationAssumed')}</div>{/if}
        <div style="overflow-x:auto;">
          <table class="gym-exercise-table">
            <thead>
              <tr>
                <th>{t('partido.colNum')}</th>
                <th>{t('partido.colPlayerUpper')}</th>
                <th>{t('partido.colState')}</th>
                <th>{t('partido.colMin')}</th>
                <th>A</th>
                <th>T</th>
                <th>CC</th>
                <th>{t('partido.colPoints')}</th>
                <th>{t('partido.colCardsUpper')}</th>
              </tr>
            </thead>
            <tbody>
              {#each view.players as { p, matched }}
                <tr>
                  <td class="num">{p.jersey_number != null ? p.jersey_number : '—'}</td>
                  <td class="name">{matched ? matched.name : (p.player_name || t('partido.noName'))}{#if !matched}{' '}<span class="muted" style="font-weight:400;">{t('partido.noProfileInApp')}</span>{/if}</td>
                  <td class="muted">{p.is_starter ? t('partido.starter') : t('partido.substitute')}</td>
                  <td class="num">{p.minutes_played != null ? p.minutes_played : '—'}</td>
                  <td class="num">{p.tries_count || '—'}</td>
                  <td class="num">{p.conversions_count || '—'}</td>
                  <td class="num">{p.penalties_count || '—'}</td>
                  <td class="num">{p.points || '—'}</td>
                  <td>{#each p.cards || [] as card, i}{@const b = cardBadge(card, t)}{#if i}{' '}{/if}<span class="badge {b.cls}">{b.text}</span>{:else}—{/each}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    {/if}
  </div>
</div>
