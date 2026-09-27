<script>
  // Tabla de datos de Mi perfil y botón de cerrar sesión. Comisión, Rango y Posición
  // solo se muestran si tu rol es de jugadora (ver renderProfile).
  import { t } from '../../lib/i18n.svelte.js';
  import { legacy } from '../../lib/legacy.js';
  import { perfil } from './perfil.svelte.js';

  const v = $derived(perfil.view);
  const hideJugadoraRow = $derived(v && !v.esJugadora ? 'none' : null);
</script>

<div class="card" style="margin-bottom:16px;">
  <table class="profile-info-table">
    <tbody>
    <tr><td style="color:var(--text-muted); width:140px;">{t('profile.email')}</td><td id="profile-email-display">{perfil.email}</td></tr>
    <tr><td style="color:var(--text-muted);">{t('profile.phone')}</td><td id="profile-phone-display">{v ? v.phone : '—'}</td></tr>
    <tr><td style="color:var(--text-muted);">{t('plantilla.birthdate')}</td><td id="profile-birthdate-display">{v ? v.birthdate : '—'}</td></tr>
    <tr id="profile-comision-row" style:display={hideJugadoraRow}><td style="color:var(--text-muted);">{t('plantilla.commission')}</td><td id="profile-comision-display">{v ? v.comision : '—'}</td></tr>
    <tr id="profile-rango-row" style:display={hideJugadoraRow}><td style="color:var(--text-muted);">{t('plantilla.rango')}</td><td id="profile-rango-display">{v ? v.rango : '—'}</td></tr>
    <tr id="profile-posicion-row" style:display={hideJugadoraRow}><td style="color:var(--text-muted);">{t('plantilla.positionLabel')}</td><td id="profile-posicion-display">{v ? v.posicion : '—'}</td></tr>
    <tr><td style="color:var(--text-muted);">{t('plantilla.role')}</td><td id="profile-rol-display">{v ? v.rol : '—'}</td></tr>
    <tr><td style="color:var(--text-muted);">{t('profile.licenseNum')}</td><td id="profile-licencia-display">{v ? v.licencia : '—'}</td></tr>
    </tbody>
  </table>
</div>
<button class="btn" style="background:linear-gradient(90deg, var(--bad), #b8443a);" onclick={() => legacy.logout()}>{t('profile.logout')}</button>
