<script>
  // INICIO: el marco de la portada. Sus banners y tarjetas los montan las secciones
  // (src/features/*/index.js) en los <div data-mount> y en los contenedores con id.
  import { t } from '../lib/i18n.svelte.js';
  import { nav, setSection } from './navigation.svelte.js';
  import { visibility } from './visibility.svelte.js';
  import PushBanner from './PushBanner.svelte';
</script>

<section class="section" class:active={nav.current === 'inicio'} id="sec-inicio">
  <div class="section-head"><h2>{t('inicio.title')}</h2></div>
  <div id="inicio-top-notices"></div>
  <div data-mount="inicio-shared-lineup-banner"></div>
  <div data-mount="next-match-banner"></div>
  <!-- Recordatorio de valoración Wellness/RPE del entreno más reciente ya finalizado
       y todavía sin valorar. Solo jugadoras: lo pinta Svelte (src/features/wellness/WellnessReminderBanner.svelte). -->
  <div data-mount="wellness-reminder-banner"></div>
  <PushBanner />
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="league-banner" id="league-banner" onclick={() => setSection('liga')} style="cursor:pointer;">
    <div class="lg-info">
      <div class="lg-title">DHC</div>
      <div class="lg-sub">{t('league.label')}</div>
    </div>
    <div class="lg-position">
      <div class="n" id="league-position-num">—</div>
      <div class="l">{t('league.position')}</div>
    </div>
  </div>
  <div class="grid inicio-row2">
    <!-- Contenido: lo pinta Svelte (src/features/multas/FinesBanner.svelte) -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="card my-fines-card" id="inicio-fines-banner" onclick={() => setSection('multas')} style="cursor:pointer;"></div>
    <!-- Contenido: lo pinta Svelte (src/features/tercer-tiempo/InicioTercerBanner.svelte) -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="card my-fines-card" id="inicio-tercer-banner" onclick={() => setSection('tercer')} style="cursor:pointer;" style:display={visibility.staffPagesHidden ? 'none' : null}></div>
    <!-- Contenido: lo pinta Svelte (src/features/tricount/TricountBanner.svelte) -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="card my-fines-card" id="inicio-tricount-banner" onclick={() => setSection('tricount')} style="cursor:pointer; grid-column:1 / -1;" style:display={visibility.staffPagesHidden ? 'none' : null}></div>
  </div>
  <div data-mount="inicio-notices-card"></div>
</section>
