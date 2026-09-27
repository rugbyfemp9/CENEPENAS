import { mount } from 'svelte';

// Monta un componente en el lugar exacto de un <div data-mount="nombre"> del armazón
// (src/shell/) y quita ese marcador, para que quede en la misma posición del DOM que
// ocupaba el marcado antiguo. El marcador es estático: Svelte no lo vuelve a tocar.
export function mountAt(Component, name, props = {}) {
  const placeholder = document.querySelector(`[data-mount="${name}"]`);
  if (!placeholder) throw new Error(`Falta <div data-mount="${name}"> en src/shell/`);
  const instance = mount(Component, { target: placeholder.parentNode, anchor: placeholder, props });
  placeholder.remove();
  return instance;
}

// Monta un componente dentro de un elemento existente (p.ej. <section id="sec-...">,
// que pinta src/shell/ y a la que la navegación le pone/quita la clase .active).
export function mountInto(Component, selector, props = {}) {
  const target = document.querySelector(selector);
  if (!target) throw new Error(`No existe ${selector} en src/shell/`);
  return mount(Component, { target, props });
}
