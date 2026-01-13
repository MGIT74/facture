/*
  # Optimize RLS policies for better performance

  1. Changes
    - Replace direct `auth.uid()` calls with `(select auth.uid())` in all RLS policies
    - This prevents re-evaluation of the auth function for each row
    - Significantly improves query performance at scale

  2. Affected Tables
    - `company_members` - 4 policies updated
    - `companies` - 2 policies updated

  3. Security
    - No security changes, same access rules apply
    - Only performance optimization
*/

-- Drop existing policies on company_members
DROP POLICY IF EXISTS "Users can view own company memberships" ON company_members;
DROP POLICY IF EXISTS "Company owners can add members" ON company_members;
DROP POLICY IF EXISTS "Company owners can update members" ON company_members;
DROP POLICY IF EXISTS "Company owners can delete members" ON company_members;

-- Drop existing policies on companies
DROP POLICY IF EXISTS "Users can view own or member companies" ON companies;
DROP POLICY IF EXISTS "Company owners and admins can update" ON companies;

-- Recreate company_members policies with optimized auth function calls
CREATE POLICY "Users can view own company memberships"
  ON company_members
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Company owners can add members"
  ON company_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = company_members.company_id
      AND companies.owner_id = (select auth.uid())
    )
  );

CREATE POLICY "Company owners can update members"
  ON company_members
  FOR UPDATE
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

CREATE POLICY "Company owners can delete members"
  ON company_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = company_members.company_id
      AND companies.owner_id = (select auth.uid())
    )
  );

-- Recreate companies policies with optimized auth function calls
CREATE POLICY "Users can view own or member companies"
  ON companies
  FOR SELECT
  TO authenticated
  USING (
    owner_id = (select auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = companies.id
      AND company_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Company owners and admins can update"
  ON companies
  FOR UPDATE
  TO authenticated
  USING (
    owner_id = (select auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = companies.id
      AND company_members.user_id = (select auth.uid())
      AND company_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    owner_id = (select auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = companies.id
      AND company_members.user_id = (select auth.uid())
      AND company_members.role IN ('owner', 'admin')
    )
  );
