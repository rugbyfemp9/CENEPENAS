<script>
  import { t } from '../../lib/i18n.svelte.js';
  import { cssUrl } from '../../lib/url.js';
  import { setSection } from '../../shell/navigation.svelte.js';
  import PlayBoard from './PlayBoard.svelte';
  import { fitViewBox } from './board.js';
  import { jugadas, setFilter, openPlay, playsOf, categoryName, canManagePlays, openAddPlayModal, animationOf } from './jugadas.svelte.js';

  // En "Todas" solo salen las categorías que tienen alguna jugada; al filtrar por una
  // categoría vacía se dice que está vacía.
  const visibleCategories = $derived(
    jugadas.filter === 'all'
      ? jugadas.categories.filter((c) => playsOf(c.id).length)
      : jugadas.categories.filter((c) => c.id === jugadas.filter)
  );
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="back-link" onclick={() => setSection('vestuario')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg> <span>{t('fines.backLabel')}</span></div>
<div class="section-head">
  <h2>{t('nav.jugadas')}</h2>
</div>

{#if jugadas.status === 'loading' || jugadas.status === 'idle'}
  <div class="gallery-empty">{t('jugadas.loading')}</div>
{:else if jugadas.status === 'error'}
  <div class="gallery-empty">{t('jugadas.loadError')}</div>
{:else if !jugadas.plays.length}
  <div class="gallery-empty">{t('jugadas.empty')}</div>
{:else}
  <div class="jugadas-filters" role="group" aria-label={t('jugadas.filtersAria')}>
    <button class="jugadas-filter" class:active={jugadas.filter === 'all'} onclick={() => setFilter('all')}>
      {t('jugadas.all')} <span class="n">{jugadas.plays.length}</span>
    </button>
    {#each jugadas.categories as c (c.id)}
      <button class="jugadas-filter" class:active={jugadas.filter === c.id} data-category={c.id} onclick={() => setFilter(c.id)}>
        {categoryName(c.id)} <span class="n">{playsOf(c.id).length}</span>
      </button>
    {/each}
  </div>

  {#each visibleCategories as c (c.id)}
    {@const plays = playsOf(c.id)}
    <div class="jugadas-group" data-category={c.id}>
      <h3 class="jugadas-group-title">{#if c.emoji}<span class="emoji">{c.emoji}</span>{/if} {categoryName(c.id)}</h3>
      {#if !plays.length}
        <div class="gallery-empty">{t('jugadas.emptyCategory')}</div>
      {:else}
        <div class="jugadas-grid">
          {#each plays as p (p.id)}
            <!-- Con vídeo, manda el vídeo (igual que en el modal). -->
            {@const anim = p.video_url ? null : animationOf(p)}
            <button class="play-card" onclick={() => openPlay(p.id)}>
              <div class="play-thumb" style={p.poster_url ? `background-image:url('${cssUrl(p.poster_url)}')` : null}>
                <!-- Sin portada, una jugada animada enseña su primer paso. -->
                {#if anim && !p.poster_url}
                  <div class="play-thumb-board"><PlayBoard {anim} positions={anim.steps[0].pos} viewBox={fitViewBox(anim)} /></div>
                {/if}
                {#if !anim}<span class="play-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>{/if}
                {#if anim}
                  <span class="play-soon play-anim-badge">{t('jugadas.animationBadge')}</span>
                {:else if !p.video_url}
                  <span class="play-soon">{t('jugadas.soon')}</span>
                {/if}
              </div>
              <div class="play-cap">
                <b>{p.title}</b>
                {#if p.description}<span>{p.description}</span>{/if}
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/each}
{/if}

<!-- Botón flotante "+" (solo admins), abajo a la derecha. Vive dentro de la sección,
     así que se oculta solo al salir de Jugadas. -->
{#if canManagePlays()}
  <div class="jugadas-fab-space"></div>
  <button class="jugadas-fab" id="add-play-btn" onclick={openAddPlayModal} aria-label={t('jugadas.addPlay')} title={t('jugadas.addPlay')}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
  </button>
{/if}
