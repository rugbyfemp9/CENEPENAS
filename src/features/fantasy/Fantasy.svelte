<script>
  // Pantalla de Fantasy (<section id="sec-fantasy">): desplegable de partidos, botones
  // de acciones, banquillo de disponibles, campo con 15 + 8 camisetas y "Mis alineaciones".
  import { t } from '../../lib/i18n.svelte.js';
  import { legacy } from '../../lib/legacy.js';
  import {
    fantasy, pitchTicks, fantasyAvailablePlayers, fantasySlots, fantasyAllPositions, placedCount,
    onFantasyMatchChange, onBenchCardClick, onSlotClick, onBenchDragStart, onSlotDragStart,
    onSlotDragOver, onSlotDragLeave, onSlotDrop, onBenchDrop, onBenchTouchStart, onSlotTouchStart,
    onTouchDragMove, onTouchDragEnd, resetFantasyLineup, openSaveLineupModal, openPublishModal,
    openSharedLineupsModal, loadSavedLineup, deleteSavedLineup,
  } from './fantasy.svelte.js';

  const available = $derived(fantasyAvailablePlayers());
  const slots = $derived(fantasySlots());

  // Arrastre táctil: el dedo puede soltarse fuera del elemento en el que empezó, así
  // que el movimiento y el final se escuchan en todo el documento.
  $effect(() => {
    document.addEventListener('touchmove', onTouchDragMove, { passive: false });
    document.addEventListener('touchend', onTouchDragEnd);
    document.addEventListener('touchcancel', onTouchDragEnd);
    return () => {
      document.removeEventListener('touchmove', onTouchDragMove, { passive: false });
      document.removeEventListener('touchend', onTouchDragEnd);
      document.removeEventListener('touchcancel', onTouchDragEnd);
    };
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="back-link" onclick={() => legacy.setSection('vestuario')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg> <span>{t('fines.backLabel')}</span></div>
<div class="section-head">
  <h2>{t('nav.fantasy')}</h2>
</div>
<div class="fantasy-top">
  <label class="fantasy-label" for="fantasy-match-select">{t('fantasy.matchLabel')}</label>
  <select id="fantasy-match-select" class="fantasy-select" disabled={fantasy.matchSelectDisabled} bind:value={fantasy.selectedMatchId} onchange={(e) => onFantasyMatchChange(e.currentTarget.value)}>
    {#each fantasy.matchOptions as opt (opt.value)}
      <option value={opt.value}>{opt.text}</option>
    {/each}
  </select>
</div>

<div class="fantasy-actions">
  <button class="btn-ghost" onclick={openSharedLineupsModal}>{t('fantasy.shared')}</button>
  <button class="btn" onclick={openSaveLineupModal}>{t('fantasy.saveLineup')}</button>
  <button class="btn" style="background:linear-gradient(90deg,#7C5CD8,#5c3fb0);" onclick={openPublishModal}>{t('fantasy.publish')}</button>
</div>

<div class="fantasy-main">
  <aside class="fantasy-side">
    <div>
      <div class="fantasy-label"><span>{t('fantasy.available')}</span> <span id="fantasy-bench-count" class="fantasy-count">{fantasy.version ? available.length : 0}</span></div>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="fantasy-bench" id="fantasy-bench" ondragover={(e) => e.preventDefault()} ondrop={onBenchDrop}>
        {#if fantasy.version}
          {#if available.length === 0}
            {#if fantasy.selectedMatchId}
              <div class="fantasy-bench-empty">No hay jugadoras disponibles.</div>
            {:else}
              <div class="fantasy-bench-empty">Crea un partido en Asistencia para poder montar una alineación.</div>
            {/if}
          {:else}
            {#each available as p (p.id)}
              <button class="jersey-card" draggable="true" ondragstart={(e) => onBenchDragStart(e, p.id)}
                      ontouchstart={(e) => onBenchTouchStart(e, p.id)}
                      onclick={() => onBenchCardClick(p.id)} title={legacy.displayName(p)}>
                <div class="jersey-shape"><span class="jstripes"></span><span class="jsleeve l"></span><span class="jsleeve r"></span></div>
                <div class="jname">{legacy.displayName(p)}</div>
              </button>
            {/each}
          {/if}
        {/if}
      </div>
    </div>
  </aside>

  <div class="fantasy-pitch-col">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="fantasy-pitch" id="fantasy-pitch" ondragover={(e) => e.preventDefault()}>
      {#if fantasy.version}
        <button type="button" class="fantasy-pitch-refresh-btn" onclick={() => resetFantasyLineup()} title="Vaciar el campo" aria-label="Vaciar el campo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-3-6.7"/><path d="M21 3v6h-6"/></svg>
        </button>
        <div class="pitch-ingoal top"></div>
        <div class="pitch-ingoal bottom"></div>
        <div class="pitch-sideline left"></div>
        <div class="pitch-sideline right"></div>
        <div class="pitch-line dead-top"></div>
        <div class="pitch-line try-top"></div>
        <div class="pitch-line dashed-long line-5-top"></div>
        <div class="pitch-line line-22-top"></div>
        <div class="pitch-line dashed-long line-10-top"></div>
        <div class="pitch-line half"></div>
        <div class="pitch-line dashed-long line-10-bottom"></div>
        <div class="pitch-line line-22-bottom"></div>
        <div class="pitch-line dashed-long line-5-bottom"></div>
        <div class="pitch-line try-bottom"></div>
        <div class="pitch-line dead-bottom"></div>
        {#each pitchTicks as tick}<div class="pitch-tick" style="top:{tick.y}%;left:{tick.x}%;"></div>{/each}
        <div class="pitch-centerspot"></div>
        {#each slots as s (s.pos.num)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="rugby-slot {s.isSub ? 'pitch-slot sub-pitch-slot' : 'pitch-slot'}{s.filled ? ' filled' : ''}" class:drag-over={fantasy.dragOver.has(s.pos.num)} data-pos={s.pos.num} style="left:{s.pos.x}%; top:{s.pos.y}%;"
               ondragover={(e) => onSlotDragOver(e, s.pos.num)} ondragleave={(e) => onSlotDragLeave(e, s.pos.num)} ondrop={(e) => onSlotDrop(e, s.pos.num)}>
            <button class="slot-shape" draggable={s.filled ? 'true' : 'false'}
                    ondragstart={(e) => onSlotDragStart(e, s.pos.num)}
                    ontouchstart={(e) => onSlotTouchStart(e, s.pos.num)}
                    onclick={() => onSlotClick(s.pos.num)} title="{s.pos.num} · {s.pos.label}{s.filled ? ' · ' + s.name : ''}">
              {#if s.filled}
                <span class="jstripes"></span><span class="jsleeve l"></span><span class="jsleeve r"></span><span class="slot-num-filled">{s.pos.num}</span>
              {:else}
                <span class="slot-num">{s.pos.num}</span>
              {/if}
            </button>
            {#if s.filled}<span class="slot-pname">{s.name}</span>{/if}
          </div>
        {/each}
      {/if}
    </div>

    <div id="fantasy-saved-card" class="fantasy-saved-card">
      <div class="fantasy-label">{t('fantasy.myLineups')}</div>
      <div class="fantasy-saved-list" id="fantasy-saved-list">
        {#if fantasy.savedStatus === 'loading'}
          <div class="fantasy-saved-empty">Cargando…</div>
        {:else if fantasy.savedStatus === 'empty'}
          <div class="fantasy-saved-empty">Aún no tienes alineaciones guardadas para este partido.</div>
        {:else if fantasy.savedStatus === 'list'}
          {#each fantasy.savedItems as it (it.id)}
            <div class="fantasy-saved-item">
              <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
              <div class="info" onclick={() => loadSavedLineup(it.id)}>
                <b>{it.name}</b>
                <span>{placedCount(it.lineup)}/{fantasyAllPositions.length} colocadas</span>
              </div>
              <button class="del-btn" onclick={() => deleteSavedLineup(it.id)} title="Eliminar">✕</button>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
</div>
