/*
  # Role-Based Access Control Implementation

  1. Security Updates
    - Update all existing RLS policies to check for admin role
    - Admin user: nilkanthplatdepo@gmail.com gets full access
    - All other users get read-only access
    - Apply restrictions to all tables: clients, challans, challan_items, returns, return_line_items, stock, bills

  2. Policy Changes
    - Replace existing policies with role-based ones
    - Admin can INSERT, UPDATE, DELETE
    - Non-admin users can only SELECT
*/

-- Drop all existing policies first
DROP POLICY IF EXISTS "Authenticated users can manage clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can manage challans" ON challans;
DROP POLICY IF EXISTS "Authenticated users can manage challan items" ON challan_items;
DROP POLICY IF EXISTS "Authenticated users can manage returns" ON returns;
DROP POLICY IF EXISTS "Authenticated users can manage return line items" ON return_line_items;
DROP POLICY IF EXISTS "Authenticated users can manage stock" ON stock;
DROP POLICY IF EXISTS "Authenticated users can manage bills" ON bills;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.jwt() ->> 'email' = 'nilkanthplatdepo@gmail.com';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- CLIENTS table policies
CREATE POLICY "Admin can manage clients"
  ON clients
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

CREATE POLICY "Non-admin can view clients"
  ON clients
  FOR SELECT
  TO authenticated
  USING (NOT is_admin_user());

-- CHALLANS table policies
CREATE POLICY "Admin can manage challans"
  ON challans
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

CREATE POLICY "Non-admin can view challans"
  ON challans
  FOR SELECT
  TO authenticated
  USING (NOT is_admin_user());

-- CHALLAN_ITEMS table policies
CREATE POLICY "Admin can manage challan items"
  ON challan_items
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

CREATE POLICY "Non-admin can view challan items"
  ON challan_items
  FOR SELECT
  TO authenticated
  USING (NOT is_admin_user());

-- RETURNS table policies
CREATE POLICY "Admin can manage returns"
  ON returns
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

CREATE POLICY "Non-admin can view returns"
  ON returns
  FOR SELECT
  TO authenticated
  USING (NOT is_admin_user());

-- RETURN_LINE_ITEMS table policies
CREATE POLICY "Admin can manage return line items"
  ON return_line_items
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

CREATE POLICY "Non-admin can view return line items"
  ON return_line_items
  FOR SELECT
  TO authenticated
  USING (NOT is_admin_user());

-- STOCK table policies
CREATE POLICY "Admin can manage stock"
  ON stock
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

CREATE POLICY "Non-admin can view stock"
  ON stock
  FOR SELECT
  TO authenticated
  USING (NOT is_admin_user());

-- BILLS table policies
CREATE POLICY "Admin can manage bills"
  ON bills
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

CREATE POLICY "Non-admin can view bills"
  ON bills
  FOR SELECT
  TO authenticated
  USING (NOT is_admin_user());