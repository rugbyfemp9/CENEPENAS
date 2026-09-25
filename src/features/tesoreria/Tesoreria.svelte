<script>
  import { t } from '../../lib/i18n.svelte.js';
  import { legacy } from '../../lib/legacy.js';
  import { balanceLabel } from '../../lib/treasury/treasury.svelte.js';
  import TreasuryTable from '../../lib/treasury/TreasuryTable.svelte';
  import TreasuryEditButton from '../../lib/treasury/TreasuryEditButton.svelte';
  import { treasury, canManageClubTreasury } from './tesoreria.svelte.js';
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="back-link" onclick={() => legacy.setSection('comisiones')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg> <span>{t('nav.comisiones')}</span></div>

<div class="section-head">
  <h2>Comi Tesoreria</h2>
  <button class="treasury-add-btn" id="treasury-add-btn" onclick={treasury.openAdd} aria-label={t('comi.addMovement')} title={t('comi.addMovement')} style:display={canManageClubTreasury() ? null : 'none'}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>
  </button>
</div>

<!-- Banner con el saldo total del equipo -->
<button class="treasury-banner" onclick={treasury.openBreakdown}>
  <div class="treasury-banner-label">{t('comi.pot')}</div>
  <div class="treasury-banner-amount" id="treasury-balance" class:neg={treasury.view.balance < 0}>{balanceLabel(treasury.view.balance)}</div>
  <div class="treasury-banner-hint">{t('comi.viewBreakdown')}</div>
</button>

<!-- Resumen de ingresos y gastos, en formato tabla tipo Excel -->
<div class="card treasury-table-card">
  <div class="treasury-table-toolbar">
    <span class="treasury-table-toolbar-label">{t('comi.movements')}</span>
    <TreasuryEditButton {treasury} id="treasury-edit-btn" labelId="treasury-edit-btn-label" />
  </div>
  <TreasuryTable {treasury} headId="treasury-table-head" bodyId="treasury-table-body" />
</div>
