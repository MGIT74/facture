import { Router } from 'express';
import { pool, withTransaction } from '../db.js';
import { asyncHandler, HttpError } from '../utils.js';
import { requireAdmin } from '../middleware.js';

const router = Router();
const KINDS = ['invoice', 'quote'];
const LAYOUTS = ['classic', 'modern', 'minimal'];
const LOGO = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/;
const LIST_COLS = `id, kind, name, is_default, layout, accent, title, show_discount, show_tax, show_bank, notes, terms, footer,
  (logo IS NOT NULL) AS has_logo, created_at, updated_at`;

const text = (v, max) => {
  if (v === undefined) return undefined;
  const s = String(v ?? '').trim();
  if (s.length > max) throw new HttpError(400, `Texte trop long (${max} caractères maximum)`);
  return s || null;
};
const bool = (v) => (v === undefined ? undefined : v ? 1 : 0);

function clean(body, creating) {
  const d = {};
  const name = text(body.name, 120);
  if (creating && !name) throw new HttpError(400, 'Le nom du modèle est obligatoire');
  if (name !== undefined) { if (!name) throw new HttpError(400, 'Le nom du modèle est obligatoire'); d.name = name; }
  if (creating) {
    if (!KINDS.includes(body.kind)) throw new HttpError(400, 'Type de modèle invalide (facture ou devis)');
    d.kind = body.kind;
  }
  if (body.layout !== undefined) {
    if (!LAYOUTS.includes(body.layout)) throw new HttpError(400, 'Disposition invalide');
    d.layout = body.layout;
  }
  if (body.accent !== undefined) {
    if (!/^#[0-9a-fA-F]{6}$/.test(body.accent)) throw new HttpError(400, 'Couleur invalide (format #RRGGBB)');
    d.accent = body.accent.toLowerCase();
  }
  const title = text(body.title, 60); if (title !== undefined) d.title = title;
  for (const f of ['show_discount', 'show_tax', 'show_bank']) { const v = bool(body[f]); if (v !== undefined) d[f] = v; }
  for (const [f, max] of [['notes', 4000], ['terms', 4000], ['footer', 1000]]) { const v = text(body[f], max); if (v !== undefined) d[f] = v; }
  if (body.logo !== undefined) {
    if (body.logo === null || body.logo === '') d.logo = null;
    else if (typeof body.logo !== 'string' || !LOGO.test(body.logo)) throw new HttpError(400, 'Logo invalide : image PNG ou JPEG uniquement');
    else if (body.logo.length > 600_000) throw new HttpError(400, 'Logo trop lourd (environ 400 Ko maximum)');
    else d.logo = body.logo;
  }
  return d;
}

router.get('/', asyncHandler(async (req, res) => {
  const params = [req.company.id];
  let where = 'company_id = ?';
  if (req.query.kind) { where += ' AND kind = ?'; params.push(req.query.kind); }
  const [rows] = await pool.query(`SELECT ${LIST_COLS} FROM document_templates WHERE ${where} ORDER BY kind, is_default DESC, name`, params);
  res.json(rows);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const [[row]] = await pool.query('SELECT * FROM document_templates WHERE id = ? AND company_id = ?', [req.params.id, req.company.id]);
  if (!row) throw new HttpError(404, 'Modèle introuvable');
  res.json(row);
}));

router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const d = clean(req.body || {}, true);
  const id = await withTransaction(async (conn) => {
    const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM document_templates WHERE company_id = ? AND kind = ?', [req.company.id, d.kind]);
    // Le premier modèle d'un type devient le modèle par défaut ; ensuite seulement sur demande
    const makeDefault = n === 0 || !!req.body.is_default;
    if (makeDefault) await conn.query('UPDATE document_templates SET is_default = 0 WHERE company_id = ? AND kind = ?', [req.company.id, d.kind]);
    const [r] = await conn.query('INSERT INTO document_templates SET ?', [{ ...d, company_id: req.company.id, is_default: makeDefault ? 1 : 0 }]);
    return r.insertId;
  });
  const [[row]] = await pool.query('SELECT * FROM document_templates WHERE id = ?', [id]);
  res.status(201).json(row);
}));

router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const d = clean(req.body || {}, false);
  await withTransaction(async (conn) => {
    const [[t]] = await conn.query('SELECT * FROM document_templates WHERE id = ? AND company_id = ? FOR UPDATE', [req.params.id, req.company.id]);
    if (!t) throw new HttpError(404, 'Modèle introuvable');
    if (req.body.is_default === true) {
      await conn.query('UPDATE document_templates SET is_default = 0 WHERE company_id = ? AND kind = ?', [req.company.id, t.kind]);
      d.is_default = 1;
    }
    if (Object.keys(d).length) await conn.query('UPDATE document_templates SET ? WHERE id = ?', [d, t.id]);
  });
  const [[row]] = await pool.query('SELECT * FROM document_templates WHERE id = ?', [req.params.id]);
  res.json(row);
}));

router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const [r] = await pool.query('DELETE FROM document_templates WHERE id = ? AND company_id = ?', [req.params.id, req.company.id]);
  if (!r.affectedRows) throw new HttpError(404, 'Modèle introuvable');
  res.status(204).end();
}));

export default router;
