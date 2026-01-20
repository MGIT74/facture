/*
  # Add Payment Integrations and Extend Payments Table

  1. New Tables
    - `payment_integrations` - Store provider configurations (Stripe, Wise)
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `provider` (text) - stripe, wise, manual
      - `is_enabled` (boolean)
      - `config` (jsonb) - config data
      - `created_at`, `updated_at` (timestamptz)

  2. Changes to existing tables
    - Add columns to `payments` for integration support:
      - `integration_id` (uuid, nullable)
      - `currency` (text)
      - `payment_status` (text)
      - `provider` (text)
      - `provider_payment_id` (text)
      - `provider_data` (jsonb)
      - `paid_at` (timestamptz)
      - `updated_at` (timestamptz)

  3. Security
    - Enable RLS on payment_integrations
    - Add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS payment_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('stripe', 'wise', 'manual')),
  is_enabled boolean DEFAULT false,
  config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, provider)
);

ALTER TABLE payment_integrations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_payment_integrations_company ON payment_integrations(company_id);

CREATE POLICY "Users can view payment integrations for their companies"
  ON payment_integrations FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert payment integrations for their companies"
  ON payment_integrations FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can update payment integrations for their companies"
  ON payment_integrations FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete payment integrations for their companies"
  ON payment_integrations FOR DELETE TO authenticated
  USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'integration_id') THEN
    ALTER TABLE payments ADD COLUMN integration_id uuid REFERENCES payment_integrations(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'currency') THEN
    ALTER TABLE payments ADD COLUMN currency text DEFAULT 'EUR';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'payment_status') THEN
    ALTER TABLE payments ADD COLUMN payment_status text DEFAULT 'completed' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'provider') THEN
    ALTER TABLE payments ADD COLUMN provider text DEFAULT 'manual' CHECK (provider IN ('stripe', 'wise', 'manual'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'provider_payment_id') THEN
    ALTER TABLE payments ADD COLUMN provider_payment_id text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'provider_data') THEN
    ALTER TABLE payments ADD COLUMN provider_data jsonb DEFAULT '{}';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'paid_at') THEN
    ALTER TABLE payments ADD COLUMN paid_at timestamptz;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'updated_at') THEN
    ALTER TABLE payments ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payments_integration ON payments(integration_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_payments_provider ON payments(provider);
