<script>
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import { galeria, albumForm, saveNewAlbum } from './galeria.svelte.js';

  const labelStyle = 'display:flex; flex-direction:column; gap:5px; font-size:12.5px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.04em;';
  const inputStyle = "font-family:'Roboto',sans-serif; font-size:14px; padding:10px 12px; border-radius:10px; border:1.5px solid var(--line); color:var(--navy);";
</script>

<Modal id="add-album-modal" bind:open={galeria.addModalOpen} boxStyle="max-width:400px;">
  <h3 style="margin-top:0;">{t('galeria.addAlbum')}</h3>
  <p class="modal-sub">{t('galeria.modalSub')}</p>
  <div class="field-group" style="display:flex; flex-direction:column; gap:12px; margin:14px 0 18px;">
    <label style={labelStyle}>
      <span>{t('galeria.seasonLabel')}</span>
      <select id="album-season-input" bind:value={albumForm.seasonId} style="{inputStyle} background:var(--white);">
        {#each galeria.seasons as s (s.id)}<option value={s.id}>{s.label}</option>{/each}
        <option value="__new__">{t('galeria.newSeasonOption')}</option>
      </select>
    </label>
    <label id="album-new-season-wrap" style="{labelStyle.replace('display:flex', `display:${albumForm.seasonId === '__new__' ? 'flex' : 'none'}`)}">
      <span>{t('galeria.newSeasonNameLabel')}</span>
      <input type="text" id="album-new-season-input" bind:value={albumForm.newSeasonLabel} placeholder={t('galeria.newSeasonPlaceholder')} style={inputStyle}>
    </label>
    <label style={labelStyle}>
      <span>{t('galeria.albumTitleLabel')}</span>
      <input type="text" id="album-title-input" bind:value={albumForm.title} placeholder={t('galeria.albumTitlePlaceholder')} style={inputStyle}>
    </label>
    <label style={labelStyle}>
      <span>{t('galeria.coverLabel')}</span>
      <input type="url" id="album-cover-input" bind:value={albumForm.cover} placeholder="https://..." style={inputStyle}>
    </label>
    <label style={labelStyle}>
      <span>{t('galeria.albumUrlLabel')}</span>
      <input type="url" id="album-url-input" bind:value={albumForm.url} placeholder="https://photos.app.goo.gl/..." style={inputStyle}>
    </label>
  </div>
  <div class="modal-actions">
    <button class="btn-ghost" onclick={() => (galeria.addModalOpen = false)}>{t('att.cancel')}</button>
    <button class="btn" onclick={saveNewAlbum}>{t('att.saveGeneric')}</button>
  </div>
</Modal>
