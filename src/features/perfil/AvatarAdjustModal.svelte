<script>
  // Modal para ajustar/recortar la foto de perfil YA subida: deja reencuadrar
  // (arrastrar) y hacer zoom para que encaje bien dentro del recuadro cuadrado
  // redondeado que usa el avatar. Al guardar, se recorta a un cuadrado en un <canvas>
  // y se sube como si fuera una foto nueva.
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import {
    avatarAdjust, setAvatarAdjustImg, onAvatarAdjustImgLoad, onAvatarAdjustZoom, setupAvatarAdjustDrag,
    closeAvatarAdjustModal, saveAvatarAdjust,
  } from './avatar.svelte.js';

  let frame;
  let img;

  $effect(() => {
    setAvatarAdjustImg(img);
    return setupAvatarAdjustDrag(frame);
  });

  const box = $derived(avatarAdjust.box);
</script>

<Modal id="avatar-adjust-modal" bind:open={avatarAdjust.open} boxStyle="max-width:360px;">
  <h3 style="margin-top:0;">{t('profile.adjustPhotoTitle')}</h3>
  <div class="modal-sub">{t('profile.adjustPhotoSub')}</div>
  <div id="avatar-adjust-frame" bind:this={frame} style="position:relative; width:240px; height:240px; margin:4px auto 16px; border-radius:24px; overflow:hidden; background:var(--bg); touch-action:none; cursor:grab; border:1.5px solid var(--line);">
    <img id="avatar-adjust-img" src="" alt="" crossorigin="anonymous" draggable="false" bind:this={img} onload={onAvatarAdjustImgLoad} style="position:absolute; top:0; left:0; max-width:none; user-select:none; -webkit-user-drag:none;" style:width={box ? box.w + 'px' : null} style:height={box ? box.h + 'px' : null} style:transform={box ? `translate(${box.x}px, ${box.y}px)` : null}>
  </div>
  <input type="range" id="avatar-adjust-zoom" min="100" max="300" step="1" style="width:100%; accent-color:var(--sky);" bind:value={avatarAdjust.zoom} oninput={onAvatarAdjustZoom}>
  <div class="modal-actions">
    <button class="btn-ghost" onclick={closeAvatarAdjustModal}>{t('att.cancel')}</button>
    <button class="btn" onclick={saveAvatarAdjust}>{t('att.saveGeneric')}</button>
  </div>
</Modal>
