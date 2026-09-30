<script>
  // Total de multas pendientes de todo el equipo en la tarjeta "Multas" de Vestuario
  // (se traduce con t(), así que se repinta solo al cambiar de idioma).
  import { vestuarioTotalText } from './multas.svelte.js';
</script>

<span id="vest-multas-total">{vestuarioTotalText()}</span>
