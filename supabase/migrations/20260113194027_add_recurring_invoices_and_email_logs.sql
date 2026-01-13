/*
  # Add Recurring Invoices and Email Logs

  1. New Tables
    - `recurring_invoices` - Template for recurring invoice generation
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key)
      - `client_id` (uuid, foreign key)
      - `frequency` (text: weekly, monthly, quarterly, yearly)
      - `next_issue_date` (date)
      - `last_issue_date` (date)
      - `end_date` (date, optional)
      - `is_active` (boolean)
      - Template fields for invoice generation
    - `email_logs` - Track sent emails
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key)
      - `invoice_id` / `quote_id` (uuid, optional foreign keys)
      - `recipient_email` (text)
      - `subject` (text)
      - `status` (text: pending, sent, failed)
      - `sent_at` (timestamp)
      - `error_message` (text)
  
  2. New Columns
    - `invoices.sent_at` - Track when invoice was sent
    - `quotes.sent_at` - Track when quote was sent
    - `companies.email_footer` - Custom email footer
    - `companies.bank_details` - Bank details for invoices
  
  3. Security
    - Enable RLS on all new tables
    - Add policies for company member access
*/

-- Add new columns to existing tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'sent_at') THEN
    ALTER TABLE invoices ADD COLUMN sent_at timestamptz;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'sent_at') THEN
    ALTER TABLE quotes ADD COLUMN sent_at timestamptz;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'email_footer') THEN
    ALTER TABLE companies ADD COLUMN email_footer text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'bank_details') THEN
    ALTER TABLE companies ADD COLUMN bank_details text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'iban') THEN
    ALTER TABLE companies ADD COLUMN iban text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'bic') THEN
    ALTER TABLE companies ADD COLUMN bic text;
  END IF;
END $$;

-- Create recurring_invoices table
CREATE TABLE IF NOT EXISTS recurring_invoices (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  next_issue_date date NOT NULL,
  last_issue_date date,
  end_date date,
  is_active boolean DEFAULT true,
  currency_code text DEFAULT 'EUR',
  notes text,
  terms text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create recurring_invoice_lines table
CREATE TABLE IF NOT EXISTS recurring_invoice_lines (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  recurring_invoice_id uuid REFERENCES recurring_invoices(id) ON DELETE CASCADE NOT NULL,
  item_id uuid REFERENCES items(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity decimal(10,2) DEFAULT 1,
  unit_price decimal(12,2) NOT NULL,
  discount_rate decimal(5,2) DEFAULT 0,
  tax_rate decimal(5,2) DEFAULT 0,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create email_logs table
CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  body text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_company_id ON recurring_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_client_id ON recurring_invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_next_issue_date ON recurring_invoices(next_issue_date);
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_is_active ON recurring_invoices(is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_invoice_lines_recurring_invoice_id ON recurring_invoice_lines(recurring_invoice_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_company_id ON email_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_invoice_id ON email_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_quote_id ON email_logs(quote_id);

-- Enable RLS
ALTER TABLE recurring_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recurring_invoices
CREATE POLICY "Users can view recurring invoices of their companies"
  ON recurring_invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = recurring_invoices.company_id
      AND company_members.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can create recurring invoices in their companies"
  ON recurring_invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = recurring_invoices.company_id
      AND company_members.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can update recurring invoices in their companies"
  ON recurring_invoices FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = recurring_invoices.company_id
      AND company_members.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = recurring_invoices.company_id
      AND company_members.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can delete recurring invoices in their companies"
  ON recurring_invoices FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = recurring_invoices.company_id
      AND company_members.user_id = (SELECT auth.uid())
    )
  );

-- RLS Policies for recurring_invoice_lines
CREATE POLICY "Users can view recurring invoice lines of their companies"
  ON recurring_invoice_lines FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM recurring_invoices
      JOIN company_members ON company_members.company_id = recurring_invoices.company_id
      WHERE recurring_invoices.id = recurring_invoice_lines.recurring_invoice_id
      AND company_members.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can create recurring invoice lines in their companies"
  ON recurring_invoice_lines FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM recurring_invoices
      JOIN company_members ON company_members.company_id = recurring_invoices.company_id
      WHERE recurring_invoices.id = recurring_invoice_lines.recurring_invoice_id
      AND company_members.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can update recurring invoice lines in their companies"
  ON recurring_invoice_lines FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM recurring_invoices
      JOIN company_members ON company_members.company_id = recurring_invoices.company_id
      WHERE recurring_invoices.id = recurring_invoice_lines.recurring_invoice_id
      AND company_members.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM recurring_invoices
      JOIN company_members ON company_members.company_id = recurring_invoices.company_id
      WHERE recurring_invoices.id = recurring_invoice_lines.recurring_invoice_id
      AND company_members.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can delete recurring invoice lines in their companies"
  ON recurring_invoice_lines FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM recurring_invoices
      JOIN company_members ON company_members.company_id = recurring_invoices.company_id
      WHERE recurring_invoices.id = recurring_invoice_lines.recurring_invoice_id
      AND company_members.user_id = (SELECT auth.uid())
    )
  );

-- RLS Policies for email_logs
CREATE POLICY "Users can view email logs of their companies"
  ON email_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = email_logs.company_id
      AND company_members.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can create email logs in their companies"
  ON email_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = email_logs.company_id
      AND company_members.user_id = (SELECT auth.uid())
    )
  );

-- Trigger for updated_at on recurring_invoices
DROP TRIGGER IF EXISTS update_recurring_invoices_updated_at ON recurring_invoices;
CREATE TRIGGER update_recurring_invoices_updated_at BEFORE UPDATE ON recurring_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();