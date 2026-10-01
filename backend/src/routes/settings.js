import { Router } from 'express';
import { pool } from '../db.js';
import { asyncHandler, HttpError } from '../utils.js';
import { requireAdmin } from '../middleware.js';

const FIELDS = ['company_name', 'legal_name', 'siret', 'vat_number', 'address', 'postal_code', 'city', 'country',
  'email', 'phone', 'iban', 'bic', 'invoice_prefix', 'quote_prefix', 'default_tax_rate', 'payment_terms_days', 'default_terms'];

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  const [[row]] = await pool.query('SELECT * FROM settings WHERE id = 1');
  res.json(row);
}));

router.put('/', requireAdmin, asyncHandler(async (req, res) => {
  const data = {};
  for (const f of FIELDS) if (req.body[f] !== undefined) data[f] = req.body[f] === '' ? null : req.body[f];
  if (data.company_name === null) throw new HttpError(400, "Le nom de l'entreprise est obligatoire");
  if (!data.invoice_prefix && 'invoice_prefix' in data) delete data.invoice_prefix;
  if (!data.quote_prefix && 'quote_prefix' in data) delete data.quote_prefix;
  if (Object.keys(data).length) await pool.query('UPDATE settings SET ? WHERE id = 1', [data]);
  const [[row]] = await pool.query('SELECT * FROM settings WHERE id = 1');
  res.json(row);
}));

export default router;
