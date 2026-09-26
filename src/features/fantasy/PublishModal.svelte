<script>
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import { publishModal, closePublishModal, selectPublishAudience, confirmPublish } from './fantasy.svelte.js';

  const audiences = [
    { value: 'jugadoras', key: 'nav.plantilla' },
    { value: 'staff', key: 'fantasy.audienceStaff' },
    { value: 'capitanas', key: 'fantasy.audienceCaptains' },
    { value: 'persona', key: 'fantasy.audiencePerson' },
  ];
</script>

<Modal id="publish-modal" bind:open={publishModal.open} boxStyle="max-width:400px;">
  <h3 style="margin-top:0;">{t('fantasy.shareWithTitle')}</h3>
  <div class="publish-audience-grid" id="publish-audience-grid">
    {#each audiences as a (a.value)}
      <button class="publish-audience-opt" class:selected={publishModal.audience === a.value} data-audience={a.value} onclick={() => selectPublishAudience(a.value)}>{t(a.key)}</button>
    {/each}
  </div>
  <div id="publish-person-wrap" style:display={publishModal.audience === 'persona' ? 'block' : 'none'} style="margin-top:12px;">
    <label style="display:flex; flex-direction:column; gap:5px; font-size:12.5px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.04em;">
      <span>{t('fantasy.personLabel')}</span>
      <select id="publish-person-select" bind:value={publishModal.personId} style="font-family:'Roboto',sans-serif; font-size:14px; padding:10px 12px; border-radius:10px; border:1.5px solid var(--line); color:var(--navy);">
        {#each publishModal.people as p (p.id)}
          <option value={p.id}>{p.name}</option>
        {/each}
      </select>
    </label>
  </div>
  <div class="modal-actions">
    <button class="btn-ghost" onclick={closePublishModal}>{t('att.cancel')}</button>
    <button class="btn" onclick={confirmPublish}>{t('fantasy.publish')}</button>
  </div>
</Modal>
