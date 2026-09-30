// Solo deja pasar enlaces http(s) y rutas relativas de la propia web. Un
// "javascript:..." guardado en Supabase se ejecutaría al hacer clic en el enlace.
export function safeUrl(url) {
  const value = String(url || '').trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//')) return '';
  return value;
}

// Para meter una URL dentro de url('...') en CSS sin poder cerrar la cadena.
export function cssUrl(url) {
  return safeUrl(url).replace(/['"\\\n\r()]/g, (c) => encodeURIComponent(c));
}
