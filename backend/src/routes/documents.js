import { Router } from 'express';
import { pool, withTransaction } from '../db.js';
import { asyncHandler, HttpError, computeTotals, today, addDays, isDate, CURRENCIES } from '../utils.js';
import { renderPdf } from '../pdf.js';

// Factures et devis partagent la même logique : seule la config change.
const KINDS = {
  invoice: {
    table: 'invoices', lines: 'invoice_lines', fk: 'invoice_id', dateCol: 'due_date',
    prefixCol: 'invoice_prefix', manualStatuses: ['draft', 'sent', 'cancelled'],
  },
  quote: {
    table: 'quotes', lines: 'quote_lines', fk: 'quote_id', dateCol: 'valid_until',
    prefixCol: 'quote_prefix', manualStatuses: ['draft', 'sent', 'accepted', 'rejected'],
  },
};

// Pour les factures, « en retard » est calculé à la lecture (envoyée + échéance dépassée).
const displayStatus = (k) => k === 'invoice'
  ? "CASE WHEN d.status = 'sent' AND d.due_date < CURDATE() THEN 'overdue' ELSE d.status END"
  : 'd.status';

async function nextNumber(conn, companyId, kind, prefix, year) {
  await conn.query(
    'INSERT INTO counters (company_id, kind, year, value) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE value = value + 1',
    [companyId, kind, year],
  );
  // La ligne est verrouillée par notre transaction jusqu'au commit : pas de doublon possible.
  const [[row]] = await conn.query('SELECT value FROM counters WHERE company_id = ? AND kind = ? AND year = ?', [companyId, kind, year]);
  return `${prefix}-${year}-${String(row.value).padStart(4, '0')}`;
}

function validate(body, cfg) {
  if (!body.client_id) throw new HttpError(400, 'Choisis un client');
  if (!Array.isArray(body.lines) || body.lines.length === 0) throw new HttpError(400, 'Ajoute au moins une ligne');
  if (body.lines.some((l) => !String(l.description || '').trim())) throw new HttpError(400, 'Chaque ligne doit avoir une description');
  if (body.issue_date && !isDate(body.issue_date)) throw new HttpError(400, "Date d'émission invalide");
  if (body[cfg.dateCol] && !isDate(body[cfg.dateCol])) throw new HttpError(400, 'Date invalide');
  if (body.currency && !CURRENCIES.includes(body.currency)) throw new HttpError(400, 'Devise non supportée');
}

async function assertClient(conn, companyId, clientId) {
  const [[c]] = await conn.query('SELECT id FROM clients WHERE id = ? AND company_id = ?', [clientId, companyId]);
  if (!c) throw new HttpError(400, "Ce client n'appartient pas à cette entreprise");
}

/** Modèle choisi (de cette entreprise et du bon type), sinon le modèle par défaut du type, sinon aucun (apparence standard). */
async function resolveTemplate(db, companyId, kind, templateId) {
  if (templateId) {
    const [[t]] = await db.query('SELECT * FROM document_templates WHERE id = ? AND company_id = ? AND kind = ?', [templateId, companyId, kind]);
    if (!t) throw new HttpError(400, "Ce modèle n'existe pas pour cette entreprise");
    return t;
  }
  const [[t]] = await db.query('SELECT * FROM document_templates WHERE company_id = ? AND kind = ? AND is_default = 1 LIMIT 1', [companyId, kind]);
  return t || null;
}

async function insertLines(conn, cfg, docId, lines) {
  for (const l of lines) {
    await conn.query(`INSERT INTO ${cfg.lines} SET ?`, [{ ...l, [cfg.fk]: docId }]);
  }
}

async function createDocument(conn, kind, company, body, extra = {}) {
  const cfg = KINDS[kind];
  validate(body, cfg);
  await assertClient(conn, company.id, body.client_id);
  const issue = body.issue_date || today();
  const year = Number(issue.slice(0, 4));
  const defaultDays = kind === 'invoice' ? company.payment_terms_days : 30;
  const t = computeTotals(body.lines);
  const template = await resolveTemplate(conn, company.id, kind, body.template_id);
  const number = await nextNumber(conn, company.id, kind, company[cfg.prefixCol], year);
  const [r] = await conn.query(`INSERT INTO ${cfg.table} SET ?`, [{
    company_id: company.id,
    number,
    currency: body.currency || company.default_currency,
    template_id: template?.id ?? null,
    client_id: body.client_id,
    status: 'draft',
    issue_date: issue,
    [cfg.dateCol]: body[cfg.dateCol] || addDays(issue, defaultDays),
    subtotal: t.subtotal, discount_total: t.discount_total, tax_total: t.tax_total, total: t.total,
    notes: body.notes !== undefined ? body.notes || null : template?.notes ?? null,
    terms: body.terms !== undefined ? body.terms || null : template?.terms ?? company.default_terms ?? null,
    ...extra,
  }]);
  await insertLines(conn, cfg, r.insertId, t.lines);
  return r.insertId;
}

export async function loadDocument(kind, id, companyId) {
  const cfg = KINDS[kind];
  const [[doc]] = await pool.query(
    `SELECT d.*, ${displayStatus(kind)} AS display_status, c.name AS client_name
       FROM ${cfg.table} d JOIN clients c ON c.id = d.client_id WHERE d.id = ? AND d.company_id = ?`, [id, companyId]);
  if (!doc) throw new HttpError(404, 'Document introuvable');
  const [lines] = await pool.query(`SELECT * FROM ${cfg.lines} WHERE ${cfg.fk} = ? ORDER BY sort_order, id`, [id]);
  const [[client]] = await pool.query('SELECT * FROM clients WHERE id = ?', [doc.client_id]);
  const [[company]] = await pool.query('SELECT * FROM companies WHERE id = ?', [doc.company_id]);
  const template = await resolveTemplate(pool, doc.company_id, kind, null).catch(() => null);
  const own = doc.template_id
    ? (await pool.query('SELECT * FROM document_templates WHERE id = ?', [doc.template_id]))[0][0]
    : null;
  const result = { ...doc, lines, client, company, template: own || template };
  if (kind === 'invoice') {
    const [payments] = await pool.query('SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date, id', [id]);
    result.payments = payments;
    result.balance_due = Math.round((doc.total - doc.amount_paid) * 100) / 100;
  }
  return result;
}

export function documentsRouter(kind) {
  const cfg = KINDS[kind];
  const router = Router();

  router.get('/', asyncHandler(async (req, res) => {
    const { status, client_id, q } = req.query;
    const where = ['d.company_id = ?'];
    const params = [req.company.id];
    if (status) {
      if (kind === 'invoice' && status === 'overdue') where.push("d.status = 'sent' AND d.due_date < CURDATE()");
      else if (kind === 'invoice' && status === 'sent') where.push("d.status = 'sent' AND d.due_date >= CURDATE()");
      else { where.push('d.status = ?'); params.push(status); }
    }
    if (client_id) { where.push('d.client_id = ?'); params.push(client_id); }
    if (q) { where.push('(d.number LIKE ? OR c.name LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
    const [rows] = await pool.query(
      `SELECT d.*, ${displayStatus(kind)} AS display_status, c.name AS client_name
         FROM ${cfg.table} d JOIN clients c ON c.id = d.client_id
         WHERE ${where.join(' AND ')}
         ORDER BY d.issue_date DESC, d.id DESC LIMIT 500`, params);
    res.json(rows);
  }));

  router.get('/:id', asyncHandler(async (req, res) => res.json(await loadDocument(kind, req.params.id, req.company.id))));

  router.get('/:id/pdf', asyncHandler(async (req, res) => {
    renderPdf(res, kind, await loadDocument(kind, req.params.id, req.company.id));
  }));

  router.post('/', asyncHandler(async (req, res) => {
    const id = await withTransaction((conn) => createDocument(conn, kind, req.company, req.body || {}));
    res.status(201).json(await loadDocument(kind, id, req.company.id));
  }));

  router.put('/:id', asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await withTransaction(async (conn) => {
      const [[doc]] = await conn.query(`SELECT * FROM ${cfg.table} WHERE id = ? AND company_id = ? FOR UPDATE`, [id, req.company.id]);
      if (!doc) throw new HttpError(404, 'Document introuvable');
      if (doc.status !== 'draft') throw new HttpError(409, 'Seul un brouillon peut être modifié');
      const body = req.body || {};
      validate(body, cfg);
      await assertClient(conn, req.company.id, body.client_id);
      const t = computeTotals(body.lines);
      const template = body.template_id === undefined ? { id: doc.template_id } : await resolveTemplate(conn, req.company.id, kind, body.template_id);
      await conn.query(`UPDATE ${cfg.table} SET ? WHERE id = ?`, [{
        client_id: body.client_id,
        template_id: template?.id ?? null,
        currency: body.currency || doc.currency,
        issue_date: body.issue_date || doc.issue_date,
        [cfg.dateCol]: body[cfg.dateCol] || doc[cfg.dateCol],
        subtotal: t.subtotal, discount_total: t.discount_total, tax_total: t.tax_total, total: t.total,
        notes: body.notes || null, terms: body.terms || null,
      }, id]);
      await conn.query(`DELETE FROM ${cfg.lines} WHERE ${cfg.fk} = ?`, [id]);
      await insertLines(conn, cfg, id, t.lines);
    });
    res.json(await loadDocument(kind, id, req.company.id));
  }));

  // Copie un document en nouveau brouillon (nouveau numéro, dates du jour)
  router.post('/:id/duplicate', asyncHandler(async (req, res) => {
    const src = await loadDocument(kind, req.params.id, req.company.id);
    const id = await withTransaction((conn) => createDocument(conn, kind, req.company, {
      client_id: src.client_id, currency: src.currency, template_id: src.template_id ?? undefined,
      lines: src.lines, notes: src.notes, terms: src.terms,
    }));
    res.status(201).json(await loadDocument(kind, id, req.company.id));
  }));

  router.post('/:id/status', asyncHandler(async (req, res) => {
    const { status } = req.body || {};
    if (!cfg.manualStatuses.includes(status)) throw new HttpError(400, 'Statut non autorisé');
    const [[doc]] = await pool.query(`SELECT * FROM ${cfg.table} WHERE id = ? AND company_id = ?`, [req.params.id, req.company.id]);
    if (!doc) throw new HttpError(404, 'Document introuvable');
    if (doc.status === 'invoiced') throw new HttpError(409, 'Ce devis a déjà été transformé en facture');
    if (kind === 'invoice') {
      if (doc.status === 'paid') throw new HttpError(409, 'Une facture payée ne peut plus changer de statut');
      if (status === 'draft' && doc.amount_paid > 0) throw new HttpError(409, 'Des paiements sont enregistrés : repasse en brouillon impossible');
    }
    await pool.query(`UPDATE ${cfg.table} SET status = ? WHERE id = ?`, [status, req.params.id]);
    res.json(await loadDocument(kind, req.params.id, req.company.id));
  }));

  router.delete('/:id', asyncHandler(async (req, res) => {
    const [[doc]] = await pool.query(`SELECT * FROM ${cfg.table} WHERE id = ? AND company_id = ?`, [req.params.id, req.company.id]);
    if (!doc) throw new HttpError(404, 'Document introuvable');
    if (kind === 'invoice' && !['draft', 'cancelled'].includes(doc.status)) {
      throw new HttpError(409, 'Annule la facture avant de la supprimer');
    }
    if (kind === 'invoice' && doc.amount_paid > 0) throw new HttpError(409, 'Des paiements sont enregistrés sur cette facture');
    if (kind === 'quote' && doc.status === 'invoiced') throw new HttpError(409, 'Ce devis a été transformé en facture');
    await pool.query(`DELETE FROM ${cfg.table} WHERE id = ?`, [req.params.id]);
    res.status(204).end();
  }));

  if (kind === 'quote') {
    // Devis -> facture (brouillon), copie des lignes et de la devise
    router.post('/:id/convert', asyncHandler(async (req, res) => {
      const invoiceId = await withTransaction(async (conn) => {
        const [[quote]] = await conn.query('SELECT * FROM quotes WHERE id = ? AND company_id = ? FOR UPDATE', [req.params.id, req.company.id]);
        if (!quote) throw new HttpError(404, 'Devis introuvable');
        if (quote.status === 'invoiced') throw new HttpError(409, 'Ce devis a déjà été facturé');
        const [lines] = await conn.query('SELECT * FROM quote_lines WHERE quote_id = ? ORDER BY sort_order, id', [quote.id]);
        const id = await createDocument(conn, 'invoice', req.company, {
          client_id: quote.client_id, lines, notes: quote.notes, terms: quote.terms, currency: quote.currency,
        }, { quote_id: quote.id });
        await conn.query("UPDATE quotes SET status = 'invoiced' WHERE id = ?", [quote.id]);
        return id;
      });
      res.status(201).json(await loadDocument('invoice', invoiceId, req.company.id));
    }));
  }

  return router;
}
