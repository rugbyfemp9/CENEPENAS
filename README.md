# CENEPENAS

Panel del club CN Peñas. Es una web estática (sin framework ni paso de compilación)
publicada en GitHub Pages; la app de Capacitor carga esa misma URL. Los datos viven
en Supabase y las notificaciones push van por Firebase.

## Estructura

```
index.html            Marcado de todas las pantallas y el orden de carga de CSS/JS
css/                  Estilos, uno por sección (el orden de los <link> es la cascada)
js/
  push.js             Notificaciones push (Capacitor / Firebase / Web Push)
  core/               Piezas compartidas: almacenamiento, idioma, Supabase, sesión,
                      estado global, fechas, permisos por rol, navegación...
  features/           Una sección de la app por archivo (asistencia, multas, gym,
                      galería, fantasy, tesorería, tercer tiempo...)
  main.js             Arranque: lo que se ejecuta al cargar la página
  sw-register.js      Registro del service worker
assets/img/           Logos, escudos y portadas de la galería
sw.js                 Service worker (instalación como PWA + caché del cascarón)
firebase-messaging-sw.js  Service worker de las notificaciones en segundo plano
config.toml           Configuración local de Supabase
```

## Cómo funciona la carga de JS

Los archivos de `js/` son `<script>` clásicos, no módulos: todos comparten el ámbito
global, así que una función declarada en cualquier archivo se puede llamar desde otro
y desde los `onclick="..."` del HTML.

La única regla: **el código que se ejecuta al cargar la página va en `js/main.js`**,
que se carga el último. Los demás archivos solo declaran funciones y variables. Si un
archivo llamara al cargarse a una función de otro archivo que todavía no se ha
cargado, fallaría.

## Probar en local

```
python3 -m http.server 8000
```

y abrir http://localhost:8000/.
