import bcrypt from 'bcryptjs';
import { pool } from './db.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Crée le premier administrateur à partir de ADMIN_EMAIL / ADMIN_PASSWORD,
 * uniquement si la table users est vide (utile au premier démarrage sous Docker).
 */
export async function bootstrapAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || !password) return;

  for (let attempt = 1; attempt <= 20; attempt++) {
    try {
      const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM users');
      if (n > 0) return;
      const hash = await bcrypt.hash(password, 10);
      await pool.query('INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)', [
        email, process.env.ADMIN_NAME || 'Administrateur', hash, 'admin',
      ]);
      console.log(`Compte administrateur créé : ${email}`);
      return;
    } catch (err) {
      if (attempt === 20) console.error('Création du compte admin impossible :', err.message);
      await sleep(3000); // base pas encore prête
    }
  }
}
