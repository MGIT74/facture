import { Router } from 'express';
import { pool } from '../db.js';
import { asyncHandler, CURRENCIES } from '../utils.js';

const router = Router();

/** Tableau de bord de l'entreprise courante, pour une devise (?currency=EUR). */
router.get('/', asyncHandler(async (req, res) => {
  const cid = req.company.id;
  const [used] = await pool.query(
    'SELECT DISTINCT currency FROM invoices WHERE company_id = ? UNION SELECT ?', [cid, req.company.default_currency]);
  const currencies = used.map((r) => r.currency).sort();
  const wanted = String(req.query.currency || '').toUpperCase();
  const currency = CURRENCIES.includes(wanted) ? wanted : req.company.default_currency;

  const [[kpi]] = await pool.query(`
    SELECT
      (SELECT COALESCE(SUM(p.amount),0) FROM payments p JOIN invoices i ON i.id = p.invoice_id
         WHERE i.company_id = ? AND i.currency = ? AND p.payment_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS collected_month,
      (SELECT COALESCE(SUM(p.amount),0) FROM payments p JOIN invoices i ON i.id = p.invoice_id
         WHERE i.company_id = ? AND i.currency = ?
           AND p.payment_date >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)
           AND p.payment_date <  DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS collected_prev_month,
      (SELECT COALESCE(SUM(total),0) FROM invoices
         WHERE company_id = ? AND currency = ? AND status IN ('sent','paid') AND YEAR(issue_date) = YEAR(CURDATE())) AS invoiced_year,
      (SELECT COALESCE(SUM(total - amount_paid),0) FROM invoices
         WHERE company_id = ? AND currency = ? AND status = 'sent') AS outstanding,
      (SELECT COALESCE(SUM(total - amount_paid),0) FROM invoices
         WHERE company_id = ? AND currency = ? AND status = 'sent' AND due_date < CURDATE()) AS overdue_amount,
      (SELECT COUNT(*) FROM invoices WHERE company_id = ? AND currency = ? AND status = 'sent' AND due_date < CURDATE()) AS overdue_count,
      (SELECT COUNT(*) FROM invoices WHERE company_id = ? AND status = 'draft') AS draft_count,
      (SELECT COUNT(*) FROM quotes WHERE company_id = ? AND status IN ('draft','sent')) AS open_quotes
  `, [cid, currency, cid, currency, cid, currency, cid, currency, cid, currency, cid, currency, cid, cid]);

  // 12 derniers mois (du plus ancien au mois courant)
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const since = "DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 11 MONTH)";
  const [collected] = await pool.query(`
    SELECT i.currency, DATE_FORMAT(p.payment_date, '%Y-%m') AS month, SUM(p.amount) AS amount
      FROM payments p JOIN invoices i ON i.id = p.invoice_id
     WHERE i.company_id = ? AND p.payment_date >= ${since}
     GROUP BY i.currency, month`, [cid]);
  const [invoiced] = await pool.query(`
    SELECT currency, DATE_FORMAT(issue_date, '%Y-%m') AS month, SUM(total) AS amount
      FROM invoices
     WHERE company_id = ? AND status IN ('sent','paid') AND issue_date >= ${since}
     GROUP BY currency, month`, [cid]);
  const pick = (rows, cur) => months.map((m) => Number(rows.find((r) => r.currency === cur && r.month === m)?.amount || 0));
  const series = Object.fromEntries(currencies.map((c) => [c, { collected: pick(collected, c), invoiced: pick(invoiced, c) }]));

  // Une carte par devise utilisée
  const [perCurrency] = await pool.query(`
    SELECT currency,
           COALESCE(SUM(CASE WHEN status = 'sent' THEN total - amount_paid ELSE 0 END), 0) AS outstanding,
           COALESCE(SUM(CASE WHEN status = 'sent' AND due_date < CURDATE() THEN total - amount_paid ELSE 0 END), 0) AS overdue_amount,
           COALESCE(SUM(status = 'sent' AND due_date < CURDATE()), 0) AS overdue_count
      FROM invoices WHERE company_id = ? GROUP BY currency`, [cid]);
  const by_currency = currencies.map((c) => {
    const r = perCurrency.find((x) => x.currency === c) || {};
    return {
      currency: c,
      outstanding: Number(r.outstanding || 0),
      overdue_amount: Number(r.overdue_amount || 0),
      overdue_count: Number(r.overdue_count || 0),
      collected_month: series[c].collected[11],
    };
  });

  const [status_breakdown] = await pool.query(`
    SELECT CASE WHEN status = 'sent' AND due_date < CURDATE() THEN 'overdue' ELSE status END AS status,
           COUNT(*) AS count, COALESCE(SUM(total), 0) AS amount
      FROM invoices WHERE company_id = ? AND currency = ? GROUP BY 1`, [cid, currency]);

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

  res.json({ currency, currencies, months, kpi, by_currency, series, status_breakdown, overdue, recent });
}));

export default router;
