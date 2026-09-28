<script>
  // Modal "Editar perfil" (el propio, o el de cualquier jugadora si es la cuenta admin
  // desde Jugadoras).
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import { editProfile, editProfileEsJugadora, closeEditProfileModal, saveProfileEdits } from './edit-profile.svelte.js';

  const labelStyle = 'display:flex; flex-direction:column; gap:5px; font-size:12.5px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.04em;';
  const inputStyle = "font-family:'Roboto',sans-serif; font-size:14px; padding:10px 12px; border-radius:10px; border:1.5px solid var(--line); color:var(--navy);";
  const selectStyle = inputStyle + ' background:var(--white);';

  const hideJugadoraField = $derived(editProfileEsJugadora() ? null : 'none');
</script>

<!-- Cerrar (clic fuera o botón "atrás") también olvida a qué jugadora se estaba editando. -->
<Modal id="edit-profile-modal" bind:open={() => editProfile.open, (v) => { if (!v) closeEditProfileModal(); }} boxStyle="max-width:380px;">
  <h3 style="margin-top:0;" id="edit-profile-modal-title">{editProfile.title ?? t('profile.editTitle')}</h3>
  <div class="field-group" style="display:flex; flex-direction:column; gap:12px; margin:14px 0 18px;">
    <label style={labelStyle}>
      <span>{t('profile.nameLabel')}</span>
      <input type="text" id="profile-name-input" placeholder={t('profile.namePlaceholder')} bind:value={editProfile.name} style={inputStyle}>
    </label>
    <label style={labelStyle}>
      <span>{t('profile.nicknameLabel')}</span>
      <input type="text" id="profile-mote-input" placeholder={t('profile.nicknamePlaceholder')} bind:value={editProfile.mote} style={inputStyle}>
    </label>
    <label style={labelStyle}>
      <span>{t('profile.phone')}</span>
      <input type="tel" id="profile-phone-input" placeholder={t('profile.phonePlaceholder')} bind:value={editProfile.phone} style={inputStyle}>
    </label>
    <label style={labelStyle}>
      <span>{t('plantilla.birthdate')}</span>
      <input type="date" id="profile-birthdate-input" bind:value={editProfile.birthdate} style={inputStyle}>
    </label>
    <label id="profile-comision-field" style={labelStyle} style:display={hideJugadoraField}>
      <span>{t('plantilla.commission')}</span>
      <select id="profile-comision-input" bind:value={editProfile.comision} style={selectStyle}>
        <option value="">{t('plantilla.unassigned')}</option>
        <option value="Comi Activitats">Comi Activitats</option>
        <option value="Comi Xarxes">Comi Xarxes</option>
        <option value="Comi Tercer Temps">Comi Tercer Temps</option>
        <option value="Comi Tesoreria">Comi Tesoreria</option>
        <option value="Comi Gira">Comi Gira</option>
      </select>
    </label>
    <label id="profile-rango-field" style={labelStyle} style:display={hideJugadoraField}>
      <span>{t('plantilla.rango')}</span>
      <select id="profile-rango-input" bind:value={editProfile.rango} style={selectStyle}>
        <option value="">{t('plantilla.unassigned')}</option>
        <option value="veterana">{t('rank.veterana')}</option>
        <option value="novata">{t('rank.novata')}</option>
        <option value="sang_de_fang">Sang de Fang</option>
      </select>
    </label>
    <label id="profile-posicion-field" style={labelStyle} style:display={hideJugadoraField}>
      <span>{t('plantilla.positionLabel')}</span>
      <select id="profile-posicion-input" bind:value={editProfile.posicion} style={selectStyle}>
        <option value="">{t('plantilla.unassigned')}</option>
        <option value="delantera">{t('plantilla.posForward')}</option>
        <option value="3/4">3/4</option>
      </select>
    </label>
    <label style={labelStyle}>
      <span>{t('plantilla.role')}</span>
      <select id="profile-rol-input" bind:value={editProfile.rol} style={selectStyle}>
        <option value="">{t('plantilla.unassigned')}</option>
        <option value="jugadora">{t('role.player')}</option>
        <option value="Capitana">{t('role.captain')}</option>
        <option value="entrenador/a">{t('role.coach')}</option>
        <option value="delegado/a">{t('role.delegate')}</option>
        <option value="directiva">{t('role.board')}</option>
        <option value="fisio">{t('role.physio')}</option>
      </select>
    </label>
    <label style={labelStyle}>
      <span>{t('profile.licenseNum')}</span>
      <input type="text" id="profile-licencia-input" placeholder={t('profile.licensePlaceholder')} bind:value={editProfile.licencia} style={inputStyle}>
    </label>
  </div>
  <div class="modal-actions">
    <button class="btn-ghost" onclick={closeEditProfileModal}>{t('att.cancel')}</button>
    <button class="btn" onclick={saveProfileEdits}>{t('att.saveGeneric')}</button>
  </div>
</Modal>
