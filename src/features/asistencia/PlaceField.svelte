<script>
  // Campo "Lugar" del modal de evento: buscador enlazado con Google Maps y botón 🏠 Casa.
  import { t } from '../../lib/i18n.svelte.js';
  import { eventForm as f, onPlaceInput, selectHomePlace } from './editor.svelte.js';
  import { buildMapsSearchUrl } from './events.js';

  let { labelStyle } = $props();
</script>

<label style={labelStyle}>
  <span id="field-place-label-text">{f.placeLabel}</span>
  <div class="place-row">
    <input type="text" id="new-event-place" placeholder="Sala del club" bind:value={f.place} required={f.placeRequired} oninput={(e) => onPlaceInput(e.currentTarget.value)} style="font-family:'Roboto',sans-serif; font-size:14px; padding:10px 12px; border-radius:10px; border:1.5px solid var(--line); color:var(--navy); flex:1; min-width:0;">
    <button type="button" class="place-home-btn" id="place-home-btn" class:selected={f.homeSelected} onclick={selectHomePlace} title={t('att.homeTitle')}>🏠</button>
  </div>
  <div class="place-maps-preview" id="place-maps-preview" style:display={f.mapsQuery ? 'flex' : 'none'}>{#if f.mapsQuery}<a class="place-maps-link" href={buildMapsSearchUrl(f.mapsQuery)} target="_blank" rel="noopener">📍 Ver "{f.mapsQuery}" en Google Maps</a>{/if}</div>
  <div class="place-hint" id="field-place-hint" style:display={f.showPlaceHint ? 'block' : 'none'}>{t('att.homeHint')}</div>
</label>
