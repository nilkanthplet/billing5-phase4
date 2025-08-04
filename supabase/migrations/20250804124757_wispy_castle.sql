/*
  # Remove Partner Stock Functionality

  1. Database Changes
    - Remove partner_stock_notes column from challan_items table
    - Remove partner_stock_notes column from return_line_items table
    - Remove any partner-related columns from stock table if they exist

  2. Security
    - Maintain existing RLS policies
    - No changes to user permissions needed
*/

-- Remove partner_stock_notes column from challan_items table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'challan_items' AND column_name = 'partner_stock_notes'
  ) THEN
    ALTER TABLE challan_items DROP COLUMN partner_stock_notes;
  END IF;
END $$;

-- Remove partner_stock_notes column from return_line_items table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'return_line_items' AND column_name = 'partner_stock_notes'
  ) THEN
    ALTER TABLE return_line_items DROP COLUMN partner_stock_notes;
  END IF;
END $$;

-- Remove any partner-related columns from stock table if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock' AND column_name = 'partner_stock'
  ) THEN
    ALTER TABLE stock DROP COLUMN partner_stock;
  END IF;
END $$;