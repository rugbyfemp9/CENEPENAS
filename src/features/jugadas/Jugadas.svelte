<script>
  import { t } from '../../lib/i18n.svelte.js';
  import { cssUrl } from '../../lib/url.js';
  import { setSection } from '../../shell/navigation.svelte.js';
  import { CATEGORIES, PLAYS } from './jugadas.js';
  import { jugadas, setFilter, openPlay, playsOf, categoryLabel, playTitle } from './jugadas.svelte.js';

  const visibleCategories = $derived(
    CATEGORIES.filter((c) => jugadas.filter === 'all' || jugadas.filter === c.id)
  );
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="back-link" onclick={() => setSection('vestuario')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg> <span>{t('fines.backLabel')}</span></div>
<div class="section-head">
  <h2>{t('nav.jugadas')}</h2>
</div>

<div class="jugadas-filters" role="group" aria-label={t('jugadas.filtersAria')}>
  <button class="jugadas-filter" class:active={jugadas.filter === 'all'} onclick={() => setFilter('all')}>
    {t('jugadas.all')} <span class="n">{PLAYS.length}</span>
  </button>
  {#each CATEGORIES as c (c.id)}
    <button class="jugadas-filter" class:active={jugadas.filter === c.id} data-category={c.id} onclick={() => setFilter(c.id)}>
      {categoryLabel(c.id)} <span class="n">{playsOf(c.id).length}</span>
    </button>
  {/each}
</div>

{#each visibleCategories as c (c.id)}
  {@const plays = playsOf(c.id)}
  <div class="jugadas-group" data-category={c.id}>
    <h3 class="jugadas-group-title"><span class="emoji">{c.emoji}</span> {categoryLabel(c.id)}</h3>
    {#if !plays.length}
      <div class="gallery-empty">{t('jugadas.emptyCategory')}</div>
    {:else}
      <div class="jugadas-grid">
        {#each plays as p (p.id)}
          <button class="play-card" onclick={() => openPlay(p.id)}>
            <div class="play-thumb" style={p.poster ? `background-image:url('${cssUrl(p.poster)}')` : null}>
              <span class="play-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>
              {#if !p.video}<span class="play-soon">{t('jugadas.soon')}</span>{/if}
            </div>
            <div class="play-cap">
              <b>{playTitle(p)}</b>
              <span>{categoryLabel(p.category)}</span>
            </div>
          </button>
        {/each}
      </div>
    {/if}
  </div>
{/each}
