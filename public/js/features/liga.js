/* ---- Liga: clasificación y resultados de la Divisió d'Honor Catalana AON ---- */
// Datos obtenidos de rugby.cat (temporada 2025-26). rugby.cat carga su clasificación
// y resultados desde un widget de un proveedor externo (matchready.es) que bloquea
// que se incruste en otras páginas, así que esto es una foto fija: para verla siempre
// al día usa el enlace a rugby.cat que aparece al pie de la sección, o pídeme que la
// revise y ponga los datos al día a mano.
const leagueOwnTeam = 'CNPN';

// No usamos escudos oficiales de los clubs (son marcas de terceros); en su lugar,
// cada equipo tiene una insignia propia con sus iniciales y un color distinto.
// El CNPN reutiliza el mismo degradado que el escudo del club en el resto de la app.
const teamCrests = {
'CNPN':               { initials:'CN', logo: 'assets/img/logo.png' },
'CORNE/CRUC':         { initials:'CC', logo: 'assets/img/cornecruc.jpg' },
'CEFA UNIZAR':        { initials:'CU', logo: 'assets/img/cefaunizar.jpg' },
'VPC ANDORRA':        { initials:'VA', logo: 'assets/img/vpcandorra.jpeg' },
'ALGONTEC ZARAGOZA':  { initials:'AZ', logo: 'assets/img/algfenix.png' },
'CE INEF LLEIDA':     { initials:'CI', logo: 'assets/img/inef.jpeg' }
};
function teamCrestHtml(name) {
const c = teamCrests[name] || { 
  initials: name.slice(0, 2).toUpperCase(), 
  bg: 'linear-gradient(135deg,#8FA3C2,#5B6B7C)' 
};

// Si el equipo tiene logo/imagen configurado
if (c.logo) {
  return `
      <span class="liga-crest" style="background: transparent; display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px;" title="${escapeHtml(name)}">
        <img src="${c.logo}" 
             alt="${escapeHtml(name)}" 
             loading="lazy"
             style="width: 100%; height: 100%; object-fit: contain; display: block;" 
             onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';" />
        <span style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center; background: ${c.bg || '#444'}; border-radius: 4px;">
          ${escapeHtml(c.initials)}
        </span>
      </span>
    `;
}

// Si no tiene logo, mantiene la etiqueta original
return `<span class="liga-crest" style="background:${c.bg};" title="${escapeHtml(name)}">${escapeHtml(c.initials)}</span>`;
}

const leagueStandings = [
  { pos:1, team:'CORNE/CRUC',       j:10, g:8, e:0, p:2, pf:226, pc:129, dp:97,   af:34, ac:20, bo:2, bd:2, pts:36 },
  { pos:2, team:'CNPN',             j:10, g:8, e:0, p:2, pf:204, pc:92,  dp:112,  af:35, ac:12, bo:3, bd:1, pts:36 },
  { pos:3, team:'CEFA UNIZAR',      j:10, g:5, e:1, p:4, pf:157, pc:156, dp:1,    af:27, ac:26, bo:2, bd:0, pts:22 },
  { pos:4, team:'VPC ANDORRA',      j:10, g:4, e:1, p:5, pf:197, pc:189, dp:8,    af:30, ac:31, bo:2, bd:1, pts:21 },
  { pos:5, team:'ALGONTEC ZARAGOZA',j:10, g:2, e:0, p:8, pf:160, pc:248, dp:-88,  af:25, ac:42, bo:1, bd:2, pts:11 },
  { pos:6, team:'CE INEF LLEIDA',   j:10, g:2, e:0, p:8, pf:129, pc:259, dp:-130, af:22, ac:42, bo:1, bd:1, pts:10 }
];

const leagueResults = [
  { jornada:'Jornada 1', matches:[
    { date:'11/10/2025', home:'VPC ANDORRA', away:'CORNE/CRUC', score:'43 - 38' },
    { date:'11/10/2025', home:'CE INEF LLEIDA', away:'CNPN', score:'5 - 39' },
    { date:'11/10/2025', home:'ALGONTEC ZARAGOZA', away:'CEFA UNIZAR', score:'5 - 18' }
  ]},
  { jornada:'Jornada 2', matches:[
    { date:'18/10/2025', home:'ALGONTEC ZARAGOZA', away:'VPC ANDORRA', score:'5 - 38' },
    { date:'18/10/2025', home:'CNPN', away:'CEFA UNIZAR', score:'21 - 0' },
    { date:'18/10/2025', home:'CORNE/CRUC', away:'CE INEF LLEIDA', score:'32 - 12' }
  ]},
  { jornada:'Jornada 3', matches:[
    { date:'08/11/2025', home:'VPC ANDORRA', away:'CE INEF LLEIDA', score:'32 - 17' },
    { date:'08/11/2025', home:'CORNE/CRUC', away:'CEFA UNIZAR', score:'34 - 5' },
    { date:'08/11/2025', home:'CNPN', away:'ALGONTEC ZARAGOZA', score:'20 - 15' }
  ]},
  { jornada:'Jornada 4', matches:[
    { date:'15/11/2025', home:'VPC ANDORRA', away:'CNPN', score:'10 - 12' },
    { date:'15/11/2025', home:'CORNE/CRUC', away:'ALGONTEC ZARAGOZA', score:'18 - 10' },
    { date:'15/11/2025', home:'CE INEF LLEIDA', away:'CEFA UNIZAR', score:'12 - 36' }
  ]},
  { jornada:'Jornada 5', matches:[
    { date:'13/12/2025', home:'CEFA UNIZAR', away:'VPC ANDORRA', score:'29 - 10' },
    { date:'13/12/2025', home:'ALGONTEC ZARAGOZA', away:'CE INEF LLEIDA', score:'24 - 0' },
    { date:'13/12/2025', home:'CNPN', away:'CORNE/CRUC', score:'0 - 3' }
  ]},
  { jornada:'Jornada 6', matches:[
    { date:'24/01/2026', home:'CORNE/CRUC', away:'VPC ANDORRA', score:'15 - 7' },
    { date:'24/01/2026', home:'CNPN', away:'CE INEF LLEIDA', score:'22 - 10' },
    { date:'24/01/2026', home:'CEFA UNIZAR', away:'ALGONTEC ZARAGOZA', score:'18 - 12' }
  ]},
  { jornada:'Jornada 7', matches:[
    { date:'07/02/2026', home:'VPC ANDORRA', away:'ALGONTEC ZARAGOZA', score:'27 - 18' },
    { date:'07/02/2026', home:'CNPN', away:'CEFA UNIZAR', score:'27 - 17' },
    { date:'07/02/2026', home:'CE INEF LLEIDA', away:'CORNE/CRUC', score:'12 - 10' }
  ]},
  { jornada:'Jornada 8', matches:[
    { date:'14/02/2026', home:'CE INEF LLEIDA', away:'VPC ANDORRA', score:'20 - 5' },
    { date:'14/02/2026', home:'CORNE/CRUC', away:'CEFA UNIZAR', score:'13 - 5' },
    { date:'14/02/2026', home:'CNPN', away:'ALGONTEC ZARAGOZA', score:'34 - 0' }
  ]},
  { jornada:'Jornada 9', matches:[
    { date:'07/03/2026', home:'CNPN', away:'VPC ANDORRA', score:'18 - 8' },
    { date:'07/03/2026', home:'CORNE/CRUC', away:'ALGONTEC ZARAGOZA', score:'39 - 24' },
    { date:'07/03/2026', home:'CEFA UNIZAR', away:'CE INEF LLEIDA', score:'12 - 5' }
  ]},
  { jornada:'Jornada 10', matches:[
    { date:'14/03/2026', home:'VPC ANDORRA', away:'CEFA UNIZAR', score:'17 - 17' },
    { date:'21/03/2026', home:'CE INEF LLEIDA', away:'ALGONTEC ZARAGOZA', score:'36 - 47' },
    { date:'14/03/2026', home:'CORNE/CRUC', away:'CNPN', score:'24 - 11' }
  ]},
  { jornada:'Semifinal', matches:[
    { date:'28/03/2026', home:'CORNE/CRUC', away:'VPC ANDORRA', score:'28 - 6' },
    { date:'28/03/2026', home:'CNPN', away:'CEFA UNIZAR', score:'37 - 0' }
  ]},
  { jornada:'Final', matches:[
    { date:'18/04/2026', home:'CORNE/CRUC', away:'CNPN', score:'8 - 13' }
  ]}
];

function renderLeagueBanner(){
  const numEl = document.getElementById('league-position-num');
  if(!numEl) return;
  const own = leagueStandings.find(t => t.team === leagueOwnTeam);
  numEl.textContent = own ? `${own.pos}º` : '—';
}

function renderLeagueStandings(){
  const box = document.getElementById('liga-standings-table');
  if(!box) return;
  const rows = leagueStandings.map(t => `
      <tr class="${t.team === leagueOwnTeam ? 'liga-own-team' : ''}">
        <td class="liga-pos">${t.pos}</td>
        <td class="liga-team">${teamCrestHtml(t.team)}${escapeHtml(t.team)}</td>
        <td>${t.j}</td><td>${t.g}</td><td>${t.e}</td><td>${t.p}</td>
        <td>${t.pf}</td><td>${t.pc}</td><td>${t.dp > 0 ? '+' : ''}${t.dp}</td>
        <td>${t.af}</td><td>${t.ac}</td><td>${t.bo}</td><td>${t.bd}</td>
        <td class="liga-pts">${t.pts}</td>
      </tr>
    `).join('');
  box.innerHTML = `
      <thead>
        <tr><th>#</th><th style="text-align:left;">${escapeHtml(t('liga.teamCol'))}</th><th>J</th><th>G</th><th>E</th><th>P</th><th>PF</th><th>PC</th><th>DP</th><th>AF</th><th>AC</th><th>BO</th><th>BD</th><th>Pts</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    `;
}

function renderLeagueResults(){
  const box = document.getElementById('liga-results-list');
  if(!box) return;
  box.innerHTML = leagueResults.map(round => `
      <div class="liga-jornada-heading">${escapeHtml(round.jornada)}</div>
      ${round.matches.map(m => {
        const isOwn = m.home === leagueOwnTeam || m.away === leagueOwnTeam;
        return `
          <div class="liga-match ${isOwn ? 'liga-own-match' : ''}">
            <div class="teams">${teamCrestHtml(m.home)}${escapeHtml(m.home)} <span class="score">${m.score}</span> ${escapeHtml(m.away)}${teamCrestHtml(m.away)}</div>
            <div class="date">${m.date}</div>
          </div>
        `;
      }).join('')}
    `).join('');
}

function setLigaTab(tab){
  document.querySelectorAll('.liga-tabs button').forEach(b => b.classList.toggle('active', b.dataset.ligaTab === tab));
  document.getElementById('liga-panel-clasificacion').classList.toggle('active', tab === 'clasificacion');
  document.getElementById('liga-panel-resultados').classList.toggle('active', tab === 'resultados');
}

function renderLeague(){
  renderLeagueStandings();
  renderLeagueResults();
  renderLeagueBanner();
}
