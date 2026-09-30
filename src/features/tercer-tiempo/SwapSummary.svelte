<script>
  // Contenido de #swap-summary-card: "Tus cambios de turno".
  import { tercer } from './tercer-tiempo.svelte.js';
  import { acceptSwap, rejectSwap } from './covers.svelte.js';

  const s = $derived(tercer.summary);
</script>

{#if s}
  <div class="section-head" style="margin-bottom:2px;"><h3 style="margin:0; font-size:16px;">{s.title}</h3></div>
  {#if s.emptyText}
    <div class="swap-empty">{s.emptyText}</div>
  {:else}
    {#each s.items as item}
      <div class="swap-request-item">
        <div class="txt">
          <b>{item.title}</b>
          <span>{item.text}</span>
        </div>
        {#if item.kind === 'incoming'}
          <div class="swap-request-actions">
            <button class="btn-xs reject" onclick={() => rejectSwap(item.coverId)}>{item.rejectText}</button>
            <button class="btn-xs accept" onclick={() => acceptSwap(item.coverId)}>{item.acceptText}</button>
          </div>
        {:else}
          <span class={item.badgeCls}>{item.badgeText}</span>
        {/if}
      </div>
    {/each}
  {/if}
{/if}
