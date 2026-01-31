/**
 * Crea la base de datos y las tablas (users, sessions) en MySQL.
 * Ejecutar una vez: node scripts/init-db.js
 * Requiere .env con DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

const dbName = process.env.DB_NAME || 'chat_encriptacion';

async function run() {
  // Conectar sin base de datos para poder crear la BD
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });

  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log('Base de datos:', dbName, '(creada o ya existía)');

    await conn.changeUser({ database: dbName });

    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(20) PRIMARY KEY,
        username VARCHAR(64) NOT NULL UNIQUE,
        password_hash VARCHAR(128) NOT NULL,
        salt VARCHAR(32) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Tabla: users');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        token VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(20) NOT NULL,
        username VARCHAR(64) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('Tabla: sessions');

    console.log('Listo. Puedes ejecutar: npm start');
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
