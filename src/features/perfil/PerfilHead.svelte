<script>
  // Cabecera de Mi perfil: volver, título, marca de lesión (con su desplegable) y
  // botón de editar el perfil.
  import { t } from '../../lib/i18n.svelte.js';
  import { setSection } from '../../shell/navigation.svelte.js';
  import { perfil, toggleInjuryPicker, closeInjuryPicker, chooseInjuryIcon } from './perfil.svelte.js';
  import { openEditProfileModal } from './edit-profile.svelte.js';

  let wrap;

  // Cierra el desplegable de "lesionada / tocada" si se hace clic fuera de él
  $effect(() => {
    const onClick = (e) => {
      if (perfil.injuryPickerOpen && !wrap.contains(e.target)) closeInjuryPicker();
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="back-link" onclick={() => setSection('inicio')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg> <span>{t('common.back')}</span></div>
<div class="section-head">
  <h2>{t('profile.title')}</h2>
  <div style="display:flex; gap:8px;">
    <div class="injury-toggle-wrap" bind:this={wrap}>
      <button class="injury-toggle-btn" class:active={perfil.injuryBtn.active} class:icon-tocada={perfil.injuryBtn.tocada} id="injury-toggle-btn" onclick={toggleInjuryPicker} aria-label={t('profile.markInjury')} title={t('profile.markInjury')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8 8V6a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M12 11v6M9 14h6"/></svg>
      </button>
      <div class="injury-picker" class:open={perfil.injuryPickerOpen} id="injury-picker">
        <button class="injury-picker-btn" class:selected={perfil.injuryPickerSelected.botiquin} id="injury-picker-botiquin" onclick={() => chooseInjuryIcon('botiquin')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8 8V6a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M12 11v6M9 14h6"/></svg>
          <span>{t('profile.injured')}</span>
        </button>
        <button class="injury-picker-btn" class:selected={perfil.injuryPickerSelected.tocada} id="injury-picker-tocada" onclick={() => chooseInjuryIcon('tocada')}>
          <span class="emoji">🤕</span>
          <span>{t('profile.knocked')}</span>
        </button>
      </div>
    </div>
    <button class="cal-open-btn" onclick={() => openEditProfileModal()} aria-label={t('profile.editProfile')} title={t('profile.editProfile')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
    </button>
  </div>
</div>
