import jwt from 'jsonwebtoken';
import { HttpError } from './utils.js';
import { pool } from './db.js';

/** Vérifie le jeton puis relit le compte en base : un compte supprimé ou rétrogradé perd ses droits immédiatement. */
export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new HttpError(401, 'Connexion requise');
    let payload;
    try { payload = jwt.verify(token, process.env.JWT_SECRET); }
    catch { throw new HttpError(401, 'Session expirée, reconnecte-toi'); }
    const [[user]] = await pool.query('SELECT id, name, email, role FROM users WHERE id = ?', [payload.id]);
    if (!user) throw new HttpError(401, 'Compte introuvable');
    req.user = user;
    next();
  } catch (e) { next(e); }
}

export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') return next(new HttpError(403, 'Réservé aux administrateurs'));
  next();
}

/** Entreprises auxquelles l'utilisateur a accès (et uniquement celles-ci). */
export async function companiesOf(userId) {
  const [rows] = await pool.query(
    `SELECT c.* FROM companies c JOIN user_companies uc ON uc.company_id = c.id WHERE uc.user_id = ? ORDER BY c.id`, [userId]);
  return rows;
}

/**
 * Entreprise courante (en-tête X-Company-Id), obligatoirement parmi celles de l'utilisateur.
 * Sans en-tête : la première. C'est ce contrôle qui garantit l'isolement entre espaces.
 */
export async function withCompany(req, _res, next) {
  try {
    const mine = await companiesOf(req.user.id);
    if (!mine.length) throw new HttpError(409, "Aucune entreprise : crées-en une d'abord");
    const raw = Number(req.headers['x-company-id']);
    const company = raw ? mine.find((c) => c.id === raw) : mine[0];
    if (!company) throw new HttpError(403, 'Accès refusé à cette entreprise');
    req.company = company;
    next();
  } catch (e) { next(e); }
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(409).json({ error: 'Suppression impossible : cet élément est utilisé dans des factures ou devis.' });
  }
  if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Cette valeur existe déjà.' });
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur' });
}
