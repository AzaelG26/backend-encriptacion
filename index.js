const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { encrypt, decrypt, getKey } = require('./lib/encrypt');
const { createUser, login, createSession, getSession } = require('./lib/auth');
const { initDb } = require('./lib/db');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// --- Rutas API (antes de static para que /api/* siempre responda) ---

app.get('/api/health', (req, res) => {
  res.send('Servidor de mensajería cifrada activo 🔐');
});

app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await createUser(username, password);
    if (user.error) return res.status(400).json({ error: user.error });
    const session = await createSession(user);
    res.json(session);
  } catch (e) {
    console.error('Register error:', e);
    res.status(500).json({ error: 'Error al registrar' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await login(username, password);
    if (user.error) return res.status(401).json({ error: user.error });
    const session = await createSession(user);
    res.json(session);
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

app.get('/api/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
    const session = await getSession(token);
    if (!session) return res.status(401).json({ error: 'No autorizado' });
    res.json({ user: session });
  } catch (e) {
    res.status(500).json({ error: 'Error al verificar sesión' });
  }
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

// --- Servir frontend (después de todas las rutas /api) ---
app.use(express.static(path.join(__dirname, '..', 'frontend-encriptacion')));

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*' },
});

// --- Socket.IO: requiere token y asocia usuario ---
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    const session = await getSession(token);
    if (!session) return next(new Error('No autorizado'));
    socket.data.user = session;
    next();
  } catch (e) {
    next(new Error('No autorizado'));
  }
});

// --- Chat cifrado ---

const MAX_HISTORY = 500;
const messageHistory = [];

function addToHistory(envelope) {
  messageHistory.push(envelope);
  if (messageHistory.length > MAX_HISTORY) messageHistory.shift();
}

io.on('connection', (socket) => {
  const { username } = socket.data.user;
  console.log('Usuario conectado:', socket.id, username);

  socket.emit('encryption-key', { key: getKey().toString('base64') });
  socket.emit('chat:history', [...messageHistory]);

  socket.on('chat:send', (data) => {
    let envelope;
    try {
      if (data.encrypted != null && data.iv && data.authTag) {
        decrypt({ iv: data.iv, authTag: data.authTag, encrypted: data.encrypted });
        envelope = {
          id: socket.id,
          username,
          encrypted: data.encrypted,
          iv: data.iv,
          authTag: data.authTag,
          at: new Date().toISOString(),
        };
      } else if (typeof data.message === 'string') {
        const payload = encrypt(data.message);
        envelope = {
          id: socket.id,
          username,
          encrypted: payload.encrypted,
          iv: payload.iv,
          authTag: payload.authTag,
          at: new Date().toISOString(),
        };
      } else {
        return socket.emit('chat:error', { error: 'Envía { message } o { encrypted, iv, authTag }' });
      }
    } catch (e) {
      return socket.emit('chat:error', { error: 'Error al descifrar mensaje' });
    }
    addToHistory(envelope);
    io.emit('chat:message', envelope);
  });

  socket.on('disconnect', () => {
    console.log('Usuario desconectado:', socket.id, username);
  });
});

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await initDb();
    console.log('Base de datos MySQL conectada.');
  } catch (e) {
    console.error('Error al conectar con MySQL:', e.message);
    process.exit(1);
  }
  server.listen(PORT, '0.0.0.0', () => {
    console.log('Servidor en http://localhost:' + PORT + ' 🚀');
  });
}

start();
