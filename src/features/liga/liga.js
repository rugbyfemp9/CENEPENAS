// Liga: clasificación y resultados de la Divisió d'Honor Catalana Femenina.
//
// rugby.cat no tiene la tabla: la carga en un iframe de matchready.es, que no bloquea
// que se incruste (sin X-Frame-Options ni CSP), así que Liga.svelte la muestra en
// directo igual. Los números 57/112 de la URL son la competición de esta temporada
// (2026-27): al cambiar de temporada, coge la URL nueva del iframe de la página de
// rugby.cat (y la página también puede cambiar de dirección).
export const LEAGUE_EMBED_URL = 'https://matchready.es/rugbycat/web/ca/public/calendar/57/112/combined/classification/';
export const LEAGUE_SOURCE_URL = 'https://rugby.cat/dhc-femenina/divisio-dhonor-catalana-femenina/';

// El iframe es de otro dominio y no podemos leer sus datos, así que la posición del
// CNPN en el banner de Inicio se pone a mano: actualízala cuando cambie.
export const LEAGUE_OWN_POSITION = 2;

export function ownPositionLabel() {
  return LEAGUE_OWN_POSITION ? `${LEAGUE_OWN_POSITION}º` : '—';
}
