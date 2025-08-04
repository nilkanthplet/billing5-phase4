/*
  # Add borrowed stock tracking to challan items

  1. Schema Changes
    - Add `borrowed_stock` column to `challan_items` table
    - This field will store borrowed stock quantities for billing purposes
    - Does not affect actual stock deduction logic

  2. Security
    - Update existing RLS policies to include the new field
    - Maintain existing access controls

  3. Notes
    - This field is for record-keeping and future billing logic only
    - Actual stock management remains unchanged
*/

-- Add borrowed_stock column to challan_items table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'challan_items' AND column_name = 'borrowed_stock'
  ) THEN
    ALTER TABLE challan_items ADD COLUMN borrowed_stock integer DEFAULT 0;
  END IF;
END $$;

-- Add comment to explain the purpose of this field
COMMENT ON COLUMN challan_items.borrowed_stock IS 'Quantity of borrowed stock from partners - for billing purposes only, does not affect actual stock counts';