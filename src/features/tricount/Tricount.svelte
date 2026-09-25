<script>
  import { t } from '../../lib/i18n.svelte.js';
  import { legacy } from '../../lib/legacy.js';
  import { formatEuro } from '../../lib/format.js';
  import {
    tricount, tricountRosterPlayers, tricountBalances, tricountSettlementPlan, tricountDateHeading,
    rosterName, templateParts, balanceKind, setTricountTab, toggleSettlementPanel,
    settleTricountPayment, undoTricountSettlement, openAddTricountModal, openEditTricountModal,
    deleteTricountExpense,
  } from './tricount.svelte.js';

  // Cada bloque se recalcula cuando cambian los gastos/liquidaciones o el idioma
  // (como hacía renderTricount(), que también se llamaba desde setLang()).
  const myBalance = $derived.by(() => {
    const n = tricountBalances()[legacy.currentUserId] || 0;
    const kind = balanceKind(n);
    return {
      kind,
      sign: kind === 'pos' ? '+' : kind === 'neg' ? '−' : '',
      amount: Math.abs(n),
      hint: kind === 'pos' ? t('tricount.theyOweYou') : kind === 'neg' ? t('tricount.youOwe') : t('tricount.upToDate'),
    };
  });

  const balanceCards = $derived.by(() => {
    const balances = tricountBalances();
    return tricountRosterPlayers().map((p) => {
      const n = balances[p.id] || 0;
      const kind = balanceKind(n);
      return {
        id: p.id, name: legacy.displayName(p), kind, amount: Math.abs(n),
        hint: kind === 'pos' ? t('tricount.balanceOwed') : kind === 'neg' ? t('tricount.balanceOwes') : t('tricount.balanceEven'),
      };
    });
  });

  const plan = $derived(tricountSettlementPlan().map((item) => ({ ...item, fromName: rosterName(item.from), toName: rosterName(item.to) })));
  const mustPayParts = $derived(templateParts(t('tricount.mustPay')));

  const settled = $derived(
    tricount.settlements.slice().sort((a, b) => (b.iso || '').localeCompare(a.iso || ''))
      .map((s) => ({ ...s, fromName: rosterName(s.from), toName: rosterName(s.to) })),
  );
  const paidToParts = $derived(templateParts(t('tricount.paidTo')));

  const summaryMine = $derived(tricount.expenses.filter((e) => e.paidBy === legacy.currentUserId).reduce((sum, e) => sum + e.amount, 0));
  const summaryTotal = $derived(tricount.expenses.reduce((sum, e) => sum + e.amount, 0));

  // Del más reciente al más antiguo, agrupados por fecha
  const expenseRows = $derived.by(() => {
    const sorted = tricount.expenses.slice().sort((a, b) => (b.iso || '').localeCompare(a.iso || ''));
    let lastIso = null;
    return sorted.map((exp) => {
      let heading = null;
      if (exp.iso !== lastIso) {
        heading = tricountDateHeading(exp.iso);
        lastIso = exp.iso;
      }
      const payer = legacy.rosterById[exp.paidBy];
      const peopleWord = exp.participants.length === 1 ? t('tricount.person') : t('tricount.people');
      return {
        id: exp.id, heading, label: exp.label, amount: exp.amount,
        paidByText: t('tricount.paidBy', { name: payer ? legacy.displayName(payer) : '—', count: exp.participants.length, peopleWord }),
        canEdit: !!exp.createdBy && exp.createdBy === legacy.authUserId,
      };
    });
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="back-link" onclick={() => legacy.setSection('vestuario')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg> <span>{t('fines.backLabel')}</span></div>

<div class="section-head">
  <h2>{t('tricount.title')}</h2>
  <button class="cal-open-btn" onclick={openAddTricountModal} aria-label={t('tricount.addExpense')} title={t('tricount.addExpense')}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>
  </button>
</div>

<div class="simple-tabs tricount-tabs">
  <button class:active={tricount.tab === 'gastos'} data-tricount-tab="gastos" onclick={() => setTricountTab('gastos')}>{t('tricount.tabExpenses')}</button>
  <button class:active={tricount.tab === 'saldos'} data-tricount-tab="saldos" onclick={() => setTricountTab('saldos')}>{t('tricount.tabBalances')}</button>
</div>

<!-- PESTAÑA GASTOS -->
<div class="tricount-panel" class:active={tricount.tab === 'gastos'} id="tricount-panel-gastos">
  <div class="tricount-summary-grid">
    <div class="card stat-card c1">
      <div class="k">{t('tricount.mineLabel')}</div>
      <div class="v" id="tricount-summary-mine">{formatEuro(summaryMine)}</div>
    </div>
    <div class="card stat-card c2">
      <div class="k">{t('tricount.totalLabel')}</div>
      <div class="v" id="tricount-summary-total">{formatEuro(summaryTotal)}</div>
    </div>
  </div>
  <div id="tricount-expense-list">
    {#if expenseRows.length === 0}
      <div class="att-roster-empty">{t('tricount.expensesEmpty')}</div>
    {:else}
      {#each expenseRows as exp (exp.id)}
        {#if exp.heading !== null}<div class="tricount-date-heading">{exp.heading}</div>{/if}
        <div class="tricount-expense-item">
          <div class="info">
            <b>{exp.label}</b>
            <span>{exp.paidByText}</span>
          </div>
          <div class="right">
            <span class="amt">{formatEuro(exp.amount)}</span>
            {#if exp.canEdit}
              <button type="button" class="tricount-expense-del" onclick={() => openEditTricountModal(exp.id)} aria-label="Editar" title="Editar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </button>
            {/if}
            <button type="button" class="tricount-expense-del" onclick={() => deleteTricountExpense(exp.id)} aria-label="Eliminar" title="Eliminar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
            </button>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<!-- PESTAÑA SALDOS -->
<div class="tricount-panel" class:active={tricount.tab === 'saldos'} id="tricount-panel-saldos">
  <!-- Resumen personal destacado -->
  <div class="tricount-my-balance" id="tricount-my-balance">
    <div class="label">{t('tricount.myBalance')}</div>
    <div class="amt {myBalance.kind}">{myBalance.sign}{formatEuro(myBalance.amount)}</div>
    <div class="hint">{myBalance.hint}</div>
  </div>

  <!-- Reembolsos sugeridos: colapsado por defecto -->
  <button type="button" class="tricount-settlement-toggle" id="tricount-settlement-toggle" class:open={tricount.settlementOpen} onclick={toggleSettlementPanel} style="margin-top:22px;">
    <span>{tricount.settlementToggleLabel ?? t('tricount.viewSettlements')}</span>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 9l6 6 6-6"/></svg>
  </button>
  <div class="tricount-settlement-collapse" id="tricount-settlement-collapse" style="display:{tricount.settlementOpen ? 'block' : 'none'};">
    <p class="tricount-settlement-hint">{t('tricount.settlementHint')}</p>
    <div id="tricount-settlement-list">
      {#if plan.length === 0}
        <div class="tricount-settlement-empty">{t('tricount.settlementEmpty')}</div>
      {:else}
        {#each plan as item, i (i)}
          <div class="tricount-settlement-item">
            <div class="txt">{#each mustPayParts as part, j (j)}{#if part.key === 'from'}<b>{item.fromName}</b>{:else if part.key === 'amount'}<span class="amt">{formatEuro(item.amount)}</span>{:else if part.key === 'to'}<b>{item.toName}</b>{:else}{part.raw}{/if}{/each}</div>
            <button type="button" class="settle-btn" onclick={() => settleTricountPayment(item.from, item.to, item.amount)}>{t('tricount.markPaid')}</button>
          </div>
        {/each}
      {/if}
    </div>

    <div class="section-head" id="tricount-settled-head" style="margin-top:22px;" style:display={settled.length ? null : 'none'}>
      <h3 style="margin:0; text-transform:uppercase; font-size:15px; letter-spacing:.03em;">{t('tricount.settledHeading')}</h3>
    </div>
    <div id="tricount-settled-list">
      {#each settled as s (s.id)}
        <div class="tricount-settled-item">
          <div class="txt">{#each paidToParts as part, j (j)}{#if part.key === 'from'}<b>{s.fromName}</b>{:else if part.key === 'amount'}{formatEuro(s.amount)}{:else if part.key === 'to'}<b>{s.toName}</b>{:else}{part.raw}{/if}{/each}</div>
          <button type="button" class="undo-btn" onclick={() => undoTricountSettlement(s.id)}>{t('tricount.undo')}</button>
        </div>
      {/each}
    </div>
  </div>

  <div class="section-head" style="margin-top:22px;">
    <h3 style="margin:0; text-transform:uppercase; font-size:15px; letter-spacing:.03em;">{t('tricount.breakdownHeading')}</h3>
  </div>
  <div class="tricount-balance-grid" id="tricount-balance-grid">
    {#each balanceCards as c (c.id)}
      <div class="tricount-balance-card">
        <b>{c.name}</b>
        <span class="amt {c.kind}">{formatEuro(c.amount)}</span>
        <span class="hint">{c.hint}</span>
      </div>
    {/each}
  </div>
</div>
