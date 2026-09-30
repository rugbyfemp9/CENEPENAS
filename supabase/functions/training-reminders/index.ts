// Punto de entrada de la función de Supabase: ver handler.ts.
import { handle } from './handler.ts';

Deno.serve((req) => handle(req));
