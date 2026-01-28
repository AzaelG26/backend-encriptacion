const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());

const server = http.createServer(app);

// const io = new Server(server, {
//   cors: { origin: "*" }
// });

app.get('/', (req, res) => {
  res.send('Servidor de mensajería cifrada activo 🔐');
});

// io.on('connection', (socket) => {
//   console.log('Usuario conectado:', socket.id);

//   socket.on('mensaje-cifrado', (data) => {
//     console.log('Mensaje cifrado recibido:', data);
//     socket.broadcast.emit('mensaje-cifrado', data);
//   });
// });

server.listen(3000, () => {
  console.log('Servidor corriendo en puerto 3000 🚀');
});