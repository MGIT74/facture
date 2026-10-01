import jwt from 'jsonwebtoken';
import { HttpError } from './utils.js';

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Connexion requise'));
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new HttpError(401, 'Session expirée, reconnecte-toi'));
  }
}

export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') return next(new HttpError(403, 'Réservé aux administrateurs'));
  next();
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
