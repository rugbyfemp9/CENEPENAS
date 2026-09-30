<script>
  // Una fila (jugadora) del constructor de actas a mano. Los campos solo escriben en el
  // dato de la fila (no reactivo): la fila entera se vuelve a crear al añadir/quitar.
  import { roster } from '../../lib/roster.js';
  import { t } from '../../lib/i18n.svelte.js';
  import {
    updateActaBuilderRow, removeActaBuilderRow, addActaBuilderCard, updateActaBuilderCard, removeActaBuilderCard,
  } from './builder.svelte.js';

  let { row, i } = $props();
</script>

<tr>
  <td><input type="number" min="0" max="99" value={row.jerseyNumber} style="width:52px;" oninput={(e) => updateActaBuilderRow(i, 'jerseyNumber', e.currentTarget.value)}></td>
  <td><select style="min-width:150px;" onchange={(e) => updateActaBuilderRow(i, 'playerId', e.currentTarget.value)}><option value="">{t('actas.choosePlayer')}</option>{#each roster as p}<option value={p.id} selected={row.playerId === p.id}>{p.name}</option>{/each}</select></td>
  <td><input type="number" min="0" max="80" value={row.entryMinute} style="width:56px;" oninput={(e) => updateActaBuilderRow(i, 'entryMinute', e.currentTarget.value)}></td>
  <td><input type="number" min="0" max="80" value={row.exitMinute} style="width:56px;" oninput={(e) => updateActaBuilderRow(i, 'exitMinute', e.currentTarget.value)}></td>
  <td><input type="number" min="0" value={row.tries} style="width:44px;" oninput={(e) => updateActaBuilderRow(i, 'tries', e.currentTarget.value)}></td>
  <td><input type="number" min="0" value={row.conversions} style="width:44px;" oninput={(e) => updateActaBuilderRow(i, 'conversions', e.currentTarget.value)}></td>
  <td><input type="number" min="0" value={row.penalties} style="width:44px;" oninput={(e) => updateActaBuilderRow(i, 'penalties', e.currentTarget.value)}></td>
  <td>
    <div style="display:flex; flex-wrap:wrap; gap:4px; align-items:center; min-width:130px;">
      {#each row.cards as card, ci}
        <span style="display:inline-flex; align-items:center; gap:3px; background:var(--bg-soft,#eef2f6); border-radius:6px; padding:2px 4px;">
          <select style="font-size:11px; padding:1px; border-radius:4px;" onchange={(e) => updateActaBuilderCard(i, ci, 'type', e.currentTarget.value)}>
            <option value="amarilla" selected={card.type === 'amarilla'}>{t('partido.cardYellow')}</option>
            <option value="roja" selected={card.type === 'roja'}>{t('partido.cardRed')}</option>
          </select>
          <input type="number" min="0" max="80" placeholder="min" value={card.minute ?? ''} style="width:38px; font-size:11px;" oninput={(e) => updateActaBuilderCard(i, ci, 'minute', e.currentTarget.value)}>
          <button type="button" onclick={() => removeActaBuilderCard(i, ci)} style="border:none; background:none; cursor:pointer; color:var(--bad); font-weight:700; padding:0 2px;">✕</button>
        </span>
      {/each}
      <button type="button" class="btn-ghost" style="padding:2px 8px; font-size:11px;" onclick={() => addActaBuilderCard(i)}>{t('actas.addCard')}</button>
    </div>
  </td>
  <td><button type="button" onclick={() => removeActaBuilderRow(i)} title={t('actas.removePlayer')} style="border:none; background:none; cursor:pointer; color:var(--bad); font-weight:700; font-size:14px; padding:2px 6px;">✕</button></td>
</tr>
