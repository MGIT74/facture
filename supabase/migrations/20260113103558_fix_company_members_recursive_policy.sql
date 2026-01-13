/*
  # Fix infinite recursion in company_members RLS policy

  1. Problem
    - The SELECT policy on company_members references company_members itself
    - This causes infinite recursion when trying to read the table

  2. Solution
    - Drop the recursive policy
    - Create a new policy that checks user_id directly or via companies table
*/

DROP POLICY IF EXISTS "Users can view members of their companies" ON company_members;

CREATE POLICY "Users can view their own membership"
  ON company_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Company owners can view all memberships"
  ON company_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = company_members.company_id
      AND companies.owner_id = auth.uid()
    )
  );