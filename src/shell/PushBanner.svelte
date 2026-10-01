<script>
  // Invita a activar las notificaciones (recordatorios de asistencia...) mientras no se
  // haya dado ni negado el permiso en este dispositivo: ver initWebPush() en src/lib/push.svelte.js.
  import { t } from '../lib/i18n.svelte.js';
  import { pushBanner, enableWebPush, dismissPushBanner } from '../lib/push.svelte.js';
</script>

{#if pushBanner.visible}
  <div class="push-banner" id="inicio-push-banner">
    <div class="icon">🔔</div>
    <div class="txt">
      <b>{t('pushBanner.title')}</b>
      <span>{t('pushBanner.subtitle')}</span>
    </div>
    <div class="actions">
      <button class="btn" onclick={enableWebPush}>{t('pushBanner.enable')}</button>
      <button class="btn-ghost" onclick={dismissPushBanner}>{t('pushBanner.dismiss')}</button>
    </div>
  </div>
{/if}
