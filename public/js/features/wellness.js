// ---- Wellness / RPE (tabla Supabase "attendance_wellness") ----
// Valoración que rellena cada jugadora tras un evento:
//   1) RPE (esfuerzo percibido, 1-10) con slider, emoji, color y texto dinámicos.
//   2) Horas de sueño: selector de un solo clic (<6h, 7-8h, >8h).
//   3) Estado de ánimo: 5 emojis de un solo clic.
//   4) Molestias físicas: Sí/No y, si Sí, en qué zona.
// Todo se guarda junto, en una sola fila por (event_id, user_id).
// Todo el módulo (botón + modal) es SOLO para el rol jugadora: ver
// toggleAttWellnessButtonVisibility(), llamado desde renderEventDetail().
// Cada valor del 1 al 10 tiene su propio emoji, color y texto descriptivo, tal como
// los ha definido el club (algunos "emoji" son directamente el círculo de color).
const RPE_LEVELS = {
  1:  { emoji:'😌', color:'#2E9E6C', key:'att.rpe1' },
  2:  { emoji:'🟢', color:'#3CAE73', key:'att.rpe2' },
  3:  { emoji:'🙂', color:'#8DB93C', key:'att.rpe3' },
  4:  { emoji:'🟡', color:'#E3B23C', key:'att.rpe4' },
  5:  { emoji:'🏃‍♀️', color:'#DE9F3F', key:'att.rpe5' },
  6:  { emoji:'🟠', color:'#D8894A', key:'att.rpe6' },
  7:  { emoji:'🥵', color:'#D8704A', key:'att.rpe7' },
  8:  { emoji:'🔴', color:'#D8564A', key:'att.rpe8' },
  9:  { emoji:'🔥', color:'#B33A2E', key:'att.rpe9' },
  10: { emoji:'💀', color:'#7A1E1E', key:'att.rpe10' }
};
function wellnessRpeLevel(v){
  return RPE_LEVELS[Number(v)] || RPE_LEVELS[5];
}
function updateWellnessRpeDisplay(v){
  const level = wellnessRpeLevel(v);
  document.getElementById('wellness-rpe-value').textContent = v;
  document.getElementById('wellness-rpe-emoji').textContent = level.emoji;
  const descEl = document.getElementById('wellness-rpe-desc');
  descEl.textContent = t(level.key);
  descEl.style.color = level.color;
  document.getElementById('wellness-rpe-slider').style.setProperty('--rpe-color', level.color);
}

let wellnessModalEventId = null;
let wellnessHasDiscomfort = false;
let wellnessSleep = null; // 'lt6' | '7-8' | 'gt8' | null (todavía sin elegir)
let wellnessMood = null;  // 1-5 | null (todavía sin elegir)

function setWellnessDiscomfort(hasDiscomfort){
  wellnessHasDiscomfort = hasDiscomfort;
  document.querySelectorAll('#wellness-modal .wellness-toggle-opt').forEach(btn => {
    btn.classList.toggle('selected', (btn.dataset.val === 'yes') === hasDiscomfort);
  });
  document.getElementById('wellness-discomfort-detail').style.display = hasDiscomfort ? '' : 'none';
}

// Tocar la opción ya seleccionada la deselecciona (vuelve a "todavía sin elegir", es
// decir, val = null): así se puede dejar el campo vacío aunque antes se hubiera
// marcado algo por error, sin tener que cerrar el modal y volver a entrar.
function setWellnessSleep(val){
  wellnessSleep = (val !== null && val === wellnessSleep) ? null : val;
  document.querySelectorAll('#wellness-sleep-options .wellness-pill-opt').forEach(btn => {
    btn.classList.toggle('selected', wellnessSleep !== null && btn.dataset.val === wellnessSleep);
  });
}

function setWellnessMood(val){
  wellnessMood = (val !== null && Number(val) === Number(wellnessMood)) ? null : val;
  document.querySelectorAll('#wellness-mood-options .wellness-mood-opt').forEach(btn => {
    btn.classList.toggle('selected', wellnessMood !== null && Number(btn.dataset.val) === Number(wellnessMood));
  });
}

// Solo el rol jugadora (Capitana incluida, ver effectiveRoleForPermissions) puede ver
// y usar este módulo — el resto de roles (entrenador/a, delegado/a, directiva...) no
// tienen relación con su propio RPE de entreno/partido.
function canUseWellness(){
  return effectiveRoleForPermissions(myProfile.rol) === 'jugadora';
}

async function openWellnessModal(eventId){
  if(!canUseWellness()) return;
  const ev = attEvents.find(e => e.id === eventId);
  if(!ev) return;

  wellnessModalEventId = eventId;
  document.getElementById('wellness-modal-sub').textContent = `${ev.label} · ${eventWhenDisplay(ev)}`;

  // Valores por defecto mientras se cargan (si ya había una respuesta previa, se
  // sobrescriben en cuanto llega la respuesta de Supabase, más abajo).
  document.getElementById('wellness-rpe-slider').value = 5;
  updateWellnessRpeDisplay(5);
  setWellnessSleep(null);
  setWellnessMood(null);
  setWellnessDiscomfort(false);
  document.getElementById('wellness-discomfort-textarea').value = '';

  document.getElementById('wellness-modal').classList.add('active');

  if(!currentAuthUserId) return; // sin sesión iniciada no hay nada que cargar
  const { data, error } = await supabaseClient.from('attendance_wellness')
    .select('rpe, sleep_hours, mood, has_discomfort, discomfort_detail')
    .eq('event_id', eventId).eq('user_id', currentAuthUserId).maybeSingle();
  if(error){ console.error('No se ha podido cargar el wellness', error); return; }
  // Si mientras cargaba se cerró el modal o se abrió el de otro evento, no pisamos nada
  if(wellnessModalEventId !== eventId || !data) return;

  const rpe = data.rpe || 5;
  document.getElementById('wellness-rpe-slider').value = rpe;
  updateWellnessRpeDisplay(rpe);
  setWellnessSleep(data.sleep_hours || null);
  setWellnessMood(data.mood || null);
  setWellnessDiscomfort(!!data.has_discomfort);
  document.getElementById('wellness-discomfort-textarea').value = data.discomfort_detail || '';
}

function closeWellnessModal(){
  document.getElementById('wellness-modal').classList.remove('active');
  wellnessModalEventId = null;
}

async function saveWellnessModal(){
  if(!wellnessModalEventId) return;
  if(!currentAuthUserId){ closeWellnessModal(); return; } // sin sesión, no hay dónde guardarlo

  const eventId = wellnessModalEventId;
  const rpe = Number(document.getElementById('wellness-rpe-slider').value);
  const discomfortDetail = document.getElementById('wellness-discomfort-textarea').value.trim();

  const { error } = await supabaseClient.from('attendance_wellness').upsert({
    event_id: eventId,
    user_id: currentAuthUserId,
    rpe,
    sleep_hours: wellnessSleep,
    mood: wellnessMood,
    has_discomfort: wellnessHasDiscomfort,
    discomfort_detail: wellnessHasDiscomfort ? discomfortDetail : '',
    updated_at: new Date().toISOString()
    // onConflict: se indica explícitamente (event_id, user_id) para que, si ya había
    // una valoración de esta jugadora para este entreno, SUSTITUYA esa fila en vez de
    // crear una segunda — así entrar de nuevo y guardar otros valores reemplaza a los
    // anteriores. Requiere que en Supabase exista una constraint UNIQUE sobre
    // (event_id, user_id) en "attendance_wellness" (ver nota más abajo).
  }, { onConflict: 'event_id,user_id' });
  if(error){
    console.error('No se ha podido guardar el wellness', error);
    alert(t('att.wellnessSaveError'));
    return;
  }
  closeWellnessModal();
  // Si el entreno recién valorado era el que señalaba el banner de Inicio, se
  // recalcula para que desaparezca (o pase al siguiente entreno pendiente, si hay).
  if(typeof renderWellnessReminderBanner === 'function') renderWellnessReminderBanner();
}

// Muestra/oculta el botón 📊 de la tarjeta de asistencia según el rol, y recoloca
// los botones superiores (editar / tullidas / wellness) uno junto a otro, en función
// de cuáles estén realmente visibles para evitar huecos o solapes.
function toggleAttWellnessButtonVisibility(){
  const btn = document.getElementById('att-detail-wellness-btn');
  if(btn) btn.style.display = canUseWellness() ? '' : 'none';
  layoutAttDetailHeaderButtons();
}
// Muestra/oculta el botón 📊 de acceso directo al Panel de Análisis Wellness/RPE de
// Cos Tècnic, en la cabecera del DETALLE de un evento concreto (mismo criterio que
// el botón equivalente de la tarjeta en el listado de Asistencia: solo Cos Tècnic y
// solo si el evento ya ha terminado, ver canViewWellnessStaff()/hasEventEnded()).
function toggleAttWellnessStaffButtonVisibility(ev){
  const btn = document.getElementById('att-detail-wellness-staff-btn');
  if(btn) btn.style.display = (canViewWellnessStaff() && hasEventEnded(ev)) ? '' : 'none';
  layoutAttDetailHeaderButtons();
}
function layoutAttDetailHeaderButtons(){
  const order = ['att-detail-edit-btn', 'att-detail-tullides-btn', 'att-detail-wellness-btn', 'att-detail-wellness-staff-btn'];
  let offset = 10;
  order.forEach(id => {
    const el = document.getElementById(id);
    if(!el || el.style.display === 'none') return;
    el.style.right = offset + 'px';
    offset += 34;
  });
}

// ---- Banner "Entreno pendiente de valorar" (Inicio) ----
// Recuerda a las jugadoras que valoren el Wellness/RPE del entreno finalizado más
// reciente que todavía no tienen valorado. Solo visible para el rol jugadora (misma
// condición que el resto del módulo, ver canUseWellness()).
let wellnessReminderEventId = null;

// Un entreno se considera "finalizado" si su fecha ya pasó, o si es hoy pero su hora
// de fin (o de inicio, si no hay hora de fin) ya ha pasado.
function hasEventEnded(ev, now){
  const nowRef = now || new Date();
  const todayIso = todayLocalIso();
  const iso = attEventIso(ev);
  if(iso < todayIso) return true;
  if(iso > todayIso) return false;
  const timeStr = (ev.endTime || ev.startTime || '').replace(/h$/, '');
  if(!timeStr) return false;
  const [hh, mm] = timeStr.split(':').map(Number);
  const eventMoment = new Date(nowRef.getFullYear(), nowRef.getMonth(), nowRef.getDate(), hh || 0, mm || 0);
  return nowRef >= eventMoment;
}

async function renderWellnessReminderBanner(){
  const banner = document.getElementById('inicio-wellness-reminder-banner');
  if(!banner) return;

  if(!canUseWellness() || !currentAuthUserId){
    banner.style.display = 'none';
    wellnessReminderEventId = null;
    return;
  }

  const now = new Date();
  // Igual que en el selector de eventos de Cos Tècnic (populateWellnessStaffEventSelect):
  // cualquier evento que no sea una reunión cuenta para el Wellness/RPE (entrenos Y
  // partidos), no solo entrenos. Antes solo miraba 'training', así que si el último
  // evento finalizado de una jugadora era un partido, el banner nunca lo encontraba
  // aunque tuviera una valoración pendiente de verdad.
  const pastTrainings = attEvents
    .filter(ev => attEventType(ev) !== 'meeting' && hasEventEnded(ev, now))
    .sort((a, b) => {
      const isoCmp = attEventIso(b).localeCompare(attEventIso(a));
      if(isoCmp !== 0) return isoCmp;
      return (b.startTime || '').localeCompare(a.startTime || '');
    });

  if(!pastTrainings.length){
    banner.style.display = 'none';
    wellnessReminderEventId = null;
    return;
  }

  const { data, error } = await supabaseClient.from('attendance_wellness')
    .select('event_id').eq('user_id', currentAuthUserId)
    .in('event_id', pastTrainings.map(ev => ev.id));
  if(error){
    console.error('No se ha podido comprobar el wellness pendiente', error);
    banner.style.display = 'none';
    wellnessReminderEventId = null;
    return;
  }

  const ratedIds = new Set((data || []).map(row => row.event_id));
  const pending = pastTrainings.find(ev => !ratedIds.has(ev.id));

  if(!pending){
    banner.style.display = 'none';
    wellnessReminderEventId = null;
    return;
  }

  wellnessReminderEventId = pending.id;
  banner.style.display = 'flex';
}

// Abre directamente el modal de valoración Wellness/RPE del entreno pendiente que
// señala el banner, sin pasar antes por el detalle del evento.
function openWellnessReminderBanner(){
  if(!wellnessReminderEventId) return;
  openWellnessModal(wellnessReminderEventId);
}
