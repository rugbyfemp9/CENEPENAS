<script>
  // Formulario de registro del overlay de acceso (src/shell/AuthOverlay.svelte).
  import { t } from '../lib/i18n.svelte.js';
  import { authUi, registerForm, showAuthView, handleRegister, registerAsksPlayerFields, authMessage } from './auth.svelte.js';
</script>

<div id="auth-register-view" style:display={authUi.view === 'register' ? 'block' : 'none'}>
  <h3>{t('auth.createAccount')}</h3>
  <div class="auth-field-group">
    <label>{t('profile.email')}
      <input type="email" id="register-email-input" placeholder={t('auth.emailPlaceholder')} autocomplete="username" bind:value={registerForm.email}>
    </label>
    <label>{t('auth.password')}
      <input type="password" id="register-password-input" placeholder={t('auth.passwordPlaceholder')} autocomplete="new-password" bind:value={registerForm.password}>
    </label>
    <label>{t('profile.nameLabel')}
      <input type="text" id="register-nombre-input" placeholder={t('profile.nameLabel')} bind:value={registerForm.nombre}>
    </label>
    <label>{t('auth.lastName')}
      <input type="text" id="register-apellido-input" placeholder={t('auth.lastName')} bind:value={registerForm.apellido}>
    </label>
    <label>{t('profile.nicknameLabel')}
      <input type="text" id="register-mote-input" placeholder={t('profile.nicknamePlaceholder')} bind:value={registerForm.mote}>
    </label>
    <label>{t('plantilla.birthdate')}
      <input type="date" id="register-fecha-nacimiento-input" bind:value={registerForm.fecha_nacimiento}>
    </label>
    <label>{t('plantilla.role')}
      <select id="register-rol-input" bind:value={registerForm.rol}>
        <option value="">{t('auth.selectRole')}</option>
        <option value="jugadora">{t('role.player')}</option>
        <option value="Capitana">{t('role.captain')}</option>
        <option value="entrenador/a">{t('role.coach')}</option>
        <option value="delegado/a">{t('role.delegate')}</option>
        <option value="directiva">{t('role.board')}</option>
        <option value="fisio">{t('role.physio')}</option>
      </select>
    </label>
    <div id="register-jugadora-fields" style="flex-direction:column; gap:12px;" style:display={registerAsksPlayerFields() ? 'flex' : 'none'}>
      <label>{t('plantilla.rango')}
        <select id="register-rango-input" bind:value={registerForm.rango}>
          <option value="">{t('auth.selectRank')}</option>
          <option value="veterana">{t('rank.veterana')}</option>
          <option value="novata">{t('rank.novata')}</option>
          <option value="sang_de_fang">Sang de Fang</option>
        </select>
      </label>
      <label>{t('plantilla.positionLabel')}
        <select id="register-posicion-input" bind:value={registerForm.posicion}>
          <option value="">{t('auth.selectPosition')}</option>
          <option value="delantera">{t('plantilla.posForward')}</option>
          <option value="3/4">3/4</option>
        </select>
      </label>
      <label>{t('plantilla.commission')}
        <select id="register-comision-input" bind:value={registerForm.comision}>
          <option value="">{t('plantilla.unassigned')}</option>
          <option value="Comi Xarxes">Comi Xarxes</option>
          <option value="Comi Tesoreria">Comi Tesoreria</option>
          <option value="Comi Gira">Comi Gira</option>
          <option value="Comi Tercer Temps">Comi Tercer Temps</option>
          <option value="Comi Activitats">Comi Activitats</option>
        </select>
      </label>
      <label>{t('plantilla.license')}
        <input type="text" id="register-licencia-input" placeholder={t('profile.licensePlaceholder')} bind:value={registerForm.licencia}>
      </label>
    </div>
  </div>
  <div class="auth-error" id="register-error" style:color={authUi.registerErrorColor}>{authMessage(authUi.registerError)}</div>
  <button class="btn auth-submit-btn" onclick={handleRegister}>{t('auth.createAccount')}</button>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions, a11y_missing_attribute -->
  <div class="auth-switch">{t('auth.haveAccount')} <a onclick={() => showAuthView('login')}>{t('auth.loginLink')}</a></div>
</div>
