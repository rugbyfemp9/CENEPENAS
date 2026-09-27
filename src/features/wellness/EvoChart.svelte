<script>
  // Gráfico de líneas dibujado a mano en SVG (sin librerías externas): RPE de 0 a 10 en
  // el eje Y, una sesión valorada por punto en el eje X, coloreado con la misma escala
  // Borg CR-10 de RPE_LEVELS. Un puntito rojo encima del punto marca los días con
  // molestias físicas.
  import { t } from '../../lib/i18n.svelte.js';
  import { wellnessRpeLevel } from './wellness.svelte.js';
  import { wellnessShortDateLabel } from './wellness-history.svelte.js';

  let { points } = $props();

  const W = 680, H = 200, padL = 26, padR = 12, padT = 16, padB = 24;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const n = $derived(points.length);
  const xPos = (i) => (n === 1 ? padL + innerW / 2 : padL + (innerW * i / (n - 1)));
  const yPos = (v) => padT + innerH - (Math.max(0, Math.min(10, v)) / 10) * innerH;

  const linePath = $derived(points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xPos(i).toFixed(1)} ${yPos(p.rpe).toFixed(1)}`).join(' '));
  const labelIdxs = $derived(n <= 6 ? points.map((_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1]);
</script>

<svg viewBox="0 0 {W} {H}">
  {#each [0, 5, 10] as v (v)}
    <line x1={padL} y1={yPos(v).toFixed(1)} x2={W - padR} y2={yPos(v).toFixed(1)} stroke="var(--line)" stroke-width="1" />
    <text x="2" y={(yPos(v) + 3.5).toFixed(1)} font-size="9" fill="var(--text-muted)">{v}</text>
  {/each}
  <path d={linePath} fill="none" stroke="var(--sky)" stroke-width="2" />
  {#each points as p, i}
    <circle cx={xPos(i).toFixed(1)} cy={yPos(p.rpe).toFixed(1)} r="4" fill={wellnessRpeLevel(Math.round(p.rpe)).color} stroke="#fff" stroke-width="1.4"><title>{wellnessShortDateLabel(p.iso)} · RPE {p.rpe.toFixed(1)}</title></circle>{#if p.hasDiscomfort}<circle cx={xPos(i).toFixed(1)} cy={(yPos(p.rpe) - 9).toFixed(1)} r="3" fill="var(--bad)"><title>{t('wstaff.evoDiscomfortMarker')}</title></circle>{/if}
  {/each}
  {#each labelIdxs as i}
    <text x={xPos(i).toFixed(1)} y={H - 6} font-size="9" fill="var(--text-muted)" text-anchor="middle">{wellnessShortDateLabel(points[i].iso)}</text>
  {/each}
</svg>
