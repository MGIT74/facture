import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool, withTransaction } from '../db.js';
import { asyncHandler, HttpError } from '../utils.js';

// Monté derrière requireAuth + requireAdmin.
// Un administrateur ne voit et ne gère que : lui-même, les comptes qu'il a créés,
// et les comptes qui partagent au moins une de ses entreprises. Rien d'autre.
const router = Router();
const ROLES = ['admin', 'user'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const myCompanyIds = async (db, userId) =>
  (await db.query('SELECT company_id FROM user_companies WHERE user_id = ?', [userId]))[0].map((r) => r.company_id);

const VISIBLE = `(u.id = ? OR u.created_by = ? OR EXISTS (
  SELECT 1 FROM user_companies a JOIN user_companies b ON a.company_id = b.company_id WHERE a.user_id = ? AND b.user_id = u.id))`;

async function visibleUser(db, adminId, id) {
  const [[u]] = await db.query(
    `SELECT u.id, u.name, u.email, u.role, u.created_by, u.created_at FROM users u WHERE u.id = ? AND ${VISIBLE}`,
    [id, adminId, adminId, adminId]);
  return u || null;
}

function cleanIds(value, mine) {
  const ids = [...new Set((Array.isArray(value) ? value : []).map(Number).filter(Boolean))];
  if (ids.some((id) => !mine.includes(id))) throw new HttpError(403, "Tu ne peux donner accès qu'à tes propres entreprises");
  return ids;
}

router.get('/', asyncHandler(async (req, res) => {
  const me = req.user.id;
  const [users] = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.created_by, u.created_at FROM users u WHERE ${VISIBLE} ORDER BY u.name`, [me, me, me]);
  // Uniquement les entreprises que l'administrateur partage avec chaque compte (les autres restent invisibles)
  const [rows] = await pool.query(
    `SELECT uc.user_id, c.id, c.company_name FROM user_companies uc JOIN companies c ON c.id = uc.company_id
      WHERE uc.company_id IN (SELECT company_id FROM user_companies WHERE user_id = ?) AND uc.user_id IN (?)`,
    [me, users.map((u) => u.id)]);
  res.json(users.map((u) => ({
    ...u,
    is_me: u.id === me,
    created_by_me: u.created_by === me,
    companies: rows.filter((r) => r.user_id === u.id).map((r) => ({ id: r.id, name: r.company_name })),
  })));
}));

router.post('/', asyncHandler(async (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim();
  const email = String(b.email || '').trim().toLowerCase();
  const role = b.role || 'user';
  if (!name) throw new HttpError(400, 'Le nom est obligatoire');
  if (!EMAIL.test(email)) throw new HttpError(400, 'Email invalide');
  if (String(b.password || '').length < 8) throw new HttpError(400, 'Le mot de passe doit faire au moins 8 caractères');
  if (!ROLES.includes(role)) throw new HttpError(400, 'Rôle invalide');
  const ids = cleanIds(b.company_ids, await myCompanyIds(pool, req.user.id));
  // Un utilisateur simple doit avoir au moins une entreprise ; un administrateur peut démarrer sans (il créera la sienne)
  if (role === 'user' && !ids.length) throw new HttpError(400, 'Choisis au moins une entreprise pour cet utilisateur');

  const hash = await bcrypt.hash(String(b.password), 10);
  let id;
  try {
    id = await withTransaction(async (conn) => {
      const [r] = await conn.query('INSERT INTO users (name, email, password_hash, role, created_by) VALUES (?, ?, ?, ?, ?)',
        [name.slice(0, 120), email, hash, role, req.user.id]);
      for (const cid of ids) await conn.query('INSERT INTO user_companies (user_id, company_id) VALUES (?, ?)', [r.insertId, cid]);
      return r.insertId;
    });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Un compte existe déjà avec cet email');
    throw e;
  }
  res.status(201).json({ id, name, email, role, company_ids: ids });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const me = req.user.id;
  const u = await visibleUser(pool, me, Number(req.params.id));
  if (!u) throw new HttpError(404, 'Utilisateur introuvable');
  const b = req.body || {};
  if (u.id === me && (b.role !== undefined || b.company_ids !== undefined)) {
    throw new HttpError(400, 'Tu ne peux pas modifier ton propre rôle ou tes accès : utilise « Mon compte » pour le reste');
  }
  const data = {};
  if (b.name !== undefined) {
    if (!String(b.name).trim()) throw new HttpError(400, 'Le nom est obligatoire');
    data.name = String(b.name).trim().slice(0, 120);
  }
  if (b.role !== undefined) {
    if (!ROLES.includes(b.role)) throw new HttpError(400, 'Rôle invalide');
    data.role = b.role;
  }
  if (b.password) {
    if (String(b.password).length < 8) throw new HttpError(400, 'Le mot de passe doit faire au moins 8 caractères');
    data.password_hash = await bcrypt.hash(String(b.password), 10);
  }
  await withTransaction(async (conn) => {
    if (Object.keys(data).length) await conn.query('UPDATE users SET ? WHERE id = ?', [data, u.id]);
    if (Array.isArray(b.company_ids)) {
      const mine = await myCompanyIds(conn, me);
      const wanted = cleanIds(b.company_ids, mine);
      // On ne touche qu'aux accès sur MES entreprises ; ceux qu'il a ailleurs restent inchangés
      const current = (await myCompanyIds(conn, u.id)).filter((id) => mine.includes(id));
      for (const cid of wanted.filter((id) => !current.includes(id))) {
        await conn.query('INSERT INTO user_companies (user_id, company_id) VALUES (?, ?)', [u.id, cid]);
      }
      for (const cid of current.filter((id) => !wanted.includes(id))) {
        await conn.query('DELETE FROM user_companies WHERE user_id = ? AND company_id = ?', [u.id, cid]);
      }
    }
  });
  res.json({ ok: true });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const u = await visibleUser(pool, req.user.id, Number(req.params.id));
  if (!u) throw new HttpError(404, 'Utilisateur introuvable');
  if (u.id === req.user.id) throw new HttpError(400, 'Tu ne peux pas supprimer ton propre compte');
  await pool.query('DELETE FROM users WHERE id = ?', [u.id]);
  res.status(204).end();
}));

export default router;
