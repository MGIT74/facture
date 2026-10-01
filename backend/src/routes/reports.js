import { Router } from 'express';
import { pool } from '../db.js';
import { asyncHandler, HttpError, CURRENCIES, isDate, today } from '../utils.js';

const router = Router();

function period(req) {
  const to = req.query.to || today();
  const from = req.query.from || `${to.slice(0, 4)}-01-01`;
  if (!isDate(from) || !isDate(to) || from > to) throw new HttpError(400, 'Période invalide');
  return { from, to };
}

/** Chiffres d'une période pour une devise : facturé, encaissé, reste à encaisser, TVA par taux, par mois, par client. */
router.get('/', asyncHandler(async (req, res) => {
  const cid = req.company.id;
  const { from, to } = period(req);
  const [cur] = await pool.query('SELECT DISTINCT currency FROM invoices WHERE company_id = ? UNION SELECT ?', [cid, req.company.default_currency]);
  const currencies = cur.map((r) => r.currency).sort();
  const wanted = String(req.query.currency || '').toUpperCase();
  const currency = CURRENCIES.includes(wanted) ? wanted : req.company.default_currency;
  const inPeriod = "i.company_id = ? AND i.currency = ? AND i.status IN ('sent','paid') AND i.issue_date BETWEEN ? AND ?";
  const args = [cid, currency, from, to];

  const [[totals]] = await pool.query(
    `SELECT COUNT(*) AS invoices, COALESCE(SUM(i.subtotal),0) AS ht, COALESCE(SUM(i.tax_total),0) AS tax, COALESCE(SUM(i.total),0) AS ttc,
            COALESCE(SUM(CASE WHEN i.status = 'sent' THEN i.total - i.amount_paid ELSE 0 END),0) AS outstanding,
            COALESCE(SUM(CASE WHEN i.status = 'sent' AND i.due_date < CURDATE() THEN i.total - i.amount_paid ELSE 0 END),0) AS overdue
       FROM invoices i WHERE ${inPeriod}`, args);
  const [[{ collected }]] = await pool.query(
    `SELECT COALESCE(SUM(p.amount),0) AS collected FROM payments p JOIN invoices i ON i.id = p.invoice_id
      WHERE i.company_id = ? AND i.currency = ? AND p.payment_date BETWEEN ? AND ?`, args);

  const [invMonths] = await pool.query(
    `SELECT DATE_FORMAT(i.issue_date, '%Y-%m') AS month, SUM(i.total) AS amount FROM invoices i WHERE ${inPeriod} GROUP BY month`, args);
  const [colMonths] = await pool.query(
    `SELECT DATE_FORMAT(p.payment_date, '%Y-%m') AS month, SUM(p.amount) AS amount FROM payments p JOIN invoices i ON i.id = p.invoice_id
      WHERE i.company_id = ? AND i.currency = ? AND p.payment_date BETWEEN ? AND ? GROUP BY month`, args);
  const months = [];
  for (let d = new Date(from.slice(0, 7) + '-01T00:00:00Z'); d <= new Date(to + 'T00:00:00Z') && months.length < 36; d.setUTCMonth(d.getUTCMonth() + 1)) {
    const m = d.toISOString().slice(0, 7);
    months.push({ month: m, invoiced: Number(invMonths.find((r) => r.month === m)?.amount || 0), collected: Number(colMonths.find((r) => r.month === m)?.amount || 0) });
  }

  const [byClient] = await pool.query(
    `SELECT c.id, c.name, COUNT(*) AS invoices, SUM(i.total) AS total, SUM(i.amount_paid) AS paid, SUM(i.total - i.amount_paid) AS balance
       FROM invoices i JOIN clients c ON c.id = i.client_id WHERE ${inPeriod} GROUP BY c.id, c.name ORDER BY total DESC LIMIT 10`, args);
  const [byTax] = await pool.query(
    `SELECT l.tax_rate, SUM(l.line_total) AS base, SUM(ROUND(l.line_total * l.tax_rate / 100, 2)) AS tax
       FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id WHERE ${inPeriod} GROUP BY l.tax_rate ORDER BY l.tax_rate`, args);
  const [quotes] = await pool.query(
    `SELECT status, COUNT(*) AS count, COALESCE(SUM(total),0) AS total FROM quotes
      WHERE company_id = ? AND currency = ? AND issue_date BETWEEN ? AND ? GROUP BY status`, args);

  res.json({ from, to, currency, currencies, totals: { ...totals, collected: Number(collected) }, months, by_client: byClient, by_tax: byTax, quotes });
}));

// ------------------------------------------------------------------ exports CSV (Excel français : « ; » et virgule décimale)
const STATUS = { draft: 'Brouillon', sent: 'Envoyée', paid: 'Payée', cancelled: 'Annulée', overdue: 'En retard', accepted: 'Accepté', rejected: 'Refusé', invoiced: 'Facturé' };
const METHOD = { bank_transfer: 'Virement', card: 'Carte', check: 'Chèque', cash: 'Espèces', other: 'Autre' };
const cell = (v) => {
  if (v === null || v === undefined) return '';
  let s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
  if (/^[=+\-@\t\r]/.test(s) && typeof v !== 'number') s = `'${s}`; // évite l'injection de formule dans Excel
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (header, rows) => '\uFEFF' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';

router.get('/export/:what', asyncHandler(async (req, res) => {
  const cid = req.company.id;
  const { from, to } = period(req);
  let header, rows, name;
  if (req.params.what === 'invoices') {
    [rows] = await pool.query(
      `SELECT i.number, c.name AS client, i.issue_date, i.due_date, i.currency, i.subtotal, i.tax_total, i.total, i.amount_paid,
              CASE WHEN i.status = 'sent' AND i.due_date < CURDATE() THEN 'overdue' ELSE i.status END AS status
         FROM invoices i JOIN clients c ON c.id = i.client_id WHERE i.company_id = ? AND i.issue_date BETWEEN ? AND ? ORDER BY i.issue_date, i.id`, [cid, from, to]);
    header = ['Numéro', 'Client', 'Date', 'Échéance', 'Statut', 'Devise', 'Total HT', 'TVA', 'Total TTC', 'Payé', 'Reste dû'];
    rows = rows.map((r) => [r.number, r.client, r.issue_date, r.due_date, STATUS[r.status], r.currency, r.subtotal, r.tax_total, r.total, r.amount_paid, Math.round((r.total - r.amount_paid) * 100) / 100]);
    name = 'factures';
  } else if (req.params.what === 'quotes') {
    [rows] = await pool.query(
      `SELECT q.number, c.name AS client, q.issue_date, q.valid_until, q.status, q.currency, q.subtotal, q.tax_total, q.total
         FROM quotes q JOIN clients c ON c.id = q.client_id WHERE q.company_id = ? AND q.issue_date BETWEEN ? AND ? ORDER BY q.issue_date, q.id`, [cid, from, to]);
    header = ['Numéro', 'Client', 'Date', 'Valable jusqu\'au', 'Statut', 'Devise', 'Total HT', 'TVA', 'Total TTC'];
    rows = rows.map((r) => [r.number, r.client, r.issue_date, r.valid_until, STATUS[r.status], r.currency, r.subtotal, r.tax_total, r.total]);
    name = 'devis';
  } else if (req.params.what === 'payments') {
    [rows] = await pool.query(
      `SELECT p.payment_date, i.number, c.name AS client, p.amount, i.currency, p.payment_method, p.reference
         FROM payments p JOIN invoices i ON i.id = p.invoice_id JOIN clients c ON c.id = i.client_id
        WHERE i.company_id = ? AND p.payment_date BETWEEN ? AND ? ORDER BY p.payment_date, p.id`, [cid, from, to]);
    header = ['Date', 'Facture', 'Client', 'Montant', 'Devise', 'Mode', 'Référence'];
    rows = rows.map((r) => [r.payment_date, r.number, r.client, r.amount, r.currency, METHOD[r.payment_method], r.reference]);
    name = 'paiements';
  } else if (req.params.what === 'clients') {
    [rows] = await pool.query('SELECT name, email, phone, address, postal_code, city, country, vat_number FROM clients WHERE company_id = ? ORDER BY name', [cid]);
    header = ['Nom', 'Email', 'Téléphone', 'Adresse', 'Code postal', 'Ville', 'Pays', 'N° TVA'];
    rows = rows.map((r) => [r.name, r.email, r.phone, r.address, r.postal_code, r.city, r.country, r.vat_number]);
    name = 'clients';
  } else throw new HttpError(404, 'Export inconnu');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}-${from}_${to}.csv"`);
  res.send(csv(header, rows));
}));

export default router;
