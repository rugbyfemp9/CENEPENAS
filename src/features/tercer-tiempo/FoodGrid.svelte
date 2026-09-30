<script>
  // Contenido de #tt-food-grid: "Qué llevamos", por categorías con huecos limitados.
  import { foodView, openFoodSlotModal, setFoodSlotStatus, removeFoodSlot } from './food.svelte.js';

  const grid = $derived(foodView.grid);
</script>

{#each grid || [] as cat}
  <div class="tt-food-cat">
    <div class="tt-food-cat-head">
      <b>{cat.head}</b>
      <span class="tt-food-count{cat.full ? ' full' : ''}">{cat.count}</span>
    </div>
    <div class="tt-food-slots">
      {#each cat.slots as slot}
        {#if slot.filled}
          <div class="tt-food-slot{slot.status === 'brought' ? ' brought' : ''}{slot.status === 'missing' ? ' missing' : ''}">
            <span class="txt">{slot.text}</span>
            <div class="tt-food-slot-actions">
              {#if !slot.supervising && slot.status}
                <span class="tt-food-status-badge {slot.status === 'brought' ? 'brought' : 'missing'}">{slot.status === 'brought' ? '✓' : '✕'}</span>
              {/if}
              {#if slot.supervising}
                <button class="tt-food-check check{slot.status === 'brought' ? ' on' : ''}" onclick={() => setFoodSlotStatus(cat.key, slot.index, 'brought')} title={cat.broughtTitle}>✓</button>
                <button class="tt-food-check cross{slot.status === 'missing' ? ' on' : ''}" onclick={() => setFoodSlotStatus(cat.key, slot.index, 'missing')} title={cat.missingTitle}>✕</button>
              {/if}
              {#if slot.mine}<button class="del" onclick={() => removeFoodSlot(cat.key, slot.index)} title={cat.removeTitle}>✕</button>{/if}
            </div>
          </div>
        {:else}
          <button class="tt-food-slot empty" onclick={() => openFoodSlotModal(cat.key)}>
            <span class="plus">+</span><span>{cat.signMeUp}</span>
          </button>
        {/if}
      {/each}
    </div>
  </div>
{/each}
