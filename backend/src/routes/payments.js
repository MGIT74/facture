import { Router } from 'express';
import { pool, withTransaction } from '../db.js';
import { asyncHandler, HttpError, r2, today, isDate } from '../utils.js';

const METHODS = ['bank_transfer', 'cash', 'check', 'card', 'other'];
const router = Router();

/** Recalcule amount_paid et le statut d'une facture à partir de ses paiements. */
async function syncInvoice(conn, invoiceId) {
  const [[inv]] = await conn.query('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
  const [[sum]] = await conn.query(
    'SELECT COALESCE(SUM(amount), 0) AS paid, MAX(payment_date) AS last_date FROM payments WHERE invoice_id = ?', [invoiceId]);
  const paid = r2(sum.paid);
  let status = inv.status;
  let paidDate = null;
  if (inv.status !== 'cancelled') {
    if (paid >= inv.total && inv.total > 0) { status = 'paid'; paidDate = sum.last_date; }
    else if (inv.status === 'paid' || inv.status === 'draft') status = 'sent';
  }
  await conn.query('UPDATE invoices SET amount_paid = ?, status = ?, paid_date = ? WHERE id = ?', [paid, status, paidDate, invoiceId]);
}

router.get('/', asyncHandler(async (req, res) => {
  const params = [];
  let where = '';
  if (req.query.invoice_id) { where = 'WHERE p.invoice_id = ?'; params.push(req.query.invoice_id); }
  const [rows] = await pool.query(
    `SELECT p.*, i.number AS invoice_number, c.name AS client_name
       FROM payments p JOIN invoices i ON i.id = p.invoice_id JOIN clients c ON c.id = i.client_id
       ${where} ORDER BY p.payment_date DESC, p.id DESC LIMIT 500`, params);
  res.json(rows);
}));

router.post('/', asyncHandler(async (req, res) => {
  const b = req.body || {};
  const amount = r2(b.amount);
  if (!b.invoice_id) throw new HttpError(400, 'Choisis une facture');
  if (!(amount > 0)) throw new HttpError(400, 'Le montant doit être supérieur à 0');
  if (b.payment_date && !isDate(b.payment_date)) throw new HttpError(400, 'Date invalide');
  if (b.payment_method && !METHODS.includes(b.payment_method)) throw new HttpError(400, 'Mode de paiement invalide');

  const id = await withTransaction(async (conn) => {
    const [[inv]] = await conn.query('SELECT * FROM invoices WHERE id = ? FOR UPDATE', [b.invoice_id]);
    if (!inv) throw new HttpError(404, 'Facture introuvable');
    if (inv.status === 'cancelled') throw new HttpError(409, 'Cette facture est annulée');
    if (amount > r2(inv.total - inv.amount_paid) + 0.005) {
      throw new HttpError(400, `Le montant dépasse le reste à payer (${r2(inv.total - inv.amount_paid)} €)`);
    }
    const [r] = await conn.query('INSERT INTO payments SET ?', [{
      invoice_id: inv.id, amount, payment_date: b.payment_date || today(),
      payment_method: b.payment_method || 'bank_transfer', reference: b.reference || null, notes: b.notes || null,
    }]);
    await syncInvoice(conn, inv.id);
    return r.insertId;
  });
  const [[row]] = await pool.query('SELECT * FROM payments WHERE id = ?', [id]);
  res.status(201).json(row);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await withTransaction(async (conn) => {
    const [[p]] = await conn.query('SELECT * FROM payments WHERE id = ?', [req.params.id]);
    if (!p) throw new HttpError(404, 'Paiement introuvable');
    await conn.query('SELECT id FROM invoices WHERE id = ? FOR UPDATE', [p.invoice_id]);
    await conn.query('DELETE FROM payments WHERE id = ?', [p.id]);
    await syncInvoice(conn, p.invoice_id);
  });
  res.status(204).end();
}));

export default router;
