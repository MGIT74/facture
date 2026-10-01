import { Router } from 'express';
import { pool } from '../db.js';
import { asyncHandler, HttpError, CURRENCIES } from '../utils.js';
import { requireAdmin } from '../middleware.js';

const FIELDS = ['company_name', 'legal_name', 'siret', 'vat_number', 'address', 'postal_code', 'city', 'country',
  'email', 'phone', 'iban', 'bic', 'invoice_prefix', 'quote_prefix', 'default_currency', 'default_tax_rate',
  'payment_terms_days', 'default_terms'];

const router = Router();

function pick(body, creating) {
  const data = {};
  for (const f of FIELDS) if (body[f] !== undefined) data[f] = body[f] === '' ? null : body[f];
  if (creating && !data.company_name) throw new HttpError(400, "Le nom de l'entreprise est obligatoire");
  if ('company_name' in data && !data.company_name) throw new HttpError(400, "Le nom de l'entreprise est obligatoire");
  for (const f of ['invoice_prefix', 'quote_prefix']) if (f in data && !data[f]) delete data[f];
  if (data.default_currency && !CURRENCIES.includes(data.default_currency)) throw new HttpError(400, 'Devise non supportée');
  if (data.default_currency === null) delete data.default_currency;
  return data;
}

router.get('/', asyncHandler(async (_req, res) => {
  const [rows] = await pool.query('SELECT * FROM companies ORDER BY company_name');
  res.json(rows);
}));

router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const [r] = await pool.query('INSERT INTO companies SET ?', [pick(req.body || {}, true)]);
  const [[row]] = await pool.query('SELECT * FROM companies WHERE id = ?', [r.insertId]);
  res.status(201).json(row);
}));

router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const data = pick(req.body || {}, false);
  if (Object.keys(data).length) {
    const [r] = await pool.query('UPDATE companies SET ? WHERE id = ?', [data, req.params.id]);
    if (!r.affectedRows) throw new HttpError(404, 'Entreprise introuvable');
  }
  const [[row]] = await pool.query('SELECT * FROM companies WHERE id = ?', [req.params.id]);
  if (!row) throw new HttpError(404, 'Entreprise introuvable');
  res.json(row);
}));

router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM companies');
  if (n <= 1) throw new HttpError(409, 'Impossible de supprimer la dernière entreprise');
  try {
    await pool.query('DELETE FROM counters WHERE company_id = ?', [req.params.id]);
    const [r] = await pool.query('DELETE FROM companies WHERE id = ?', [req.params.id]);
    if (!r.affectedRows) throw new HttpError(404, 'Entreprise introuvable');
  } catch (e) {
    if (e.code === 'ER_ROW_IS_REFERENCED_2') {
      throw new HttpError(409, 'Cette entreprise contient encore des clients, produits, devis ou factures : supprime-les d\'abord.');
    }
    throw e;
  }
  res.status(204).end();
}));

export default router;
