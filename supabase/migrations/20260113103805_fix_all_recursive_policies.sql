/*
  # Fix all recursive RLS policies

  1. Problem
    - companies SELECT checks company_members
    - company_members SELECT checks companies
    - This creates infinite recursion

  2. Solution
    - Simplify company_members SELECT to only check user_id directly
    - Allow companies SELECT to check owner_id OR company_members
    - Break the circular dependency
*/

-- Drop all existing policies on company_members
DROP POLICY IF EXISTS "Company owners can delete memberships" ON company_members;
DROP POLICY IF EXISTS "Company owners can manage memberships" ON company_members;
DROP POLICY IF EXISTS "Company owners can update memberships" ON company_members;
DROP POLICY IF EXISTS "Company owners can view all memberships" ON company_members;
DROP POLICY IF EXISTS "Users can view their own membership" ON company_members;

-- Drop existing policy on companies
DROP POLICY IF EXISTS "Users can view companies they are members of" ON companies;
DROP POLICY IF EXISTS "Company admins can update their companies" ON companies;

-- Create new non-recursive policies for company_members
-- SELECT: Users can only see rows where they are the user_id (no external table reference)
CREATE POLICY "Users can view own company memberships"
  ON company_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT: Only company owners can add members (check companies.owner_id directly)
CREATE POLICY "Company owners can add members"
  ON company_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = company_members.company_id
      AND companies.owner_id = auth.uid()
    )
  );

-- UPDATE: Only company owners can update members
CREATE POLICY "Company owners can update members"
  ON company_members
  FOR UPDATE
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

-- DELETE: Only company owners can remove members
CREATE POLICY "Company owners can delete members"
  ON company_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = company_members.company_id
      AND companies.owner_id = auth.uid()
    )
  );

-- Create new policies for companies
-- SELECT: Users can view companies they own OR are members of
CREATE POLICY "Users can view own or member companies"
  ON companies
  FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = companies.id
      AND company_members.user_id = auth.uid()
    )
  );

-- UPDATE: Only owners and admins can update
CREATE POLICY "Company owners and admins can update"
  ON companies
  FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = companies.id
      AND company_members.user_id = auth.uid()
      AND company_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = companies.id
      AND company_members.user_id = auth.uid()
      AND company_members.role IN ('owner', 'admin')
    )
  );