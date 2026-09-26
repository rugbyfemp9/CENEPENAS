// ---- Jugadoras: miembros registrados, leídos en directo de la tabla profiles.
// Las tarjetas amarillas/rojas se muestran para cada jugadora usando su id real.
let plantillaData = [];
let plantillaSortBy = 'alfabetico'; // 'alfabetico' | 'nacimiento' | 'comision' | 'tarjetas'
let plantillaPositionFilter = ''; // '' (todas) | 'delantera' | '3/4'

function setPlantillaPositionFilter(value){
  plantillaPositionFilter = value;
  renderPlantillaTable();
}
let plantillaStatsSortBy = 'alfabetico'; // 'alfabetico' | 'minutos' | 'ensayos' | 'tarjetas' | 'puntos'

async function loadPlantilla(){
  const box = document.getElementById('plantilla-grid');
  if(!box) return;

  // Si hay una copia reciente guardada en este dispositivo se pinta al momento con
  // esa (ver readCache/writeCache más arriba), en vez de mostrar "Cargando…" cada
  // vez que se abre la app aunque la plantilla no haya cambiado nada.
  const cached = await readCache('profiles');
  if(cached){
    applyPlantillaRows(cached.data);
  } else {
    box.innerHTML = `<tr><td colspan="7"><div class="att-roster-empty">${escapeHtml(t('plantilla.loading'))}</div></td></tr>`;
  }

  const { data, error } = await supabaseClient.from('profiles').select('*');

  if(error){
    if(!cached){
      box.innerHTML = `<tr><td colspan="7"><div class="att-roster-empty">${escapeHtml(t('plantilla.loadErrorList', {error: error.message}))}</div></td></tr>`;
    }
    return;
  }

  writeCache('profiles', data);
  applyPlantillaRows(data);
}

// Procesa las filas de "profiles" (vengan de la caché o recién traídas de Supabase)
// y actualiza roster/thirdTimeGroups y todo lo que depende de ellos. Separado de
// loadPlantilla() para poder pintar primero con la copia en caché y luego repetir
// exactamente lo mismo en cuanto llega la versión fresca de la red.
function applyPlantillaRows(data){
  const box = document.getElementById('plantilla-grid');
  // La cuenta admin es solo de gestión: no debe aparecer en ningún listado, grupo
  // ni estadística de cara al resto del equipo.
  plantillaData = (data || []).filter(p => !p.is_admin);
  if(!plantillaData.length){
    if(box) box.innerHTML = `<tr><td colspan="6"><div class="att-roster-empty">${escapeHtml(t('plantilla.noMembers'))}</div></td></tr>`;
    thirdTimeGroups.A = [];
    thirdTimeGroups.B = [];
    renderThirdTime();
    return;
  }

  // Sincroniza los grupos de tercer tiempo (y los datos básicos de cada persona)
  // con lo que hay guardado en Supabase, para que "Tercer tiempo" siempre muestre
  // a las jugadoras realmente registradas y en su grupo correcto.
  thirdTimeGroups.A = [];
  thirdTimeGroups.B = [];
  plantillaData.forEach(p => {
    const esYo = p.id === currentAuthUserId;
    const groupPlayerId = esYo ? 'me' : p.id;

    if(esYo){
      rosterById['me'].avatarUrl = p.avatar_url || myProfile.avatarUrl || '';
      // Así, si cambias la foto de perfil desde otra sesión/dispositivo, también se
      // actualiza aquí en cuanto llega el cambio en tiempo real.
      myProfile.avatarUrl = p.avatar_url || myProfile.avatarUrl || '';
    } else {
      const fullNameForRoster = [p.nombre, p.apellido].filter(Boolean).join(' ') || p.mote || 'Sin nombre';
      if(rosterById[p.id]){
        // Ya estaba en el roster de una carga anterior: se actualiza en el sitio
        Object.assign(rosterById[p.id], {
          name: fullNameForRoster, mote: p.mote || '', pos: p.rango || '', posicion: p.posicion || '', rol: p.rol || '', comision: p.comision || '', avatarUrl: p.avatar_url || '', birthdate: p.fecha_nacimiento || '', licencia: p.licencia || ''
        });
      } else {
        const newPlayer = {
          id: p.id, name: fullNameForRoster, mote: p.mote || '', pos: p.rango || '', posicion: p.posicion || '', rol: p.rol || '', comision: p.comision || '', avatarUrl: p.avatar_url || '', injured: false, injuryIcon: '', birthdate: p.fecha_nacimiento || '', licencia: p.licencia || '', rm: {}
        };
        rosterById[p.id] = newPlayer;
        roster.push(newPlayer);
      }
    }

    if(p.grupo_tercer_tiempo === 'A') thirdTimeGroups.A.push(groupPlayerId);
    else if(p.grupo_tercer_tiempo === 'B') thirdTimeGroups.B.push(groupPlayerId);
  });

  renderPlantillaTable();
  renderThirdTime();
  // Si ya estabas en la pestaña Fantasy cuando ha terminado de cargar la Plantilla,
  // se refresca sola para que aparezcan las jugadoras recién llegadas.
  if(document.getElementById('sec-fantasy')?.classList.contains('active')){
    appBridge.fantasy.refresh();
  }

  // Cualquier avatar ya pintado en pantalla (el tuyo propio en el header/sidebar/perfil,
  // o el de cualquier compañera en asistencia, gym o multas) se repinta aquí con el dato
  // fresco, para que un cambio de foto de perfil llegue en directo sin recargar. Cada
  // función se protege sola si la vista correspondiente no está abierta ahora mismo.
  if(typeof renderProfile === 'function') renderProfile();
  appBridge.gym.refresh(); // asistencia de hoy y ranking del Gym
  if(typeof renderRollCallList === 'function') renderRollCallList();
  if(typeof renderEventDetail === 'function') renderEventDetail();
  if(typeof renderFinesTable === 'function') renderFinesTable();
}

// Cualquier alta, baja o cambio de un perfil (nombre, mote, rango, y sobre todo la
// foto de perfil) se recarga aquí al momento en todas las cuentas conectadas, igual
// que ya pasa con la rutina, las marcas o la asistencia al gym.
function subscribeToProfilesRealtime(){
  supabaseClient
    .channel('profiles-sync')
    .on('postgres_changes', { event:'*', schema:'public', table:'profiles' }, () => loadPlantilla())
    .subscribe();
}

// Repinta la tabla de Jugadoras con el orden elegido, sin volver a pedir los datos a Supabase.
function renderPlantillaTable(){
  const box = document.getElementById('plantilla-grid');
  if(!box) return;
  const thActions = document.getElementById('plantilla-th-actions');
  if(thActions) thActions.style.display = isAdmin ? '' : 'none';
  const data = plantillaPositionFilter
    ? plantillaData.filter(p => p.posicion === plantillaPositionFilter)
    : plantillaData;
  if(!data.length){
    box.innerHTML = `<tr><td colspan="7"><div class="att-roster-empty">${escapeHtml(t('plantilla.noPlayersPosition'))}</div></td></tr>`;
    return;
  }

  // Nombre a mostrar para cada jugadora, calculado sobre TODO el grupo que se ve en esta
  // tabla, para poder desambiguar nombres de pila repetidos (jerarquía: mote > nombre de
  // pila > nombre de pila + inicial del primer apellido si hay más de una con el mismo).
  const jugadorasDisplayNames = computeDisplayNames(data.map(p => ({
    id: p.id,
    name: [p.nombre, p.apellido].filter(Boolean).join(' ') || t('plantilla.noName'),
    mote: p.mote
  })));

  // Antes solo se contaban las tarjetas de la propia usuaria logueada, así que al resto
  // de jugadoras nunca les aparecían aunque tuvieran multas de "TR"/"TA". Ahora se cuenta
  // para cada jugadora usando su id real en "fines" (que es 'me' para la propia usuaria
  // y el id de Supabase para las demás).
  const rows = data.map(p => {
    const fullName = [p.nombre, p.apellido].filter(Boolean).join(' ') || p.mote || t('plantilla.noName');
    const shownName = jugadorasDisplayNames.get(p.id) || fullName;
    const esJugadora = effectiveRoleForPermissions(p.rol) === 'jugadora';
    const esYo = p.id === currentAuthUserId;
    const finesPlayerId = esYo ? 'me' : p.id;
    const yellowCount = fines.filter(f => f.playerId === finesPlayerId && f.reasonId === 'amarilla').length;
    const redCount = fines.filter(f => f.playerId === finesPlayerId && f.reasonId === 'roja').length;
    return { p, shownName, esJugadora, esYo, yellowCount, redCount, cardsTotal: yellowCount + redCount };
  });

  box.innerHTML = sortPlantillaRows(rows).map(row => {
    const { p, shownName, esJugadora, esYo } = row;

    return `
        <tr>
          <td>
            <div class="col-player">
              <span class="avatar">${avatarHtml(p.avatar_url, initials(shownName), esYo ? rosterById['me'].injured : false, esYo ? rosterById['me'].injuryIcon : '')}</span>
              <b>${escapeHtml(shownName)}</b>
            </div>
          </td>
          <td class="${p.fecha_nacimiento ? '' : 'muted-cell'}">${p.fecha_nacimiento ? formatFullDate(p.fecha_nacimiento) : t('plantilla.unassigned')}</td>
          <td class="${p.rol ? '' : 'muted-cell'}">${p.rol || t('plantilla.unassigned')}</td>
          <td class="${esJugadora && p.rango ? '' : 'muted-cell'}">${esJugadora ? (p.rango || t('plantilla.unassigned')) : '—'}</td>
          <td class="${esJugadora && p.posicion ? '' : 'muted-cell'}">${esJugadora ? (posicionLabel(p.posicion) === '—' ? t('plantilla.unassigned') : posicionLabel(p.posicion)) : '—'}</td>
          <td class="${esJugadora && p.comision ? '' : 'muted-cell'}">${esJugadora ? (p.comision || t('plantilla.unassigned')) : '—'}</td>
          <td class="${p.licencia ? '' : 'muted-cell'}">${p.licencia || t('plantilla.unassigned')}</td>
          ${isAdmin ? `<td><button class="btn-ghost" style="padding:4px 10px; font-size:12px;" onclick="openEditProfileModal('${p.id}')">${escapeHtml(t('att.edit'))}</button></td>` : ''}
        </tr>
      `;
  }).join('');
}

// ---- Toolbar "Datos" / "Estadísticas" de la sección Jugadoras ----
let plantillaActiveTab = 'datos';

function setPlantillaTab(tab){
  plantillaActiveTab = tab;
  document.querySelectorAll('[data-plantilla-tab]').forEach(b => {
    b.classList.toggle('active', b.dataset.plantillaTab === tab);
  });
  document.getElementById('plantilla-panel-datos').style.display = tab === 'datos' ? '' : 'none';
  document.getElementById('plantilla-panel-estadisticas').style.display = tab === 'estadisticas' ? '' : 'none';

  // Se recargan cada vez que se entra en la pestaña (por si algo cambió mientras no la
  // tenías abierta), y además se mantienen frescas en vivo mientras la tienes abierta,
  // gracias a la suscripción realtime de match_report_players.
  if(tab === 'estadisticas'){
    loadPlantillaStats();
  }
}

// Suma, para cada jugadora ya registrada en la app (cruzando por perfil, licencia o
// nombre — igual que en el acta de cada partido), los minutos jugados, ensayos, puntos
// y tarjetas de TODAS las actas de partido guardadas hasta ahora.
async function loadPlantillaStats(){
  const box = document.getElementById('plantilla-stats-grid');
  if(!box) return;

  const cached = await readCache('match_report_players_own_team');
  if(cached){
    renderPlantillaStatsRows(cached.data);
  } else {
    box.innerHTML = `<tr><td colspan="5"><div class="att-roster-empty">${escapeHtml(t('plantilla.loadingStats'))}</div></td></tr>`;
  }

  const { data, error } = await supabaseClient
    .from('match_report_players')
    .select('profile_id, license_number, player_name, minutes_played, tries_count, points, match_report_cards(id)')
    .eq('is_own_team', true);

  if(error){
    if(!cached){
      box.innerHTML = `<tr><td colspan="5"><div class="att-roster-empty">${escapeHtml(t('plantilla.statsLoadError', {error: error.message}))}</div></td></tr>`;
    }
    return;
  }

  writeCache('match_report_players_own_team', data || []);
  renderPlantillaStatsRows(data);
}

// Agrupa las filas de match_report_players (vengan de la caché o recién traídas de
// Supabase) por jugadora y pinta la tabla de Estadísticas. Separado de
// loadPlantillaStats() para poder pintar primero con la copia en caché y luego
// repetir lo mismo en cuanto llega la versión fresca de la red.
function renderPlantillaStatsRows(data){
  const box = document.getElementById('plantilla-stats-grid');
  if(!box) return;

  const statsByProfileId = {};
  (data || []).forEach(row => {
    const matched = findRosterMatchForReportPlayer(row);
    if(!matched || !matched.id) return; // solo jugadoras con perfil/cuenta en la app

    if(!statsByProfileId[matched.id]){
      statsByProfileId[matched.id] = { profile: matched, minutes: 0, tries: 0, points: 0, cards: 0 };
    }
    const s = statsByProfileId[matched.id];
    s.minutes += row.minutes_played || 0;
    s.tries += row.tries_count || 0;
    s.points += row.points || 0;
    s.cards += (row.match_report_cards || []).length;
  });

  const rows = Object.values(statsByProfileId);
  if(!rows.length){
    box.innerHTML = `<tr><td colspan="5"><div class="att-roster-empty">${escapeHtml(t('plantilla.noMatchReports'))}</div></td></tr>`;
    return;
  }

  sortPlantillaStatsRows(rows);

  box.innerHTML = rows.map(s => `
      <tr>
        <td>
          <div class="col-player">
            <span class="avatar">${avatarHtml(s.profile.avatarUrl, initials(s.profile.name), false, '')}</span>
            <b>${escapeHtml(s.profile.name)}</b>
          </div>
        </td>
        <td class="num">${s.minutes || '—'}</td>
        <td class="num">${s.tries || '—'}</td>
        <td class="num">${s.points || '—'}</td>
        <td class="num">${s.cards || '—'}</td>
      </tr>
    `).join('');
}

function sortPlantillaRows(rows){
  const arr = rows.slice();
  if(plantillaSortBy === 'nacimiento'){
    arr.sort((a, b) => {
      const da = a.p.fecha_nacimiento, db = b.p.fecha_nacimiento;
      if(!da && !db) return 0;
      if(!da) return 1;
      if(!db) return -1;
      return da.localeCompare(db);
    });
  } else if(plantillaSortBy === 'comision'){
    arr.sort((a, b) => {
      const ca = a.p.comision || '', cb = b.p.comision || '';
      if(!ca && !cb) return 0;
      if(!ca) return 1;
      if(!cb) return -1;
      return ca.localeCompare(cb, 'es');
    });
  } else if(plantillaSortBy === 'tarjetas'){
    arr.sort((a, b) => b.cardsTotal - a.cardsTotal);
  } else {
    arr.sort((a, b) => a.shownName.localeCompare(b.shownName, 'es'));
  }
  return arr;
}

function togglePlantillaSortMenu(){
  document.getElementById('plantilla-sort-menu').classList.toggle('active');
  document.getElementById('plantilla-sort-btn').classList.toggle('active');
}
function closePlantillaSortMenu(){
  document.getElementById('plantilla-sort-menu').classList.remove('active');
  document.getElementById('plantilla-sort-btn').classList.remove('active');
}
function setPlantillaSort(sortBy){
  plantillaSortBy = sortBy;
  document.querySelectorAll('#plantilla-sort-menu button').forEach(b => {
    b.classList.toggle('active', b.dataset.sort === sortBy);
  });
  closePlantillaSortMenu();
  renderPlantillaTable();
}

// Orden de la pestaña "Estadísticas": mismo patrón que el de "Datos" (arriba), pero
// con su propio botón/menú y sus propios criterios (de más a menos minutos, ensayos,
// tarjetas o puntos).
function sortPlantillaStatsRows(rows){
  if(plantillaStatsSortBy === 'minutos') rows.sort((a, b) => b.minutes - a.minutes);
  else if(plantillaStatsSortBy === 'ensayos') rows.sort((a, b) => b.tries - a.tries);
  else if(plantillaStatsSortBy === 'tarjetas') rows.sort((a, b) => b.cards - a.cards);
  else if(plantillaStatsSortBy === 'puntos') rows.sort((a, b) => b.points - a.points);
  else rows.sort((a, b) => displayName(a.profile).localeCompare(displayName(b.profile), 'es'));
  return rows;
}
function togglePlantillaStatsSortMenu(){
  document.getElementById('plantilla-stats-sort-menu').classList.toggle('active');
  document.getElementById('plantilla-stats-sort-btn').classList.toggle('active');
}
function closePlantillaStatsSortMenu(){
  document.getElementById('plantilla-stats-sort-menu').classList.remove('active');
  document.getElementById('plantilla-stats-sort-btn').classList.remove('active');
}
function setPlantillaStatsSort(sortBy){
  plantillaStatsSortBy = sortBy;
  document.querySelectorAll('#plantilla-stats-sort-menu button').forEach(b => {
    b.classList.toggle('active', b.dataset.sort === sortBy);
  });
  closePlantillaStatsSortMenu();
  loadPlantillaStats();
}
// Cierra cualquier menú de ordenar (el de "Datos" y el de "Estadísticas") si se toca
// fuera de él.
document.addEventListener('click', (e) => {
  document.querySelectorAll('.sort-menu-wrap').forEach(wrap => {
    if(wrap.contains(e.target)) return;
    wrap.querySelector('.sort-menu')?.classList.remove('active');
    wrap.querySelector('.cal-open-btn')?.classList.remove('active');
  });
});

// Mientras cualquier <select> de la app tiene el foco (su panel puede estar desplegado),
// ocultamos el menú inferior fijo para que no lo tape con su franja oscura en móvil.
document.addEventListener('focusin', (e) => {
  if(e.target.tagName === 'SELECT') document.body.classList.add('select-open');
});
document.addEventListener('focusout', (e) => {
  if(e.target.tagName === 'SELECT') document.body.classList.remove('select-open');
});
