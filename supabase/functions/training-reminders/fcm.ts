// ---- Firebase Cloud Messaging (API HTTP v1) ----
// Para mandar hace falta un token de acceso de Google, que se pide firmando un JWT con
// la clave de la cuenta de servicio de Firebase (secreto FIREBASE_SERVICE_ACCOUNT: el
// JSON que se descarga en Firebase → Configuración → Cuentas de servicio).

export type ServiceAccount = { client_email: string; private_key: string; project_id: string };

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const base64urlJson = (value: unknown) => base64url(new TextEncoder().encode(JSON.stringify(value)));

async function signingKey(pem: string) {
  const b64 = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

export async function fcmAccessToken(account: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64urlJson({ alg: 'RS256', typ: 'JWT' })}.${base64urlJson({
    iss: account.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600,
  })}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', await signingKey(account.private_key), new TextEncoder().encode(unsigned));

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${base64url(new Uint8Array(signature))}`,
    }),
  });
  if (!res.ok) throw new Error(`Google no ha dado el token de acceso (${res.status}): ${await res.text()}`);
  return (await res.json()).access_token;
}

export type SendResult = { ok: boolean; unregistered: boolean; error?: string };

// Manda un mensaje. unregistered = ese token ya no existe (app desinstalada, permiso
// retirado...), así que hay que borrarlo de push_subscriptions.
export async function sendFcm(accessToken: string, projectId: string, message: unknown): Promise<SendResult> {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  });
  if (res.ok) return { ok: true, unregistered: false };

  const text = await res.text();
  let errorCode = '';
  try {
    const details = JSON.parse(text).error?.details || [];
    errorCode = details.find((d: { errorCode?: string }) => d.errorCode)?.errorCode || '';
  } catch { /* respuesta que no es JSON */ }
  return { ok: false, unregistered: errorCode === 'UNREGISTERED', error: `${res.status} ${errorCode} ${text.slice(0, 200)}` };
}
