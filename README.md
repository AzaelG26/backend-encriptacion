# Chat con mensajes cifrados

Backend con Express + Socket.IO. Los mensajes se cifran al enviarse y se descifran al recibirse (AES-256-GCM).

## Configuración

```bash
cp .env.example .env
# Edita .env y define ENCRYPTION_KEY (32+ caracteres) en producción
npm install
npm start
```

Servidor en `http://localhost:3000`. El frontend del chat se sirve en la raíz (`/`); abre **http://localhost:3000** en el navegador. Si ya tenías el servidor corriendo, reinícialo (`Ctrl+C` y `npm start`) para que sirva el frontend.

### Entrar desde otros dispositivos en tu red

La **clave** solo la configuras tú en `.env`. Quien entre al chat **no pone la clave** en ningún sitio: el servidor se la envía al conectar.

1. Arranca el servidor (`npm start`). En la consola verás algo como `Red local: http://192.168.x.x:3000`.
2. En otro PC/móvil de la misma Wi‑Fi, abre en el navegador **esa URL** (la de tu IP + `:3000`).
3. El chat cargará y recibirá la clave automáticamente; ya puede enviar y recibir mensajes.

Si no pueden conectar, revisa que el firewall de Windows permita entrantes en el puerto 3000.

## API REST

| Método | Ruta | Body | Descripción |
|--------|------|------|-------------|
| POST | `/api/encrypt` | `{ "message": "texto" }` | Devuelve `{ iv, authTag, encrypted }` |
| POST | `/api/decrypt` | `{ "iv", "authTag", "encrypted" }` | Devuelve `{ "message": "..." }` |
| GET | `/api/encryption-key` | - | Clave en base64 (solo para demo; no exponer en producción) |

## Socket.IO (chat)

- **Conectar:** `io.connect('http://localhost:3000')`
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
