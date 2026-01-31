const crypto = require('crypto');
const { pool } = require('./db');

const SALT_LENGTH = 16;
const KEY_LEN = 64;
const ITERATIONS = 100000;
const DIGEST = 'sha512';

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST).toString('base64');
}

async function createUser(username, password) {
  const norm = (username || '').trim().toLowerCase();
  if (!norm || norm.length < 2) return { error: 'Usuario mínimo 2 caracteres' };
  if (!password || password.length < 4) return { error: 'Contraseña mínimo 4 caracteres' };

  const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [norm]);
  if (existing.length > 0) return { error: 'Usuario ya existe' };

  const salt = crypto.randomBytes(SALT_LENGTH);
  const passwordHash = hashPassword(password, salt);
  const id = crypto.randomBytes(8).toString('hex');

  await pool.query(
    'INSERT INTO users (id, username, password_hash, salt) VALUES (?, ?, ?, ?)',
    [id, norm, passwordHash, salt.toString('base64')]
  );
  return { id, username: norm };
}

async function login(username, password) {
  const norm = (username || '').trim().toLowerCase();
  const [rows] = await pool.query(
    'SELECT id, username, password_hash, salt FROM users WHERE username = ?',
    [norm]
  );
  const user = rows[0];
  if (!user) return { error: 'Usuario o contraseña incorrectos' };

  const salt = Buffer.from(user.salt, 'base64');
  const hash = hashPassword(password, salt);
  if (hash !== user.password_hash) return { error: 'Usuario o contraseña incorrectos' };

  return { id: user.id, username: user.username };
}

async function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query(
    'INSERT INTO sessions (token, user_id, username) VALUES (?, ?, ?)',
    [token, user.id, user.username]
  );
  return { token, user: { id: user.id, username: user.username } };
}

async function getSession(token) {
  if (!token) return null;
  const [rows] = await pool.query(
    'SELECT user_id AS id, username FROM sessions WHERE token = ?',
    [token]
  );
  const row = rows[0];
  return row ? { id: row.id, username: row.username } : null;
}

module.exports = { createUser, login, createSession, getSession };
