<script>
  // Banner de Mi perfil: avatar (con su menú de foto y el <input> de subirla), nombre,
  // mote/rol, licencia y las dos estadísticas.
  import { t } from '../../lib/i18n.svelte.js';
  import { perfil } from './perfil.svelte.js';
  import {
    togglePfAvatarMenu, closePfAvatarMenu, chooseEditAvatarPhoto, openAvatarAdjustModal, removeAvatarPhoto,
    handleAvatarUpload, setAvatarInput,
  } from './avatar.svelte.js';
  import OwnAvatar from './OwnAvatar.svelte';

  let wrap;
  let input;

  $effect(() => {
    setAvatarInput(input);
    // Cierra el menú de la foto de perfil si se hace clic fuera de él
    const onClick = (e) => {
      if (perfil.avatarMenuOpen && !wrap.contains(e.target)) closePfAvatarMenu();
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  });
</script>

<div class="pf-hero" id="pf-hero">
  <div class="pf-hero-top">
    <div class="pf-avatar-wrap" bind:this={wrap}>
      <div class="avatar pf-avatar" class:avatar-logo-fallback={perfil.avatar && !perfil.avatar.url} id="pf-avatar"><OwnAvatar /></div>
      <button type="button" class="pf-avatar-edit-btn" disabled={perfil.uploading} onclick={togglePfAvatarMenu} aria-label={t('profile.editPhoto')} title={t('profile.editPhoto')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      </button>
      <div class="pf-avatar-menu" class:open={perfil.avatarMenuOpen} id="pf-avatar-menu">
        <button onclick={chooseEditAvatarPhoto}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <span>{t('profile.changePhotoAction')}</span>
        </button>
        <button id="pf-avatar-adjust-btn" disabled={perfil.view ? perfil.view.adjustDisabled : false} onclick={openAvatarAdjustModal}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          <span>{t('profile.editPhotoAction')}</span>
        </button>
        <button class="danger" onclick={removeAvatarPhoto}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6"/></svg>
          <span>{t('profile.removePhoto')}</span>
        </button>
      </div>
      <input type="file" id="pf-avatar-input" accept="image/*" style="display:none;" bind:this={input} onchange={handleAvatarUpload}>
    </div>
    <div class="pf-hero-info">
      <b id="profile-name-display">{perfil.view ? perfil.view.name : t('profile.defaultName')}</b>
      <span id="profile-mote-role-display">{perfil.view ? perfil.view.moteRole : t('profile.setUpRole')}</span>
      <span id="profile-licencia-hero-display" class="pf-hero-licencia">{perfil.view ? perfil.view.licenciaHero : ''}</span>
    </div>
  </div>
  <div class="pf-stats">
    <div class="pf-stat">
      <b id="pf-stat-matches">{perfil.matches}</b>
      <span>{t('profile.matchesPlayed')}</span>
    </div>
    <div class="pf-stat">
      <b id="pf-stat-attendance">{perfil.attendance}</b>
      <span>{t('profile.trainingAttendance')}</span>
    </div>
  </div>
</div>
