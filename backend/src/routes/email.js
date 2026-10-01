import { Router } from 'express';
import { pool } from '../db.js';
import { asyncHandler, HttpError } from '../utils.js';
import { requireAdmin } from '../middleware.js';
import { loadDocument } from './documents.js';
import {
  getEmailSettings, isConfigured, encrypt, EMAIL_RE, parseEmails, sendMail, TEMPLATE_KEYS, KEYS_BY_KIND, VARIABLES,
  DEFAULT_TEMPLATES, getTemplate, buildVariables, render, deliver,
} from '../services/email.js';

const router = Router();
const SECURE = ['none', 'starttls', 'ssl'];

const publicSettings = (s) => {
  const { smtp_pass_enc, ...rest } = s; // le mot de passe ne sort jamais
  return { ...rest, has_password: !!smtp_pass_enc, configured: isConfigured(s) };
};
const str = (v, max) => {
  if (v === undefined) return undefined;
  const t = String(v ?? '').trim();
  if (t.length > max) throw new HttpError(400, `Texte trop long (${max} caractères maximum)`);
  return t || null;
};
const email = (v, label) => {
  const t = str(v, 190);
  if (t && !EMAIL_RE.test(t)) throw new HttpError(400, `Adresse email invalide (${label})`);
  return t;
};

// ------------------------------------------------------------------ réglages SMTP
router.get('/settings', asyncHandler(async (req, res) => res.json(publicSettings(await getEmailSettings(req.company.id)))));

router.put('/settings', requireAdmin, asyncHandler(async (req, res) => {
  const b = req.body || {};
  const d = {};
  const set = (k, v) => { if (v !== undefined) d[k] = v; };
  set('smtp_host', str(b.smtp_host, 190));
  if (b.smtp_port !== undefined) {
    const p = Number(b.smtp_port);
    if (!Number.isInteger(p) || p < 1 || p > 65535) throw new HttpError(400, 'Port invalide');
    d.smtp_port = p;
  }
  if (b.smtp_secure !== undefined) {
    if (!SECURE.includes(b.smtp_secure)) throw new HttpError(400, 'Sécurité de connexion invalide');
    d.smtp_secure = b.smtp_secure;
  }
  set('smtp_user', str(b.smtp_user, 190));
  if (typeof b.smtp_password === 'string' && b.smtp_password !== '') d.smtp_pass_enc = encrypt(b.smtp_password);
  if (b.clear_password === true) d.smtp_pass_enc = null;
  if (b.tls_reject_unauthorized !== undefined) d.tls_reject_unauthorized = b.tls_reject_unauthorized ? 1 : 0;
  set('from_name', str(b.from_name, 120));
  set('from_email', email(b.from_email, "adresse d'expédition"));
  set('reply_to', email(b.reply_to, 'adresse de réponse'));
  if (b.bcc_self !== undefined) d.bcc_self = b.bcc_self ? 1 : 0;
  set('signature', str(b.signature, 2000));
  if (b.reminders_enabled !== undefined) d.reminders_enabled = b.reminders_enabled ? 1 : 0;
  const days = ['reminder1_days', 'reminder2_days', 'reminder3_days'];
  for (const k of days) {
    if (b[k] === undefined) continue;
    const n = Number(b[k]);
    if (!Number.isInteger(n) || n < 1 || n > 365) throw new HttpError(400, 'Les délais de relance doivent être compris entre 1 et 365 jours');
    d[k] = n;
  }
  const cur = await getEmailSettings(req.company.id);
  const merged = { ...cur, ...d };
  if (!(merged.reminder1_days <= merged.reminder2_days && merged.reminder2_days <= merged.reminder3_days)) {
    throw new HttpError(400, 'Les délais de relance doivent être croissants (1re ≤ 2e ≤ 3e)');
  }
  if (merged.reminders_enabled && !isConfigured(merged)) {
    throw new HttpError(400, "Configure d'abord le serveur SMTP et l'adresse d'expédition avant d'activer les relances automatiques");
  }
  await pool.query('INSERT INTO email_settings SET ? ON DUPLICATE KEY UPDATE ?', [{ company_id: req.company.id, ...d }, Object.keys(d).length ? d : { company_id: req.company.id }]);
  res.json(publicSettings(await getEmailSettings(req.company.id)));
}));

// Email de test envoyé avec les réglages enregistrés
router.post('/test', requireAdmin, asyncHandler(async (req, res) => {
  const s = await getEmailSettings(req.company.id);
  if (!isConfigured(s)) throw new HttpError(400, "Renseigne d'abord le serveur SMTP et l'adresse d'expédition, puis enregistre");
  const to = parseEmails(req.body?.to || req.user.email, 'destinataire', 1);
  try {
    await sendMail(s, {
      to, subject: `Test d'envoi Facturio : ${req.company.company_name}`,
      text: `Bonjour,\n\nCe message confirme que le serveur d'envoi de « ${req.company.company_name} » fonctionne.\n\nTu peux maintenant envoyer tes factures et devis par email.\n\nFacturio`,
    });
  } catch (e) {
    throw new HttpError(400, `Échec de l'envoi : ${String(e.response || e.message).replace(/\s+/g, ' ').slice(0, 300)}`);
  }
  res.json({ ok: true, to: to[0] });
}));

// ------------------------------------------------------------------ emails types
router.get('/templates', asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT template_key, subject, body FROM email_templates WHERE company_id = ?', [req.company.id]);
  res.json({
    variables: VARIABLES,
    templates: TEMPLATE_KEYS.map((key) => {
      const own = rows.find((r) => r.template_key === key);
      return { key, subject: own?.subject ?? DEFAULT_TEMPLATES[key].subject, body: own?.body ?? DEFAULT_TEMPLATES[key].body,
        customized: !!own, default_subject: DEFAULT_TEMPLATES[key].subject, default_body: DEFAULT_TEMPLATES[key].body };
    }),
  });
}));

router.put('/templates/:key', requireAdmin, asyncHandler(async (req, res) => {
  const { key } = req.params;
  if (!TEMPLATE_KEYS.includes(key)) throw new HttpError(404, 'Modèle introuvable');
  const subject = String(req.body?.subject || '').trim();
  const body = String(req.body?.body || '').trim();
  if (!subject || !body) throw new HttpError(400, "L'objet et le message sont obligatoires");
  if (subject.length > 250 || body.length > 10000) throw new HttpError(400, 'Texte trop long');
  await pool.query('INSERT INTO email_templates (company_id, template_key, subject, body) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE subject = VALUES(subject), body = VALUES(body)',
    [req.company.id, key, subject, body]);
  res.json({ key, subject, body, customized: true });
}));

// Remet le texte d'origine
router.delete('/templates/:key', requireAdmin, asyncHandler(async (req, res) => {
  if (!TEMPLATE_KEYS.includes(req.params.key)) throw new HttpError(404, 'Modèle introuvable');
  await pool.query('DELETE FROM email_templates WHERE company_id = ? AND template_key = ?', [req.company.id, req.params.key]);
  res.status(204).end();
}));

// ------------------------------------------------------------------ préparation et envoi
function checkKey(kind, key) {
  if (!['invoice', 'quote'].includes(kind)) throw new HttpError(400, 'Type de document invalide');
  if (!(KEYS_BY_KIND[kind] || []).includes(key)) throw new HttpError(400, "Ce type d'email ne s'applique pas à ce document");
}

// Objet et message pré-remplis pour un document
router.post('/preview', asyncHandler(async (req, res) => {
  const { kind, document_id: id, template_key: key } = req.body || {};
  checkKey(kind, key);
  const doc = await loadDocument(kind, id, req.company.id);
  const s = await getEmailSettings(req.company.id);
  const tpl = await getTemplate(req.company.id, key);
  const vars = buildVariables({ doc, company: req.company, settings: s, user: req.user });
  res.json({ subject: render(tpl.subject, vars), body: render(tpl.body, vars), to: doc.client.email || '', configured: isConfigured(s), from: s.from_email });
}));

router.post('/send', asyncHandler(async (req, res) => {
  const b = req.body || {};
  checkKey(b.kind, b.template_key);
  const doc = await loadDocument(b.kind, b.document_id, req.company.id);
  const settings = await getEmailSettings(req.company.id);
  const r = await deliver({
    company: req.company, user: req.user, settings, kind: b.kind, doc, templateKey: b.template_key,
    to: b.to, cc: b.cc, subject: b.subject, body: b.body, attachPdf: b.attach_pdf !== false,
  });
  if (!r.ok) throw new HttpError(502, `Envoi impossible : ${r.error}`);
  res.json({ ok: true });
}));

// Historique d'envoi (d'un document, ou les derniers de l'entreprise)
router.get('/logs', asyncHandler(async (req, res) => {
  const params = [req.company.id];
  let where = 'l.company_id = ?';
  if (req.query.kind && req.query.document_id) { where += ' AND l.kind = ? AND l.document_id = ?'; params.push(req.query.kind, Number(req.query.document_id)); }
  const [rows] = await pool.query(
    `SELECT l.id, l.kind, l.document_id, l.template_key, l.to_email, l.cc_email, l.subject, l.status, l.error, l.automatic, l.created_at, u.name AS user_name
       FROM email_logs l LEFT JOIN users u ON u.id = l.user_id WHERE ${where} ORDER BY l.id DESC LIMIT 100`, params);
  res.json(rows);
}));

export default router;
