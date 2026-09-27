<script>
  // Formulario de registro del overlay de acceso (src/shell/AuthOverlay.svelte).
  import { authUi, registerForm, showAuthView, handleRegister, registerAsksPlayerFields } from './auth.svelte.js';
</script>

<div id="auth-register-view" style:display={authUi.view === 'register' ? 'block' : 'none'}>
  <h3>Crear cuenta</h3>
  <div class="auth-field-group">
    <label>Email
      <input type="email" id="register-email-input" placeholder="tu@email.com" autocomplete="username" bind:value={registerForm.email}>
    </label>
    <label>Contraseña
      <input type="password" id="register-password-input" placeholder="Mínimo 6 caracteres" autocomplete="new-password" bind:value={registerForm.password}>
    </label>
    <label>Nombre
      <input type="text" id="register-nombre-input" placeholder="Nombre" bind:value={registerForm.nombre}>
    </label>
    <label>Apellido
      <input type="text" id="register-apellido-input" placeholder="Apellido" bind:value={registerForm.apellido}>
    </label>
    <label>Mote
      <input type="text" id="register-mote-input" placeholder="Apodo (opcional)" bind:value={registerForm.mote}>
    </label>
    <label>Fecha de nacimiento
      <input type="date" id="register-fecha-nacimiento-input" bind:value={registerForm.fecha_nacimiento}>
    </label>
    <label>Rol
      <select id="register-rol-input" bind:value={registerForm.rol}>
        <option value="">Selecciona un rol</option>
        <option value="jugadora">Jugadora</option>
        <option value="Capitana">Capitana</option>
        <option value="entrenador/a">Entrenador/a</option>
        <option value="delegado/a">Delegado/a</option>
        <option value="directiva">Junta directiva</option>
        <option value="fisio">Fisios</option>
      </select>
    </label>
    <div id="register-jugadora-fields" style="flex-direction:column; gap:12px;" style:display={registerAsksPlayerFields() ? 'flex' : 'none'}>
      <label>Rango
        <select id="register-rango-input" bind:value={registerForm.rango}>
          <option value="">Selecciona un rango</option>
          <option value="veterana">Veterana</option>
          <option value="novata">Novata</option>
          <option value="sang_de_fang">Sang de Fang</option>
        </select>
      </label>
      <label>Posición
        <select id="register-posicion-input" bind:value={registerForm.posicion}>
          <option value="">Selecciona una posición</option>
          <option value="delantera">Delantera</option>
          <option value="3/4">3/4</option>
        </select>
      </label>
      <label>Comisión
        <select id="register-comision-input" bind:value={registerForm.comision}>
          <option value="">Sin asignar</option>
          <option value="Comi Xarxes">Comi Xarxes</option>
          <option value="Comi Tesoreria">Comi Tesoreria</option>
          <option value="Comi Gira">Comi Gira</option>
          <option value="Comi Tercer Temps">Comi Tercer Temps</option>
          <option value="Comi Activitats">Comi Activitats</option>
        </select>
      </label>
      <label>Núm. de licencia
        <input type="text" id="register-licencia-input" placeholder="Ej. 123456" bind:value={registerForm.licencia}>
      </label>
    </div>
  </div>
  <div class="auth-error" id="register-error" style:color={authUi.registerErrorColor}>{authUi.registerError}</div>
  <button class="btn auth-submit-btn" onclick={handleRegister}>Crear cuenta</button>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions, a11y_missing_attribute -->
  <div class="auth-switch">¿Ya tienes cuenta? <a onclick={() => showAuthView('login')}>Inicia sesión</a></div>
</div>
