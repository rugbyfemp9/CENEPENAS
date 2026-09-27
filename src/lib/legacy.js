// Acceso al código antiguo (js/), que sigue cargándose con <script> clásicos.
//
// Sus `let`/`const`/`function` de primer nivel viven en el ámbito global, así que
// desde aquí se pueden leer por su nombre. Todo acceso desde Svelte pasa por este
// archivo para que quede a la vista qué depende todavía del código antiguo: cuando
// una pieza se migra, sale de aquí. Al final de la migración este archivo desaparece.
//
// Ya solo queda el armazón de la interfaz: la navegación entre secciones
// (js/core/navigation.js) y el cierre de sesión (js/core/auth.js).

/* global setSection, handleLogout */

export const legacy = {
  // Cerrar sesión (js/core/auth.js).
  logout: () => handleLogout(),
  setSection: (id, opts) => setSection(id, opts),
};
