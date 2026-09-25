/* ================= GYM ================= */
// Ejercicios principales sobre los que se lleva marca (1RM) y ranking de equipo.
// Antes eran intocables; ahora entrenador/a y admin también pueden eliminarlos (ver
// gymExerciseDeletable) — cuando lo hacen, se guarda en "gym_removed_default_exercises"
// para que la eliminación sea real y quede igual en todas las cuentas.
const gymMainExercises = ['Sentadilla', 'Peso muerto', 'Press banca', 'Press militar', 'Dominadas lastradas'];

// Nombres (en minúsculas) de los ejercicios fijos que entrenador/a o admin han
// eliminado para todo el equipo. Se guarda en Supabase (tabla
// "gym_removed_default_exercises") y se sincroniza en directo, igual que el resto
// del catálogo de ejercicios.
let gymRemovedDefaultExercises = new Set();
async function loadGymRemovedDefaultExercises(){
  // Copia en caché primero (si hay una reciente), para pintar al momento; la
  // petición real de abajo sigue haciéndose igual y corrige lo que haga falta.
  const cached = await readCache('gym_removed_default_exercises');
  if(cached){
    gymRemovedDefaultExercises = new Set(cached.data);
    renderGymMarks();
    renderGymQuickCalcSelectors();
    calculateGymQuickRm();
    renderGymRankingExerciseOptions();
    renderGymRanking();
  }

  const { data, error } = await supabaseClient.from('gym_removed_default_exercises').select('name');
  if(error){ console.error('No se han podido cargar los ejercicios fijos eliminados', error); return; }
  const names = (data || []).map(row => row.name.toLowerCase());
  writeCache('gym_removed_default_exercises', names);
  gymRemovedDefaultExercises = new Set(names);
  renderGymMarks();
  renderGymQuickCalcSelectors();
  calculateGymQuickRm();
  renderGymRankingExerciseOptions();
  renderGymRanking();
}
function subscribeToGymRemovedDefaultExercisesRealtime(){
  supabaseClient
    .channel('gym-removed-default-exercises-sync')
    .on('postgres_changes', { event:'*', schema:'public', table:'gym_removed_default_exercises' }, () => loadGymRemovedDefaultExercises())
    .subscribe();
}

// Solo entrenador/a y la cuenta admin pueden añadir ejercicios "generales": quedan
// visibles para todo el equipo y entran también en el ránking. El resto de la
// plantilla puede seguir añadiendo sus propios ejercicios personalizados, pero esos
// se guardan como privados (solo los ve quien los crea, ver gymAllExercises).
const GYM_GENERAL_EXERCISE_ROLES = ['entrenador/a'];
function canManageGeneralExercises(){
  return isAdmin || GYM_GENERAL_EXERCISE_ROLES.includes(myProfile.rol);
}

// Catálogo de ejercicios "generales" añadidos desde la app (además de los fijos de
// arriba): se guarda en Supabase (tabla "gym_exercises") y es visible para todo el
// mundo. Los ejercicios privados de cada jugadora NO están aquí — viven solo en su
// propio "gym_rm" y por eso la política RLS de esa tabla impide que nadie más los
// vea (ver supabase_gym_exercises.sql).
let gymExercises = [];
async function loadGymExercises(){
  const cached = await readCache('gym_exercises');
  if(cached){
    gymExercises = cached.data;
    renderGymMarks();
    renderGymRankingExerciseOptions();
    renderGymRanking();
  }

  const { data, error } = await supabaseClient.from('gym_exercises').select('*').order('created_at', { ascending:true });
  if(error){ console.error('No se han podido cargar los ejercicios generales de gym', error); return; }
  gymExercises = data || [];
  writeCache('gym_exercises', gymExercises);
  renderGymMarks();
  renderGymRankingExerciseOptions();
  renderGymRanking();
}
function subscribeToGymExercisesRealtime(){
  supabaseClient
    .channel('gym-exercises-sync')
    .on('postgres_changes', { event:'*', schema:'public', table:'gym_exercises' }, () => loadGymExercises())
    .subscribe();
}

// Rutina de la semana: no hay ninguna hasta que se confirme con Supabase (tabla
// "gym_weekly_routine", ver loadGymWeeklyRoutine). Esa tabla la rellena la función Edge
// "process-gym-routine-pdf" cuando alguien sube el PDF de la rutina. Mientras valga
// null, se entiende que esta semana todavía no se ha subido ninguna rutina.
let gymWeeklyRoutine = null;

// Día de la rutina que se está viendo en la pantalla de detalle (índice en days[]).
let gymRoutineSelectedDayIndex = null;
// Jugadora sobre la que calcula la calculadora rápida. null = la jugadora logeada
// (currentUserId). Se resetea a null cada vez que se abre el detalle de un día.
let gymQuickCalcPlayerId = null;
// Grupo de jugadoras seleccionado en la pantalla de detalle: 'forwards' o 'backs'.
let gymRoutineSelectedGroup = 'forwards';

// Asistencia al gimnasio por día: { '2026-08-18': [{ playerId:'me', time:'18:30' }] }
let gymAttendanceByDate = {};

// El cuerpo técnico y las jugadoras pueden subir el PDF de la rutina.
const GYM_ROUTINE_EDITOR_ROLES = ['entrenador/a', 'delegado/a', 'directiva', 'jugadora'];
function canEditGymRoutine(){
  return isAdmin || GYM_ROUTINE_EDITOR_ROLES.includes(effectiveRoleForPermissions(myProfile.rol));
}

// ---- Panel 1: rutina de la semana ----
function renderGymRoutine(){
  const canEdit = canEditGymRoutine();
  const uploadBtn = document.getElementById('gym-routine-upload-btn');
  if(uploadBtn) uploadBtn.style.display = canEdit ? 'flex' : 'none';
  const moreWrap = document.getElementById('gym-routine-more');
  if(moreWrap) moreWrap.style.display = canEdit ? 'flex' : 'none';

  const weekLabelEl = document.getElementById('gym-week-label');
  const daysBox = document.getElementById('gym-routine-days');
  if(!daysBox) return;

  // Todavía no se ha subido ningún PDF esta semana: no se muestra rutina ninguna,
  // solo el aviso y (si puede editarla) el botón para subirla.
  if(!gymWeeklyRoutine || !gymWeeklyRoutine.days || gymWeeklyRoutine.days.length === 0){
    if(weekLabelEl) weekLabelEl.textContent = '';
    daysBox.innerHTML = `
        <div class="gym-routine-empty">
          <p>Todavía no se ha subido la rutina de esta semana.</p>
          ${canEdit ? `<button class="btn" onclick="openGymRoutineUploadModal()">Subir la rutina</button>` : ''}
        </div>
      `;
    return;
  }

  if(weekLabelEl) weekLabelEl.textContent = gymWeeklyRoutine.weekLabel || '';

  // Un tarjetón por cada día de entreno que tenga la rutina; al pulsar se abre el
  // detalle de ese día en su propia pantalla.
  daysBox.innerHTML = `
      <div class="gym-tab-cards">
        ${gymWeeklyRoutine.days.map((d, i) => `
          <button class="gym-tab-card" onclick="openGymRoutineDay(${i})">
            <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/></svg></div>
            <b>Día ${i + 1}</b>
            <span>${escapeHtml(d.focus || d.day || '')}</span>
          </button>
        `).join('')}
      </div>
    `;
}

// Abre el detalle de un día concreto de la rutina en su propia pantalla completa.
// Siempre empieza mostrando el grupo "Forwards".
function openGymRoutineDay(index){
  gymRoutineSelectedDayIndex = index;
  gymRoutineSelectedGroup = 'forwards';
  gymQuickCalcPlayerId = null; // siempre se abre calculando la propia marca por defecto
  closeGymRmCalcBanner();
  renderGymRoutineDayDetalle();
  setSection('gym-entrenamiento-dia');
}

// Cambia entre la tabla de ejercicios de Forwards y la de Backs dentro del mismo día.
function setGymRoutineDayGroup(group){
  gymRoutineSelectedGroup = group;
  document.querySelectorAll('.gym-day-group-tab').forEach(b => b.classList.toggle('active', b.dataset.group === group));
  renderGymRoutineDayExercises();
}

// Devuelve la lista de ejercicios del grupo pedido para un día. Si la rutina no
// distingue por grupo (rutinas antiguas o PDF sin esa separación), usa la lista
// general "exercises" para ambos grupos.
function gymRoutineDayExercisesForGroup(d, group){
  if(group === 'backs' && Array.isArray(d.exercises_backs)) return d.exercises_backs;
  if(group === 'forwards' && Array.isArray(d.exercises_forwards)) return d.exercises_forwards;
  return d.exercises || [];
}

function renderGymRoutineDayDetalle(){
  if(!gymWeeklyRoutine || gymRoutineSelectedDayIndex === null) return;
  const d = gymWeeklyRoutine.days[gymRoutineSelectedDayIndex];
  if(!d) return;

  document.getElementById('gym-routine-day-detalle-title').textContent = t('gym.dayLabel', { n: gymRoutineSelectedDayIndex + 1 });
  document.getElementById('gym-routine-day-detalle-focus').textContent = d.focus || d.day || '';

  const splitNote = document.getElementById('gym-routine-day-detalle-split-note');
  if(splitNote){
    if(typeof d.group_split === 'boolean'){
      document.getElementById('gym-routine-day-detalle-split-note-text').textContent = d.group_split
        ? t('gym.splitRoutine')
        : t('gym.sameRoutine');
      splitNote.style.display = 'inline-flex';
    } else {
      splitNote.style.display = 'none';
    }
  }

  document.querySelectorAll('.gym-day-group-tab').forEach(b => b.classList.toggle('active', b.dataset.group === gymRoutineSelectedGroup));
  renderGymRoutineDayExercises();
}

function renderGymRoutineDayExercises(){
  if(!gymWeeklyRoutine || gymRoutineSelectedDayIndex === null) return;
  const d = gymWeeklyRoutine.days[gymRoutineSelectedDayIndex];
  if(!d) return;
  const box = document.getElementById('gym-routine-day-detalle-exercises');
  const exercises = gymRoutineDayExercisesForGroup(d, gymRoutineSelectedGroup);

  if(!exercises.length){
    box.innerHTML = `<tr><td colspan="5" class="modal-sub" style="padding:14px 8px;">No hay ejercicios registrados para este grupo en este día.</td></tr>`;
    return;
  }
  box.innerHTML = exercises.map(ex => `
      <tr>
        <td class="name">${escapeHtml(ex.name)}</td>
        <td class="num">${escapeHtml(ex.sets)}</td>
        <td class="muted">${escapeHtml(ex.reps)}</td>
        <td class="muted">${escapeHtml(ex.load)}</td>
        <td class="muted">${escapeHtml(ex.rest || '—')}</td>
      </tr>
    `).join('');
}

// Trae la rutina guardada en Supabase (si ya se ha subido algún PDF esta semana).
// Si no hay ninguna todavía, gymWeeklyRoutine se queda en null (sin rutina).
async function loadGymWeeklyRoutine(){
  const { data, error } = await supabaseClient
    .from('gym_weekly_routine')
    .select('*')
    .eq('id', 'current')
    .maybeSingle();
  if(error){
    console.error('No se ha podido cargar la rutina semanal desde Supabase', error);
    return;
  }
  gymWeeklyRoutine = (data && data.days && data.days.length)
    ? { weekLabel: data.week_label, days: data.days || [], updatedAt: data.updated_at || data.created_at || null }
    : null;
  renderGymRoutine();
  // Si la rutina cargada ya pasó de su domingo a las 23:59, se archiva sola antes
  // de mostrar nada, para que la pantalla pida la rutina de la semana nueva.
  checkAndArchiveGymRoutineIfExpired();
}

// Cualquier cambio en la rutina semanal (PDF subido, "cargar última rutina" o el
// archivado automático del domingo) se recarga aquí al momento en todas las cuentas
// que tengan la app abierta, sin tener que refrescar la página.
function subscribeToGymRoutineRealtime(){
  supabaseClient
    .channel('gym-routine-sync')
    .on('postgres_changes', { event:'*', schema:'public', table:'gym_weekly_routine' }, () => loadGymWeeklyRoutine())
    .subscribe();
}

// ---- Archivado automático de la rutina cada domingo a las 23:59 ----
// No hay ningún cron en el servidor: el archivado se comprueba cada vez que la app
// carga la rutina (al iniciar sesión, o al entrar en "Mi Entrenamiento"). Si nadie
// abre la app justo el domingo por la noche, se archivará en cuanto alguien la abra
// después, que es el comportamiento normal para una app sin backend con cron propio.

// Devuelve el domingo a las 23:59:59 (hora local) de la semana que contiene "date".
function sundayCutoffOfWeek(date){
  const d = new Date(date);
  const day = d.getDay(); // 0 = domingo ... 6 = sábado
  const diffToSunday = (7 - day) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToSunday, 23, 59, 59, 999);
}

let gymRoutineArchiveCheckInFlight = false;
async function checkAndArchiveGymRoutineIfExpired(){
  if(gymRoutineArchiveCheckInFlight) return;
  if(!gymWeeklyRoutine || !gymWeeklyRoutine.days || !gymWeeklyRoutine.days.length) return;
  if(!gymWeeklyRoutine.updatedAt) return; // sin fecha no sabemos de qué semana es: no se toca

  const cutoff = sundayCutoffOfWeek(new Date(gymWeeklyRoutine.updatedAt));
  if(new Date() <= cutoff) return; // esta rutina todavía no ha llegado a su domingo 23:59

  gymRoutineArchiveCheckInFlight = true;
  try{
    const { error: insertError } = await supabaseClient.from('gym_weekly_routine_archive').insert({
      week_label: gymWeeklyRoutine.weekLabel,
      days: gymWeeklyRoutine.days,
      archived_at: new Date().toISOString()
    });
    if(insertError){
      console.error('No se ha podido archivar la rutina de la semana pasada', insertError);
      return;
    }
    const { error: clearError } = await supabaseClient.from('gym_weekly_routine')
      .update({ week_label: null, days: [] })
      .eq('id', 'current');
    if(clearError) console.error('No se ha podido vaciar la rutina actual tras archivarla', clearError);

    gymWeeklyRoutine = null;
    renderGymRoutine();
  } finally {
    gymRoutineArchiveCheckInFlight = false;
  }
}

// ---- Panel 1: menú "más opciones" de la rutina (cargar última / ver antiguas) ----
function toggleGymRoutineMoreMenu(e){
  if(e) e.stopPropagation();
  const menu = document.getElementById('gym-routine-more-menu');
  if(menu) menu.classList.toggle('open');
}
function closeGymRoutineMoreMenu(){
  const menu = document.getElementById('gym-routine-more-menu');
  if(menu) menu.classList.remove('open');
}
// Cierra el desplegable de "más opciones" de la rutina si se hace clic fuera de él.
document.addEventListener('click', function(e){
  const wrap = document.getElementById('gym-routine-more');
  if(wrap && !wrap.contains(e.target)) closeGymRoutineMoreMenu();
});

// Vuelve a poner como rutina "current" la última rutina que se archivó (útil cuando
// una rutina dura dos semanas y no hace falta subir el PDF otra vez).
async function loadLastGymRoutine(){
  closeGymRoutineMoreMenu();
  const btn = document.getElementById('gym-routine-more-btn');
  if(btn) btn.disabled = true;
  try{
    const { data, error } = await supabaseClient
      .from('gym_weekly_routine_archive')
      .select('*')
      .order('archived_at', { ascending:false })
      .limit(1)
      .maybeSingle();
    if(error){
      console.error('No se ha podido leer el archivo de rutinas', error);
      alert('No se ha podido cargar la última rutina archivada.');
      return;
    }
    if(!data){
      alert('Todavía no hay ninguna rutina archivada.');
      return;
    }
    const { error: updateError } = await supabaseClient.from('gym_weekly_routine')
      .update({ week_label: data.week_label, days: data.days || [] })
      .eq('id', 'current');
    if(updateError){
      console.error('No se ha podido restaurar la rutina archivada', updateError);
      alert('No se ha podido cargar la última rutina.');
      return;
    }
    gymWeeklyRoutine = { weekLabel: data.week_label, days: data.days || [], updatedAt: new Date().toISOString() };
    renderGymRoutine();
  } finally {
    if(btn) btn.disabled = false;
  }
}

// Abre en una pestaña nueva un documento autocontenido con todas las rutinas
// archivadas, ordenadas de la más nueva a la más antigua.
async function openGymRoutineArchiveTab(){
  closeGymRoutineMoreMenu();
  const { data, error } = await supabaseClient
    .from('gym_weekly_routine_archive')
    .select('*')
    .order('archived_at', { ascending:false });
  if(error){
    console.error('No se ha podido leer el archivo de rutinas', error);
    alert('No se ha podido abrir el histórico de rutinas.');
    return;
  }
  if(!data || !data.length){
    alert('Todavía no hay ninguna rutina archivada.');
    return;
  }
  const html = buildGymRoutineArchiveHtml(data);
  const blob = new Blob([html], { type:'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

function formatGymArchivedAt(iso){
  if(!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day:'2-digit', month:'long', year:'numeric' });
}

function buildGymRoutineArchiveHtml(rows){
  const weeksHtml = rows.map(row => {
    const days = row.days || [];
    const daysHtml = days.map((d, i) => {
      const groupSplit = typeof d.group_split === 'boolean' ? d.group_split : false;
      const groupsToShow = groupSplit ? [['Forwards', 'forwards'], ['Backs', 'backs']] : [[null, 'forwards']];
      const tablesHtml = groupsToShow.map(([label, group]) => {
        const exercises = gymRoutineDayExercisesForGroup(d, group);
        return `
            ${label ? `<div class="group-label">${escapeHtml(label)}</div>` : ''}
            <table>
              <thead><tr><th>Ejercicio</th><th>Series</th><th>Repeticiones</th><th>Carga</th><th>Descanso</th></tr></thead>
              <tbody>
                ${exercises.length ? exercises.map(ex => `
                  <tr><td>${escapeHtml(ex.name)}</td><td>${escapeHtml(ex.sets)}</td><td>${escapeHtml(ex.reps)}</td><td>${escapeHtml(ex.load)}</td><td>${escapeHtml(ex.rest || '—')}</td></tr>
                `).join('') : `<tr><td colspan="5" class="empty">Sin ejercicios registrados.</td></tr>`}
              </tbody>
            </table>
          `;
      }).join('');
      return `
          <div class="day">
            <h3>Día ${i + 1}${d.focus || d.day ? ' · ' + escapeHtml(d.focus || d.day) : ''}</h3>
            ${tablesHtml}
          </div>
        `;
    }).join('');
    return `
        <section class="week">
          <h2>${escapeHtml(row.week_label || 'Semana sin etiqueta')}</h2>
          <div class="week-meta">Archivada el ${escapeHtml(formatGymArchivedAt(row.archived_at))}</div>
          ${daysHtml || '<p class="empty">Sin días registrados.</p>'}
        </section>
      `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Rutinas antiguas — CN Peñas</title>
<style>
  body{ font-family:'Roboto',Arial,sans-serif; background:#F4F6F9; color:#1C2B3A; margin:0; padding:24px; }
  h1{ font-family:'Oswald',Arial,sans-serif; text-transform:uppercase; margin:0 0 20px; }
  .week{ background:#fff; border-radius:14px; padding:20px 22px; margin-bottom:20px; box-shadow:0 2px 10px rgba(20,30,50,.08); }
  .week h2{ margin:0 0 4px; font-size:18px; text-transform:uppercase; }
  .week-meta{ font-size:12.5px; color:#66748C; margin-bottom:14px; }
  .day{ margin-bottom:16px; }
  .day h3{ font-size:13.5px; text-transform:uppercase; margin:0 0 8px; color:#66748C; }
  .group-label{ font-size:11px; font-weight:700; text-transform:uppercase; color:#3E7CB1; margin:8px 0 4px; }
  table{ width:100%; border-collapse:collapse; margin-bottom:6px; }
  th, td{ text-align:left; padding:7px 8px; border-bottom:1px solid #E3E8EF; font-size:13px; }
  th{ color:#66748C; font-weight:600; text-transform:uppercase; font-size:11px; }
  .empty{ color:#66748C; font-size:13px; font-style:italic; }

  </style>
</head>
<body>
  <h1>Rutinas antiguas</h1>
  ${weeksHtml}
</body>
</html>`;
}

// ---- Panel 1: subir el PDF de la rutina (lo procesa la función Edge con Gemini) ----
function openGymRoutineUploadModal(){
  document.getElementById('gym-routine-pdf-input').value = '';
  document.getElementById('gym-routine-upload-status').textContent = '';
  document.getElementById('gym-routine-upload-modal').classList.add('active');
}
function closeGymRoutineUploadModal(){
  document.getElementById('gym-routine-upload-modal').classList.remove('active');
}
async function uploadGymRoutinePdf(){
  const fileInput = document.getElementById('gym-routine-pdf-input');
  const statusBox = document.getElementById('gym-routine-upload-status');
  const submitBtn = document.getElementById('gym-routine-upload-submit-btn');
  const cancelBtn = document.getElementById('gym-routine-upload-cancel-btn');
  const file = fileInput.files && fileInput.files[0];

  if(!file){
    statusBox.textContent = 'Elige primero un archivo PDF.';
    statusBox.style.color = 'var(--bad)';
    return;
  }

  submitBtn.disabled = true;
  cancelBtn.disabled = true;
  statusBox.style.color = 'var(--text-muted)';
  statusBox.textContent = 'Subiendo y leyendo el PDF con Gemini… puede tardar unos segundos.';

  try{
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const accessToken = sessionData && sessionData.session ? sessionData.session.access_token : null;
    if(!accessToken){
      statusBox.style.color = 'var(--bad)';
      statusBox.textContent = 'Tu sesión ha caducado, vuelve a iniciar sesión e inténtalo de nuevo.';
      return;
    }

    const form = new FormData();
    form.append('pdf', file);

    const res = await fetch(`${SUPABASE_URL}/functions/v1/process-gym-routine-pdf`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form
    });
    const result = await res.json();

    if(!res.ok || result.error){
      statusBox.style.color = 'var(--bad)';
      statusBox.textContent = result.error || 'No se ha podido procesar el PDF.';
      return;
    }

    gymWeeklyRoutine = { weekLabel: result.routine.week_label, days: result.routine.days || [], updatedAt: new Date().toISOString() };
    renderGymRoutine();
    statusBox.style.color = 'var(--ok)';
    statusBox.textContent = '¡Rutina actualizada! Cerrando…';
    setTimeout(closeGymRoutineUploadModal, 900);
  }catch(e){
    statusBox.style.color = 'var(--bad)';
    statusBox.textContent = 'Error al subir el PDF: ' + e.message;
  }finally{
    submitBtn.disabled = false;
    cancelBtn.disabled = false;
  }
}

// ---- Panel 1: calculadora rápida (ejercicio + % → peso, leyendo el RM del perfil) ----
const gymQuickCalcPercents = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50];

function renderGymQuickCalcSelectors(){
  const exerciseSel = document.getElementById('gym-quick-calc-exercise');
  const pctSel = document.getElementById('gym-quick-calc-pct');
  if(!exerciseSel || !pctSel) return;

  const prevExercise = exerciseSel.value;
  exerciseSel.innerHTML = '<option value="">Elige un ejercicio</option>' +
    gymAllExercises().map(ex => `<option value="${escapeHtml(ex)}">${escapeHtml(ex)}</option>`).join('');
  if(gymAllExercises().includes(prevExercise)) exerciseSel.value = prevExercise;

  if(!pctSel.options.length){
    pctSel.innerHTML = '<option value="">%</option>' +
      gymQuickCalcPercents.map(pct => `<option value="${pct}">${pct}%</option>`).join('');
  }
}

// Redondea al medio kilo más cercano (el incremento habitual al cargar discos en barra).
function roundGymWeight(kg){
  return Math.round(kg / 0.5) * 0.5;
}

// Devuelve la jugadora sobre la que está calculando ahora mismo la calculadora
// rápida: la seleccionada manualmente, o si no hay ninguna, la jugadora logeada.
function gymQuickCalcSelectedPlayer(){
  return (gymQuickCalcPlayerId && rosterById[gymQuickCalcPlayerId]) || rosterById[currentUserId];
}

function toggleGymQuickCalcPlayerMenu(e){
  if(e) e.stopPropagation();
  const menu = document.getElementById('gym-quick-calc-player-menu');
  if(!menu) return;
  const willOpen = !menu.classList.contains('open');
  if(willOpen) renderGymQuickCalcPlayerMenu();
  menu.classList.toggle('open', willOpen);
}
function closeGymQuickCalcPlayerMenu(){
  const menu = document.getElementById('gym-quick-calc-player-menu');
  if(menu) menu.classList.remove('open');
}
// Cierra el desplegable de "cambiar jugadora" de la calculadora rápida si se hace
// clic fuera de él.
document.addEventListener('click', function(e){
  const wrap = document.getElementById('gym-quick-calc-player');
  if(wrap && !wrap.contains(e.target)) closeGymQuickCalcPlayerMenu();
});

function renderGymQuickCalcPlayerMenu(){
  const menu = document.getElementById('gym-quick-calc-player-menu');
  if(!menu) return;
  const selectedId = gymQuickCalcPlayerId || currentUserId;
  menu.innerHTML = roster.map(p => `
      <button type="button" class="gym-quick-calc-player-option${p.id === selectedId ? ' selected' : ''}" onclick="selectGymQuickCalcPlayer('${p.id}')">
        <span>${escapeHtml(displayName(p))}</span>
        ${p.id === selectedId ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>' : ''}
      </button>
    `).join('');
}

function selectGymQuickCalcPlayer(playerId){
  gymQuickCalcPlayerId = (playerId === currentUserId) ? null : playerId;
  closeGymQuickCalcPlayerMenu();
  calculateGymQuickRm();
}

function renderGymQuickCalcPlayerBadge(){
  const badge = document.getElementById('gym-quick-calc-player-badge');
  if(!badge) return;
  const player = gymQuickCalcSelectedPlayer();
  if(!player || player.id === currentUserId){
    badge.style.display = 'none';
    badge.innerHTML = '';
    return;
  }
  badge.style.display = 'inline-flex';
  badge.innerHTML = `
      <span>Calculando la marca de <b>${escapeHtml(displayName(player))}</b></span>
      <button type="button" onclick="selectGymQuickCalcPlayer('${currentUserId}')" aria-label="Volver a tu calculadora" title="Volver a tu calculadora">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    `;
}

// Vacía la calculadora rápida (sin ejercicio ni % elegidos, sin marca de compañera
// seleccionada, y sin resultado). Se llama al salir del detalle de un día del Gym,
// igual que la calculadora avanzada. Si ya está vacía, no toca nada.
function resetGymQuickCalc(){
  const exerciseSel = document.getElementById('gym-quick-calc-exercise');
  const pctSel = document.getElementById('gym-quick-calc-pct');
  const box = document.getElementById('gym-quick-calc-result');
  const badge = document.getElementById('gym-quick-calc-player-badge');
  if(!exerciseSel || !pctSel || !box) return;

  const alreadyEmpty = !gymQuickCalcPlayerId && exerciseSel.value === '' && pctSel.value === '' &&
    box.innerHTML === '' && (!badge || badge.style.display === 'none');
  if(alreadyEmpty) return;

  gymQuickCalcPlayerId = null;
  closeGymQuickCalcPlayerMenu();
  exerciseSel.value = '';
  pctSel.value = '';
  box.innerHTML = '';
  if(badge){ badge.style.display = 'none'; badge.innerHTML = ''; }
}

function calculateGymQuickRm(){
  renderGymQuickCalcSelectors();
  renderGymQuickCalcPlayerBadge();
  const exerciseSel = document.getElementById('gym-quick-calc-exercise');
  const pctSel = document.getElementById('gym-quick-calc-pct');
  const box = document.getElementById('gym-quick-calc-result');
  if(!exerciseSel || !pctSel || !box) return;

  const exercise = exerciseSel.value;
  const pctRaw = pctSel.value;
  if(!exercise || pctRaw === ''){
    box.innerHTML = `<div class="gym-quick-calc-empty">Elige un ejercicio y un % para calcular.</div>`;
    return;
  }
  const pct = parseFloat(pctRaw);
  const player = gymQuickCalcSelectedPlayer();
  const isMe = !player || player.id === currentUserId;
  const record = player && player.rm ? player.rm[exercise] : null;

  if(!record){
    box.innerHTML = isMe ? `
        <div class="gym-quick-calc-empty">
          Todavía no tienes una marca (1RM) registrada para <b>${escapeHtml(exercise)}</b>.
          <a onclick="goToGymMarks()">Regístrala en Mis Marcas ›</a>
        </div>
      ` : `
        <div class="gym-quick-calc-empty">
          <b>${escapeHtml(displayName(player))}</b> todavía no tiene una marca (1RM) registrada para <b>${escapeHtml(exercise)}</b>.
        </div>
      `;
    return;
  }

  const raw = record.weight * pct / 100;
  const rounded = roundGymWeight(raw);

  box.innerHTML = `
      <div class="gym-quick-calc-out">
        <span class="pct">${pct}% de ${isMe ? 'tu' : `la de ${escapeHtml(displayName(player))}`} ${escapeHtml(exercise)}</span>
        <span class="kg">${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)} kg</span>
        <span class="raw">Exacto: ${raw.toFixed(1)} kg · ${isMe ? 'tu marca' : 'su marca'}: ${record.weight} kg</span>
      </div>
    `;
}

// Muestra/oculta el banner de la calculadora de %RM avanzada (tabla completa a
// partir de un 1RM conocido, o de un peso + repeticiones vía fórmula de Epley).
function toggleGymRmCalcBanner(){
  const banner = document.getElementById('gym-rm-calc-banner');
  if(!banner) return;
  const isHidden = banner.style.display === 'none' || !banner.style.display;
  banner.style.display = isHidden ? 'block' : 'none';
}
function closeGymRmCalcBanner(){
  const banner = document.getElementById('gym-rm-calc-banner');
  if(banner) banner.style.display = 'none';
}
// Vacía la calculadora de %RM avanzada (inputs + resultado + banner abierto). Se
// llama al salir del detalle de un día del Gym, para que no arrastre valores de un
// ejercicio a otro. Si ya está vacía y cerrada, no toca nada.
function resetGymRmCalcBanner(){
  const oneRmInput = document.getElementById('gym-calc-1rm');
  const weightInput = document.getElementById('gym-calc-weight');
  const repsInput = document.getElementById('gym-calc-reps');
  const banner = document.getElementById('gym-rm-calc-banner');
  const resultBox = document.getElementById('gym-rm-calc-result');
  if(!oneRmInput || !weightInput || !repsInput || !banner || !resultBox) return;

  const isOpen = banner.style.display === 'block';
  const hasValues = oneRmInput.value !== '' || weightInput.value !== '' || repsInput.value !== '';
  const hasResult = resultBox.innerHTML !== '';
  if(!isOpen && !hasValues && !hasResult) return;

  oneRmInput.value = '';
  weightInput.value = '';
  repsInput.value = '';
  resultBox.innerHTML = '';
  banner.style.display = 'none';
}

// ---- Panel 1: calculadora de %RM (tabla completa) ----
function calculateGymRmTable(){
  const oneRmInput = parseFloat(document.getElementById('gym-calc-1rm').value);
  const weight = parseFloat(document.getElementById('gym-calc-weight').value);
  const reps = parseFloat(document.getElementById('gym-calc-reps').value);
  const box = document.getElementById('gym-rm-calc-result');

  let oneRm = oneRmInput;
  if(!oneRm && weight && reps){
    // Fórmula de Epley: 1RM = peso × (1 + repeticiones / 30)
    oneRm = weight * (1 + reps / 30);
  }
  if(!oneRm || oneRm <= 0){
    box.innerHTML = `<div class="modal-sub" style="margin-top:12px;">Escribe tu 1RM, o un peso y unas repeticiones, para calcularlo.</div>`;
    return;
  }

  const percentages = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50];
  box.innerHTML = `
      <table class="gym-rm-calc-table">
        ${percentages.map(pct => `
          <tr class="${pct === 100 ? 'gym-rm-100' : ''}">
            <td class="pct">${pct}%</td>
            <td class="kg">${(oneRm * pct / 100).toFixed(1)} kg</td>
          </tr>
        `).join('')}
      </table>
    `;
}

// ---- Panel 2: mis marcas (1RM) ----
// "Mis Marcas" vive ahora dentro de "Mi Entrenamiento" (debajo de la rutina), así que
// el enlace desde la calculadora rápida vuelve a esa pantalla y baja hasta la tabla.
function goToGymMarks(){
  setSection('gym-entrenamiento');
  const el = document.getElementById('gym-marks-section');
  if(el) setTimeout(() => el.scrollIntoView({ behavior:'smooth', block:'start' }), 50);
}
// Lista de ejercicios que ve esta persona en "Mis Marcas": los principales de
// siempre (fijos) + los generales que haya añadido entrenador/a o admin (visibles
// para todo el equipo) + los que ella misma se haya creado como privados (solo
// pueden aparecer aquí los suyos: la política RLS de "gym_rm" impide que le lleguen
// marcas de ejercicios privados de otras personas).
function gymAllExercises(){
  const seen = new Set();
  const list = [];
  gymMainExercises.forEach(name => {
    const key = name.toLowerCase();
    if(gymRemovedDefaultExercises.has(key)) return; // entrenador/a o admin lo eliminó para todo el equipo
    if(!seen.has(key)){ seen.add(key); list.push(name); }
  });
  gymExercises.forEach(row => {
    const key = row.name.toLowerCase();
    if(!seen.has(key)){ seen.add(key); list.push(row.name); }
  });
  const me = rosterById[currentUserId];
  if(me && me.rm){
    Object.keys(me.rm).forEach(name => {
      const key = name.toLowerCase();
      if(!seen.has(key)){ seen.add(key); list.push(name); }
    });
  }
  return list;
}

// Lista de ejercicios para el selector del ránking del equipo: solo los generales
// (fijos + los que haya añadido entrenador/a o admin). Los privados de cada jugadora
// no entran en el ránking a propósito, porque solo ella tiene datos para compararlos.
function gymRankingExercises(){
  const seen = new Set();
  const list = [];
  gymMainExercises.forEach(name => {
    const key = name.toLowerCase();
    if(gymRemovedDefaultExercises.has(key)) return;
    if(!seen.has(key)){ seen.add(key); list.push(name); }
  });
  gymExercises.forEach(row => {
    const key = row.name.toLowerCase();
    if(!seen.has(key)){ seen.add(key); list.push(row.name); }
  });
  return list;
}

// Un ejercicio se puede borrar desde "Mis Marcas" siempre, pero quién puede hacerlo
// depende de qué tipo es: los cinco fijos y los generales (los añadió entrenador/a o
// admin) solo los puede borrar entrenador/a o admin, porque afecta a todo el equipo.
// Si no aparece ni en los fijos ni en el catálogo general, es un ejercicio privado —
// y si aparece en tu lista es porque lo creaste tú, así que puedes borrarlo tú misma.
function gymExerciseDeletable(name){
  const key = name.toLowerCase();
  const isFixed = gymMainExercises.some(ex => ex.toLowerCase() === key);
  if(isFixed) return canManageGeneralExercises();
  const isGeneral = gymExercises.some(ex => ex.name.toLowerCase() === key);
  if(isGeneral) return canManageGeneralExercises();
  return true;
}

let gymRmModalExercise = null;
function renderGymMarks(){
  const me = rosterById[currentUserId];
  const body = document.getElementById('gym-marks-table-body');
  body.innerHTML = gymAllExercises().map(exercise => {
    const record = me && me.rm ? me.rm[exercise] : null;
    const deletable = gymExerciseDeletable(exercise);
    return `
        <tr>
          <td>${escapeHtml(exercise)}</td>
          <td>${record ? `<b>${record.weight} kg</b>` : '<span class="no-rm">Sin registrar</span>'}</td>
          <td>${record ? formatShortDate(record.updatedAt) : '—'}</td>
          <td>
            <div class="actions-cell">
              <button class="history-btn" onclick="openGymRmHistoryModal('${exercise.replace(/'/g, "\\'")}')" aria-label="Ver histórico" title="Ver histórico">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 3h7l4 4v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M14 3v4a1 1 0 001 1h4"/><path d="M9 13h6M9 17h6M9 9h2"/></svg>
              </button>
              <button class="edit-btn" onclick="openGymRmModal('${exercise.replace(/'/g, "\\'")}')" aria-label="Registrar marca" title="Registrar marca">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
              </button>
              ${deletable ? `
              <button class="del-btn" onclick="deleteGymExercise('${exercise.replace(/'/g, "\\'")}')" aria-label="Eliminar ejercicio" title="Eliminar ejercicio">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
              </button>` : ''}
            </div>
          </td>
        </tr>
      `;
  }).join('') + `
      <tr class="gym-add-exercise-row">
        <td><input type="text" id="gym-new-exercise-name" placeholder="Nuevo ejercicio…" onkeydown="if(event.key==='Enter'){ event.preventDefault(); document.getElementById('gym-new-exercise-weight').focus(); }"></td>
        <td><input type="number" class="weight-input" id="gym-new-exercise-weight" placeholder="${canManageGeneralExercises() ? 'Kg (opcional)' : 'Kg'}" min="0" step="0.5" onkeydown="if(event.key==='Enter'){ event.preventDefault(); addGymCustomExercise(); }"></td>
        <td></td>
        <td>
          <button class="treasury-add-btn" onclick="addGymCustomExercise()" aria-label="Añadir ejercicio" title="Añadir ejercicio">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </td>
      </tr>
    `;
}
function openGymRmModal(exercise){
  gymRmModalExercise = exercise;
  const me = rosterById[currentUserId];
  const record = me && me.rm ? me.rm[exercise] : null;
  document.getElementById('gym-rm-modal-title').textContent = exercise;
  document.getElementById('gym-rm-input').value = record ? record.weight : '';
  document.getElementById('gym-rm-modal').classList.add('active');
}
function closeGymRmModal(){
  document.getElementById('gym-rm-modal').classList.remove('active');
}
// Guarda una marca (1RM) en Supabase (tabla "gym_rm") para que el ranking del equipo
// vea siempre el dato real, no solo lo que quede en memoria de esta pestaña.
// Guarda una marca (1RM) en Supabase: la tabla "gym_rm" mantiene la marca actual
// (una fila por profile_id+exercise) y "gym_rm_history" acumula un registro por
// cada vez que se guarda, para poder consultar la evolución en el histórico.
async function persistGymRm(exercise, weight, updatedAt){
  if(!currentAuthUserId) return;
  const nowIso = new Date().toISOString();
  const { error } = await supabaseClient.from('gym_rm').upsert({
    profile_id: currentAuthUserId,
    exercise,
    weight,
    updated_at: nowIso
  }, { onConflict: 'profile_id,exercise' });
  if(error) console.error('No se ha podido guardar la marca en Supabase', error);

  const { error: historyError } = await supabaseClient.from('gym_rm_history').insert({
    profile_id: currentAuthUserId,
    exercise,
    weight,
    recorded_at: nowIso
  });
  if(historyError) console.error('No se ha podido guardar el histórico de la marca', historyError);
}
// Guarda también una copia en memoria del histórico, para poder mostrarla al
// momento en el modal aunque todavía no se haya recargado desde Supabase.
function pushGymRmHistoryLocal(me, exercise, weight, updatedAt){
  if(!me.rmHistory) me.rmHistory = {};
  if(!me.rmHistory[exercise]) me.rmHistory[exercise] = [];
  me.rmHistory[exercise].unshift({ weight, updatedAt });
}
async function saveGymRm(){
  const weight = parseFloat(document.getElementById('gym-rm-input').value);
  if(isNaN(weight) || weight < 0){
    alert('Escribe un peso válido (puede ser 0).');
    return;
  }
  const exercise = gymRmModalExercise;
  const updatedAt = todayLocalIso();
  const me = rosterById[currentUserId];
  if(!me.rm) me.rm = {};
  me.rm[exercise] = { weight, updatedAt };
  pushGymRmHistoryLocal(me, exercise, weight, updatedAt);
  closeGymRmModal();
  renderGymMarks();
  calculateGymQuickRm();
  renderGymRankingExerciseOptions();
  renderGymRanking();
  await persistGymRm(exercise, weight, updatedAt);
}
// Añade un ejercicio entero desde la fila vacía del final de la tabla. Si quien lo
// añade es entrenador/a o admin, el peso es OPCIONAL: puede crear el ejercicio para
// todo el equipo sin registrar su propia marca todavía (cada jugadora la registrará
// cuando quiera). Si lo añade cualquier otra persona, se guarda como marca privada
// suya (nadie más lo ve) y en ese caso el peso sigue siendo obligatorio, porque no
// tendría sentido crear una marca personal sin marca.
async function addGymCustomExercise(){
  const nameInput = document.getElementById('gym-new-exercise-name');
  const weightInput = document.getElementById('gym-new-exercise-weight');
  const name = nameInput.value.trim();
  const weightRaw = weightInput.value.trim();
  const isManager = canManageGeneralExercises();

  if(!name){
    alert('Escribe el nombre del ejercicio.');
    nameInput.focus();
    return;
  }

  let weight = null;
  if(weightRaw !== ''){
    weight = parseFloat(weightRaw);
    if(isNaN(weight) || weight < 0){
      alert('Escribe un peso válido (puede ser 0), o déjalo en blanco.');
      weightInput.focus();
      return;
    }
  } else if(!isManager){
    alert('Escribe un peso válido (puede ser 0).');
    weightInput.focus();
    return;
  }

  // Si ya existe un ejercicio con ese nombre (sin distinguir mayúsculas), se
  // actualiza su marca en vez de crear uno duplicado.
  const existing = gymAllExercises().find(ex => ex.toLowerCase() === name.toLowerCase());
  const exercise = existing || name;

  if(!existing && isManager){
    const { data, error } = await supabaseClient
      .from('gym_exercises')
      .insert({ name: exercise, created_by: currentAuthUserId })
      .select()
      .single();
    if(error){
      console.error('No se pudo añadir el ejercicio general', error);
      alert('No se ha podido añadir el ejercicio. Inténtalo de nuevo.');
      return;
    }
    gymExercises.push(data);
    renderGymRankingExerciseOptions();
    renderGymRanking();
  }

  nameInput.value = '';
  weightInput.value = '';

  // Ejercicio creado sin marca (solo puede pasar si es entrenador/a o admin): se
  // deja aquí, sin guardar ninguna marca todavía.
  if(weight === null){
    renderGymMarks();
    calculateGymQuickRm();
    return;
  }

  const updatedAt = todayLocalIso();
  const me = rosterById[currentUserId];
  if(!me.rm) me.rm = {};
  me.rm[exercise] = { weight, updatedAt };
  pushGymRmHistoryLocal(me, exercise, weight, updatedAt);
  renderGymMarks();
  calculateGymQuickRm();
  renderGymRankingExerciseOptions();
  renderGymRanking();
  await persistGymRm(exercise, weight, updatedAt);
}

// Elimina un ejercicio de "Mis Marcas". Si es uno de los cinco fijos, se guarda su
// eliminación en "gym_removed_default_exercises" para que desaparezca de verdad y en
// todas las cuentas. Si era general (lo añadió entrenador/a o admin) se quita del
// catálogo compartido "gym_exercises". En cualquier caso se borra también tu propia
// marca guardada (la de otras jugadoras, si la hubiera, no se toca).
async function deleteGymExercise(name){
  if(!gymExerciseDeletable(name)) return;

  const key = name.toLowerCase();
  const isFixed = gymMainExercises.some(ex => ex.toLowerCase() === key);
  const generalRow = gymExercises.find(ex => ex.name.toLowerCase() === key);

  if(!confirm((isFixed || generalRow)
    ? `¿Eliminar "${name}" para todo el equipo? Dejará de verse en Mis Marcas, la calculadora rápida y el ránking.`
    : `¿Eliminar "${name}" de tus marcas?`
  )) return;

  if(isFixed){
    const { error } = await supabaseClient.from('gym_removed_default_exercises').insert({
      name,
      removed_by: currentAuthUserId
    });
    if(error){
      console.error('No se pudo eliminar el ejercicio fijo', error);
      alert('No se ha podido eliminar. Inténtalo de nuevo.');
      return;
    }
    gymRemovedDefaultExercises.add(key);
    renderGymRankingExerciseOptions();
    renderGymRanking();
  } else if(generalRow){
    const { error } = await supabaseClient.from('gym_exercises').delete().eq('id', generalRow.id);
    if(error){
      console.error('No se pudo eliminar el ejercicio', error);
      alert('No se ha podido eliminar. Inténtalo de nuevo.');
      return;
    }
    gymExercises = gymExercises.filter(ex => ex.id !== generalRow.id);
    renderGymRankingExerciseOptions();
    renderGymRanking();
  }

  const me = rosterById[currentUserId];
  if(me && me.rm) delete me.rm[name];
  if(me && me.rmHistory) delete me.rmHistory[name];
  renderGymMarks();
  calculateGymQuickRm();

  if(currentAuthUserId){
    await supabaseClient.from('gym_rm').delete().eq('profile_id', currentAuthUserId).eq('exercise', name);
    await supabaseClient.from('gym_rm_history').delete().eq('profile_id', currentAuthUserId).eq('exercise', name);
  }
}

// ---- Panel 2: histórico de marcas de un ejercicio ----
let gymRmHistoryExercise = null;
function openGymRmHistoryModal(exercise){
  gymRmHistoryExercise = exercise;
  document.getElementById('gym-rm-history-modal-title').textContent = 'Histórico — ' + exercise;
  document.getElementById('gym-rm-history-list').innerHTML = `<div class="gym-rm-history-loading">Cargando histórico…</div>`;
  document.getElementById('gym-rm-history-modal').classList.add('active');
  loadGymRmHistory(exercise);
}
function closeGymRmHistoryModal(){
  document.getElementById('gym-rm-history-modal').classList.remove('active');
  gymRmHistoryExercise = null;
}
async function loadGymRmHistory(exercise){
  const me = rosterById[currentUserId];
  let entries = [];
  let historyLoadFailed = false;

  if(currentAuthUserId){
    const { data, error } = await supabaseClient.from('gym_rm_history')
      .select('weight, recorded_at')
      .eq('profile_id', currentAuthUserId)
      .eq('exercise', exercise)
      .order('recorded_at', { ascending:false });
    if(error){
      console.error('No se ha podido cargar el histórico de la marca', error);
      historyLoadFailed = true;
    }
    else if(data && data.length){
      entries = data.map(row => ({ weight: row.weight, updatedAt: row.recorded_at ? row.recorded_at.slice(0, 10) : '' }));
    }
  }
  // Si Supabase no tiene histórico todavía (o no hay conexión), se usa lo que
  // haya en memoria de esta sesión, y si tampoco hay nada, al menos la marca actual.
  if(!entries.length && me && me.rmHistory && me.rmHistory[exercise] && me.rmHistory[exercise].length){
    entries = me.rmHistory[exercise];
  }
  if(!entries.length){
    const current = me && me.rm ? me.rm[exercise] : null;
    if(current) entries = [current];
  }

  // El usuario puede haber cerrado el modal o abierto otro ejercicio mientras
  // se esperaba la respuesta de Supabase.
  if(gymRmHistoryExercise !== exercise) return;

  const list = document.getElementById('gym-rm-history-list');
  if(!entries.length){
    list.innerHTML = `<div class="gym-rm-history-empty">Todavía no hay marcas registradas para este ejercicio.</div>`;
    return;
  }
  // Si la consulta a Supabase ha fallado, se avisa de que lo que se ve aquí no es
  // el histórico completo (para no confundirlo con "solo has hecho una marca").
  const warningHtml = historyLoadFailed
    ? `<div class="gym-rm-history-empty" style="color:var(--bad); padding:0 2px 12px; text-align:left;">No se ha podido traer el histórico completo desde Supabase — se muestra solo lo guardado en esta sesión.</div>`
    : '';
  list.innerHTML = warningHtml + `<div class="gym-rm-history-list-inner">` + entries.map((e, i) => `
      <div class="gym-rm-history-row${i === 0 ? ' latest' : ''}">
        <span class="w">${e.weight} kg</span>
        <span class="d">${e.updatedAt ? formatShortDate(e.updatedAt) : '—'}</span>
      </div>
    `).join('') + `</div>`;
}

// ---- Panel 3: asistencia al gimnasio hoy ----
// Se guarda en Supabase (tabla "gym_attendance": profile_id + fecha + hora, con
// una fila por persona y día) para que quede sincronizada al momento en todas las
// cuentas, igual que las marcas y la rutina semanal.
function renderGymAttendanceToday(){
  const todayIso = todayLocalIso();
  const entries = (gymAttendanceByDate[todayIso] || []).slice().sort((a, b) => a.time.localeCompare(b.time));
  const box = document.getElementById('gym-attendance-today');
  const me = rosterById[currentUserId];
  const myEntry = entries.find(e => e.playerId === currentUserId);

  document.getElementById('gym-checkin-btn').style.display = myEntry ? 'none' : 'flex';

  if(!entries.length){
    box.innerHTML = `<div class="att-roster-empty">Todavía no se ha apuntado nadie hoy.</div>`;
    return;
  }
  box.innerHTML = entries.map(e => {
    const p = rosterById[e.playerId];
    if(!p) return '';
    return `
        <div class="gym-attendee-row">
          <span class="avatar">${avatarHtml(p.avatarUrl, initials(displayName(p)), p.injured, p.injuryIcon)}</span>
          <div class="meta"><b>${escapeHtml(displayName(p))}</b></div>
          <span class="time">${e.time}</span>
          ${e.playerId === currentUserId ? `
            <button class="cancel-btn" onclick="cancelGymCheckin()" aria-label="Quitarme de hoy" title="Quitarme de hoy">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          ` : ''}
        </div>
      `;
  }).join('');
}
function openGymCheckinModal(){
  const now = new Date();
  document.getElementById('gym-checkin-time-input').value =
    String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  document.getElementById('gym-checkin-modal').classList.add('active');
}
function closeGymCheckinModal(){
  document.getElementById('gym-checkin-modal').classList.remove('active');
}
async function saveGymCheckin(){
  const time = document.getElementById('gym-checkin-time-input').value;
  if(!time){
    alert('Elige una hora.');
    return;
  }
  const todayIso = todayLocalIso();
  if(!gymAttendanceByDate[todayIso]) gymAttendanceByDate[todayIso] = [];
  gymAttendanceByDate[todayIso] = gymAttendanceByDate[todayIso].filter(e => e.playerId !== currentUserId);
  gymAttendanceByDate[todayIso].push({ playerId:currentUserId, time });
  closeGymCheckinModal();
  renderGymAttendanceToday();

  if(currentAuthUserId){
    const { error } = await supabaseClient.from('gym_attendance').upsert({
      profile_id: currentAuthUserId,
      attendance_date: todayIso,
      time
    }, { onConflict: 'profile_id,attendance_date' });
    if(error){
      console.error('No se ha podido guardar tu asistencia al gimnasio en Supabase', error);
      alert('Te has apuntado en la app, pero no se ha podido sincronizar con Supabase: ' + error.message);
    }
  }
}
async function cancelGymCheckin(){
  const todayIso = todayLocalIso();
  if(gymAttendanceByDate[todayIso]){
    gymAttendanceByDate[todayIso] = gymAttendanceByDate[todayIso].filter(e => e.playerId !== currentUserId);
  }
  renderGymAttendanceToday();

  if(currentAuthUserId){
    const { error } = await supabaseClient.from('gym_attendance')
      .delete()
      .eq('profile_id', currentAuthUserId)
      .eq('attendance_date', todayIso);
    if(error){
      console.error('No se ha podido quitar tu asistencia al gimnasio en Supabase', error);
      alert('Te has quitado en la app, pero no se ha podido sincronizar con Supabase: ' + error.message);
    }
  }
}

// Trae quién se ha apuntado hoy al gimnasio desde Supabase. Se llama al iniciar
// sesión y cada vez que se entra en "Equipo", para no depender solo de lo que ya
// hubiera en memoria de esta pestaña.
async function loadGymAttendanceToday(){
  const todayIso = todayLocalIso();
  const { data, error } = await supabaseClient
    .from('gym_attendance')
    .select('*')
    .eq('attendance_date', todayIso);
  if(error){
    console.error('No se han podido cargar las asistencias al gimnasio de hoy', error);
    return;
  }
  gymAttendanceByDate[todayIso] = (data || []).map(row => ({
    playerId: row.profile_id === currentAuthUserId ? 'me' : row.profile_id,
    time: row.time
  }));
  renderGymAttendanceToday();
}

// Cualquier cambio en la asistencia de hoy (alguien se apunta o se quita, desde
// cualquier cuenta) se recarga aquí al momento, sin tener que refrescar la página.
function subscribeToGymAttendanceRealtime(){
  supabaseClient
    .channel('gym-attendance-sync')
    .on('postgres_changes', { event:'*', schema:'public', table:'gym_attendance' }, () => loadGymAttendanceToday())
    .subscribe();
}

// ---- Panel 3: ranking de RM del equipo ----
function renderGymRankingExerciseOptions(){
  const sel = document.getElementById('gym-ranking-exercise');
  const prev = sel.value;
  const all = gymRankingExercises();
  sel.innerHTML = all.map(ex => `<option value="${escapeHtml(ex)}">${escapeHtml(ex)}</option>`).join('');
  if(all.includes(prev)) sel.value = prev;
}
function renderGymRanking(){
  const exercise = document.getElementById('gym-ranking-exercise').value || gymRankingExercises()[0];
  const withRecord = [];
  const without = [];
  roster.forEach(p => {
    const record = p.rm ? p.rm[exercise] : null;
    if(record) withRecord.push({ p, weight:record.weight, updatedAt:record.updatedAt });
    else without.push({ p });
  });
  withRecord.sort((a, b) => b.weight - a.weight);

  const body = document.getElementById('gym-ranking-table-body');
  if(!withRecord.length && !without.length){
    body.innerHTML = `<tr><td colspan="4"><div class="att-roster-empty">Todavía no hay nadie en la plantilla.</div></td></tr>`;
    return;
  }
  const rows = withRecord.map((entry, i) => `
      <tr class="${i === 0 ? 'gym-rank-top' : ''}">
        <td class="rank-cell">${i + 1}</td>
        <td class="player-row"><div class="meta"><b>${escapeHtml(displayName(entry.p))}</b></div></td>
        <td class="weight-cell">${entry.weight} kg</td>
        <td class="updated-cell">${entry.updatedAt ? formatShortDate(entry.updatedAt) : '—'}</td>
      </tr>
    `).join('') + without.map(entry => `
      <tr>
        <td class="rank-cell">—</td>
        <td class="player-row"><div class="meta"><b>${escapeHtml(displayName(entry.p))}</b></div></td>
        <td class="weight-cell no-rm">Sin registrar</td>
        <td class="updated-cell">—</td>
      </tr>
    `).join('');
  body.innerHTML = rows;
}

// ---- Marcas del equipo guardadas en Supabase (tabla "gym_rm") ----
// Cada fila: { profile_id, exercise, weight, updated_at }. Se leen todas las marcas
// del equipo (RLS permite SELECT a cualquier persona autenticada) y se vuelcan sobre
// el roster ya cargado por loadPlantilla(), para que el ranking siempre muestre el
// dato real guardado en Supabase y no solo lo que haya en memoria de esta pestaña.
async function loadGymRm(){
  const { data, error } = await supabaseClient.from('gym_rm').select('profile_id, exercise, weight, updated_at');
  if(error){
    console.error('No se han podido cargar las marcas del equipo desde Supabase', error);
    return;
  }
  (data || []).forEach(row => {
    const targetId = row.profile_id === currentAuthUserId ? 'me' : row.profile_id;
    const player = rosterById[targetId];
    if(!player) return;
    if(!player.rm) player.rm = {};
    player.rm[row.exercise] = {
      weight: row.weight,
      updatedAt: row.updated_at ? row.updated_at.slice(0, 10) : ''
    };
  });
  renderGymMarks();
  calculateGymQuickRm();
  renderGymRanking();
}

// Cualquier cambio en las marcas del equipo (la tuya propia, o las de cualquier otra
// jugadora) se recarga aquí al momento: así "Mis Marcas" y el ranking del equipo
// quedan siempre al día en todas las cuentas, sin tener que refrescar la página.
function subscribeToGymRmRealtime(){
  supabaseClient
    .channel('gym-rm-sync')
    .on('postgres_changes', { event:'*', schema:'public', table:'gym_rm' }, () => loadGymRm())
    .subscribe();
}
