const express = require('express');
const http = require('http');
const path = require('path');
const os = require('os');
const { Server } = require('socket.io');
const { encrypt, decrypt, getKey } = require('./lib/encrypt');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

app.use(express.static(path.join(__dirname, '..', 'frontend-encriptacion')));

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*' },
});

// --- Rutas REST ---

app.get('/api/health', (req, res) => {
  res.send('Servidor de mensajería cifrada activo 🔐');
});

/** Cifrar mensaje. POST /api/encrypt { "message": "texto" } */
app.post('/api/encrypt', (req, res) => {
  try {
    const { message } = req.body;
    if (typeof message !== 'string') {
      return res.status(400).json({ error: 'Se requiere "message" (string)' });
    }
    const payload = encrypt(message);
    res.json(payload);
  } catch (e) {
    res.status(500).json({ error: 'Error al cifrar', detail: e.message });
  }
});

/** Descifrar mensaje. POST /api/decrypt { "iv", "authTag", "encrypted" } */
app.post('/api/decrypt', (req, res) => {
  try {
    const { iv, authTag, encrypted } = req.body;
    if (!iv || !authTag || !encrypted) {
      return res.status(400).json({ error: 'Se requieren "iv", "authTag" y "encrypted"' });
    }
    const message = decrypt({ iv, authTag, encrypted });
    res.json({ message });
  } catch (e) {
    res.status(500).json({ error: 'Error al descifrar', detail: e.message });
  }
});

/** Clave en base64 para que el frontend pueda cifrar/descifrar (solo desarrollo/demo) */
app.get('/api/encryption-key', (req, res) => {
  const key = getKey();
  res.json({ key: key.toString('base64') });
});

// --- Socket.IO: Chat cifrado ---

const MAX_HISTORY = 500;
const messageHistory = [];

function addToHistory(envelope) {
  messageHistory.push(envelope);
  if (messageHistory.length > MAX_HISTORY) messageHistory.shift();
}

io.on('connection', (socket) => {
  console.log('Usuario conectado:', socket.id);

  socket.emit('encryption-key', { key: getKey().toString('base64') });
  socket.emit('chat:history', [...messageHistory]);

  socket.on('chat:send', (data) => {
    let plain;
    try {
      if (data.encrypted != null && data.iv && data.authTag) {
        plain = decrypt({ iv: data.iv, authTag: data.authTag, encrypted: data.encrypted });
      } else if (typeof data.message === 'string') {
        plain = data.message;
      } else {
        return socket.emit('chat:error', { error: 'Envía { message } o { encrypted, iv, authTag }' });
      }
    } catch (e) {
      return socket.emit('chat:error', { error: 'Error al descifrar mensaje' });
    }

    const payload = encrypt(plain);
    const envelope = {
      id: socket.id,
      encrypted: payload.encrypted,
      iv: payload.iv,
      authTag: payload.authTag,
      at: new Date().toISOString(),
    };
    addToHistory(envelope);
    io.emit('chat:message', envelope);
  });

  socket.on('disconnect', () => {
    console.log('Usuario desconectado:', socket.id);
  });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('Servidor en http://localhost:' + PORT + ' 🚀');
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log('  Red local: http://' + iface.address + ':' + PORT + ' (comparte esta URL para que entren otros)');
      }
    }
  }
});
