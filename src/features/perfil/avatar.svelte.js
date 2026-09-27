// ---- Foto de perfil: menú "Cambiar / Editar / Eliminar foto", subida y recorte ----
import { flushSync } from 'svelte';
import { supabase } from '../../lib/supabase.js';
import { auth } from '../../lib/session.svelte.js';
import { myProfile, rosterById } from '../../lib/roster.js';
import { t } from '../../lib/i18n.svelte.js';
import { perfil, renderProfile, refreshAvatarEverywhere } from './perfil.svelte.js';

// El <input type="file"> oculto y la <img> del modal de ajustar (los registran sus componentes).
let avatarInputEl = null;
let adjustImgEl = null;
export function setAvatarInput(el) { avatarInputEl = el; }
export function setAvatarAdjustImg(el) { adjustImgEl = el; }

// Abre/cierra el menú "Editar foto / Eliminar foto" bajo el botón de la foto de perfil
export function togglePfAvatarMenu() {
  perfil.avatarMenuOpen = !perfil.avatarMenuOpen;
}
export function closePfAvatarMenu() {
  perfil.avatarMenuOpen = false;
}
export function chooseEditAvatarPhoto() {
  perfil.avatarMenuOpen = false;
  avatarInputEl.click();
}

// Quita la foto de perfil: borra la referencia en "profiles" y vuelve a mostrar las iniciales.
// El archivo en sí se queda en el bucket de Storage (no hace falta borrarlo para esto).
export async function removeAvatarPhoto() {
  perfil.avatarMenuOpen = false;
  if (!myProfile.avatarUrl) return;
  // El menú se cierra en pantalla antes de que salga el confirm() (que bloquea).
  flushSync();
  if (!confirm('¿Eliminar tu foto de perfil?')) return;

  if (auth.userId) {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', auth.userId);

    if (updateError) {
      alert('No se ha podido eliminar la foto: ' + updateError.message);
      return;
    }
  }

  myProfile.avatarUrl = '';
  rosterById['me'].avatarUrl = '';
  renderProfile();
  refreshAvatarEverywhere();
}

// Sube la foto elegida al bucket "avatars" de Supabase Storage y guarda su URL
// pública en la fila de "profiles" de la jugadora, para que se vea en Mi perfil
// y en la lista de Jugadoras.
export async function handleAvatarUpload(event) {
  const input = event.target;
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert('Elige un archivo de imagen (JPG, PNG…).');
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    alert('La imagen pesa demasiado. Elige una de menos de 15 MB.');
    return;
  }

  // Las fotos que salen directas de la cámara del móvil suelen pesar varios MB a
  // una resolución (3000-4000px de lado) muchísimo mayor que la que jamás se va a
  // mostrar: el avatar se ve siempre en un recuadro pequeño (unos 90px). Antes de
  // subirla se redimensiona aquí mismo, en el navegador, a un JPEG de como mucho
  // 800px de lado — en la práctica el archivo final pesa entre 10 y 40 veces menos
  // sin que se note ninguna diferencia visual, lo que ahorra tanto almacenamiento
  // en Supabase como el tráfico de red cada vez que alguien la vuelve a cargar.
  let blob;
  try {
    // maxDim reducido a 320px: el avatar más grande que se ve en toda la app es el de
    // Mi perfil (88×88px CSS); con 320px hay margen de sobra incluso en pantallas de
    // alta densidad (hasta ~3.6x), y el archivo pesa varias veces menos — esto es lo
    // que más peso mueve en el "Cached Egress" de Supabase, porque el avatar es la
    // única imagen que se sube a Storage y se descarga una y otra vez desde todos los
    // dispositivos del equipo.
    blob = await compressImageFile(file, 320, 0.82);
  } catch (e) {
    console.error('No se ha podido comprimir la imagen', e);
    alert('No se ha podido procesar la imagen. Prueba con otra foto.');
    return;
  }
  if (!blob) {
    alert('No se ha podido procesar la imagen. Prueba con otra foto.');
    return;
  }

  // Siempre se sube como .jpg (independientemente del formato original) para que
  // "Cambiar foto" y "Editar foto" guarden siempre en la misma ruta de Storage
  // (avatar.jpg) y no se vayan quedando archivos antiguos huérfanos en otro formato.
  await uploadAvatarBlob(blob, 'jpg');
}

// Redimensiona y comprime una imagen en el propio navegador usando un <canvas>,
// sin pasar por el servidor. maxDim limita el lado más largo (en píxeles); quality
// es la calidad JPEG (0-1). Devuelve un Blob listo para subir a Supabase Storage.
async function compressImageFile(file, maxDim, quality) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('No se ha podido leer la imagen'));
    image.src = dataUrl;
  });
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  return await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
}

// Sube un archivo o blob (usado tanto por "Cambiar foto" como, tras recortar, por
// "Editar foto") al bucket "avatars" de Supabase Storage y guarda su URL pública en
// la fila de "profiles" de la jugadora, para que se vea en Mi perfil y en la lista
// de Jugadoras. Devuelve true/false según si se ha podido completar.
async function uploadAvatarBlob(blob, extHint) {
  const authUserId = auth.userId;
  if (!authUserId) {
    alert('Inicia sesión para poder subir una foto de perfil.');
    return false;
  }

  perfil.uploading = true;

  const ext = (extHint || 'jpg').toLowerCase();
  const path = `${authUserId}/avatar.${ext}`;

  // cacheControl a 1 año: es seguro porque cada subida cambia la URL pública (lleva
  // "?t=" con la fecha), así que el navegador nunca podría servir por error una foto
  // vieja aunque la cachee mucho tiempo. Esto evita que cada jugadora tenga que
  // volver a descargar la misma foto de sus compañeras cada vez que abre la lista
  // de Jugadoras o Asistencia, mientras esa foto no cambie.
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { upsert: true, cacheControl: '31536000' });

  if (uploadError) {
    alert('No se ha podido subir la foto: ' + uploadError.message);
    perfil.uploading = false;
    return false;
  }

  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
  // Parámetro añadido solo para evitar que el navegador muestre una versión en caché desactualizada
  const publicUrl = urlData.publicUrl + '?t=' + Date.now();

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', authUserId);

  perfil.uploading = false;

  if (updateError) {
    alert('La foto se subió, pero no se pudo guardar en tu perfil: ' + updateError.message);
    return false;
  }

  myProfile.avatarUrl = publicUrl;
  rosterById['me'].avatarUrl = publicUrl;
  renderProfile();
  refreshAvatarEverywhere();
  return true;
}

// ---- Ajustar/recortar la foto de perfil ya subida ----
// Deja arrastrar y hacer zoom sobre la foto actual dentro de un recuadro cuadrado
// (mismo aspecto que el avatar), y al guardar recorta ese encuadre a un cuadrado
// real con <canvas> y lo sube como la nueva foto de perfil.
let avatarAdjustState = null; // {naturalW, naturalH, baseScale, scale, x, y}
const AVATAR_ADJUST_FRAME = 240; // debe coincidir con el width/height en px del #avatar-adjust-frame

export const avatarAdjust = $state({
  open: false,
  zoom: 100,
  // Tamaño y posición de la <img> dentro del recuadro: { w, h, x, y } (null = sin pintar aún).
  box: null,
});

export function openAvatarAdjustModal() {
  perfil.avatarMenuOpen = false;
  if (!myProfile.avatarUrl) {
    flushSync();
    alert(t('profile.adjustPhotoNoPhoto'));
    return;
  }
  avatarAdjustState = null;
  avatarAdjust.zoom = 100;
  // Se asigna a mano (y no con {src}) para que, aunque sea la misma foto que la última
  // vez, el navegador la vuelva a "cargar" y salte onAvatarAdjustImgLoad.
  adjustImgEl.src = myProfile.avatarUrl;
  avatarAdjust.open = true;
}

export function onAvatarAdjustImgLoad() {
  const naturalW = adjustImgEl.naturalWidth, naturalH = adjustImgEl.naturalHeight;
  // Escala mínima para que la imagen cubra siempre todo el recuadro cuadrado
  const baseScale = AVATAR_ADJUST_FRAME / Math.min(naturalW, naturalH);
  avatarAdjustState = {
    naturalW, naturalH, baseScale, scale: 1,
    x: (AVATAR_ADJUST_FRAME - naturalW * baseScale) / 2,
    y: (AVATAR_ADJUST_FRAME - naturalH * baseScale) / 2,
  };
  renderAvatarAdjustTransform();
}

export function closeAvatarAdjustModal() {
  avatarAdjust.open = false;
}

function renderAvatarAdjustTransform() {
  if (!avatarAdjustState) return;
  const s = avatarAdjustState;
  const totalScale = s.baseScale * s.scale;
  const w = s.naturalW * totalScale, h = s.naturalH * totalScale;
  // No dejar que se separen bordes del recuadro al arrastrar
  const minX = Math.min(0, AVATAR_ADJUST_FRAME - w), maxX = 0;
  const minY = Math.min(0, AVATAR_ADJUST_FRAME - h), maxY = 0;
  s.x = Math.max(minX, Math.min(maxX, s.x));
  s.y = Math.max(minY, Math.min(maxY, s.y));
  avatarAdjust.box = { w, h, x: s.x, y: s.y };
}

export function onAvatarAdjustZoom(e) {
  if (!avatarAdjustState) return;
  avatarAdjustState.scale = Number(e.target.value) / 100;
  renderAvatarAdjustTransform();
}

// Arrastrar la foto dentro del recuadro (ratón y dedo). Devuelve la función que quita
// los listeners (la llama el componente al desmontarse).
export function setupAvatarAdjustDrag(frame) {
  let dragging = false, startPointerX = 0, startPointerY = 0, startX = 0, startY = 0;

  function pointerDown(clientX, clientY) {
    if (!avatarAdjustState) return;
    dragging = true;
    startPointerX = clientX; startPointerY = clientY;
    startX = avatarAdjustState.x; startY = avatarAdjustState.y;
    frame.style.cursor = 'grabbing';
  }
  function pointerMove(clientX, clientY) {
    if (!dragging || !avatarAdjustState) return;
    avatarAdjustState.x = startX + (clientX - startPointerX);
    avatarAdjustState.y = startY + (clientY - startPointerY);
    renderAvatarAdjustTransform();
  }
  function pointerUp() {
    dragging = false;
    frame.style.cursor = 'grab';
  }

  const onMouseDown = e => { pointerDown(e.clientX, e.clientY); e.preventDefault(); };
  const onMouseMove = e => pointerMove(e.clientX, e.clientY);
  const onTouchStart = e => {
    const touch = e.touches[0];
    pointerDown(touch.clientX, touch.clientY);
  };
  const onTouchMove = e => {
    const touch = e.touches[0];
    pointerMove(touch.clientX, touch.clientY);
    e.preventDefault();
  };

  frame.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', pointerUp);
  frame.addEventListener('touchstart', onTouchStart, { passive: true });
  frame.addEventListener('touchmove', onTouchMove, { passive: false });
  frame.addEventListener('touchend', pointerUp);

  return () => {
    frame.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', pointerUp);
    frame.removeEventListener('touchstart', onTouchStart);
    frame.removeEventListener('touchmove', onTouchMove);
    frame.removeEventListener('touchend', pointerUp);
  };
}

export async function saveAvatarAdjust() {
  if (!avatarAdjustState) return;
  const s = avatarAdjustState;
  const totalScale = s.baseScale * s.scale;

  // Recorta, a resolución nativa de la imagen, exactamente la porción que se ve
  // dentro del recuadro cuadrado de la vista previa.
  const cropSize = AVATAR_ADJUST_FRAME / totalScale;
  const srcX = -s.x / totalScale;
  const srcY = -s.y / totalScale;

  // Igual que en "Cambiar foto": 320px es de sobra para el avatar más grande que se
  // ve en la app (88×88px CSS en Mi perfil), y reduce mucho el peso que se descarga
  // desde Supabase Storage cada vez que alguien ve una foto (el "Cached Egress").
  const OUTPUT_SIZE = 320;
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(adjustImgEl, srcX, srcY, cropSize, cropSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  if (!blob) {
    alert('No se ha podido procesar la imagen.');
    return;
  }
  const ok = await uploadAvatarBlob(blob, 'jpg');
  if (ok) closeAvatarAdjustModal();
}
