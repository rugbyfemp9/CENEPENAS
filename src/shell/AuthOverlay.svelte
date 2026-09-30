<script>
  // LOGIN / REGISTRO (Supabase Auth).
  import Crest from './Crest.svelte';
  import RegisterView from './RegisterView.svelte';
  import { t } from '../lib/i18n.svelte.js';
  import { authUi, loginForm, showAuthView, handleLogin, authMessage } from './auth.svelte.js';
</script>

<div class="auth-overlay" class:hidden={authUi.hidden} id="auth-overlay">
  <div class="auth-box">
    <div class="auth-brand">
      <Crest />
      <div class="auth-brand-name">CNPENAS</div>
    </div>

    <!-- LOGIN -->
    <div id="auth-login-view" style:display={authUi.view === 'login' ? 'block' : 'none'}>
      <h3>{t('auth.loginTitle')}</h3>
      <div class="auth-field-group">
        <label>{t('profile.email')}
          <input type="email" id="login-email-input" placeholder={t('auth.emailPlaceholder')} autocomplete="username" bind:value={loginForm.email}>
        </label>
        <label>{t('auth.password')}
          <input type="password" id="login-password-input" placeholder="••••••••" autocomplete="current-password" bind:value={loginForm.password}>
        </label>
      </div>
      <div class="auth-error" id="login-error">{authMessage(authUi.loginError)}</div>
      <button class="btn auth-submit-btn" onclick={handleLogin}>{t('auth.loginBtn')}</button>
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions, a11y_missing_attribute -->
      <div class="auth-switch">{t('auth.noAccount')} <a onclick={() => showAuthView('register')}>{t('auth.registerLink')}</a></div>
    </div>

    <!-- REGISTRO -->
    <RegisterView />
  </div>
</div>
