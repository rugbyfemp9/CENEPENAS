<script>
  // Banner de "Multas" en Inicio: mismo tamaño que el de Tercer tiempo, cambia de
  // color/mensaje según lo que debe el usuario que ha iniciado sesión. (El <div
  // id="inicio-fines-banner"> que lo contiene sigue en index.html: al pulsarlo entero
  // también se va a Multas.)
  import { t } from '../../lib/i18n.svelte.js';
  import { legacy } from '../../lib/legacy.js';
  import { inicioFinesBanner } from './multas.svelte.js';

  const banner = $derived(inicioFinesBanner());
</script>

{#if banner}
  <div class="tt-personal fines-{banner.kind} tt-personal-stacked">
    <!-- Bolsa de dinero -->
    <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 3h4l1 3.2c2.6.9 4.5 3 4.5 6.3 0 4.1-3.6 7.5-7.5 7.5S4.5 16.6 4.5 12.5c0-3.3 1.9-5.4 4.5-6.3L10 3z"/><path d="M12 10.5c-1.1 0-2 .6-2 1.4s.9 1.4 2 1.4 2 .6 2 1.4-.9 1.4-2 1.4M12 9.5v1M12 14.5v1"/></svg></div>
    <div class="txt">
      <b>{t('fines.title')}</b>
      <span>{banner.kind === 'ok' ? t('fines.ok') : t(`fines.${banner.kind}`, { total: banner.total })}</span>
    </div>
    {#if banner.kind !== 'ok'}
      <div class="tt-personal-actions">
        <button class="tt-swap-btn" onclick={(e) => { e.stopPropagation(); legacy.setSection('multas'); }}>{t('fines.cta')}</button>
      </div>
    {/if}
  </div>
{/if}
