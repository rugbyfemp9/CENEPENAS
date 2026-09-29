<script>
  import { t } from '../../lib/i18n.svelte.js';
  import { nav, setSection } from '../../shell/navigation.svelte.js';
  import { LEAGUE_EMBED_URL, LEAGUE_SOURCE_URL } from './liga.js';

  // El widget pesa (~260 KB más jQuery): solo se carga la primera vez que se abre Liga,
  // y luego se queda cargado para no recargarlo en cada visita.
  let opened = $state(false);
  $effect(() => { if (nav.current === 'liga') opened = true; });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="back-link" onclick={() => setSection('vestuario')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg> <span>{t('fines.backLabel')}</span></div>
<div class="section-head">
  <h2>{t('nav.liga')}</h2>
  <span style="font-size:12px; color:var(--text-muted); font-weight:600;">Divisió d'Honor Catalana AON</span>
</div>

<!-- El widget de matchready trae sus propias pestañas (Calendari / Classificació /
     Quadre de competició), así que aquí no ponemos otras. -->
<div class="card liga-embed-card">
  {#if opened}
    <iframe class="liga-embed" src={LEAGUE_EMBED_URL} title={t('liga.embedTitle')} referrerpolicy="no-referrer"></iframe>
  {/if}
</div>

<div class="liga-source-note">
  <span>{t('liga.sourceNotePrefix')}</span> <a href={LEAGUE_SOURCE_URL} target="_blank" rel="noopener">rugby.cat</a><span>{t('liga.sourceNoteSuffix')}</span>
</div>
