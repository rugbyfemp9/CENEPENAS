<script>
  // Pestaña "Sesión" del panel de Cos Tècnic: desplegable de entrenos/partidos ya
  // terminados, alertas rápidas y tabla global del entrenamiento (una fila por
  // jugadora, con el color de intensidad del RPE de RPE_LEVELS).
  import { t } from '../../lib/i18n.svelte.js';
  import { staff, onWellnessStaffEventChange, openWellnessAlertModal, staffRpeColor } from './wellness-staff.svelte.js';

  const WELLNESS_STAFF_MOOD_EMOJI = { 1: '😞', 2: '🙁', 3: '😐', 4: '🙂', 5: '😄' };
  const ALERT_CARDS = [
    ['discomfort', '🔴', 'wstaff.alertDiscomfortTitle'],
    ['sleep', '🟡', 'wstaff.alertSleepTitle'],
    ['load', '🔥', 'wstaff.alertLoadTitle'],
  ];
  const sleepCls = (h) => (h === 'lt6' ? 'lt6' : h === 'gt8' ? 'gt8' : 'mid');
  const sleepKey = (h) => (h === 'lt6' ? 'att.wellnessSleepLt6' : h === 'gt8' ? 'att.wellnessSleepGt8' : 'att.wellnessSleep78');
</script>

<div class="wstaff-event-select-row">
  <label>
    <span>{t('wstaff.eventLabel')}</span>
    <select id="wstaff-event-select" value={staff.selectValue} onchange={(e) => onWellnessStaffEventChange(e.currentTarget.value)}>
      {#if staff.eventOptions && !staff.eventOptions.length}
        <option value="">{t('wstaff.noEvents')}</option>
      {:else if staff.eventOptions}
        {#each staff.eventOptions as opt}
          <option value={opt.id}>{opt.label}</option>
        {/each}
      {/if}
    </select>
  </label>
</div>

<!-- BLOQUE DE ALERTAS RÁPIDAS -->
<div class="wstaff-alerts-grid" id="wstaff-alerts-grid">
  {#each ALERT_CARDS as [kind, icon, titleKey] (kind)}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="wstaff-alert-card {kind}" onclick={() => openWellnessAlertModal(kind)} style="cursor:pointer;">
      <div class="wstaff-alert-head">
        <span class="wstaff-alert-icon">{icon}</span>
        <span class="wstaff-alert-title">{t(titleKey)}</span>
        <span class="wstaff-alert-count" id="wstaff-alert-{kind}-count">{staff.alerts[kind].length}</span>
      </div>
    </div>
  {/each}
</div>

<!-- TABLA GLOBAL DEL ENTRENAMIENTO -->
<div class="card wstaff-table-card">
  <table class="wstaff-table">
    <thead>
      <tr>
        <th>{t('wstaff.colPlayer')}</th>
        <th class="num">{t('wstaff.colSleep')}</th>
        <th class="num">{t('wstaff.colMood')}</th>
        <th class="num">{t('wstaff.colRpe')}</th>
        <th class="num">{t('wstaff.colLoad')}</th>
        <th>{t('wstaff.colDiscomfort')}</th>
      </tr>
    </thead>
    <tbody id="wstaff-table-body">
      {#each staff.rows as r}
        <tr>
          <td class="col-player"><b>{r.name}</b></td>
          <td class="num">{#if !r.sleepHours}<span class="wstaff-sleep-pill none">{t('wstaff.noSleep')}</span>{:else}<span class="wstaff-sleep-pill {sleepCls(r.sleepHours)}">{t(sleepKey(r.sleepHours))}</span>{/if}</td>
          <td class="num">{r.mood != null ? (WELLNESS_STAFF_MOOD_EMOJI[r.mood] || '—') : t('wstaff.noMood')}</td>
          <td class="num">{#if r.rpe != null}<span class="wstaff-rpe-pill" style="background:{staffRpeColor(r.rpe)};">{r.rpe}</span>{:else}<span class="muted-cell">—</span>{/if}</td>
          <td class="num">{r.load != null ? Math.round(r.load) : '—'}</td>
          <td>{#if r.hasDiscomfort}<span class="discomfort-yes">{r.discomfortDetail || t('att.wellnessYes')}</span>{:else}<span class="discomfort-no">{t('wstaff.noDiscomfort')}</span>{/if}</td>
        </tr>
      {/each}
    </tbody>
  </table>
  <div class="wstaff-empty-state" id="wstaff-empty-state" style:display={staff.emptyShown ? null : 'none'}>{t('wstaff.noData')}</div>
</div>
