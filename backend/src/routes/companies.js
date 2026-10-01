import { Router } from 'express';
import { pool, withTransaction } from '../db.js';
import { asyncHandler, HttpError, CURRENCIES } from '../utils.js';
import { requireAdmin, companiesOf } from '../middleware.js';

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

/** L'entreprise doit faire partie de celles de l'utilisateur (sinon : comme si elle n'existait pas). */
async function ownCompany(req) {
  const company = (await companiesOf(req.user.id)).find((c) => c.id === Number(req.params.id));
  if (!company) throw new HttpError(404, 'Entreprise introuvable');
  return company;
}

// Uniquement les entreprises de l'utilisateur
router.get('/', asyncHandler(async (req, res) => {
  res.json((await companiesOf(req.user.id)).sort((a, b) => a.company_name.localeCompare(b.company_name)));
}));

// Un administrateur crée sa propre entreprise : il en devient membre, personne d'autre n'y a accès
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const data = pick(req.body || {}, true);
  const id = await withTransaction(async (conn) => {
    const [r] = await conn.query('INSERT INTO companies SET ?', [data]);
    await conn.query('INSERT INTO user_companies (user_id, company_id) VALUES (?, ?)', [req.user.id, r.insertId]);
    return r.insertId;
  });
  const [[row]] = await pool.query('SELECT * FROM companies WHERE id = ?', [id]);
  res.status(201).json(row);
}));

router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const company = await ownCompany(req);
  const data = pick(req.body || {}, false);
  if (Object.keys(data).length) await pool.query('UPDATE companies SET ? WHERE id = ?', [data, company.id]);
  const [[row]] = await pool.query('SELECT * FROM companies WHERE id = ?', [company.id]);
  res.json(row);
}));

router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const company = await ownCompany(req);
  try {
    // Dans une transaction : si l'entreprise contient des données, rien n'est supprimé (numérotation comprise)
    await withTransaction(async (conn) => {
      await conn.query('DELETE FROM counters WHERE company_id = ?', [company.id]);
      await conn.query('DELETE FROM companies WHERE id = ?', [company.id]);
    });
  } catch (e) {
    if (e.code === 'ER_ROW_IS_REFERENCED_2') {
      throw new HttpError(409, "Cette entreprise contient encore des clients, produits, devis ou factures : supprime-les d'abord.");
    }
    throw e;
  }
  res.status(204).end();
}));

export default router;
