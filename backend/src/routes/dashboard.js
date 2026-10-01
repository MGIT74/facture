import { Router } from 'express';
import { pool } from '../db.js';
import { asyncHandler } from '../utils.js';

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  const [[kpi]] = await pool.query(`
    SELECT
      (SELECT COALESCE(SUM(amount),0) FROM payments
         WHERE payment_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS collected_month,
      (SELECT COALESCE(SUM(total),0) FROM invoices
         WHERE status IN ('sent','paid') AND YEAR(issue_date) = YEAR(CURDATE())) AS invoiced_year,
      (SELECT COALESCE(SUM(total - amount_paid),0) FROM invoices WHERE status = 'sent') AS outstanding,
      (SELECT COALESCE(SUM(total - amount_paid),0) FROM invoices
         WHERE status = 'sent' AND due_date < CURDATE()) AS overdue_amount,
      (SELECT COUNT(*) FROM invoices WHERE status = 'sent' AND due_date < CURDATE()) AS overdue_count,
      (SELECT COUNT(*) FROM invoices WHERE status = 'draft') AS draft_count,
      (SELECT COUNT(*) FROM quotes WHERE status IN ('draft','sent')) AS open_quotes
  `);

  const [monthly] = await pool.query(`
    SELECT DATE_FORMAT(payment_date, '%Y-%m') AS month, SUM(amount) AS amount
      FROM payments
     WHERE payment_date >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 11 MONTH)
     GROUP BY month`);
  const byMonth = Object.fromEntries(monthly.map((m) => [m.month, Number(m.amount)]));
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ month: key, amount: byMonth[key] || 0 });
  }

  const [overdue] = await pool.query(`
    SELECT i.id, i.number, i.due_date, i.total - i.amount_paid AS balance_due, c.name AS client_name,
           DATEDIFF(CURDATE(), i.due_date) AS days_late
      FROM invoices i JOIN clients c ON c.id = i.client_id
     WHERE i.status = 'sent' AND i.due_date < CURDATE()
     ORDER BY i.due_date LIMIT 5`);

  const [recent] = await pool.query(`
    SELECT i.id, i.number, i.issue_date, i.total, c.name AS client_name,
           CASE WHEN i.status = 'sent' AND i.due_date < CURDATE() THEN 'overdue' ELSE i.status END AS display_status
      FROM invoices i JOIN clients c ON c.id = i.client_id
     ORDER BY i.created_at DESC LIMIT 6`);

  res.json({ kpi, monthly: months, overdue, recent });
}));

export default router;
