<script>
  import { t } from '../../lib/i18n.svelte.js';
  import { safeUrl, cssUrl } from '../../lib/url.js';
  import { galeria, currentSeason, canManageGallery, coverUrl, openSeason, goBack, openAddAlbumModal } from './galeria.svelte.js';

  // De más reciente a menos reciente (la temporada actual, primero del todo).
  // El id sigue el formato "AAAA-AAAA", así que ordenar el texto al revés basta.
  const orderedSeasons = $derived([...galeria.seasons].sort((a, b) => b.id.localeCompare(a.id)));
  const season = $derived(currentSeason());
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="back-link" id="galeria-back-link" onclick={goBack}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg> <span id="galeria-back-label">{galeria.view === 'seasons' ? t('fines.backLabel') : t('galeria.backSeasons')}</span></div>
<div class="section-head">
  <h2 id="galeria-title">{galeria.view === 'seasons' ? t('nav.galeria') : (season ? season.label : t('galeria.albumsFallbackTitle'))}</h2>
  <button class="cal-open-btn" id="add-album-btn" onclick={openAddAlbumModal} aria-label={t('galeria.addAlbum')} title={t('galeria.addAlbum')} style:display={canManageGallery() ? null : 'none'}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>
  </button>
</div>

<!-- Nivel 1: temporadas -->
<div class="gallery-seasons" id="galeria-seasons-view" style:display={galeria.view === 'seasons' ? null : 'none'}>
  {#each orderedSeasons as s (s.id)}
    <button class="season-card" onclick={() => openSeason(s.id)}>
      <div class="season-card-cover" style="background-image:url('{cssUrl(coverUrl(s.cover))}');"></div>
      <div class="season-card-overlay">
        <div class="season-card-title">{s.label}</div>
        <div class="season-card-sub">{s.albums.length === 1 ? t('galeria.albumCountOne', { count: s.albums.length }) : t('galeria.albumCountMany', { count: s.albums.length })}</div>
        {#if s.current}<div class="season-card-current">{t('galeria.currentSeason')}</div>{/if}
      </div>
    </button>
  {/each}
</div>

<!-- Nivel 2: álbumes de una temporada — cada uno abre su álbum de Google Photos -->
<div class="gallery-albums" id="galeria-albums-view" style:display={galeria.view === 'albums' ? null : 'none'}>
  {#if !season || !season.albums.length}
    <div class="gallery-empty">{t('galeria.noAlbumsSeason')}</div>
  {:else}
    {#each season.albums as a (a.id)}
      <a class="album-card" href={safeUrl(a.url) || undefined} target="_blank" rel="noopener noreferrer" title={t('galeria.openInGooglePhotos')}>
        <img src={safeUrl(coverUrl(a.cover))} alt={a.title} loading="lazy">
        <div class="cap">
          <b>{a.title}</b>
          <span>{t('galeria.viewInGooglePhotos')}
            <span class="ext-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/></svg></span>
          </span>
        </div>
      </a>
    {/each}
  {/if}
</div>
