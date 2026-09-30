// Importe en euros al estilo español, p.ej. "185,50 €" (siempre con dos decimales).
// La usan Tricount, Comi Tesoreria y Comi Tercer Temps.
export function formatEuro(n) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
