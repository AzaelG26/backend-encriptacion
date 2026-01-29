const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Obtiene la clave de cifrado (32 bytes) desde ENV o genera una por defecto.
 * En producción DEBES definir ENCRYPTION_KEY en .env.
 */
function getKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (raw && raw.length >= 32) {
    return crypto.createHash('sha256').update(raw).digest();
  }
  return crypto.createHash('sha256').update('clave-default-cambiar-en-produccion').digest();
}

/**
 * Cifra un mensaje en texto plano. Devuelve un objeto con iv, authTag y encrypted en base64.
 * @param {string} plaintext - Mensaje a cifrar
 * @returns {{ iv: string, authTag: string, encrypted: string }}
 */
function encrypt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    encrypted,
  };
}

/**
 * Descifra un mensaje. Espera { iv, authTag, encrypted } en base64.
 * @param {{ iv: string, authTag: string, encrypted: string }} payload
 * @returns {string} Mensaje en texto plano
 */
function decrypt(payload) {
  const key = getKey();
  const iv = Buffer.from(payload.iv, 'base64');
  const authTag = Buffer.from(payload.authTag, 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(payload.encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports = { encrypt, decrypt, getKey };
