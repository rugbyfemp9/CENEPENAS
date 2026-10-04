<script>
  // Recordatorio de valoración Wellness/RPE del entreno más reciente ya finalizado,
  // sin "No asistiré" y todavía sin valorar. Solo jugadoras: ver renderWellnessReminderBanner().
  import { t } from '../../lib/i18n.svelte.js';
  import { reminder, openWellnessReminderBanner, markReminderEventNotAttended } from './wellness.svelte.js';
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="wellness-reminder-banner" id="inicio-wellness-reminder-banner" style:display={reminder.display} onclick={openWellnessReminderBanner}>
  <div class="icon">⚠️</div>
  <div class="txt">
    <b>{t('wellnessReminder.title')}</b>
    <span>{t('wellnessReminder.subtitle')}</span>
    {#if reminder.sub}<span class="ev">{reminder.sub}</span>{/if}
  </div>
  <button class="btn-ghost not-attended" onclick={(e) => { e.stopPropagation(); markReminderEventNotAttended(); }}>{t('wellnessReminder.notAttended')}</button>
</div>
