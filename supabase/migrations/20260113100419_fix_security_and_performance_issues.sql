/*
  # Fix Security and Performance Issues

  1. Indexes for Foreign Keys
    - Add index on companies.owner_id
    - Add index on invoice_lines.item_id
    - Add index on invoices.quote_id
    - Add index on quote_lines.item_id

  2. RLS Policy Optimization
    - Update all policies to use (select auth.uid()) instead of auth.uid()
    - This prevents re-evaluation of auth functions for each row

  3. Function Security
    - Set search_path to public for all functions to prevent mutable search_path issues
*/

-- 1. Add missing indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_companies_owner_id ON companies(owner_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_item_id ON invoice_lines(item_id);
CREATE INDEX IF NOT EXISTS idx_invoices_quote_id ON invoices(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_lines_item_id ON quote_lines(item_id);

-- 2. Fix RLS policies to use (select auth.uid()) for better performance

-- Profiles policies
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = (select auth.uid()));

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = (select auth.uid()));

-- Companies policies
DROP POLICY IF EXISTS "Users can view companies they are members of" ON companies;
DROP POLICY IF EXISTS "Users can create companies" ON companies;
DROP POLICY IF EXISTS "Company admins can update their companies" ON companies;
DROP POLICY IF EXISTS "Company owners can delete their companies" ON companies;

CREATE POLICY "Users can view companies they are members of"
  ON companies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = companies.id
      AND company_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can create companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = (select auth.uid()));

CREATE POLICY "Company admins can update their companies"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = companies.id
      AND company_members.user_id = (select auth.uid())
      AND company_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = companies.id
      AND company_members.user_id = (select auth.uid())
      AND company_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Company owners can delete their companies"
  ON companies FOR DELETE
  TO authenticated
  USING (owner_id = (select auth.uid()));

-- Company members policies
DROP POLICY IF EXISTS "Users can view members of their companies" ON company_members;
DROP POLICY IF EXISTS "Company owners can manage memberships" ON company_members;
DROP POLICY IF EXISTS "Company owners can update memberships" ON company_members;
DROP POLICY IF EXISTS "Company owners can delete memberships" ON company_members;

CREATE POLICY "Users can view members of their companies"
  ON company_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = company_members.company_id
      AND cm.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Company owners can manage memberships"
  ON company_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = company_members.company_id
      AND companies.owner_id = (select auth.uid())
    )
  );

CREATE POLICY "Company owners can update memberships"
  ON company_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = company_members.company_id
      AND companies.owner_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = company_members.company_id
      AND companies.owner_id = (select auth.uid())
    )
  );

CREATE POLICY "Company owners can delete memberships"
  ON company_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = company_members.company_id
      AND companies.owner_id = (select auth.uid())
    )
  );

-- Clients policies
DROP POLICY IF EXISTS "Users can view clients of their companies" ON clients;
DROP POLICY IF EXISTS "Users can create clients in their companies" ON clients;
DROP POLICY IF EXISTS "Users can update clients in their companies" ON clients;
DROP POLICY IF EXISTS "Users can delete clients in their companies" ON clients;

CREATE POLICY "Users can view clients of their companies"
  ON clients FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = clients.company_id
      AND company_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can create clients in their companies"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = clients.company_id
      AND company_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update clients in their companies"
  ON clients FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = clients.company_id
      AND company_members.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = clients.company_id
      AND company_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete clients in their companies"
  ON clients FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = clients.company_id
      AND company_members.user_id = (select auth.uid())
    )
  );

-- Items policies
DROP POLICY IF EXISTS "Users can view items of their companies" ON items;
DROP POLICY IF EXISTS "Users can create items in their companies" ON items;
DROP POLICY IF EXISTS "Users can update items in their companies" ON items;
DROP POLICY IF EXISTS "Users can delete items in their companies" ON items;

CREATE POLICY "Users can view items of their companies"
  ON items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = items.company_id
      AND company_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can create items in their companies"
  ON items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = items.company_id
      AND company_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update items in their companies"
  ON items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = items.company_id
      AND company_members.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = items.company_id
      AND company_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete items in their companies"
  ON items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = items.company_id
      AND company_members.user_id = (select auth.uid())
    )
  );

-- Quotes policies
DROP POLICY IF EXISTS "Users can view quotes of their companies" ON quotes;
DROP POLICY IF EXISTS "Users can create quotes in their companies" ON quotes;
DROP POLICY IF EXISTS "Users can update quotes in their companies" ON quotes;
DROP POLICY IF EXISTS "Users can delete quotes in their companies" ON quotes;

CREATE POLICY "Users can view quotes of their companies"
  ON quotes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = quotes.company_id
      AND company_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can create quotes in their companies"
  ON quotes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = quotes.company_id
      AND company_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update quotes in their companies"
  ON quotes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = quotes.company_id
      AND company_members.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = quotes.company_id
      AND company_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete quotes in their companies"
  ON quotes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = quotes.company_id
      AND company_members.user_id = (select auth.uid())
    )
  );

-- Quote lines policies
DROP POLICY IF EXISTS "Users can view quote lines of their companies" ON quote_lines;
DROP POLICY IF EXISTS "Users can create quote lines in their companies" ON quote_lines;
DROP POLICY IF EXISTS "Users can update quote lines in their companies" ON quote_lines;
DROP POLICY IF EXISTS "Users can delete quote lines in their companies" ON quote_lines;

CREATE POLICY "Users can view quote lines of their companies"
  ON quote_lines FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes
      JOIN company_members ON company_members.company_id = quotes.company_id
      WHERE quotes.id = quote_lines.quote_id
      AND company_members.user_id = (select auth.uid())
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
      AND company_members.user_id = (select auth.uid())
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
      AND company_members.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotes
      JOIN company_members ON company_members.company_id = quotes.company_id
      WHERE quotes.id = quote_lines.quote_id
      AND company_members.user_id = (select auth.uid())
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
      AND company_members.user_id = (select auth.uid())
    )
  );

-- Invoices policies
DROP POLICY IF EXISTS "Users can view invoices of their companies" ON invoices;
DROP POLICY IF EXISTS "Users can create invoices in their companies" ON invoices;
DROP POLICY IF EXISTS "Users can update invoices in their companies" ON invoices;
DROP POLICY IF EXISTS "Users can delete invoices in their companies" ON invoices;

CREATE POLICY "Users can view invoices of their companies"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = invoices.company_id
      AND company_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can create invoices in their companies"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = invoices.company_id
      AND company_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update invoices in their companies"
  ON invoices FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = invoices.company_id
      AND company_members.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = invoices.company_id
      AND company_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete invoices in their companies"
  ON invoices FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = invoices.company_id
      AND company_members.user_id = (select auth.uid())
    )
  );

-- Invoice lines policies
DROP POLICY IF EXISTS "Users can view invoice lines of their companies" ON invoice_lines;
DROP POLICY IF EXISTS "Users can create invoice lines in their companies" ON invoice_lines;
DROP POLICY IF EXISTS "Users can update invoice lines in their companies" ON invoice_lines;
DROP POLICY IF EXISTS "Users can delete invoice lines in their companies" ON invoice_lines;

CREATE POLICY "Users can view invoice lines of their companies"
  ON invoice_lines FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      JOIN company_members ON company_members.company_id = invoices.company_id
      WHERE invoices.id = invoice_lines.invoice_id
      AND company_members.user_id = (select auth.uid())
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
      AND company_members.user_id = (select auth.uid())
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
      AND company_members.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices
      JOIN company_members ON company_members.company_id = invoices.company_id
      WHERE invoices.id = invoice_lines.invoice_id
      AND company_members.user_id = (select auth.uid())
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
      AND company_members.user_id = (select auth.uid())
    )
  );

-- Payments policies
DROP POLICY IF EXISTS "Users can view payments of their companies" ON payments;
DROP POLICY IF EXISTS "Users can create payments in their companies" ON payments;
DROP POLICY IF EXISTS "Users can update payments in their companies" ON payments;
DROP POLICY IF EXISTS "Users can delete payments in their companies" ON payments;

CREATE POLICY "Users can view payments of their companies"
  ON payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = payments.company_id
      AND company_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can create payments in their companies"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = payments.company_id
      AND company_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update payments in their companies"
  ON payments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = payments.company_id
      AND company_members.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = payments.company_id
      AND company_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete payments in their companies"
  ON payments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = payments.company_id
      AND company_members.user_id = (select auth.uid())
    )
  );

-- 3. Fix function search_path issues
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION handle_new_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.company_members (company_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;