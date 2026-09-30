<script>
  // Cabecera del detalle de un evento: botones (editar / tullidas / wellness / Cos
  // Tècnic), fecha, título, lugar, horas, insignia de intensidad y RSVP.
  import { t } from '../../lib/i18n.svelte.js';
  import { safeUrl } from '../../lib/url.js';
  import { attSelection } from './events.js';
  import { attDetail, getDetailView } from './asistencia.svelte.js';
  import { setMyRsvp } from './attendance.svelte.js';
  import { openEditEventModal } from './editor.svelte.js';
  import { openTullidesModal } from '../tullidas/tullidas.svelte.js';
  import { openWellnessModal } from '../wellness/wellness.svelte.js';
  import { goToWellnessStaffAnalysis } from '../wellness/wellness-staff.svelte.js';

  const v = $derived(getDetailView());
  const shown = (key) => (v && v.visible[key] ? null : 'none');
</script>

<div class="att-detail-header">
  <button class="att-event-edit-btn" id="att-detail-edit-btn" onclick={() => openEditEventModal(attSelection.currentEventId)} aria-label={t('att.editEvent')} title={t('att.editEvent')} style:display={shown('edit')} style:right={attDetail.rights.edit}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
  </button>
  <button class="att-event-edit-btn att-detail-tullides-btn" id="att-detail-tullides-btn" onclick={openTullidesModal} aria-label={t('att.tullidesButton')} title={t('att.tullidesButton')} style:display={shown('tullides')} style:right={attDetail.rights.tullides}>
    🩹
  </button>
  <!-- Wellness / RPE: solo visible para el rol jugadora (ver canUseWellness) -->
  <button class="att-event-edit-btn att-detail-wellness-btn" id="att-detail-wellness-btn" onclick={() => openWellnessModal(attSelection.currentEventId)} aria-label={t('att.wellnessButton')} title={t('att.wellnessButton')} style:display={shown('wellness')} style:right={attDetail.rights.wellness}>
    📊
  </button>
  <!-- Acceso directo al Panel de Análisis Wellness/RPE de Cos Tècnic para ESTE evento
       concreto: solo entrenador/a, delegado/a, directiva, fisio o admin, y solo si el
       evento ya ha terminado (ver canViewWellnessStaff()/hasEventEnded()). -->
  <button class="att-event-edit-btn att-detail-wellness-staff-btn" id="att-detail-wellness-staff-btn" onclick={() => goToWellnessStaffAnalysis(attSelection.currentEventId)} aria-label={t('wstaff.quickAccessButton')} title={t('wstaff.quickAccessButton')} style:display={shown('staff')} style:right={attDetail.rights.staff}>
    📊
  </button>
  <div class="att-detail-top">
    <div class="att-detail-date-badge"><div class="d" id="att-detail-daynum">{v ? v.daynum : ''}</div><div class="m" id="att-detail-monthabbr">{v ? v.monthabbr : ''}</div></div>
    <div class="att-detail-titleblock">
      <h2 id="att-detail-title">{v?.title ?? t('att.event')}</h2>
      <div class="att-detail-when" id="att-detail-when">{v ? v.when : ''}</div>
    </div>
    <span class="att-detail-intensity-badge" id="att-detail-intensity-badge" class:show={attDetail.badgeShow}>{v ? v.intensity : ''}</span>
  </div>
  <div class="att-detail-meta">
    <span class="meta-item"><span id="att-detail-location">{#if v}{#if v.place && v.placeMapsUrl}{v.locationIcon}<a class="att-detail-location-link" href={safeUrl(v.placeMapsUrl)} target="_blank" rel="noopener">{v.place}</a>{:else}{v.place ? `${v.locationIcon}${v.place}` : ''}{/if}{/if}</span></span>
    <span class="meta-item" id="att-detail-meet-item" style:display={v && v.isTraining ? 'none' : null}>⏰ <span>{t('att.meet')}</span> <span id="att-detail-meet">{v ? v.meet : ''}</span></span>
    <span class="meta-item" id="att-detail-start-item"><span id="att-detail-start-label" style:display={v && v.isTraining ? 'none' : null}>🏁 <span>{t('att.ko')}</span>{' '}</span><span id="att-detail-start">{v ? v.start : ''}</span></span>
  </div>
  <div class="att-detail-actions">
    <button class="decline" id="att-detail-decline-btn" class:is-active={v && v.my === 'no'} onclick={(event) => setMyRsvp(attSelection.currentEventId, 'no', event.currentTarget)}>{t('att.decline')}</button>
    <button class="confirm" id="att-detail-confirm-btn" class:is-active={v && v.my === 'yes'} onclick={(event) => setMyRsvp(attSelection.currentEventId, 'yes', event.currentTarget)}>{t('att.confirm')}</button>
  </div>
</div>
