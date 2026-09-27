<script>
  // Contenido de #tt-banner en el detalle: mi rol en ese partido (con "No puedo asistir")
  // y el recuadro del grupo que cocina, que abre sus integrantes.
  import CookIcon from './CookIcon.svelte';
  import CleanIcon from './CleanIcon.svelte';
  import { tercer, openThirdTimeGroupModal } from './tercer-tiempo.svelte.js';
  import { openSwapModal } from './covers.svelte.js';

  const banner = $derived(tercer.banner);
  const p = $derived(banner && banner.kind === 'match' ? banner.personal : null);
</script>

{#snippet swapBtn()}
  {#if p.swapText}<button class="tt-swap-btn" onclick={openSwapModal}>{p.swapText}</button>{/if}
{/snippet}

{#snippet groupBox()}
  <button class="tt-group-box" onclick={() => openThirdTimeGroupModal(banner.box.cookGroup)}>
    <div class="lbl">3r TEMPS</div>
    <div class="name">GRUP {banner.box.cookGroup}</div>
    <div class="hint">{banner.box.hint}</div>
  </button>
{/snippet}

{#if banner && banner.kind === 'noMatch'}
  <div class="tt-personal none">{banner.text}</div>
{:else if p && p.kind === 'noGroup'}
  <!-- El HTML original de esta variante tenía el <b> sin cerrar (<b>…</div>), y el
       navegador lo "reparaba" así: un <b> vacío al final de la tarjeta y el recuadro
       del grupo metido dentro de otro <b>. Se reproduce tal cual. -->
  <div class="tt-personal none"><div class="txt"><b>{p.title}</b></div><b></b></div>
  <b>{@render groupBox()}</b>
{:else if p}
  <div class="tt-personal {p.kind}">
    {#if p.kind !== 'none'}<div class="icon">{#if p.kind === 'cook'}<CookIcon />{:else}<CleanIcon />{/if}</div>{/if}
    <div class="txt"><b>{p.title}</b><span>{p.text}</span></div>
    {#if p.actions === 'wrapped'}
      <div class="tt-personal-actions">
        {@render swapBtn()}
      </div>
    {:else if p.actions === 'bare'}
      {@render swapBtn()}
    {/if}
  </div>
  {@render groupBox()}
{/if}
