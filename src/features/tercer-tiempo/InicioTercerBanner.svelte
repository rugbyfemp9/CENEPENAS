<script>
  // Tarjeta "Tercer tiempo" de Inicio. (El <div id="inicio-tercer-banner"> que la
  // contiene lo pinta src/shell/Inicio.svelte: al pulsarlo entero se va a la lista de
  // Tercer tiempo, y se oculta al Cos Tècnic.)
  import { t } from '../../lib/i18n.svelte.js';
  import CookIcon from './CookIcon.svelte';
  import CleanIcon from './CleanIcon.svelte';
  import { tercer, openTercerDetail } from './tercer-tiempo.svelte.js';

  const b = $derived(tercer.inicio);
</script>

{#if b}
  <div class="tt-personal {b.cls}">
    {#if b.icon}<div class="icon">{#if b.icon === 'cook'}<CookIcon />{:else}<CleanIcon />{/if}</div>{/if}
    <div class="txt"><b>{b.title}</b><span>{b.text}</span></div>
    {#if b.signupMatchId}
      <div class="tt-personal-actions">
        <button class="tt-swap-btn tt-signup-btn" onclick={(event) => { event.stopPropagation(); openTercerDetail(b.signupMatchId, 'tercer'); }}>{t('tercer.signup')}</button>
      </div>
    {/if}
  </div>
{/if}
