import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { asyncHandler, HttpError } from '../utils.js';
import { requireAuth } from '../middleware.js';

const router = Router();

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw new HttpError(400, 'Email et mot de passe requis');
  const [[user]] = await pool.query('SELECT * FROM users WHERE email = ?', [String(email).trim().toLowerCase()]);
  const ok = user && (await bcrypt.compare(password, user.password_hash));
  if (!ok) throw new HttpError(401, 'Email ou mot de passe incorrect');
  const payload = { id: user.id, name: user.name, email: user.email, role: user.role };
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, user: payload });
}));

router.get('/me', requireAuth, (req, res) => res.json(req.user));

// Modifier son propre nom
router.put('/me', requireAuth, asyncHandler(async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) throw new HttpError(400, 'Le nom est obligatoire');
  await pool.query('UPDATE users SET name = ? WHERE id = ?', [name.slice(0, 120), req.user.id]);
  res.json({ ...req.user, name: name.slice(0, 120) });
}));

// Changer son propre mot de passe
router.put('/password', requireAuth, asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) throw new HttpError(400, 'Mot de passe actuel et nouveau mot de passe requis');
  if (String(new_password).length < 8) throw new HttpError(400, 'Le nouveau mot de passe doit faire au moins 8 caractères');
  const [[u]] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!(await bcrypt.compare(current_password, u.password_hash))) throw new HttpError(400, 'Mot de passe actuel incorrect');
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(new_password, 10), req.user.id]);
  res.status(204).end();
}));

export default router;
