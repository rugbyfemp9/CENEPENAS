/* ================= GYM ================= */
// Rutina de la semana (tarjetones por día + detalle de cada día con las tablas de
// Forwards/Backs), archivado automático de la rutina del domingo, menú "más opciones"
// (cargar la última / ver antiguas), subida del PDF (función Edge
// "process-gym-routine-pdf"), calculadora rápida y de %RM, "Mis Marcas" (1RM,
// ejercicios personalizados, histórico), asistencia al gimnasio de hoy y ranking.
//
// Las marcas (1RM) de cada persona se siguen guardando en su entrada del roster del
// código antiguo (rosterById[...].rm), que no es reactivo: por eso `gym.version` se
// incrementa cada vez que cambian (aquí o desde fuera: roster recargado, perfil
// editado...) y todo lo que las lee depende de ese contador (ver rosterTick()).
import { SvelteSet } from 'svelte/reactivity';
import { legacy } from '../../lib/legacy.js';

// Ejercicios principales sobre los que se lleva marca (1RM) y ranking de equipo.
// Antes eran intocables; ahora entrenador/a y admin también pueden eliminarlos (ver
// gymExerciseDeletable) — cuando lo hacen, se guarda en "gym_removed_default_exercises"
// para que la eliminación sea real y quede igual en todas las cuentas.
const gymMainExercises = ['Sentadilla', 'Peso muerto', 'Press banca', 'Press militar', 'Dominadas lastradas'];

export const gym = $state({
  version: 0,
  // Nombres (en minúsculas) de los ejercicios fijos que entrenador/a o admin han
  // eliminado para todo el equipo. Se guarda en Supabase (tabla
  // "gym_removed_default_exercises") y se sincroniza en directo, igual que el resto
  // del catálogo de ejercicios.
  removedDefaultExercises: new SvelteSet(),
  // Catálogo de ejercicios "generales" añadidos desde la app (además de los fijos de
  // arriba): se guarda en Supabase (tabla "gym_exercises") y es visible para todo el
  // mundo. Los ejercicios privados de cada jugadora NO están aquí — viven solo en su
  // propio "gym_rm" y por eso la política RLS de esa tabla impide que nadie más los
  // vea (ver supabase_gym_exercises.sql).
  exercises: [],
  // Rutina de la semana: no hay ninguna hasta que se confirme con Supabase (tabla
  // "gym_weekly_routine", ver loadGymWeeklyRoutine). Esa tabla la rellena la función Edge
  // "process-gym-routine-pdf" cuando alguien sube el PDF de la rutina. Mientras valga
  // null, se entiende que esta semana todavía no se ha subido ninguna rutina.
  weeklyRoutine: null,
  // Asistencia al gimnasio por día: { '2026-08-18': [{ playerId:'me', time:'18:30' }] }
  attendanceByDate: {},
});

// Algo de fuera de Svelte ha cambiado (marcas en el roster, el roster en sí, el rol o
// is_admin): se vuelve a pintar todo lo que depende de ello.
export function refresh() {
  gym.version++;
}
function rosterTick() {
  gym.version; // dependencia reactiva
}

// Igual que escapeHtml() del código antiguo al pintar los campos de la rutina: un
// campo que falte (undefined/null) sale escrito tal cual, no vacío.
export function asText(value) {
  return String(value);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export async function loadGymRemovedDefaultExercises() {
  // Copia en caché primero (si hay una reciente), para pintar al momento; la
  // petición real de abajo sigue haciéndose igual y corrige lo que haga falta.
  const cached = await legacy.readCache('gym_removed_default_exercises');
  if (cached) {
    gym.removedDefaultExercises = new SvelteSet(cached.data);
    calculateGymQuickRm();
  }

  const { data, error } = await legacy.supabase.from('gym_removed_default_exercises').select('name');
  if (error) { console.error('No se han podido cargar los ejercicios fijos eliminados', error); return; }
  const names = (data || []).map((row) => row.name.toLowerCase());
  legacy.writeCache('gym_removed_default_exercises', names);
  gym.removedDefaultExercises = new SvelteSet(names);
  calculateGymQuickRm();
}
export function subscribeToGymRemovedDefaultExercisesRealtime() {
  legacy.supabase
    .channel('gym-removed-default-exercises-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'gym_removed_default_exercises' }, () => loadGymRemovedDefaultExercises())
    .subscribe();
}

// Solo entrenador/a y la cuenta admin pueden añadir ejercicios "generales": quedan
// visibles para todo el equipo y entran también en el ránking. El resto de la
// plantilla puede seguir añadiendo sus propios ejercicios personalizados, pero esos
// se guardan como privados (solo los ve quien los crea, ver gymAllExercises).
const GYM_GENERAL_EXERCISE_ROLES = ['entrenador/a'];
export function canManageGeneralExercises() {
  rosterTick();
  return legacy.isAdmin || GYM_GENERAL_EXERCISE_ROLES.includes(legacy.myProfile.rol);
}

export async function loadGymExercises() {
  const cached = await legacy.readCache('gym_exercises');
  if (cached) gym.exercises = cached.data;

  const { data, error } = await legacy.supabase.from('gym_exercises').select('*').order('created_at', { ascending: true });
  if (error) { console.error('No se han podido cargar los ejercicios generales de gym', error); return; }
  gym.exercises = data || [];
  legacy.writeCache('gym_exercises', $state.snapshot(gym.exercises));
}
export function subscribeToGymExercisesRealtime() {
  legacy.supabase
    .channel('gym-exercises-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'gym_exercises' }, () => loadGymExercises())
    .subscribe();
}

// El cuerpo técnico y las jugadoras pueden subir el PDF de la rutina.
const GYM_ROUTINE_EDITOR_ROLES = ['entrenador/a', 'delegado/a', 'directiva', 'jugadora'];
export function canEditGymRoutine() {
  rosterTick();
  return legacy.isAdmin || GYM_ROUTINE_EDITOR_ROLES.includes(legacy.effectiveRole(legacy.myProfile.rol));
}

export function hasWeeklyRoutine() {
  const r = gym.weeklyRoutine;
  return !!(r && r.days && r.days.length);
}

// ---- Panel 1: detalle de un día de la rutina ----
// Lo que se ve en la pantalla de detalle es lo último que se pintó (al abrir el día, al
// cambiar de grupo o de idioma), como antes: si la rutina cambia mientras tanto (p.ej.
// llega otra en directo), el detalle abierto no se toca hasta entonces.
export const dayDetail = $state({
  // Día de la rutina que se está viendo en la pantalla de detalle (índice en days[]).
  index: null,
  // Grupo de jugadoras seleccionado en la pantalla de detalle: 'forwards' o 'backs'.
  group: 'forwards',
  n: null,            // número de día del título (null = aún no se ha pintado: "Día 1" fijo)
  focus: '',
  splitVisible: false,
  splitKey: null,     // clave i18n del aviso de rutina distinta/misma por grupo
  exercises: null,    // filas de la tabla (null = tabla vacía, todavía sin pintar)
});

// Al cambiar de idioma se vuelve a pintar el detalle abierto (como hacía setLang()).
window.addEventListener('app:langchange', () => {
  if (dayDetail.index !== null) renderGymRoutineDayDetalle();
});

// Abre el detalle de un día concreto de la rutina en su propia pantalla completa.
// Siempre empieza mostrando el grupo "Forwards".
export function openGymRoutineDay(index) {
  dayDetail.index = index;
  dayDetail.group = 'forwards';
  quickCalc.playerId = null; // siempre se abre calculando la propia marca por defecto
  closeGymRmCalcBanner();
  renderGymRoutineDayDetalle();
  legacy.setSection('gym-entrenamiento-dia');
}

// Cambia entre la tabla de ejercicios de Forwards y la de Backs dentro del mismo día.
export function setGymRoutineDayGroup(group) {
  dayDetail.group = group;
  clearForeignGroupTabs();
  renderGymRoutineDayExercises();
}

// NOTA: el código antiguo marcaba la pestaña activa recorriendo TODOS los
// .gym-day-group-tab de la página, y las pestañas Datos/Estadísticas de Jugadoras
// reutilizan esa clase (sin data-group): al abrir un día o cambiar de grupo, a ellas
// se les quitaba el .active. Se mantiene igual en esta migración; arreglarlo aparte.
function clearForeignGroupTabs() {
  document.querySelectorAll('.gym-day-group-tab:not([data-group])').forEach((b) => b.classList.remove('active'));
}

// Devuelve la lista de ejercicios del grupo pedido para un día. Si la rutina no
// distingue por grupo (rutinas antiguas o PDF sin esa separación), usa la lista
// general "exercises" para ambos grupos.
function gymRoutineDayExercisesForGroup(d, group) {
  if (group === 'backs' && Array.isArray(d.exercises_backs)) return d.exercises_backs;
  if (group === 'forwards' && Array.isArray(d.exercises_forwards)) return d.exercises_forwards;
  return d.exercises || [];
}

function selectedRoutineDay() {
  if (!gym.weeklyRoutine || dayDetail.index === null) return null;
  return gym.weeklyRoutine.days[dayDetail.index] || null;
}

function renderGymRoutineDayDetalle() {
  const d = selectedRoutineDay();
  if (!d) return;
  dayDetail.n = dayDetail.index + 1;
  dayDetail.focus = d.focus || d.day || '';
  if (typeof d.group_split === 'boolean') {
    dayDetail.splitKey = d.group_split ? 'gym.splitRoutine' : 'gym.sameRoutine';
    dayDetail.splitVisible = true;
  } else {
    dayDetail.splitVisible = false;
  }
  clearForeignGroupTabs();
  renderGymRoutineDayExercises();
}

function renderGymRoutineDayExercises() {
  const d = selectedRoutineDay();
  if (!d) return;
  dayDetail.exercises = gymRoutineDayExercisesForGroup(d, dayDetail.group);
}

// Trae la rutina guardada en Supabase (si ya se ha subido algún PDF esta semana).
// Si no hay ninguna todavía, la rutina se queda en null (sin rutina).
export async function loadGymWeeklyRoutine() {
  const { data, error } = await legacy.supabase
    .from('gym_weekly_routine')
    .select('*')
    .eq('id', 'current')
    .maybeSingle();
  if (error) {
    console.error('No se ha podido cargar la rutina semanal desde Supabase', error);
    return;
  }
  gym.weeklyRoutine = (data && data.days && data.days.length)
    ? { weekLabel: data.week_label, days: data.days || [], updatedAt: data.updated_at || data.created_at || null }
    : null;
  // Si la rutina cargada ya pasó de su domingo a las 23:59, se archiva sola antes
  // de mostrar nada, para que la pantalla pida la rutina de la semana nueva.
  checkAndArchiveGymRoutineIfExpired();
}

// Cualquier cambio en la rutina semanal (PDF subido, "cargar última rutina" o el
// archivado automático del domingo) se recarga aquí al momento en todas las cuentas
// que tengan la app abierta, sin tener que refrescar la página.
export function subscribeToGymRoutineRealtime() {
  legacy.supabase
    .channel('gym-routine-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'gym_weekly_routine' }, () => loadGymWeeklyRoutine())
    .subscribe();
}

// ---- Archivado automático de la rutina cada domingo a las 23:59 ----
// No hay ningún cron en el servidor: el archivado se comprueba cada vez que la app
// carga la rutina (al iniciar sesión, o al entrar en "Mi Entrenamiento"). Si nadie
// abre la app justo el domingo por la noche, se archivará en cuanto alguien la abra
// después, que es el comportamiento normal para una app sin backend con cron propio.

// Devuelve el domingo a las 23:59:59 (hora local) de la semana que contiene "date".
function sundayCutoffOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = domingo ... 6 = sábado
  const diffToSunday = (7 - day) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToSunday, 23, 59, 59, 999);
}

let gymRoutineArchiveCheckInFlight = false;
async function checkAndArchiveGymRoutineIfExpired() {
  if (gymRoutineArchiveCheckInFlight) return;
  const routine = gym.weeklyRoutine;
  if (!routine || !routine.days || !routine.days.length) return;
  if (!routine.updatedAt) return; // sin fecha no sabemos de qué semana es: no se toca

  const cutoff = sundayCutoffOfWeek(new Date(routine.updatedAt));
  if (new Date() <= cutoff) return; // esta rutina todavía no ha llegado a su domingo 23:59

  gymRoutineArchiveCheckInFlight = true;
  try {
    const { error: insertError } = await legacy.supabase.from('gym_weekly_routine_archive').insert({
      week_label: routine.weekLabel,
      days: $state.snapshot(routine.days),
      archived_at: new Date().toISOString(),
    });
    if (insertError) {
      console.error('No se ha podido archivar la rutina de la semana pasada', insertError);
      return;
    }
    const { error: clearError } = await legacy.supabase.from('gym_weekly_routine')
      .update({ week_label: null, days: [] })
      .eq('id', 'current');
    if (clearError) console.error('No se ha podido vaciar la rutina actual tras archivarla', clearError);

    gym.weeklyRoutine = null;
  } finally {
    gymRoutineArchiveCheckInFlight = false;
  }
}

// ---- Panel 1: menú "más opciones" de la rutina (cargar última / ver antiguas) ----
export const routineMenu = $state({ open: false, busy: false });

export function toggleGymRoutineMoreMenu(e) {
  if (e) e.stopPropagation();
  routineMenu.open = !routineMenu.open;
}
export function closeGymRoutineMoreMenu() {
  routineMenu.open = false;
}

// Vuelve a poner como rutina "current" la última rutina que se archivó (útil cuando
// una rutina dura dos semanas y no hace falta subir el PDF otra vez).
export async function loadLastGymRoutine() {
  closeGymRoutineMoreMenu();
  routineMenu.busy = true;
  try {
    const { data, error } = await legacy.supabase
      .from('gym_weekly_routine_archive')
      .select('*')
      .order('archived_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('No se ha podido leer el archivo de rutinas', error);
      alert('No se ha podido cargar la última rutina archivada.');
      return;
    }
    if (!data) {
      alert('Todavía no hay ninguna rutina archivada.');
      return;
    }
    const { error: updateError } = await legacy.supabase.from('gym_weekly_routine')
      .update({ week_label: data.week_label, days: data.days || [] })
      .eq('id', 'current');
    if (updateError) {
      console.error('No se ha podido restaurar la rutina archivada', updateError);
      alert('No se ha podido cargar la última rutina.');
      return;
    }
    gym.weeklyRoutine = { weekLabel: data.week_label, days: data.days || [], updatedAt: new Date().toISOString() };
  } finally {
    routineMenu.busy = false;
  }
}

// Abre en una pestaña nueva un documento autocontenido con todas las rutinas
// archivadas, ordenadas de la más nueva a la más antigua.
export async function openGymRoutineArchiveTab() {
  closeGymRoutineMoreMenu();
  const { data, error } = await legacy.supabase
    .from('gym_weekly_routine_archive')
    .select('*')
    .order('archived_at', { ascending: false });
  if (error) {
    console.error('No se ha podido leer el archivo de rutinas', error);
    alert('No se ha podido abrir el histórico de rutinas.');
    return;
  }
  if (!data || !data.length) {
    alert('Todavía no hay ninguna rutina archivada.');
    return;
  }
  const html = buildGymRoutineArchiveHtml(data);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

function formatGymArchivedAt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
}

// El documento se genera como texto (es otra ventana, no un componente): todo lo que
// viene de Supabase pasa por escapeHtml().
function buildGymRoutineArchiveHtml(rows) {
  const weeksHtml = rows.map((row) => {
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
                ${exercises.length ? exercises.map((ex) => `
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
export const routineUpload = $state({
  open: false,
  busy: false,
  status: '',
  // Como antes, el color del mensaje se queda el último que se puso aunque se vuelva
  // a abrir el modal (al abrirlo solo se vacía el texto).
  statusColor: 'var(--text-muted)',
  fileInput: null,
});

export function openGymRoutineUploadModal() {
  if (routineUpload.fileInput) routineUpload.fileInput.value = '';
  routineUpload.status = '';
  routineUpload.open = true;
}
export function closeGymRoutineUploadModal() {
  routineUpload.open = false;
}
function setUploadStatus(color, text) {
  routineUpload.statusColor = color;
  routineUpload.status = text;
}
export async function uploadGymRoutinePdf() {
  const fileInput = routineUpload.fileInput;
  const file = fileInput.files && fileInput.files[0];

  if (!file) {
    setUploadStatus('var(--bad)', 'Elige primero un archivo PDF.');
    return;
  }

  routineUpload.busy = true;
  setUploadStatus('var(--text-muted)', 'Subiendo y leyendo el PDF con Gemini… puede tardar unos segundos.');

  try {
    const { data: sessionData } = await legacy.supabase.auth.getSession();
    const accessToken = sessionData && sessionData.session ? sessionData.session.access_token : null;
    if (!accessToken) {
      setUploadStatus('var(--bad)', 'Tu sesión ha caducado, vuelve a iniciar sesión e inténtalo de nuevo.');
      return;
    }

    const form = new FormData();
    form.append('pdf', file);

    const res = await fetch(`${legacy.supabaseUrl}/functions/v1/process-gym-routine-pdf`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
    const result = await res.json();

    if (!res.ok || result.error) {
      setUploadStatus('var(--bad)', result.error || 'No se ha podido procesar el PDF.');
      return;
    }

    gym.weeklyRoutine = { weekLabel: result.routine.week_label, days: result.routine.days || [], updatedAt: new Date().toISOString() };
    setUploadStatus('var(--ok)', '¡Rutina actualizada! Cerrando…');
    setTimeout(closeGymRoutineUploadModal, 900);
  } catch (e) {
    setUploadStatus('var(--bad)', 'Error al subir el PDF: ' + e.message);
  } finally {
    routineUpload.busy = false;
  }
}

// ---- Panel 1: calculadora rápida (ejercicio + % → peso, leyendo el RM del perfil) ----
export const gymQuickCalcPercents = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50];

export const quickCalc = $state({
  // Jugadora sobre la que calcula la calculadora rápida. null = la jugadora logeada
  // (currentUserId). Se resetea a null cada vez que se abre el detalle de un día.
  playerId: null,
  exercise: '',
  pct: '',
  // false = caja de resultado vacía (tras resetGymQuickCalc, hasta el próximo cálculo).
  shown: true,
  menuOpen: false,
  // Opciones del desplegable "cambiar jugadora", fijadas al abrirlo.
  menuPlayers: [],
});

// Redondea al medio kilo más cercano (el incremento habitual al cargar discos en barra).
function roundGymWeight(kg) {
  return Math.round(kg / 0.5) * 0.5;
}

// Devuelve la jugadora sobre la que está calculando ahora mismo la calculadora
// rápida: la seleccionada manualmente, o si no hay ninguna, la jugadora logeada.
export function gymQuickCalcSelectedPlayer() {
  rosterTick();
  return (quickCalc.playerId && legacy.rosterById[quickCalc.playerId]) || legacy.rosterById[legacy.currentUserId];
}

export function toggleGymQuickCalcPlayerMenu(e) {
  if (e) e.stopPropagation();
  const willOpen = !quickCalc.menuOpen;
  if (willOpen) {
    const selectedId = quickCalc.playerId || legacy.currentUserId;
    quickCalc.menuPlayers = legacy.roster.map((p) => ({ id: p.id, name: legacy.displayName(p), selected: p.id === selectedId }));
  }
  quickCalc.menuOpen = willOpen;
}
export function closeGymQuickCalcPlayerMenu() {
  quickCalc.menuOpen = false;
}

export function selectGymQuickCalcPlayer(playerId) {
  quickCalc.playerId = (playerId === legacy.currentUserId) ? null : playerId;
  closeGymQuickCalcPlayerMenu();
  calculateGymQuickRm();
}

// El resultado se recalcula solo al cambiar el ejercicio, el %, la jugadora o las
// marcas; esto solo vuelve a mostrarlo si se había vaciado (resetGymQuickCalc).
export function calculateGymQuickRm() {
  quickCalc.shown = true;
}

// Vacía la calculadora rápida (sin ejercicio ni % elegidos, sin marca de compañera
// seleccionada, y sin resultado). Se llama al salir del detalle de un día del Gym,
// igual que la calculadora avanzada. Si ya está vacía, no toca nada.
export function resetGymQuickCalc() {
  const alreadyEmpty = !quickCalc.playerId && quickCalc.exercise === '' && quickCalc.pct === '' && !quickCalc.shown;
  if (alreadyEmpty) return;

  quickCalc.playerId = null;
  closeGymQuickCalcPlayerMenu();
  quickCalc.exercise = '';
  quickCalc.pct = '';
  quickCalc.shown = false;
}

// Lo que muestra la caja de resultado de la calculadora rápida.
export function gymQuickCalcResult(exercise) {
  const pctRaw = quickCalc.pct;
  if (!exercise || pctRaw === '') return { kind: 'prompt' };
  const pct = parseFloat(pctRaw);
  const player = gymQuickCalcSelectedPlayer();
  const isMe = !player || player.id === legacy.currentUserId;
  const record = player && player.rm ? player.rm[exercise] : null;
  const name = isMe ? '' : legacy.displayName(player);

  if (!record) return { kind: isMe ? 'noMarkMine' : 'noMarkTheirs', exercise, name };

  const raw = record.weight * pct / 100;
  const rounded = roundGymWeight(raw);
  return {
    kind: 'out', exercise, name, isMe, pct,
    kg: rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1),
    raw: raw.toFixed(1),
    weight: record.weight,
  };
}

// ---- Panel 1: calculadora de %RM avanzada ----
// Banner con la tabla completa a partir de un 1RM conocido, o de un peso +
// repeticiones vía fórmula de Epley. Los inputs van con bind:value (número o null).
export const rmCalc = $state({
  open: false,
  oneRm: null,
  weight: null,
  reps: null,
  // null = sin resultado; { oneRm } = tabla (o, si no hay 1RM válido, el aviso).
  result: null,
});

export function toggleGymRmCalcBanner() {
  rmCalc.open = !rmCalc.open;
}
export function closeGymRmCalcBanner() {
  rmCalc.open = false;
}
const hasInputValue = (v) => v !== null && v !== undefined && v !== '';
// Vacía la calculadora de %RM avanzada (inputs + resultado + banner abierto). Se
// llama al salir del detalle de un día del Gym, para que no arrastre valores de un
// ejercicio a otro. Si ya está vacía y cerrada, no toca nada.
export function resetGymRmCalcBanner() {
  const hasValues = hasInputValue(rmCalc.oneRm) || hasInputValue(rmCalc.weight) || hasInputValue(rmCalc.reps);
  if (!rmCalc.open && !hasValues && rmCalc.result === null) return;

  rmCalc.oneRm = null;
  rmCalc.weight = null;
  rmCalc.reps = null;
  rmCalc.result = null;
  rmCalc.open = false;
}

const toNumber = (v) => parseFloat(hasInputValue(v) ? v : '');
export function calculateGymRmTable() {
  const oneRmInput = toNumber(rmCalc.oneRm);
  const weight = toNumber(rmCalc.weight);
  const reps = toNumber(rmCalc.reps);

  let oneRm = oneRmInput;
  if (!oneRm && weight && reps) {
    // Fórmula de Epley: 1RM = peso × (1 + repeticiones / 30)
    oneRm = weight * (1 + reps / 30);
  }
  rmCalc.result = { oneRm: (!oneRm || oneRm <= 0) ? null : oneRm };
}

// ---- Panel 2: mis marcas (1RM) ----
// "Mis Marcas" vive ahora dentro de "Mi Entrenamiento" (debajo de la rutina), así que
// el enlace desde la calculadora rápida vuelve a esa pantalla y baja hasta la tabla.
export function goToGymMarks() {
  legacy.setSection('gym-entrenamiento');
  const el = document.getElementById('gym-marks-section');
  if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
}

// Ejercicios generales: los fijos (menos los que se hayan eliminado para todo el
// equipo) + los que haya añadido entrenador/a o admin.
function generalExercises(seen, list) {
  gymMainExercises.forEach((name) => {
    const key = name.toLowerCase();
    if (gym.removedDefaultExercises.has(key)) return; // entrenador/a o admin lo eliminó para todo el equipo
    if (!seen.has(key)) { seen.add(key); list.push(name); }
  });
  gym.exercises.forEach((row) => {
    const key = row.name.toLowerCase();
    if (!seen.has(key)) { seen.add(key); list.push(row.name); }
  });
}

// Lista de ejercicios que ve esta persona en "Mis Marcas": los principales de
// siempre (fijos) + los generales que haya añadido entrenador/a o admin (visibles
// para todo el equipo) + los que ella misma se haya creado como privados (solo
// pueden aparecer aquí los suyos: la política RLS de "gym_rm" impide que le lleguen
// marcas de ejercicios privados de otras personas).
export function gymAllExercises() {
  rosterTick();
  const seen = new Set();
  const list = [];
  generalExercises(seen, list);
  const me = legacy.me;
  if (me && me.rm) {
    Object.keys(me.rm).forEach((name) => {
      const key = name.toLowerCase();
      if (!seen.has(key)) { seen.add(key); list.push(name); }
    });
  }
  return list;
}

// Lista de ejercicios para el selector del ránking del equipo: solo los generales
// (fijos + los que haya añadido entrenador/a o admin). Los privados de cada jugadora
// no entran en el ránking a propósito, porque solo ella tiene datos para compararlos.
export function gymRankingExercises() {
  const seen = new Set();
  const list = [];
  generalExercises(seen, list);
  return list;
}

// Un ejercicio se puede borrar desde "Mis Marcas" siempre, pero quién puede hacerlo
// depende de qué tipo es: los cinco fijos y los generales (los añadió entrenador/a o
// admin) solo los puede borrar entrenador/a o admin, porque afecta a todo el equipo.
// Si no aparece ni en los fijos ni en el catálogo general, es un ejercicio privado —
// y si aparece en tu lista es porque lo creaste tú, así que puedes borrarlo tú misma.
export function gymExerciseDeletable(name) {
  const key = name.toLowerCase();
  const isFixed = gymMainExercises.some((ex) => ex.toLowerCase() === key);
  if (isFixed) return canManageGeneralExercises();
  const isGeneral = gym.exercises.some((ex) => ex.name.toLowerCase() === key);
  if (isGeneral) return canManageGeneralExercises();
  return true;
}

// Filas de "Mis Marcas": cada ejercicio con mi marca actual.
export function gymMarksRows() {
  rosterTick();
  const me = legacy.me;
  return gymAllExercises().map((exercise) => ({
    exercise,
    record: me && me.rm ? me.rm[exercise] : null,
    deletable: gymExerciseDeletable(exercise),
  }));
}

// Inputs de la fila "Nuevo ejercicio…" al final de la tabla (se leen y se vacían
// directamente, como antes).
export const newExerciseInputs = { name: null, weight: null };

// `title` se queda el último ejercicio abierto (null = "Registrar marca" del HTML).
export const rmModal = $state({ open: false, exercise: null, title: null, weight: null });
export function openGymRmModal(exercise) {
  rmModal.exercise = exercise;
  rmModal.title = exercise;
  const me = legacy.me;
  const record = me && me.rm ? me.rm[exercise] : null;
  rmModal.weight = record ? record.weight : null;
  rmModal.open = true;
}
export function closeGymRmModal() {
  rmModal.open = false;
}
// Guarda una marca (1RM) en Supabase: la tabla "gym_rm" mantiene la marca actual
// (una fila por profile_id+exercise) y "gym_rm_history" acumula un registro por
// cada vez que se guarda, para poder consultar la evolución en el histórico (y para
// que el ranking del equipo vea siempre el dato real, no solo lo que quede en
// memoria de esta pestaña).
async function persistGymRm(exercise, weight) {
  if (!legacy.authUserId) return;
  const nowIso = new Date().toISOString();
  const { error } = await legacy.supabase.from('gym_rm').upsert({
    profile_id: legacy.authUserId,
    exercise,
    weight,
    updated_at: nowIso,
  }, { onConflict: 'profile_id,exercise' });
  if (error) console.error('No se ha podido guardar la marca en Supabase', error);

  const { error: historyError } = await legacy.supabase.from('gym_rm_history').insert({
    profile_id: legacy.authUserId,
    exercise,
    weight,
    recorded_at: nowIso,
  });
  if (historyError) console.error('No se ha podido guardar el histórico de la marca', historyError);
}
// Guarda también una copia en memoria del histórico, para poder mostrarla al
// momento en el modal aunque todavía no se haya recargado desde Supabase.
function pushGymRmHistoryLocal(me, exercise, weight, updatedAt) {
  if (!me.rmHistory) me.rmHistory = {};
  if (!me.rmHistory[exercise]) me.rmHistory[exercise] = [];
  me.rmHistory[exercise].unshift({ weight, updatedAt });
}
function setMyRm(exercise, weight) {
  const updatedAt = legacy.todayIso();
  const me = legacy.me;
  if (!me.rm) me.rm = {};
  me.rm[exercise] = { weight, updatedAt };
  pushGymRmHistoryLocal(me, exercise, weight, updatedAt);
  refresh();
}
export async function saveGymRm() {
  const weight = toNumber(rmModal.weight);
  if (isNaN(weight) || weight < 0) {
    alert('Escribe un peso válido (puede ser 0).');
    return;
  }
  const exercise = rmModal.exercise;
  setMyRm(exercise, weight);
  closeGymRmModal();
  calculateGymQuickRm();
  await persistGymRm(exercise, weight);
}
// Añade un ejercicio entero desde la fila vacía del final de la tabla. Si quien lo
// añade es entrenador/a o admin, el peso es OPCIONAL: puede crear el ejercicio para
// todo el equipo sin registrar su propia marca todavía (cada jugadora la registrará
// cuando quiera). Si lo añade cualquier otra persona, se guarda como marca privada
// suya (nadie más lo ve) y en ese caso el peso sigue siendo obligatorio, porque no
// tendría sentido crear una marca personal sin marca.
export async function addGymCustomExercise() {
  const nameInput = newExerciseInputs.name;
  const weightInput = newExerciseInputs.weight;
  const name = nameInput.value.trim();
  const weightRaw = weightInput.value.trim();
  const isManager = canManageGeneralExercises();

  if (!name) {
    alert('Escribe el nombre del ejercicio.');
    nameInput.focus();
    return;
  }

  let weight = null;
  if (weightRaw !== '') {
    weight = parseFloat(weightRaw);
    if (isNaN(weight) || weight < 0) {
      alert('Escribe un peso válido (puede ser 0), o déjalo en blanco.');
      weightInput.focus();
      return;
    }
  } else if (!isManager) {
    alert('Escribe un peso válido (puede ser 0).');
    weightInput.focus();
    return;
  }

  // Si ya existe un ejercicio con ese nombre (sin distinguir mayúsculas), se
  // actualiza su marca en vez de crear uno duplicado.
  const existing = gymAllExercises().find((ex) => ex.toLowerCase() === name.toLowerCase());
  const exercise = existing || name;

  if (!existing && isManager) {
    const { data, error } = await legacy.supabase
      .from('gym_exercises')
      .insert({ name: exercise, created_by: legacy.authUserId })
      .select()
      .single();
    if (error) {
      console.error('No se pudo añadir el ejercicio general', error);
      alert('No se ha podido añadir el ejercicio. Inténtalo de nuevo.');
      return;
    }
    gym.exercises.push(data);
  }

  nameInput.value = '';
  weightInput.value = '';

  // Ejercicio creado sin marca (solo puede pasar si es entrenador/a o admin): se
  // deja aquí, sin guardar ninguna marca todavía.
  if (weight === null) {
    calculateGymQuickRm();
    return;
  }

  setMyRm(exercise, weight);
  calculateGymQuickRm();
  await persistGymRm(exercise, weight);
}

// Elimina un ejercicio de "Mis Marcas". Si es uno de los cinco fijos, se guarda su
// eliminación en "gym_removed_default_exercises" para que desaparezca de verdad y en
// todas las cuentas. Si era general (lo añadió entrenador/a o admin) se quita del
// catálogo compartido "gym_exercises". En cualquier caso se borra también tu propia
// marca guardada (la de otras jugadoras, si la hubiera, no se toca).
export async function deleteGymExercise(name) {
  if (!gymExerciseDeletable(name)) return;

  const key = name.toLowerCase();
  const isFixed = gymMainExercises.some((ex) => ex.toLowerCase() === key);
  const generalRow = gym.exercises.find((ex) => ex.name.toLowerCase() === key);

  if (!confirm((isFixed || generalRow)
    ? `¿Eliminar "${name}" para todo el equipo? Dejará de verse en Mis Marcas, la calculadora rápida y el ránking.`
    : `¿Eliminar "${name}" de tus marcas?`
  )) return;

  if (isFixed) {
    const { error } = await legacy.supabase.from('gym_removed_default_exercises').insert({
      name,
      removed_by: legacy.authUserId,
    });
    if (error) {
      console.error('No se pudo eliminar el ejercicio fijo', error);
      alert('No se ha podido eliminar. Inténtalo de nuevo.');
      return;
    }
    gym.removedDefaultExercises.add(key);
  } else if (generalRow) {
    const generalId = generalRow.id;
    const { error } = await legacy.supabase.from('gym_exercises').delete().eq('id', generalId);
    if (error) {
      console.error('No se pudo eliminar el ejercicio', error);
      alert('No se ha podido eliminar. Inténtalo de nuevo.');
      return;
    }
    gym.exercises = gym.exercises.filter((ex) => ex.id !== generalId);
  }

  const me = legacy.me;
  if (me && me.rm) delete me.rm[name];
  if (me && me.rmHistory) delete me.rmHistory[name];
  refresh();
  calculateGymQuickRm();

  if (legacy.authUserId) {
    await legacy.supabase.from('gym_rm').delete().eq('profile_id', legacy.authUserId).eq('exercise', name);
    await legacy.supabase.from('gym_rm_history').delete().eq('profile_id', legacy.authUserId).eq('exercise', name);
  }
}

// ---- Panel 2: histórico de marcas de un ejercicio ----
export const rmHistory = $state({
  open: false,
  exercise: null,
  // Ejercicio del título; se queda el último abierto aunque se cierre el modal.
  title: null,
  // null = lista vacía (aún no se ha abierto) | 'loading' | 'empty' | 'list'
  status: null,
  entries: [],
  loadFailed: false,
});
export function openGymRmHistoryModal(exercise) {
  rmHistory.exercise = exercise;
  rmHistory.title = exercise;
  rmHistory.status = 'loading';
  rmHistory.open = true;
  loadGymRmHistory(exercise);
}
export function closeGymRmHistoryModal() {
  rmHistory.open = false;
  rmHistory.exercise = null;
}
async function loadGymRmHistory(exercise) {
  const me = legacy.me;
  let entries = [];
  let historyLoadFailed = false;

  if (legacy.authUserId) {
    const { data, error } = await legacy.supabase.from('gym_rm_history')
      .select('weight, recorded_at')
      .eq('profile_id', legacy.authUserId)
      .eq('exercise', exercise)
      .order('recorded_at', { ascending: false });
    if (error) {
      console.error('No se ha podido cargar el histórico de la marca', error);
      historyLoadFailed = true;
    } else if (data && data.length) {
      entries = data.map((row) => ({ weight: row.weight, updatedAt: row.recorded_at ? row.recorded_at.slice(0, 10) : '' }));
    }
  }
  // Si Supabase no tiene histórico todavía (o no hay conexión), se usa lo que
  // haya en memoria de esta sesión, y si tampoco hay nada, al menos la marca actual.
  if (!entries.length && me && me.rmHistory && me.rmHistory[exercise] && me.rmHistory[exercise].length) {
    entries = me.rmHistory[exercise].slice();
  }
  if (!entries.length) {
    const current = me && me.rm ? me.rm[exercise] : null;
    if (current) entries = [{ ...current }];
  }

  // El usuario puede haber cerrado el modal o abierto otro ejercicio mientras
  // se esperaba la respuesta de Supabase.
  if (rmHistory.exercise !== exercise) return;

  rmHistory.entries = entries;
  // Si la consulta a Supabase ha fallado, se avisa de que lo que se ve aquí no es
  // el histórico completo (para no confundirlo con "solo has hecho una marca").
  rmHistory.loadFailed = historyLoadFailed;
  rmHistory.status = entries.length ? 'list' : 'empty';
}

// ---- Panel 3: asistencia al gimnasio hoy ----
// Se guarda en Supabase (tabla "gym_attendance": profile_id + fecha + hora, con
// una fila por persona y día) para que quede sincronizada al momento en todas las
// cuentas, igual que las marcas y la rutina semanal.
export function gymAttendanceToday() {
  rosterTick();
  const todayIso = legacy.todayIso();
  return (gym.attendanceByDate[todayIso] || []).slice().sort((a, b) => a.time.localeCompare(b.time));
}

export const checkinModal = $state({ open: false, time: '' });
export function openGymCheckinModal() {
  const now = new Date();
  checkinModal.time = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  checkinModal.open = true;
}
export function closeGymCheckinModal() {
  checkinModal.open = false;
}
export async function saveGymCheckin() {
  const time = checkinModal.time;
  if (!time) {
    alert('Elige una hora.');
    return;
  }
  const todayIso = legacy.todayIso();
  const me = legacy.currentUserId;
  if (!gym.attendanceByDate[todayIso]) gym.attendanceByDate[todayIso] = [];
  gym.attendanceByDate[todayIso] = gym.attendanceByDate[todayIso].filter((e) => e.playerId !== me);
  gym.attendanceByDate[todayIso].push({ playerId: me, time });
  closeGymCheckinModal();

  if (legacy.authUserId) {
    const { error } = await legacy.supabase.from('gym_attendance').upsert({
      profile_id: legacy.authUserId,
      attendance_date: todayIso,
      time,
    }, { onConflict: 'profile_id,attendance_date' });
    if (error) {
      console.error('No se ha podido guardar tu asistencia al gimnasio en Supabase', error);
      alert('Te has apuntado en la app, pero no se ha podido sincronizar con Supabase: ' + error.message);
    }
  }
}
export async function cancelGymCheckin() {
  const todayIso = legacy.todayIso();
  if (gym.attendanceByDate[todayIso]) {
    gym.attendanceByDate[todayIso] = gym.attendanceByDate[todayIso].filter((e) => e.playerId !== legacy.currentUserId);
  }

  if (legacy.authUserId) {
    const { error } = await legacy.supabase.from('gym_attendance')
      .delete()
      .eq('profile_id', legacy.authUserId)
      .eq('attendance_date', todayIso);
    if (error) {
      console.error('No se ha podido quitar tu asistencia al gimnasio en Supabase', error);
      alert('Te has quitado en la app, pero no se ha podido sincronizar con Supabase: ' + error.message);
    }
  }
}

// Trae quién se ha apuntado hoy al gimnasio desde Supabase. Se llama al iniciar
// sesión y cada vez que se entra en "Equipo", para no depender solo de lo que ya
// hubiera en memoria de esta pestaña.
export async function loadGymAttendanceToday() {
  const todayIso = legacy.todayIso();
  const { data, error } = await legacy.supabase
    .from('gym_attendance')
    .select('*')
    .eq('attendance_date', todayIso);
  if (error) {
    console.error('No se han podido cargar las asistencias al gimnasio de hoy', error);
    return;
  }
  gym.attendanceByDate[todayIso] = (data || []).map((row) => ({
    playerId: row.profile_id === legacy.authUserId ? 'me' : row.profile_id,
    time: row.time,
  }));
}

// Cualquier cambio en la asistencia de hoy (alguien se apunta o se quita, desde
// cualquier cuenta) se recarga aquí al momento, sin tener que refrescar la página.
export function subscribeToGymAttendanceRealtime() {
  legacy.supabase
    .channel('gym-attendance-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'gym_attendance' }, () => loadGymAttendanceToday())
    .subscribe();
}

// ---- Panel 3: ranking de RM del equipo ----
// Ejercicio elegido en el selector ('' = ninguno todavía: el primero de la lista).
export const ranking = $state({ exercise: '' });

export function gymRankingRows(exercise) {
  rosterTick();
  const withRecord = [];
  const without = [];
  legacy.roster.forEach((p) => {
    const record = p.rm ? p.rm[exercise] : null;
    if (record) withRecord.push({ p, weight: record.weight, updatedAt: record.updatedAt });
    else without.push({ p });
  });
  withRecord.sort((a, b) => b.weight - a.weight);
  return { withRecord, without };
}

// ---- Marcas del equipo guardadas en Supabase (tabla "gym_rm") ----
// Cada fila: { profile_id, exercise, weight, updated_at }. Se leen todas las marcas
// del equipo (RLS permite SELECT a cualquier persona autenticada) y se vuelcan sobre
// el roster ya cargado por loadPlantilla(), para que el ranking siempre muestre el
// dato real guardado en Supabase y no solo lo que haya en memoria de esta pestaña.
export async function loadGymRm() {
  const { data, error } = await legacy.supabase.from('gym_rm').select('profile_id, exercise, weight, updated_at');
  if (error) {
    console.error('No se han podido cargar las marcas del equipo desde Supabase', error);
    return;
  }
  (data || []).forEach((row) => {
    const targetId = row.profile_id === legacy.authUserId ? 'me' : row.profile_id;
    const player = legacy.rosterById[targetId];
    if (!player) return;
    if (!player.rm) player.rm = {};
    player.rm[row.exercise] = {
      weight: row.weight,
      updatedAt: row.updated_at ? row.updated_at.slice(0, 10) : '',
    };
  });
  refresh();
  calculateGymQuickRm();
}

// Cualquier cambio en las marcas del equipo (la tuya propia, o las de cualquier otra
// jugadora) se recarga aquí al momento: así "Mis Marcas" y el ranking del equipo
// quedan siempre al día en todas las cuentas, sin tener que refrescar la página.
export function subscribeToGymRmRealtime() {
  legacy.supabase
    .channel('gym-rm-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'gym_rm' }, () => loadGymRm())
    .subscribe();
}

// Al iniciar sesión (auth.js): se carga todo lo del gym en este orden y se suscribe a
// los cambios en directo.
export async function loadAfterLogin() {
  await loadGymExercises();
  subscribeToGymExercisesRealtime();
  await loadGymRemovedDefaultExercises();
  subscribeToGymRemovedDefaultExercisesRealtime();
  await loadGymRm();
  subscribeToGymRmRealtime();
  refresh(); // el rol real (quién puede subir la rutina) ya se conoce
  await loadGymWeeklyRoutine();
  subscribeToGymRoutineRealtime();
  await loadGymAttendanceToday();
  subscribeToGymAttendanceRealtime();
}
