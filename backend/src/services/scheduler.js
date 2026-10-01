import { pool } from '../db.js';
import { runReminders } from './reminders.js';

/**
 * Relances automatiques : une vérification par heure, exécutée uniquement à l'heure configurée (UTC, 8 h par défaut).
 * Désactivées tant que l'entreprise n'a pas coché « Relances automatiques » (et configuré son SMTP).
 * REMINDERS_HOUR change l'heure ; DISABLE_SCHEDULER=1 coupe le planificateur.
 */
export async function runScheduledReminders({ ignoreHour = false } = {}) {
  const hour = Number(process.env.REMINDERS_HOUR ?? 8);
  if (!ignoreHour && new Date().getUTCHours() !== hour) return;
  try {
    const [rows] = await pool.query(
      `SELECT c.* FROM companies c JOIN email_settings s ON s.company_id = c.id
        WHERE s.reminders_enabled = 1 AND s.smtp_host IS NOT NULL AND s.from_email IS NOT NULL`);
    for (const company of rows) {
      const r = await runReminders(company, null, { auto: true }).catch((e) => ({ error: e.message }));
      if (r.sent || r.failed || r.error) {
        console.log(`Relances automatiques [${company.company_name}] : ${r.sent ?? 0} envoyée(s), ${r.failed ?? 0} échec(s)${r.error ? `, ${r.error}` : ''}`);
      }
    }
  } catch (e) { console.error('Planificateur de relances :', e.message); }
}

export function startScheduler() {
  if (process.env.DISABLE_SCHEDULER === '1') return;
  setInterval(() => runScheduledReminders(), 60 * 60 * 1000).unref();
}
