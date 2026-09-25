<script>
  // Tarjeta de "Tricount" en Inicio: mismo componente visual (.tt-personal) que Multas
  // y Tercer tiempo. Se mantiene al día cada vez que se carga o cambia algún
  // gasto/liquidación. (El <div id="inicio-tricount-banner"> que la contiene sigue en
  // index.html: al pulsarlo entero también se va a Tricount.)
  import { t } from '../../lib/i18n.svelte.js';
  import { legacy } from '../../lib/legacy.js';
  import { formatEuro } from '../../lib/format.js';
  import { tricountBalances, balanceKind } from './tricount.svelte.js';

  const n = $derived(tricountBalances()[legacy.currentUserId] || 0);
  const kind = $derived(balanceKind(n));
  const msg = $derived(kind === 'pos'
    ? t('tricount.owed', { amount: formatEuro(n) })
    : kind === 'neg'
      ? t('tricount.owe', { amount: formatEuro(Math.abs(n)) })
      : t('tricount.even'));
</script>

<div class="tt-personal tricount-{kind} tt-personal-stacked">
  <div class="icon emoji">🧾</div>
  <div class="txt">
    <b>{t('tricount.title')}</b>
    <span>{msg}</span>
  </div>
  <div class="tt-personal-actions">
    <button class="tt-swap-btn" onclick={(e) => { e.stopPropagation(); legacy.setSection('tricount'); }}>{t('tricount.cta')}</button>
  </div>
</div>
