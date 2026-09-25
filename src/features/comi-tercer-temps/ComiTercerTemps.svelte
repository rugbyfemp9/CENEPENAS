<script>
  import { t } from '../../lib/i18n.svelte.js';
  import { legacy } from '../../lib/legacy.js';
  import { balanceLabel } from '../../lib/treasury/treasury.svelte.js';
  import TreasuryTable from '../../lib/treasury/TreasuryTable.svelte';
  import TreasuryEditButton from '../../lib/treasury/TreasuryEditButton.svelte';
  import {
    comiTercer, setComiTercerTab, shopping, addShoppingItem, toggleShoppingItem, deleteShoppingItem,
    tercerTreasury, canManageTercerTemps,
  } from './comi-tercer-temps.svelte.js';

  const canManage = $derived(canManageTercerTemps());
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="back-link" onclick={() => legacy.setSection('comisiones')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg> <span>{t('nav.comisiones')}</span></div>
<div class="section-head"><h2>Comi Tercer Temps</h2></div>

<div class="simple-tabs comi-tercer-tabs">
  <button class:active={comiTercer.tab === 'lista'} data-comi-tercer-tab="lista" onclick={() => setComiTercerTab('lista')}>{t('comi.tabList')}</button>
  <button class:active={comiTercer.tab === 'saldo'} data-comi-tercer-tab="saldo" onclick={() => setComiTercerTab('saldo')}>{t('comi.tabBalance')}</button>
</div>

<!-- LISTA: lista de la compra con casillas de verificación -->
<div class="comi-tercer-panel" class:active={comiTercer.tab === 'lista'} id="comi-tercer-panel-lista">
  <div class="card shopping-list-card">
    <div class="shopping-add-row" id="tercer-shopping-add-row" style:display={canManage ? null : 'none'}>
      <input type="text" id="tercer-shopping-input" placeholder={t('comi.addToListPlaceholder')} bind:value={shopping.input} onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addShoppingItem(); } }}>
      <button type="button" onclick={addShoppingItem} aria-label={t('comi.addAria')}>+</button>
    </div>
    <div id="tercer-shopping-list">
      {#if shopping.items.length === 0}
        <div class="shopping-empty">La lista está vacía.{canManage ? ' Añade lo que haga falta comprar 👆' : ''}</div>
      {:else}
        {#each shopping.items as item (item.id)}
          <label class="shopping-item" class:checked={item.checked}>
            <input type="checkbox" checked={item.checked} disabled={!canManage} onchange={() => toggleShoppingItem(item.id)}>
            <span class="shopping-item-label">{item.label}</span>
            {#if canManage}
              <button type="button" class="shopping-item-del" onclick={(e) => { e.preventDefault(); deleteShoppingItem(item.id); }} aria-label="Eliminar" title="Eliminar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
              </button>
            {/if}
          </label>
        {/each}
      {/if}
    </div>
  </div>
</div>

<!-- SALDO: banner de saldo total + tabla de movimientos -->
<div class="comi-tercer-panel" class:active={comiTercer.tab === 'saldo'} id="comi-tercer-panel-saldo">
  <button class="treasury-banner" onclick={tercerTreasury.openBreakdown}>
    <div class="treasury-banner-label">{t('comi.teamBalance')}</div>
    <div class="treasury-banner-amount" id="tercer-treasury-balance" class:neg={tercerTreasury.view.balance < 0}>{balanceLabel(tercerTreasury.view.balance)}</div>
    <div class="treasury-banner-hint">{t('comi.viewBreakdown')}</div>
  </button>

  <div class="card treasury-table-card">
    <div class="treasury-table-toolbar">
      <span class="treasury-table-toolbar-label">{t('comi.movements')}</span>
      <div class="treasury-table-toolbar-actions">
        <button class="treasury-add-btn" id="tercer-treasury-add-btn" onclick={tercerTreasury.openAdd} aria-label={t('comi.addMovement')} title={t('comi.addMovement')} style:display={canManage ? null : 'none'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>
        </button>
        <TreasuryEditButton treasury={tercerTreasury} id="tercer-treasury-edit-btn" labelId="tercer-treasury-edit-btn-label" />
      </div>
    </div>
    <TreasuryTable treasury={tercerTreasury} headId="tercer-treasury-table-head" bodyId="tercer-treasury-table-body" />
  </div>
</div>
