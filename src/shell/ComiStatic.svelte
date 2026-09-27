<script>
  // Páginas de las comisiones que todavía no tienen contenido (Comi Activitats,
  // Comi Xarxes, Comi Gira).
  import { t } from '../lib/i18n.svelte.js';
  import { nav, setSection } from './navigation.svelte.js';

  let { id, title } = $props();
</script>

<section class="section" class:active={nav.current === id} id="sec-{id}">
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="back-link" onclick={() => setSection('comisiones')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg> <span>{t('nav.comisiones')}</span></div>
  <div class="section-head"><h2>{title}</h2></div>
  <div class="card"><span style="color:var(--text-muted); font-size:13.5px;">{t('comi.noContent')}</span></div>
</section>
