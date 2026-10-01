import mysql from 'mysql2/promise';
import 'dotenv/config';

export const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'facturio',
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true, // DECIMAL renvoyés en nombres JS
  dateStrings: true,    // DATE renvoyées en 'YYYY-MM-DD'
  charset: 'utf8mb4',
});

/** Exécute fn(conn) dans une transaction (commit auto, rollback si erreur). */
export async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
