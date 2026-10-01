import { Router } from 'express';
import { pool } from '../db.js';
import { asyncHandler, CURRENCIES } from '../utils.js';

const router = Router();

/** Tableau de bord de l'entreprise courante, pour une devise (?currency=EUR). */
router.get('/', asyncHandler(async (req, res) => {
  const cid = req.company.id;
  const [used] = await pool.query(
    "SELECT DISTINCT currency FROM invoices WHERE company_id = ? UNION SELECT ?", [cid, req.company.default_currency]);
  const currencies = used.map((r) => r.currency).sort();
  const wanted = String(req.query.currency || '').toUpperCase();
  const currency = CURRENCIES.includes(wanted) ? wanted : req.company.default_currency;

  const [[kpi]] = await pool.query(`
    SELECT
      (SELECT COALESCE(SUM(p.amount),0) FROM payments p JOIN invoices i ON i.id = p.invoice_id
         WHERE i.company_id = ? AND i.currency = ? AND p.payment_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS collected_month,
      (SELECT COALESCE(SUM(total),0) FROM invoices
         WHERE company_id = ? AND currency = ? AND status IN ('sent','paid') AND YEAR(issue_date) = YEAR(CURDATE())) AS invoiced_year,
      (SELECT COALESCE(SUM(total - amount_paid),0) FROM invoices
         WHERE company_id = ? AND currency = ? AND status = 'sent') AS outstanding,
      (SELECT COALESCE(SUM(total - amount_paid),0) FROM invoices
         WHERE company_id = ? AND currency = ? AND status = 'sent' AND due_date < CURDATE()) AS overdue_amount,
      (SELECT COUNT(*) FROM invoices WHERE company_id = ? AND currency = ? AND status = 'sent' AND due_date < CURDATE()) AS overdue_count,
      (SELECT COUNT(*) FROM invoices WHERE company_id = ? AND status = 'draft') AS draft_count,
      (SELECT COUNT(*) FROM quotes WHERE company_id = ? AND status IN ('draft','sent')) AS open_quotes
  `, [cid, currency, cid, currency, cid, currency, cid, currency, cid, currency, cid, cid]);

  const [monthly] = await pool.query(`
    SELECT DATE_FORMAT(p.payment_date, '%Y-%m') AS month, SUM(p.amount) AS amount
      FROM payments p JOIN invoices i ON i.id = p.invoice_id
     WHERE i.company_id = ? AND i.currency = ?
       AND p.payment_date >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 11 MONTH)
     GROUP BY month`, [cid, currency]);
  const byMonth = Object.fromEntries(monthly.map((m) => [m.month, Number(m.amount)]));
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ month: key, amount: byMonth[key] || 0 });
  }

  const [overdue] = await pool.query(`
    SELECT i.id, i.number, i.due_date, i.total - i.amount_paid AS balance_due, i.currency, c.name AS client_name,
           DATEDIFF(CURDATE(), i.due_date) AS days_late
      FROM invoices i JOIN clients c ON c.id = i.client_id
     WHERE i.company_id = ? AND i.currency = ? AND i.status = 'sent' AND i.due_date < CURDATE()
     ORDER BY i.due_date LIMIT 5`, [cid, currency]);

  const [recent] = await pool.query(`
    SELECT i.id, i.number, i.issue_date, i.total, i.currency, c.name AS client_name,
           CASE WHEN i.status = 'sent' AND i.due_date < CURDATE() THEN 'overdue' ELSE i.status END AS display_status
      FROM invoices i JOIN clients c ON c.id = i.client_id
     WHERE i.company_id = ?
     ORDER BY i.created_at DESC LIMIT 6`, [cid]);

  res.json({ currency, currencies, kpi, monthly: months, overdue, recent });
}));

export default router;
