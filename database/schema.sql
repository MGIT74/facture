-- Facturio simple : schéma MySQL 8 / MariaDB 10.5+
CREATE DATABASE IF NOT EXISTS facturio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE facturio;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','user') NOT NULL DEFAULT 'user',
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Entreprises : l'app gère plusieurs entreprises (chacune avec ses clients, produits, devis, factures)
CREATE TABLE IF NOT EXISTS companies (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(190) NOT NULL,
  legal_name VARCHAR(190),
  siret VARCHAR(30),
  vat_number VARCHAR(30),
  address VARCHAR(255),
  postal_code VARCHAR(20),
  city VARCHAR(120),
  country VARCHAR(80) DEFAULT 'France',
  email VARCHAR(190),
  phone VARCHAR(40),
  iban VARCHAR(40),
  bic VARCHAR(20),
  invoice_prefix VARCHAR(10) NOT NULL DEFAULT 'FAC',
  quote_prefix VARCHAR(10) NOT NULL DEFAULT 'DEV',
  default_currency CHAR(3) NOT NULL DEFAULT 'EUR',
  default_tax_rate DECIMAL(5,2) NOT NULL DEFAULT 20.00,
  payment_terms_days SMALLINT NOT NULL DEFAULT 30,
  default_terms TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO companies (id, company_name)
  SELECT 1, 'Mon entreprise' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM companies);

-- Accès : un utilisateur ne voit que les entreprises auxquelles il appartient.
-- Deux espaces sans entreprise en commun sont totalement isolés l'un de l'autre.
CREATE TABLE IF NOT EXISTS user_companies (
  user_id INT UNSIGNED NOT NULL,
  company_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (user_id, company_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Compteurs de numérotation : un par entreprise, par type et par année (FAC-2026-0001).
-- Incrément atomique dans une transaction : pas de doublon possible.
CREATE TABLE IF NOT EXISTS counters (
  company_id INT UNSIGNED NOT NULL,
  kind ENUM('invoice','quote') NOT NULL,
  year SMALLINT NOT NULL,
  value INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, kind, year),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS clients (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  name VARCHAR(190) NOT NULL,
  email VARCHAR(190),
  phone VARCHAR(40),
  address VARCHAR(255),
  postal_code VARCHAR(20),
  city VARCHAR(120),
  country VARCHAR(80),
  vat_number VARCHAR(30),
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  INDEX (company_id, name)
);

CREATE TABLE IF NOT EXISTS items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  name VARCHAR(190) NOT NULL,
  description TEXT,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 20.00,
  unit VARCHAR(30) DEFAULT 'unité',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  INDEX (company_id, name)
);

-- Modèles de factures et de devis (apparence et textes), propres à chaque entreprise
CREATE TABLE IF NOT EXISTS document_templates (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  kind ENUM('invoice','quote') NOT NULL,
  name VARCHAR(120) NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  layout ENUM('classic','modern','minimal') NOT NULL DEFAULT 'classic',
  accent CHAR(7) NOT NULL DEFAULT '#0071e3',
  title VARCHAR(60),
  logo MEDIUMTEXT,
  show_discount TINYINT(1) NOT NULL DEFAULT 1,
  show_tax TINYINT(1) NOT NULL DEFAULT 1,
  show_bank TINYINT(1) NOT NULL DEFAULT 1,
  notes TEXT,
  terms TEXT,
  footer TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  INDEX (company_id, kind)
);

CREATE TABLE IF NOT EXISTS quotes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  number VARCHAR(40) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  template_id INT UNSIGNED NULL,
  client_id INT UNSIGNED NOT NULL,
  status ENUM('draft','sent','accepted','rejected','invoiced') NOT NULL DEFAULT 'draft',
  issue_date DATE NOT NULL,
  valid_until DATE NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,   -- total HT (après remises)
  discount_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,      -- total TTC
  notes TEXT,
  terms TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (template_id) REFERENCES document_templates(id) ON DELETE SET NULL,
  UNIQUE KEY uq_quotes_company_number (company_id, number),
  INDEX (status), INDEX (issue_date)
);

CREATE TABLE IF NOT EXISTS quote_lines (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  quote_id INT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NULL,
  description VARCHAR(500) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(12,2) NOT NULL DEFAULT 0, -- HT après remise
  sort_order INT NOT NULL DEFAULT 0,
  FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  number VARCHAR(40) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  template_id INT UNSIGNED NULL,
  client_id INT UNSIGNED NOT NULL,
  quote_id INT UNSIGNED NULL,
  status ENUM('draft','sent','paid','cancelled') NOT NULL DEFAULT 'draft',
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE NULL,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  terms TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (template_id) REFERENCES document_templates(id) ON DELETE SET NULL,
  FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE SET NULL,
  UNIQUE KEY uq_invoices_company_number (company_id, number),
  INDEX (status), INDEX (issue_date), INDEX (due_date)
);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NULL,
  description VARCHAR(500) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT UNSIGNED NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method ENUM('bank_transfer','cash','check','card','other') NOT NULL DEFAULT 'bank_transfer',
  reference VARCHAR(120),
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  INDEX (payment_date)
);
