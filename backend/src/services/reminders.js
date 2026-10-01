import { pool } from '../db.js';
import { r2 } from '../utils.js';
import { getEmailSettings, isConfigured, getTemplate, buildVariables, render, deliver } from './email.js';
import { loadDocument } from '../routes/documents.js';

const MIN_GAP_DAYS = 3; // jamais deux relances à moins de 3 jours d'écart sur la même facture
const MAX_PER_RUN = 50;
const dayDiff = (mysqlDateTime) => (mysqlDateTime ? (Date.now() - Date.parse(mysqlDateTime.replace(' ', 'T') + 'Z')) / 86400000 : Infinity);

/** Factures envoyées et échues, avec le prochain niveau de relance et s'il est dû aujourd'hui. */
export async function reminderCandidates(company, settings) {
  const [rows] = await pool.query(
    `SELECT i.id, i.number, i.due_date, i.total, i.amount_paid, i.currency, i.last_reminder_level, i.last_reminder_at,
            c.name AS client_name, c.email AS client_email, DATEDIFF(CURDATE(), i.due_date) AS days_late
       FROM invoices i JOIN clients c ON c.id = i.client_id
      WHERE i.company_id = ? AND i.status = 'sent' AND i.due_date < CURDATE()
      ORDER BY i.due_date`, [company.id]);
  const delays = [null, settings.reminder1_days, settings.reminder2_days, settings.reminder3_days];
  return rows.map((r) => {
    const next = r.last_reminder_level + 1 <= 3 ? r.last_reminder_level + 1 : null;
    const due = next !== null && r.days_late >= delays[next] && dayDiff(r.last_reminder_at) >= MIN_GAP_DAYS;
    return { ...r, balance_due: r2(r.total - r.amount_paid), next_level: next, due_now: due && !!r.client_email, no_email: !r.client_email };
  });
}

/** Envoie toutes les relances dues de l'entreprise. auto = déclenché par le planificateur (sans utilisateur). */
export async function runReminders(company, user, { auto = false } = {}) {
  const settings = await getEmailSettings(company.id);
  if (!isConfigured(settings)) return { sent: 0, failed: 0, results: [], error: "Serveur d'envoi non configuré" };
  const due = (await reminderCandidates(company, settings)).filter((c) => c.due_now).slice(0, MAX_PER_RUN);
  const results = [];
  for (const c of due) {
    const key = `reminder_${c.next_level}`;
    const doc = await loadDocument('invoice', c.id, company.id);
    const tpl = await getTemplate(company.id, key);
    const vars = buildVariables({ doc, company, settings, user });
    const r = await deliver({
      company, user, settings, kind: 'invoice', doc, templateKey: key, to: doc.client.email,
      subject: render(tpl.subject, vars), body: render(tpl.body, vars), attachPdf: true, automatic: auto,
    }).catch((e) => ({ ok: false, error: e.message }));
    results.push({ id: c.id, number: c.number, client: c.client_name, level: c.next_level, ok: r.ok, error: r.error });
  }
  return { sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results };
}
