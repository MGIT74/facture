// Usage : npm run create-user -- email@exemple.fr "Prénom Nom" motdepasse [admin|user]
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';

const [email, name, password, role = 'admin'] = process.argv.slice(2);
if (!email || !name || !password) {
  console.error('Usage : npm run create-user -- email "Nom" motdepasse [admin|user]');
  process.exit(1);
}
const hash = await bcrypt.hash(password, 10);
await pool.query(
  'INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash), role = VALUES(role)',
  [email.toLowerCase(), name, hash, role],
);
console.log(`Utilisateur ${email} (${role}) créé / mis à jour.`);
await pool.end();
