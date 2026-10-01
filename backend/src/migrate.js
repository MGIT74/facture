import { pool } from './db.js';

/**
 * Migrations automatiques au démarrage (idempotentes).
 * v2 : « settings » (une entreprise) -> « companies » (plusieurs entreprises) + devise par document.
 * Les installations neuves (schema.sql v2) n'ont pas de table « settings » : rien à faire.
 */
const one = async (sql, params) => (await pool.query(sql, params))[0][0];
const hasTable = async (t) =>
  (await one('SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?', [t])).n > 0;
const hasColumn = async (t, c) =>
  (await one('SELECT COUNT(*) n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?', [t, c])).n > 0;
const hasIndex = async (t, i) =>
  (await one('SELECT COUNT(*) n FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?', [t, i])).n > 0;

export async function migrate() {
  if (!(await hasTable('settings'))) return;
  console.log('Migration v2 : passage au multi-entreprises…');

  await pool.query(`CREATE TABLE IF NOT EXISTS companies (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_name VARCHAR(190) NOT NULL, legal_name VARCHAR(190), siret VARCHAR(30), vat_number VARCHAR(30),
    address VARCHAR(255), postal_code VARCHAR(20), city VARCHAR(120), country VARCHAR(80) DEFAULT 'France',
    email VARCHAR(190), phone VARCHAR(40), iban VARCHAR(40), bic VARCHAR(20),
    invoice_prefix VARCHAR(10) NOT NULL DEFAULT 'FAC', quote_prefix VARCHAR(10) NOT NULL DEFAULT 'DEV',
    default_currency CHAR(3) NOT NULL DEFAULT 'EUR', default_tax_rate DECIMAL(5,2) NOT NULL DEFAULT 20.00,
    payment_terms_days SMALLINT NOT NULL DEFAULT 30, default_terms TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);

  // L'ancienne entreprise devient l'entreprise n°1
  await pool.query(`INSERT INTO companies (id, company_name, legal_name, siret, vat_number, address, postal_code, city, country,
      email, phone, iban, bic, invoice_prefix, quote_prefix, default_currency, default_tax_rate, payment_terms_days, default_terms)
    SELECT 1, company_name, legal_name, siret, vat_number, address, postal_code, city, country,
      email, phone, iban, bic, invoice_prefix, quote_prefix, 'EUR', default_tax_rate, payment_terms_days, default_terms
    FROM settings WHERE id = 1
    ON DUPLICATE KEY UPDATE company_name = VALUES(company_name), legal_name = VALUES(legal_name), siret = VALUES(siret),
      vat_number = VALUES(vat_number), address = VALUES(address), postal_code = VALUES(postal_code), city = VALUES(city),
      country = VALUES(country), email = VALUES(email), phone = VALUES(phone), iban = VALUES(iban), bic = VALUES(bic),
      invoice_prefix = VALUES(invoice_prefix), quote_prefix = VALUES(quote_prefix), default_tax_rate = VALUES(default_tax_rate),
      payment_terms_days = VALUES(payment_terms_days), default_terms = VALUES(default_terms)`);
  await pool.query(`INSERT INTO companies (id, company_name) SELECT 1, 'Mon entreprise' FROM DUAL
    WHERE NOT EXISTS (SELECT 1 FROM companies)`);

  // company_id sur les tables métier : les données existantes vont à l'entreprise 1
  for (const t of ['clients', 'items', 'quotes', 'invoices']) {
    if (!(await hasColumn(t, 'company_id'))) {
      await pool.query(`ALTER TABLE ${t} ADD COLUMN company_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER id`);
      await pool.query(`ALTER TABLE ${t} ADD CONSTRAINT fk_${t}_company FOREIGN KEY (company_id) REFERENCES companies(id)`);
      await pool.query(`ALTER TABLE ${t} ALTER COLUMN company_id DROP DEFAULT`);
    }
  }
  for (const t of ['clients', 'items']) {
    if (!(await hasIndex(t, 'idx_company_name'))) await pool.query(`ALTER TABLE ${t} ADD INDEX idx_company_name (company_id, name)`);
  }

  // Devise par document + unicité du numéro par entreprise
  for (const t of ['quotes', 'invoices']) {
    if (!(await hasColumn(t, 'currency'))) {
      await pool.query(`ALTER TABLE ${t} ADD COLUMN currency CHAR(3) NOT NULL DEFAULT 'EUR' AFTER number`);
    }
    if (await hasIndex(t, 'number')) await pool.query(`ALTER TABLE ${t} DROP INDEX number`);
    if (!(await hasIndex(t, `uq_${t}_company_number`))) {
      await pool.query(`ALTER TABLE ${t} ADD UNIQUE KEY uq_${t}_company_number (company_id, number)`);
    }
  }

  // Compteurs : clé (company_id, kind, year)
  if (!(await hasColumn('counters', 'company_id'))) {
    await pool.query('DROP TABLE IF EXISTS counters_v2');
    await pool.query(`CREATE TABLE counters_v2 (
      company_id INT UNSIGNED NOT NULL, kind ENUM('invoice','quote') NOT NULL, year SMALLINT NOT NULL,
      value INT UNSIGNED NOT NULL DEFAULT 0, PRIMARY KEY (company_id, kind, year),
      FOREIGN KEY (company_id) REFERENCES companies(id))`);
    await pool.query('INSERT INTO counters_v2 (company_id, kind, year, value) SELECT 1, kind, year, value FROM counters');
    await pool.query('DROP TABLE counters');
    await pool.query('RENAME TABLE counters_v2 TO counters');
  }

  await pool.query('DROP TABLE settings'); // en dernier : marque la migration comme terminée
  console.log('Migration v2 terminée.');
}
