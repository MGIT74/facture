/*
  # Facturio - Multi-tenant Invoicing SaaS Database Schema
  
  ## Overview
  Complete database schema for a multi-tenant invoicing application with:
  - Multi-currency support (EUR, USD, CHF)
  - Multi-company management per user
  - Clients, items, quotes, invoices, and payments
  - Strict Row Level Security (RLS) for tenant isolation
  
  ## Tables
  1. profiles - User profiles
  2. companies - Company/workspace entities
  3. company_members - User-company memberships with roles
  4. clients - Company clients
  5. items - Products/services catalog
  6. quotes - Sales quotes
  7. quote_lines - Quote line items
  8. invoices - Invoices
  9. invoice_lines - Invoice line items
  10. payments - Payment records
  
  ## Security
  All tables use RLS policies checking company_members for access control
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CREATE ALL TABLES FIRST
-- ============================================================================

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- COMPANIES
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  legal_name text,
  registration_number text,
  vat_number text,
  address text,
  city text,
  postal_code text,
  country text DEFAULT 'FR',
  email text,
  phone text,
  website text,
  logo_url text,
  default_currency text DEFAULT 'EUR',
  invoice_prefix text DEFAULT 'INV',
  next_invoice_number integer DEFAULT 1,
  quote_prefix text DEFAULT 'QUO',
  next_quote_number integer DEFAULT 1,
  default_tax_rate decimal(5,2) DEFAULT 20.00,
  payment_terms_days integer DEFAULT 30,
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- COMPANY_MEMBERS
CREATE TABLE IF NOT EXISTS company_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, user_id)
);

-- CLIENTS
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  address text,
  city text,
  postal_code text,
  country text,
  vat_number text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ITEMS
CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  unit_price decimal(12,2) NOT NULL,
  tax_rate decimal(5,2) DEFAULT 20.00,
  unit text DEFAULT 'unit',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- QUOTES
CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE RESTRICT NOT NULL,
  number text NOT NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'expired')),
  currency_code text DEFAULT 'EUR',
  exchange_rate decimal(12,6) DEFAULT 1.00,
  issue_date date NOT NULL,
  expiry_date date,
  subtotal decimal(12,2) DEFAULT 0,
  tax_total decimal(12,2) DEFAULT 0,
  discount_total decimal(12,2) DEFAULT 0,
  total decimal(12,2) DEFAULT 0,
  notes text,
  terms text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, number)
);

-- QUOTE_LINES
CREATE TABLE IF NOT EXISTS quote_lines (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id uuid REFERENCES quotes(id) ON DELETE CASCADE NOT NULL,
  item_id uuid REFERENCES items(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity decimal(10,2) DEFAULT 1,
  unit_price decimal(12,2) NOT NULL,
  discount_rate decimal(5,2) DEFAULT 0,
  tax_rate decimal(5,2) DEFAULT 0,
  line_total decimal(12,2) NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- INVOICES
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE RESTRICT NOT NULL,
  quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL,
  number text NOT NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  currency_code text DEFAULT 'EUR',
  exchange_rate decimal(12,6) DEFAULT 1.00,
  issue_date date NOT NULL,
  due_date date NOT NULL,
  paid_date date,
  subtotal decimal(12,2) DEFAULT 0,
  tax_total decimal(12,2) DEFAULT 0,
  discount_total decimal(12,2) DEFAULT 0,
  total decimal(12,2) DEFAULT 0,
  amount_paid decimal(12,2) DEFAULT 0,
  balance_due decimal(12,2) DEFAULT 0,
  notes text,
  terms text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, number)
);

-- INVOICE_LINES
CREATE TABLE IF NOT EXISTS invoice_lines (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  item_id uuid REFERENCES items(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity decimal(10,2) DEFAULT 1,
  unit_price decimal(12,2) NOT NULL,
  discount_rate decimal(5,2) DEFAULT 0,
  tax_rate decimal(5,2) DEFAULT 0,
  line_total decimal(12,2) NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  amount decimal(12,2) NOT NULL,
  payment_date date NOT NULL,
  payment_method text CHECK (payment_method IN ('bank_transfer', 'cash', 'check', 'card', 'other')),
  reference text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_company_members_company_id ON company_members(company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_user_id ON company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_company_id ON clients(company_id);
CREATE INDEX IF NOT EXISTS idx_items_company_id ON items(company_id);
CREATE INDEX IF NOT EXISTS idx_quotes_company_id ON quotes(company_id);
CREATE INDEX IF NOT EXISTS idx_quotes_client_id ON quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quote_lines_quote_id ON quote_lines(quote_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice_id ON invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_company_id ON payments(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- PROFILES POLICIES
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- COMPANIES POLICIES
CREATE POLICY "Users can view companies they are members of"
  ON companies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = companies.id
      AND company_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Company admins can update their companies"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = companies.id
      AND company_members.user_id = auth.uid()
      AND company_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = companies.id
      AND company_members.user_id = auth.uid()
      AND company_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Company owners can delete their companies"
  ON companies FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- COMPANY_MEMBERS POLICIES
CREATE POLICY "Users can view members of their companies"
  ON company_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = company_members.company_id
      AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Company owners can manage memberships"
  ON company_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = company_id
      AND companies.owner_id = auth.uid()
    )
  );

CREATE POLICY "Company owners can update memberships"
  ON company_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = company_members.company_id
      AND companies.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = company_members.company_id
      AND companies.owner_id = auth.uid()
    )
  );

CREATE POLICY "Company owners can delete memberships"
  ON company_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = company_members.company_id
      AND companies.owner_id = auth.uid()
    )
  );

-- CLIENTS POLICIES
CREATE POLICY "Users can view clients of their companies"
  ON clients FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = clients.company_id
      AND company_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create clients in their companies"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = clients.company_id
      AND company_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update clients in their companies"
  ON clients FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = clients.company_id
      AND company_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = clients.company_id
      AND company_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete clients in their companies"
  ON clients FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = clients.company_id
      AND company_members.user_id = auth.uid()
    )
  );

-- ITEMS POLICIES
CREATE POLICY "Users can view items of their companies"
  ON items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = items.company_id
      AND company_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create items in their companies"
  ON items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = items.company_id
      AND company_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update items in their companies"
  ON items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = items.company_id
      AND company_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = items.company_id
      AND company_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete items in their companies"
  ON items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = items.company_id
      AND company_members.user_id = auth.uid()
    )
  );

-- QUOTES POLICIES
CREATE POLICY "Users can view quotes of their companies"
  ON quotes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = quotes.company_id
      AND company_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create quotes in their companies"
  ON quotes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = quotes.company_id
      AND company_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update quotes in their companies"
  ON quotes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = quotes.company_id
      AND company_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = quotes.company_id
      AND company_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete quotes in their companies"
  ON quotes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = quotes.company_id
      AND company_members.user_id = auth.uid()
    )
  );

-- QUOTE_LINES POLICIES
CREATE POLICY "Users can view quote lines of their companies"
  ON quote_lines FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes
      JOIN company_members ON company_members.company_id = quotes.company_id
      WHERE quotes.id = quote_lines.quote_id
      AND company_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create quote lines in their companies"
  ON quote_lines FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotes
      JOIN company_members ON company_members.company_id = quotes.company_id
      WHERE quotes.id = quote_lines.quote_id
      AND company_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update quote lines in their companies"
  ON quote_lines FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes
      JOIN company_members ON company_members.company_id = quotes.company_id
      WHERE quotes.id = quote_lines.quote_id
      AND company_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotes
      JOIN company_members ON company_members.company_id = quotes.company_id
      WHERE quotes.id = quote_lines.quote_id
      AND company_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete quote lines in their companies"
  ON quote_lines FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes
      JOIN company_members ON company_members.company_id = quotes.company_id
      WHERE quotes.id = quote_lines.quote_id
      AND company_members.user_id = auth.uid()
    )
  );

-- INVOICES POLICIES
CREATE POLICY "Users can view invoices of their companies"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = invoices.company_id
      AND company_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create invoices in their companies"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = invoices.company_id
      AND company_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update invoices in their companies"
  ON invoices FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = invoices.company_id
      AND company_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = invoices.company_id
      AND company_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete invoices in their companies"
  ON invoices FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = invoices.company_id
      AND company_members.user_id = auth.uid()
    )
  );

-- INVOICE_LINES POLICIES
CREATE POLICY "Users can view invoice lines of their companies"
  ON invoice_lines FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      JOIN company_members ON company_members.company_id = invoices.company_id
      WHERE invoices.id = invoice_lines.invoice_id
      AND company_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create invoice lines in their companies"
  ON invoice_lines FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices
      JOIN company_members ON company_members.company_id = invoices.company_id
      WHERE invoices.id = invoice_lines.invoice_id
      AND company_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update invoice lines in their companies"
  ON invoice_lines FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      JOIN company_members ON company_members.company_id = invoices.company_id
      WHERE invoices.id = invoice_lines.invoice_id
      AND company_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices
      JOIN company_members ON company_members.company_id = invoices.company_id
      WHERE invoices.id = invoice_lines.invoice_id
      AND company_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete invoice lines in their companies"
  ON invoice_lines FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      JOIN company_members ON company_members.company_id = invoices.company_id
      WHERE invoices.id = invoice_lines.invoice_id
      AND company_members.user_id = auth.uid()
    )
  );

-- PAYMENTS POLICIES
CREATE POLICY "Users can view payments of their companies"
  ON payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = payments.company_id
      AND company_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create payments in their companies"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = payments.company_id
      AND company_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update payments in their companies"
  ON payments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = payments.company_id
      AND company_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = payments.company_id
      AND company_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete payments in their companies"
  ON payments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = payments.company_id
      AND company_members.user_id = auth.uid()
    )
  );

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, created_at)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-create company membership when company is created
CREATE OR REPLACE FUNCTION handle_new_company()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO company_members (company_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_company_created ON companies;
CREATE TRIGGER on_company_created
  AFTER INSERT ON companies
  FOR EACH ROW EXECUTE FUNCTION handle_new_company();

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_items_updated_at ON items;
CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quotes_updated_at ON quotes;
CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();