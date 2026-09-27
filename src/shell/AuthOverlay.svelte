<script>
  // LOGIN / REGISTRO (Supabase Auth).
  // NOTE: este formulario nunca se tradujo: textos fijos en castellano.
  import Crest from './Crest.svelte';
  import RegisterView from './RegisterView.svelte';
  import { authUi, loginForm, showAuthView, handleLogin } from './auth.svelte.js';
</script>

<div class="auth-overlay" class:hidden={authUi.hidden} id="auth-overlay">
  <div class="auth-box">
    <div class="auth-brand">
      <Crest />
      <div class="auth-brand-name">CNPENAS</div>
    </div>

    <!-- LOGIN -->
    <div id="auth-login-view" style:display={authUi.view === 'login' ? 'block' : 'none'}>
      <h3>Iniciar sesión</h3>
      <div class="auth-field-group">
        <label>Email
          <input type="email" id="login-email-input" placeholder="tu@email.com" autocomplete="username" bind:value={loginForm.email}>
        </label>
        <label>Contraseña
          <input type="password" id="login-password-input" placeholder="••••••••" autocomplete="current-password" bind:value={loginForm.password}>
        </label>
      </div>
      <div class="auth-error" id="login-error">{authUi.loginError}</div>
      <button class="btn auth-submit-btn" onclick={handleLogin}>Entrar</button>
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions, a11y_missing_attribute -->
      <div class="auth-switch">¿No tienes cuenta? <a onclick={() => showAuthView('register')}>Regístrate</a></div>
    </div>

    <!-- REGISTRO -->
    <RegisterView />
  </div>
</div>
