<script>
  // BARRA SUPERIOR — solo visible en móvil.
  // El estado del selector de idioma (data-lang) lo pone applyI18n() (src/lib/i18n.svelte.js).
  import Crest from './Crest.svelte';
  import { toggleLang } from '../lib/i18n.svelte.js';
</script>

<div class="top-bar-mobile">
  <div class="club">
    <Crest />
    <div class="name">CNPENAS</div>
  </div>
  <div class="right-group">
    <button class="lang-toggle-mobile" id="lang-toggle-mobile" onclick={toggleLang} aria-label="Canviar idioma / Cambiar idioma">
      <span class="lang-toggle-track">
        <span class="lang-toggle-opt">ES</span>
        <span class="lang-toggle-opt">CAT</span>
        <span class="lang-toggle-knob"></span>
      </span>
    </button>
    <!-- Botón "TÚ": lo pinta src/features/perfil/ProfileBtn.svelte -->
    <div data-mount="profile-btn"></div>
  </div>
</div>
