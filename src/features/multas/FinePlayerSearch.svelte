<script>
  // Buscador de jugadora de los modales de alta y de edición de multa. `modal` es
  // fineModal o editFineModal (multas.svelte.js); `prefix` es el prefijo de los ids
  // ('fine' / 'edit-fine').
  import Avatar from '../../lib/Avatar.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import { onPlayerSearchInput, onPlayerSearchFocus, selectPlayer, closePlayerSearchResults } from './multas.svelte.js';

  let { modal, prefix } = $props();
  const search = $derived(modal.search);
  let wrap;

  // Cierra el desplegable de resultados si se hace clic fuera del buscador de jugadora.
  function onDocumentClick(e) {
    if (wrap && !wrap.contains(e.target)) closePlayerSearchResults(search);
  }
</script>

<svelte:document onclick={onDocumentClick} />

<div class="fine-player-search" id="{prefix}-player-search" bind:this={wrap}>
  <input type="text" id="{prefix}-player-search-input" class="fine-player-search-input" class:has-selection={search.hasSelection}
         placeholder={t('fines.searchPlaceholder')} autocomplete="off"
         value={search.query} oninput={(e) => onPlayerSearchInput(modal, e.currentTarget.value)} onfocus={() => onPlayerSearchFocus(modal)}>
  <div class="fine-player-search-results" class:open={search.resultsOpen} id="{prefix}-player-search-results">{#if search.results === null}<div class="fine-player-search-empty">Sin coincidencias</div>{:else}{#each search.results as p}
    <button type="button" class="fine-player-search-result" onclick={() => selectPlayer(modal, p.id)}>
      <span class="avatar"><Avatar {...p.avatar} /></span>
      <span>{p.shown}</span>
    </button>
  {/each}{/if}</div>
</div>
