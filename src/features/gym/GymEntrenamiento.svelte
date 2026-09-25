<script>
  import { t } from '../../lib/i18n.svelte.js';
  import { legacy } from '../../lib/legacy.js';
  import {
    gym, routineMenu, canEditGymRoutine, hasWeeklyRoutine, openGymRoutineUploadModal, toggleGymRoutineMoreMenu,
    closeGymRoutineMoreMenu, loadLastGymRoutine, openGymRoutineArchiveTab, openGymRoutineDay, gymMarksRows,
    canManageGeneralExercises, newExerciseInputs, openGymRmHistoryModal, openGymRmModal, deleteGymExercise,
    addGymCustomExercise,
  } from './gym.svelte.js';

  const canEdit = $derived(canEditGymRoutine());
  const marks = $derived(gymMarksRows());
  let moreWrap;

  // Cierra el desplegable de "más opciones" de la rutina si se hace clic fuera de él.
  function onDocumentClick(e) {
    if (moreWrap && !moreWrap.contains(e.target)) closeGymRoutineMoreMenu();
  }
</script>

<svelte:document onclick={onDocumentClick} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="back-link" onclick={() => legacy.setSection('gym')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg> <span>{t('nav.gym')}</span></div>
<div class="section-head"><h2>{t('gym.myTraining')}</h2></div>

<div class="card" style="margin-bottom:16px;">
  <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:4px;">
    <h3 style="margin:0; font-size:15px; text-transform:uppercase;">{t('gym.weekRoutine')}</h3>
    <div style="display:flex; align-items:center; gap:8px;">
      <span id="gym-week-label" style="font-size:11.5px; color:var(--text-muted); font-weight:600;">{hasWeeklyRoutine() ? (gym.weeklyRoutine.weekLabel || '') : ''}</span>
      <button class="cal-open-btn small" id="gym-routine-upload-btn" onclick={openGymRoutineUploadModal} aria-label={t('gym.uploadRoutinePdf')} title={t('gym.uploadRoutinePdf')} style:display={canEdit ? 'flex' : 'none'}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3"/></svg>
      </button>
      <div class="gym-routine-more" id="gym-routine-more" style:display={canEdit ? 'flex' : 'none'} bind:this={moreWrap}>
        <button class="cal-open-btn small" id="gym-routine-more-btn" onclick={toggleGymRoutineMoreMenu} disabled={routineMenu.busy} aria-label={t('gym.moreOptionsRoutine')} title={t('gym.moreOptions')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="gym-routine-more-menu" class:open={routineMenu.open} id="gym-routine-more-menu">
          <button type="button" onclick={loadLastGymRoutine}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            <span>{t('gym.loadLastRoutine')}</span>
          </button>
          <button type="button" onclick={openGymRoutineArchiveTab}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8M10 13h4"/></svg>
            <span>{t('gym.viewOldRoutines')}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
  <div id="gym-routine-days">
    {#if !hasWeeklyRoutine()}
      <!-- Todavía no se ha subido ningún PDF esta semana: no se muestra rutina ninguna,
           solo el aviso y (si puede editarla) el botón para subirla. -->
      <div class="gym-routine-empty">
        <p>Todavía no se ha subido la rutina de esta semana.</p>
        {#if canEdit}<button class="btn" onclick={openGymRoutineUploadModal}>Subir la rutina</button>{/if}
      </div>
    {:else}
      <!-- Un tarjetón por cada día de entreno que tenga la rutina; al pulsar se abre el
           detalle de ese día en su propia pantalla. -->
      <div class="gym-tab-cards">
        {#each gym.weeklyRoutine.days as d, i (i)}
          <button class="gym-tab-card" onclick={() => openGymRoutineDay(i)}>
            <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/></svg></div>
            <b>Día {i + 1}</b>
            <span>{d.focus || d.day || ''}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<div class="card" id="gym-marks-section">
  <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px;">
    <h3 style="margin:0; font-size:15px; text-transform:uppercase;">{t('gym.myMarks')}</h3>
    <span style="font-size:11.5px; color:var(--text-muted); font-weight:600;">{t('gym.myRmRecord')}</span>
  </div>
  <div class="liga-table-scroll">
    <table class="treasury-table" id="gym-marks-table">
      <thead>
        <tr><th>{t('gym.colExercise')}</th><th>{t('gym.colMark1rm')}</th><th>{t('gym.colUpdated')}</th><th></th></tr>
      </thead>
      <tbody id="gym-marks-table-body">
        {#each marks as m (m.exercise)}
          <tr>
            <td>{m.exercise}</td>
            <td>{#if m.record}<b>{m.record.weight} kg</b>{:else}<span class="no-rm">Sin registrar</span>{/if}</td>
            <td>{m.record ? legacy.formatShortDate(m.record.updatedAt) : '—'}</td>
            <td>
              <div class="actions-cell">
                <button class="history-btn" onclick={() => openGymRmHistoryModal(m.exercise)} aria-label="Ver histórico" title="Ver histórico">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 3h7l4 4v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M14 3v4a1 1 0 001 1h4"/><path d="M9 13h6M9 17h6M9 9h2"/></svg>
                </button>
                <button class="edit-btn" onclick={() => openGymRmModal(m.exercise)} aria-label="Registrar marca" title="Registrar marca">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                </button>
                {#if m.deletable}
                  <button class="del-btn" onclick={() => deleteGymExercise(m.exercise)} aria-label="Eliminar ejercicio" title="Eliminar ejercicio">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
                  </button>
                {/if}
              </div>
            </td>
          </tr>
        {/each}
        <tr class="gym-add-exercise-row">
          <td><input type="text" id="gym-new-exercise-name" placeholder="Nuevo ejercicio…" bind:this={newExerciseInputs.name} onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); newExerciseInputs.weight.focus(); } }}></td>
          <td><input type="number" class="weight-input" id="gym-new-exercise-weight" placeholder={canManageGeneralExercises() ? 'Kg (opcional)' : 'Kg'} min="0" step="0.5" bind:this={newExerciseInputs.weight} onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGymCustomExercise(); } }}></td>
          <td></td>
          <td>
            <button class="treasury-add-btn" onclick={addGymCustomExercise} aria-label="Añadir ejercicio" title="Añadir ejercicio">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
