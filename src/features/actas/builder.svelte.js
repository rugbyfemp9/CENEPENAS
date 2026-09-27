// ---- Crear/editar acta a mano (alternativa a subir el PDF) ----
// Se guarda exactamente en las mismas tablas que usa la función Edge
// ("match_reports", "match_report_players", "match_report_cards"), así que el
// resultado se ve igual en la tabla del acta y cuenta igual en "Jugadoras" →
// Estadísticas. Igual que al subir un PDF nuevo, guardar sustituye por completo
// lo que hubiera antes para este partido (no se suma a lo anterior).
//
// Las filas son un array normal (no reactivo), como antes: escribir en un campo solo
// actualiza el dato, y las filas se vuelven a pintar enteras (actaBuilder.version)
// solo al añadir/quitar una jugadora o una tarjeta.
import { legacy } from '../../lib/legacy.js';
import { supabase } from '../../lib/supabase.js';
import { toRemotePlayerId } from '../../lib/session.svelte.js';
import { rosterById } from '../../lib/roster.js';
import { partidoDetalle } from '../partidos/partidos.svelte.js';
import { actas, loadMatchReport } from './actas.svelte.js';

export const actaBuilder = $state({
  open: false,
  busy: false,
  status: '',
  statusColor: 'var(--text-muted)',
  version: 0,
});

let actaBuilderRows = [];
export function builderRows() {
  actaBuilder.version; // dependencia: se repintan al cambiar la versión
  return actaBuilderRows;
}
function renderActaBuilderRows() {
  actaBuilder.version++;
}

function emptyActaBuilderRow() {
  return { jerseyNumber: '', playerId: '', entryMinute: 0, exitMinute: 80, tries: 0, conversions: 0, penalties: 0, cards: [] };
}

export function openMatchReportBuilderModal() {
  const existing = actas.reports[partidoDetalle.currentId];
  if (existing && existing.players && existing.players.length) {
    // Se precarga con lo que ya había, para poder corregirlo sin partir de cero.
    // El minuto de entrada/salida no se guarda tal cual en la base de datos (solo
    // los minutos totales jugados), así que aquí se reconstruye de forma razonable:
    // titular → entra en el 0; suplente → se asume que jugó hasta el final.
    actaBuilderRows = existing.players.map((p) => {
      const isStarter = !!p.is_starter;
      const minutesPlayed = p.minutes_played != null ? p.minutes_played : 80;
      return {
        jerseyNumber: p.jersey_number ?? '',
        playerId: p.profile_id || '',
        entryMinute: isStarter ? 0 : Math.max(0, 80 - minutesPlayed),
        exitMinute: isStarter ? Math.min(80, minutesPlayed) : 80,
        tries: p.tries_count || 0,
        conversions: p.conversions_count || 0,
        penalties: p.penalties_count || 0,
        cards: (p.cards || []).map((c) => ({ type: c.type, minute: c.minute })),
      };
    });
  } else {
    actaBuilderRows = [emptyActaBuilderRow()];
  }
  actaBuilder.status = '';
  renderActaBuilderRows();
  actaBuilder.open = true;
}
export function closeMatchReportBuilderModal() {
  actaBuilder.open = false;
}

export function addActaBuilderRow() {
  actaBuilderRows.push(emptyActaBuilderRow());
  renderActaBuilderRows();
}
export function removeActaBuilderRow(i) {
  actaBuilderRows.splice(i, 1);
  renderActaBuilderRows();
}
export function updateActaBuilderRow(i, field, value) {
  const row = actaBuilderRows[i];
  if (!row) return;
  if (field === 'playerId') {
    row.playerId = value;
  } else if (field === 'jerseyNumber') {
    row.jerseyNumber = value === '' ? '' : parseInt(value, 10);
  } else {
    row[field] = value === '' ? 0 : parseInt(value, 10);
  }
}
export function addActaBuilderCard(i) {
  const row = actaBuilderRows[i];
  if (!row) return;
  row.cards.push({ type: 'amarilla', minute: null });
  renderActaBuilderRows();
}
export function updateActaBuilderCard(i, ci, field, value) {
  const card = actaBuilderRows[i] && actaBuilderRows[i].cards[ci];
  if (!card) return;
  card[field] = field === 'minute' ? (value === '' ? null : parseInt(value, 10)) : value;
}
export function removeActaBuilderCard(i, ci) {
  actaBuilderRows[i].cards.splice(ci, 1);
  renderActaBuilderRows();
}

function setStatus(color, text) {
  actaBuilder.statusColor = color;
  actaBuilder.status = text;
}

export async function saveActaBuilder() {
  const validRows = actaBuilderRows.filter((r) => r.playerId);
  if (validRows.length === 0) {
    setStatus('var(--bad)', 'Añade al menos una jugadora y elige su nombre.');
    return;
  }
  if (!partidoDetalle.currentId) {
    setStatus('var(--bad)', 'No se ha podido identificar el partido.');
    return;
  }

  actaBuilder.busy = true;
  setStatus('var(--text-muted)', 'Guardando acta…');

  try {
    const { error: headerError } = await supabase.from('match_reports').upsert({
      id: partidoDetalle.currentId,
      match_duration_minutes: 80,
      match_duration_estimated: false,
      updated_at: new Date().toISOString(),
    });
    if (headerError) throw new Error(headerError.message);

    // Se sustituye entera: se borran antes las jugadoras (y sus tarjetas) que
    // hubiera ya guardadas de este mismo partido, igual que hace la función Edge
    // al procesar un PDF, para que nunca se sumen datos de dos actas distintas.
    const { data: oldPlayers, error: oldPlayersError } = await supabase
      .from('match_report_players').select('id').eq('match_id', partidoDetalle.currentId);
    if (oldPlayersError) throw new Error(oldPlayersError.message);
    const oldIds = (oldPlayers || []).map((p) => p.id);
    if (oldIds.length) {
      const { error: delCardsError } = await supabase.from('match_report_cards').delete().in('match_report_player_id', oldIds);
      if (delCardsError) throw new Error(delCardsError.message);
    }
    const { error: delPlayersError } = await supabase.from('match_report_players').delete().eq('match_id', partidoDetalle.currentId);
    if (delPlayersError) throw new Error(delPlayersError.message);

    const rowsToInsert = validRows.map((r) => {
      const player = rosterById[r.playerId];
      const entry = Math.max(0, Math.min(80, Number(r.entryMinute) || 0));
      const exit = Math.max(0, Math.min(80, Number(r.exitMinute) || 0));
      return {
        match_id: partidoDetalle.currentId,
        profile_id: toRemotePlayerId(r.playerId),
        is_own_team: true,
        jersey_number: r.jerseyNumber === '' ? null : r.jerseyNumber,
        player_name: player ? player.name : null,
        license_number: player ? (player.licencia || null) : null,
        is_starter: entry === 0,
        minutes_played: Math.max(0, exit - entry),
        tries_count: Number(r.tries) || 0,
        conversions_count: Number(r.conversions) || 0,
        penalties_count: Number(r.penalties) || 0,
        points: (Number(r.tries) || 0) * 5 + (Number(r.conversions) || 0) * 2 + (Number(r.penalties) || 0) * 3,
        _cards: (r.cards || []).filter((c) => c.minute !== null && c.minute !== ''),
      };
    });

    const { data: inserted, error: insertError } = await supabase
      .from('match_report_players')
      .insert(rowsToInsert.map(({ _cards, ...row }) => row))
      .select('id');
    if (insertError) throw new Error(insertError.message);

    const cardRows = (inserted || []).flatMap((row, i) =>
      (rowsToInsert[i]._cards || []).map((c) => ({
        match_report_player_id: row.id,
        card_type: c.type,
        minute: c.minute,
      })),
    );
    if (cardRows.length) {
      const { error: cardsError } = await supabase.from('match_report_cards').insert(cardRows);
      if (cardsError) throw new Error(cardsError.message);
    }

    await loadMatchReport(partidoDetalle.currentId);
    setStatus('var(--ok)', '¡Acta guardada!');
    setTimeout(closeMatchReportBuilderModal, 900);
  } catch (e) {
    setStatus('var(--bad)', 'No se ha podido guardar: ' + e.message);
  } finally {
    actaBuilder.busy = false;
  }
}
