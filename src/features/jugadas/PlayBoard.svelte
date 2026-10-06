<script>
  // Pizarra en SVG: el campo en metros (mismo verde y líneas que el de Fantasy) y las
  // fichas encima. Solo pinta: quién la usa decide las posiciones (el visor las va
  // interpolando, el editor las mueve) y el encuadre (viewBox). Ver board.js.
  import { PITCH_W, PITCH_L } from './board.js';

  let {
    anim,                  // jugada normalizada (normalizeAnimation)
    positions,             // { id: [x, y] } a pintar
    viewBox,               // "x y w h" en metros
    ghost = null,          // posiciones del paso anterior (el editor las pinta en tenue)
    selectedId = null,
    ontokendown = null,    // (event, id) — solo el editor
    svg = $bindable(null),
    label = '',
  } = $props();

  const uid = $props.id();

  // Líneas horizontales del campo: [y, estilo]
  const LINES = [
    [0, 'main'], [10, 'main'], [15, 'dash'], [32, 'thin'], [50, 'dash'], [60, 'half'],
    [70, 'dash'], [88, 'thin'], [105, 'dash'], [110, 'main'], [120, 'main'],
  ];
  // Marcas a 5 m y 15 m de cada banda sobre las líneas de 5, 22, 10 y medio campo.
  const TICKS = [15, 32, 50, 60, 70, 88, 105].flatMap((y) => [5, 15, PITCH_W - 15, PITCH_W - 5].map((x) => [x, y]));
  // Franjas de césped cada 12 m, también fuera del campo (el encuadre puede salirse).
  const STRIPES = Array.from({ length: 16 }, (_, i) => -36 + i * 12);

  const moved = (id) => {
    if (!ghost || !ghost[id]) return false;
    const [x1, y1] = ghost[id];
    const [x2, y2] = positions[id];
    return Math.hypot(x2 - x1, y2 - y1) > 0.5;
  };
  const fmt = (n) => Math.round(n * 100) / 100;
</script>

<svg class="play-board" {viewBox} preserveAspectRatio="xMidYMid meet" bind:this={svg} role="img" aria-label={label || undefined}>
  <defs>
    <marker id="{uid}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
      <path d="M0 0L10 5L0 10z" fill="rgba(255,255,255,.85)" />
    </marker>
  </defs>

  <!-- Césped -->
  <rect x="-40" y="-40" width={PITCH_W + 80} height={PITCH_L + 80} fill="#2B9761" />
  {#each STRIPES as y, i (y)}
    {#if i % 2 === 0}<rect x="-40" {y} width={PITCH_W + 80} height="12" fill="#2E9E6C" />{/if}
  {/each}
  <rect x="0" y="0" width={PITCH_W} height="10" fill="rgba(14,27,45,.12)" />
  <rect x="0" y={PITCH_L - 10} width={PITCH_W} height="10" fill="rgba(14,27,45,.12)" />

  <!-- Líneas -->
  <g class="pitch-lines" fill="none" stroke-linecap="butt">
    <line x1="0" y1="0" x2="0" y2={PITCH_L} class="l-main" />
    <line x1={PITCH_W} y1="0" x2={PITCH_W} y2={PITCH_L} class="l-main" />
    {#each LINES as [y, kind] (y)}
      <line x1="0" y1={y} x2={PITCH_W} y2={y} class="l-{kind}" />
    {/each}
    {#each TICKS as [x, y] (`${x}-${y}`)}
      <line x1={x} y1={y - 0.8} x2={x} y2={y + 0.8} class="l-tick" />
    {/each}
  </g>

  <!-- Paso anterior, en tenue, con flecha hasta la posición actual (solo el editor) -->
  {#if ghost}
    <g class="board-ghost">
      {#each anim.tokens as tk (tk.id)}
        {#if moved(tk.id)}
          <line x1={ghost[tk.id][0]} y1={ghost[tk.id][1]} x2={positions[tk.id][0]} y2={positions[tk.id][1]}
                class="board-arrow" marker-end="url(#{uid}-arrow)" />
          {#if tk.team === 'ball'}
            <ellipse cx={ghost[tk.id][0]} cy={ghost[tk.id][1]} rx="0.9" ry="0.6" class="tk-ball" />
          {:else}
            <circle cx={ghost[tk.id][0]} cy={ghost[tk.id][1]} r="1.6" class="tk-{tk.team}" />
          {/if}
        {/if}
      {/each}
    </g>
  {/if}

  <!-- Fichas: el balón al final para que quede por encima de las jugadoras -->
  {#each [...anim.tokens].sort((a, b) => (a.team === 'ball') - (b.team === 'ball')) as tk (tk.id)}
    {@const p = positions[tk.id]}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <g class="board-token" class:selected={selectedId === tk.id} class:interactive={!!ontokendown}
       data-token={tk.id} transform="translate({fmt(p[0])} {fmt(p[1])})"
       onpointerdown={ontokendown ? (e) => ontokendown(e, tk.id) : undefined}>
      {#if ontokendown}<circle r="3.4" class="tk-hit" />{/if}
      {#if tk.team === 'ball'}
        <ellipse rx="0.9" ry="0.6" class="tk-ball" />
      {:else}
        <circle r="1.6" class="tk-{tk.team}" />
        {#if tk.label}<text class="tk-label" dy="0.62">{tk.label}</text>{/if}
      {/if}
    </g>
  {/each}
</svg>
