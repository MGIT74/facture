import { Router } from 'express';
import { pool } from '../db.js';
import { asyncHandler, HttpError } from '../utils.js';

/**
 * Fabrique un CRUD pour une table rattachée à une entreprise (company_id).
 * Toutes les requêtes sont limitées à l'entreprise courante (req.company).
 */
export function crudRouter({ table, fields, required = [], search = ['name'], orderBy = 'name' }) {
  const router = Router();

  const pick = (body) => {
    const data = {};
    for (const f of fields) {
      if (body[f] !== undefined) data[f] = body[f] === '' ? null : body[f];
    }
    for (const f of required) {
      if (data[f] === undefined || data[f] === null) throw new HttpError(400, `Le champ « ${f} » est obligatoire`);
    }
    return data;
  };

  router.get('/', asyncHandler(async (req, res) => {
    const q = (req.query.q || '').trim();
    let sql = `SELECT * FROM ${table} WHERE company_id = ?`;
    const params = [req.company.id];
    if (q) {
      sql += ' AND (' + search.map((f) => `${f} LIKE ?`).join(' OR ') + ')';
      search.forEach(() => params.push(`%${q}%`));
    }
    sql += ` ORDER BY ${orderBy} LIMIT 1000`;
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  }));

  router.get('/:id', asyncHandler(async (req, res) => {
    const [[row]] = await pool.query(`SELECT * FROM ${table} WHERE id = ? AND company_id = ?`, [req.params.id, req.company.id]);
    if (!row) throw new HttpError(404, 'Introuvable');
    res.json(row);
  }));

  router.post('/', asyncHandler(async (req, res) => {
    const data = { ...pick(req.body || {}), company_id: req.company.id };
    const [r] = await pool.query(`INSERT INTO ${table} SET ?`, [data]);
    const [[row]] = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [r.insertId]);
    res.status(201).json(row);
  }));

  router.put('/:id', asyncHandler(async (req, res) => {
    const data = pick(req.body || {});
    const [r] = await pool.query(`UPDATE ${table} SET ? WHERE id = ? AND company_id = ?`, [data, req.params.id, req.company.id]);
    if (!r.affectedRows) throw new HttpError(404, 'Introuvable');
    const [[row]] = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id]);
    res.json(row);
  }));

  router.delete('/:id', asyncHandler(async (req, res) => {
    const [r] = await pool.query(`DELETE FROM ${table} WHERE id = ? AND company_id = ?`, [req.params.id, req.company.id]);
    if (!r.affectedRows) throw new HttpError(404, 'Introuvable');
    res.status(204).end();
  }));

  return router;
}

export const clientsRouter = () => crudRouter({
  table: 'clients',
  fields: ['name', 'email', 'phone', 'address', 'postal_code', 'city', 'country', 'vat_number', 'notes'],
  required: ['name'],
  search: ['name', 'email', 'city'],
});

export const itemsRouter = () => crudRouter({
  table: 'items',
  fields: ['name', 'description', 'unit_price', 'tax_rate', 'unit'],
  required: ['name', 'unit_price'],
  search: ['name', 'description'],
});
