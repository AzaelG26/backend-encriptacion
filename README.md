# Chat con mensajes cifrados

Backend con Express + Socket.IO. Los mensajes se cifran al enviarse y se descifran al recibirse (AES-256-GCM).

## Configuración

### 1. Variables de entorno

```bash
cp .env.example .env
# Edita .env: ENCRYPTION_KEY (32+ caracteres) y credenciales de MySQL
```

### 2. MySQL

Crea la base de datos y las tablas de una vez (un solo comando):

```bash
npm run init-db
```

Usa las variables de `.env`: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`. Si la base o las tablas ya existen, no las borra. Luego arranca el servidor con `npm start`.

### 3. Arrancar

```bash
npm install
npm start
```

Servidor en `http://localhost:3000`. El frontend (login/registro y chat) se sirve en la raíz (`/`). Las rutas `/api/*` se procesan antes que los archivos estáticos, así que `POST /api/register` y `POST /api/login` responden correctamente.

### Entrar desde otros dispositivos en tu red

La **clave** solo la configuras tú en `.env`. Quien entre al chat **no pone la clave** en ningún sitio: el servidor se la envía al conectar.

1. Arranca el servidor (`npm start`). En la consola verás algo como `Red local: http://192.168.x.x:3000`.
2. En otro PC/móvil de la misma Wi‑Fi, abre en el navegador **esa URL** (la de tu IP + `:3000`).
3. El chat cargará y recibirá la clave automáticamente; ya puede enviar y recibir mensajes.

Si no pueden conectar, revisa que el firewall de Windows permita entrantes en el puerto 3000.

## API REST

| Método | Ruta | Body | Descripción |
|--------|------|------|-------------|
| POST | `/api/register` | `{ "username", "password" }` | Registro; devuelve `{ token, user }` |
| POST | `/api/login` | `{ "username", "password" }` | Login; devuelve `{ token, user }` |
| GET | `/api/me` | Header `Authorization: Bearer <token>` o `?token=` | Devuelve `{ user }` si el token es válido |
| POST | `/api/encrypt` | `{ "message": "texto" }` | Devuelve `{ iv, authTag, encrypted }` |
| POST | `/api/decrypt` | `{ "iv", "authTag", "encrypted" }` | Devuelve `{ "message": "..." }` |
| GET | `/api/encryption-key` | - | Clave en base64 (solo para demo; no exponer en producción) |

## Socket.IO (chat)

- **Conectar:** `io.connect('http://localhost:3000', { auth: { token: '<token>' } })` — el token se obtiene de `/api/login` o `/api/register`.
- **Al conectar:** el servidor emite `encryption-key` con `{ key }` (base64) para cifrar/descifrar en el cliente.
- **Enviar mensaje:** emite `chat:send` con uno de:
  - `{ "message": "texto plano" }` → el servidor cifra y reenvía.
  - `{ "encrypted", "iv", "authTag" }` → el servidor descifra, vuelve a cifrar y reenvía.
- **Recibir mensajes:** escuchar `chat:message` → `{ id, encrypted, iv, authTag, at }`. Descifrar en el cliente con la clave recibida en `encryption-key`.
- **Historial al conectar:** el servidor emite `chat:history` con un array de los últimos mensajes (mismo formato). Así los mensajes persisten al recargar (en memoria; se pierden al reiniciar el servidor).
- **Errores:** escuchar `chat:error` → `{ "error": "..." }`.

## Flujo

1. El cliente recibe la clave vía `encryption-key` (o `/api/encryption-key`).
2. El cliente **cifra** el mensaje en el navegador y envía `chat:send` con `{ encrypted, iv, authTag }`.
3. El servidor descifra, vuelve a cifrar y hace broadcast.
4. Los clientes reciben `chat:message` cifrado y descifran localmente para mostrar el texto.

## Cómo ver que el mensaje viaja cifrado

Socket.IO usa **WebSockets** (no XHR/Fetch). En DevTools:

1. **F12** → pestaña **Red** (Network).
2. Filtra por **WS** (WebSocket) o busca la conexión que diga `socket.io`.
3. Haz clic en esa conexión → pestaña **Mensajes** (o **Messages**).
4. Envía un mensaje en el chat. Verás los **frames** del WebSocket: tanto al enviar como al recibir aparecen `encrypted`, `iv` y `authTag` en base64 (datos cifrados), no el texto en claro.
