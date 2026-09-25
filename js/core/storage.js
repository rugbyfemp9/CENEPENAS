/* ================= ALMACENAMIENTO (window.storage / localStorage) =================
   window.storage es la API de guardado que ofrece Claude.ai cuando este archivo se ve
   como artefacto dentro del chat. Si se abre de otra forma (doble clic, servidor propio,
   alojado en el club...) esa API no existe, así que aquí se crea un sustituto con el
   mismo formato pero apoyado en localStorage del navegador, para que guardar, publicar,
   etc. funcionen igual en cualquier sitio donde se abra el archivo. */
if(!window.storage){
  const LS_PREFIX = 'cnpenas:';
  window.storage = {
    async get(key, shared){
      const raw = localStorage.getItem(LS_PREFIX + key);
      if(raw === null) throw new Error('Clave no encontrada: ' + key);
      return { key, value: raw, shared: !!shared };
    },
    async set(key, value, shared){
      localStorage.setItem(LS_PREFIX + key, value);
      return { key, value, shared: !!shared };
    },
    async delete(key, shared){
      localStorage.removeItem(LS_PREFIX + key);
      return { key, deleted:true, shared: !!shared };
    },
    async list(prefix, shared){
      const keys = [];
      const p = LS_PREFIX + (prefix || '');
      for(let i = 0; i < localStorage.length; i++){
        const k = localStorage.key(i);
        if(k && k.indexOf(p) === 0) keys.push(k.slice(LS_PREFIX.length));
      }
      return { keys, prefix, shared: !!shared };
    }
  };
}

/* ================= CACHÉ CON CADUCIDAD (arranque más ligero) =================
   Guarda la última respuesta de una tabla en el dispositivo (vía window.storage,
   definido justo arriba) junto con la hora a la que se guardó. La próxima vez que
   se pida esa misma tabla, si la copia guardada tiene menos de CACHE_TTL_MS de
   antigüedad, la función que la usa la pinta al momento sin esperar a la red — y
   aun así sigue pidiendo la versión fresca por detrás para corregir cualquier
   diferencia. Esto NO sustituye a Supabase Realtime: los canales ya suscritos
   (subscribeToXRealtime) siguen avisando al instante de cualquier cambio real
   mientras la app está abierta; esta caché solo evita repetir la MISMA petición de
   arranque cada vez que alguien abre la app de nuevo, si mientras tanto no ha
   podido cambiar nada. Se usa solo en tablas de "referencia" que cambian poco
   (plantilla, ejercicios de gym, avisos, galería) — no en tablas que cambian todo
   el rato (asistencia, multas...), donde no aporta nada y solo añadiría complejidad.
*/
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

async function readCache(cacheKey){
  try{
    const raw = await window.storage.get('cache:' + cacheKey);
    const parsed = JSON.parse(raw.value);
    if(!parsed || (Date.now() - parsed.t) > CACHE_TTL_MS) return null;
    return parsed; // { t: <timestamp>, data: <lo que se guardó> }
  }catch(e){
    return null; // no había nada guardado, o estaba corrupto: como si no hubiera caché
  }
}
async function writeCache(cacheKey, data){
  try{
    await window.storage.set('cache:' + cacheKey, JSON.stringify({ t: Date.now(), data }));
  }catch(e){
    // Si falla guardar la caché no pasa nada grave: la próxima carga simplemente
    // volverá a pedirlo a la red, como si esta caché no existiera.
  }
}
