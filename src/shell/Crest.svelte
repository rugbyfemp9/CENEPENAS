<script>
  import { t } from '../lib/i18n.svelte.js';

  // Escudo del club. Si la imagen no carga, se sustituye por las letras "CN".
  function fallback(e) {
    const crest = e.currentTarget.parentElement;
    crest.classList.add('crest-fallback');
    crest.textContent = 'CN';
  }
</script>

<div class="crest"><img src="assets/img/logo.png" alt={t('brand.crestAlt')} onerror={fallback}></div>
