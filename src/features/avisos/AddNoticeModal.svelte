<script>
  import Modal from '../../lib/Modal.svelte';
  import { noticeForm, saveNotice } from './avisos.svelte.js';

  const labelStyle = 'display:flex; flex-direction:column; gap:5px; font-size:12.5px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.04em;';
</script>

<Modal id="add-notice-modal" bind:open={noticeForm.open} boxStyle="max-width:380px;">
  <h3 style="margin-top:0;">Añadir aviso</h3>
  <div class="field-group" style="display:flex; flex-direction:column; gap:12px; margin:14px 0 18px;">
    <!-- svelte-ignore a11y_label_has_associated_control -->
    <label style={labelStyle}>
      Tipo de aviso
      <div class="notice-type-quick" id="notice-type-quick">
        <button type="button" data-type="pinned" class:active={noticeForm.type === 'pinned'} onclick={() => (noticeForm.type = 'pinned')}>📌 Fijado en Avisos</button>
        <button type="button" data-type="banner" class:active={noticeForm.type === 'banner'} onclick={() => (noticeForm.type = 'banner')}>📢 Notificación arriba</button>
      </div>
      <div class="notice-type-hint" id="notice-type-hint">{noticeForm.type === 'banner' ? 'Aparece arriba del todo para todo el mundo, con una "x" para cerrarla.' : 'Se queda fijado en "Avisos" hasta que tú lo borres.'}</div>
    </label>
    <label style={labelStyle}>
      Texto del aviso
      <textarea id="notice-text-input" placeholder="Escribe aquí el aviso..." style="min-height:90px;" bind:value={noticeForm.text}></textarea>
    </label>
  </div>
  <div class="modal-actions">
    <button class="btn-ghost" onclick={() => (noticeForm.open = false)}>Cancelar</button>
    <button class="btn" onclick={saveNotice}>Publicar</button>
  </div>
</Modal>
