import nodemailer from 'nodemailer';
import crypto from 'node:crypto';
import { pool } from '../db.js';
import { HttpError, r2 } from '../utils.js';
import { renderPdfBuffer } from '../pdf.js';

export const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;
const MAX_PER_HOUR = 100;

// ------------------------------------------------------------------ chiffrement du mot de passe SMTP
// Clé dérivée de APP_SECRET (ou, à défaut, JWT_SECRET) : le mot de passe n'est jamais stocké en clair ni renvoyé par l'API.
let cachedKey;
const key = () => (cachedKey ||= crypto.scryptSync(process.env.APP_SECRET || process.env.JWT_SECRET, 'facturio-smtp-v1', 32));
export function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join(':');
}
export function decrypt(blob) {
  try {
    const [iv, tag, enc] = blob.split(':').map((s) => Buffer.from(s, 'base64'));
    const d = crypto.createDecipheriv('aes-256-gcm', key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
  } catch { return null; }
}

// ------------------------------------------------------------------ réglages
export const DEFAULT_SETTINGS = {
  smtp_host: null, smtp_port: 587, smtp_secure: 'starttls', smtp_user: null, smtp_pass_enc: null, tls_reject_unauthorized: 1,
  from_name: null, from_email: null, reply_to: null, bcc_self: 0, signature: null,
  reminders_enabled: 0, reminder1_days: 3, reminder2_days: 10, reminder3_days: 20,
};
export async function getEmailSettings(companyId) {
  const [[row]] = await pool.query('SELECT * FROM email_settings WHERE company_id = ?', [companyId]);
  return { company_id: companyId, ...DEFAULT_SETTINGS, ...(row || {}) };
}
export const isConfigured = (s) => !!(s.smtp_host && s.from_email);

export function parseEmails(value, label = 'destinataire', max = 5) {
  const list = (Array.isArray(value) ? value : String(value || '').split(/[;,\s]+/)).map((x) => String(x).trim()).filter(Boolean);
  for (const e of list) if (!EMAIL_RE.test(e)) throw new HttpError(400, `Adresse email invalide (${label}) : ${e}`);
  if (list.length > max) throw new HttpError(400, `${max} ${label}s maximum`);
  return list;
}

// ------------------------------------------------------------------ envoi SMTP
function transport(s) {
  return nodemailer.createTransport({
    host: s.smtp_host,
    port: Number(s.smtp_port),
    secure: s.smtp_secure === 'ssl',
    requireTLS: s.smtp_secure === 'starttls',
    ignoreTLS: s.smtp_secure === 'none',
    auth: s.smtp_user ? { user: s.smtp_user, pass: s.smtp_pass_enc ? decrypt(s.smtp_pass_enc) || '' : '' } : undefined,
    tls: { rejectUnauthorized: !!s.tls_reject_unauthorized },
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000,
  });
}

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const toHtml = (text) =>
  `<div style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:15px;line-height:1.55;color:#1c1c1e">` +
  esc(text).split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px">${p.replace(/\n/g, '<br>')}</p>`).join('') + '</div>';

function cleanError(e) {
  const msg = String(e?.response || e?.message || e || 'Erreur inconnue').replace(/\s+/g, ' ').trim();
  return msg.slice(0, 400);
}

export async function sendMail(s, { to, cc = [], subject, text, attachments = [] }) {
  if (s.smtp_pass_enc && s.smtp_user && decrypt(s.smtp_pass_enc) === null) {
    throw new Error('Mot de passe SMTP illisible (clé de chiffrement modifiée) : saisis-le à nouveau dans Paramètres > Email');
  }
  const from = s.from_name ? { name: s.from_name, address: s.from_email } : s.from_email;
  return transport(s).sendMail({
    from, to, cc: cc.length ? cc : undefined, bcc: s.bcc_self ? s.from_email : undefined,
    replyTo: s.reply_to || undefined, subject, text, html: toHtml(text), attachments,
  });
}

// ------------------------------------------------------------------ emails types
export const TEMPLATE_KEYS = ['invoice_send', 'quote_send', 'reminder_1', 'reminder_2', 'reminder_3', 'payment_received'];
export const KEYS_BY_KIND = {
  invoice: ['invoice_send', 'reminder_1', 'reminder_2', 'reminder_3', 'payment_received'],
  quote: ['quote_send'],
};
export const VARIABLES = ['client', 'number', 'company', 'total', 'balance', 'paid', 'issue_date', 'due_date', 'valid_until', 'days_late', 'currency', 'signature', 'sender'];

export const DEFAULT_TEMPLATES = {
  invoice_send: {
    subject: 'Facture {{number}} de {{company}}',
    body: "Bonjour {{client}},\n\nVeuillez trouver ci-joint la facture {{number}} d'un montant de {{total}}, à régler avant le {{due_date}}.\n\nNous restons à votre disposition pour toute question.\n\nCordialement,\n{{signature}}",
  },
  quote_send: {
    subject: 'Devis {{number}} de {{company}}',
    body: "Bonjour {{client}},\n\nSuite à notre échange, veuillez trouver ci-joint notre devis {{number}} d'un montant de {{total}}, valable jusqu'au {{valid_until}}.\n\nPour l'accepter, il suffit de répondre à ce message.\n\nCordialement,\n{{signature}}",
  },
  reminder_1: {
    subject: 'Rappel : facture {{number}} échue le {{due_date}}',
    body: "Bonjour {{client}},\n\nSauf erreur de notre part, la facture {{number}} d'un montant de {{balance}}, échue le {{due_date}}, n'a pas encore été réglée.\n\nNous vous remercions de bien vouloir procéder à son règlement. Si le paiement a déjà été effectué, merci de ne pas tenir compte de ce message.\n\nCordialement,\n{{signature}}",
  },
  reminder_2: {
    subject: 'Deuxième rappel : facture {{number}} impayée',
    body: "Bonjour {{client}},\n\nNous vous avons déjà relancé au sujet de la facture {{number}} ({{balance}}), échue depuis {{days_late}} jours. À ce jour, nous n'avons pas reçu votre règlement.\n\nMerci de régulariser cette situation dans les meilleurs délais, ou de nous contacter si vous rencontrez une difficulté.\n\nCordialement,\n{{signature}}",
  },
  reminder_3: {
    subject: 'Dernier rappel avant recouvrement : facture {{number}}',
    body: "Bonjour {{client}},\n\nMalgré nos précédentes relances, la facture {{number}} d'un montant de {{balance}} reste impayée ({{days_late}} jours de retard).\n\nSans règlement de votre part sous 8 jours, nous serons contraints d'engager une procédure de recouvrement.\n\nNous préférons trouver une solution amiable : contactez-nous dès réception de ce message.\n\nCordialement,\n{{signature}}",
  },
  payment_received: {
    subject: 'Paiement reçu : facture {{number}}',
    body: 'Bonjour {{client}},\n\nNous avons bien reçu votre paiement pour la facture {{number}} ({{paid}} réglés sur {{total}}). Merci !\n\nCordialement,\n{{signature}}',
  },
};

export async function getTemplate(companyId, templateKey) {
  const [[row]] = await pool.query('SELECT subject, body FROM email_templates WHERE company_id = ? AND template_key = ?', [companyId, templateKey]);
  return row ? { ...row, customized: true } : { ...DEFAULT_TEMPLATES[templateKey], customized: false };
}

const money = (n, cur = 'EUR') => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur }).format(Number(n) || 0).replace(/[\u202f\u00a0]/g, ' ');
const dateFr = (s) => (s ? s.split('-').reverse().join('/') : '');
const daysLate = (due) => (due ? Math.max(0, Math.floor((Date.now() - Date.parse(due + 'T00:00:00Z')) / 86400000)) : 0);

export function buildVariables({ doc, company, settings, user }) {
  return {
    client: doc.client?.name || '', number: doc.number, company: company.company_name,
    total: money(doc.total, doc.currency), balance: money(doc.balance_due ?? doc.total, doc.currency), paid: money(doc.amount_paid || 0, doc.currency),
    issue_date: dateFr(doc.issue_date), due_date: dateFr(doc.due_date), valid_until: dateFr(doc.valid_until),
    days_late: String(daysLate(doc.due_date)), currency: doc.currency,
    signature: settings.signature || company.company_name, sender: user?.name || '',
  };
}
export const render = (str, vars) => String(str).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? '');

// ------------------------------------------------------------------ envoi d'un document + journal
async function checkRate(companyId) {
  const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM email_logs WHERE company_id = ? AND created_at > (NOW() - INTERVAL 1 HOUR)", [companyId]);
  if (n >= MAX_PER_HOUR) throw new HttpError(429, `Limite atteinte : ${MAX_PER_HOUR} emails par heure et par entreprise. Réessaie plus tard.`);
}

/** Envoie un email pour un document, le journalise et met à jour l'état du document. Ne lève pas d'erreur SMTP : renvoie { ok, error }. */
export async function deliver({ company, user, settings, kind, doc, templateKey, to, cc, subject, body, attachPdf = true, automatic = false }) {
  if (!isConfigured(settings)) throw new HttpError(400, "Le serveur d'envoi n'est pas configuré : renseigne-le dans Paramètres > Email");
  const toList = parseEmails(to, 'destinataire');
  if (!toList.length) throw new HttpError(400, 'Indique au moins un destinataire');
  const ccList = parseEmails(cc, 'destinataire en copie');
  if (!String(subject || '').trim()) throw new HttpError(400, "L'objet est obligatoire");
  if (!String(body || '').trim()) throw new HttpError(400, 'Le message est vide');
  await checkRate(company.id);

  const attachments = attachPdf ? [{ filename: `${doc.number}.pdf`, content: await renderPdfBuffer(kind, doc), contentType: 'application/pdf' }] : [];
  let error = null;
  try { await sendMail(settings, { to: toList, cc: ccList, subject: String(subject).slice(0, 250), text: String(body), attachments }); }
  catch (e) { error = cleanError(e); }

  await pool.query('INSERT INTO email_logs SET ?', [{
    company_id: company.id, user_id: user?.id ?? null, automatic: automatic ? 1 : 0, kind, document_id: doc.id, template_key: templateKey,
    to_email: toList.join(', ').slice(0, 500), cc_email: ccList.length ? ccList.join(', ').slice(0, 500) : null,
    subject: String(subject).slice(0, 250), status: error ? 'failed' : 'sent', error: error ? error.slice(0, 480) : null,
  }]);
  if (error) return { ok: false, error };

  if (kind === 'invoice' && templateKey === 'invoice_send' && doc.status === 'draft') {
    await pool.query("UPDATE invoices SET status = 'sent' WHERE id = ? AND company_id = ?", [doc.id, company.id]);
  }
  if (kind === 'quote' && templateKey === 'quote_send' && doc.status === 'draft') {
    await pool.query("UPDATE quotes SET status = 'sent' WHERE id = ? AND company_id = ?", [doc.id, company.id]);
  }
  if (kind === 'invoice' && templateKey.startsWith('reminder_')) {
    await pool.query('UPDATE invoices SET last_reminder_level = GREATEST(last_reminder_level, ?), last_reminder_at = NOW() WHERE id = ? AND company_id = ?',
      [Number(templateKey.slice(-1)), doc.id, company.id]);
  }
  return { ok: true };
}

export { r2 };
