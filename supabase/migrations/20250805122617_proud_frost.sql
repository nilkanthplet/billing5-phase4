/*
  # Add partner_stock_notes column to challan_items table

  1. Schema Changes
    - Add `partner_stock_notes` column to `challan_items` table to store notes for each plate size
    - This field will store notes about partner stock or any special instructions

  2. Security
    - Maintain existing RLS policies
    - No additional security changes needed

  3. Notes
    - This field allows storing notes per plate size in challan items
    - Supports both regular stock and partner stock tracking
*/

-- Add partner_stock_notes column to challan_items table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'challan_items' AND column_name = 'partner_stock_notes'
  ) THEN
    ALTER TABLE challan_items ADD COLUMN partner_stock_notes text;
  END IF;
END $$;

-- Add comment to explain the purpose of this field
COMMENT ON COLUMN challan_items.partner_stock_notes IS 'Notes about partner stock or special instructions for this plate size';