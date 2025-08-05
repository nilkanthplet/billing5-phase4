/*
  # Add damage and loss tracking to return line items

  1. Schema Changes
    - Add `damaged_quantity` column to `return_line_items` table
    - Add `lost_quantity` column to `return_line_items` table
    - Add `driver_name` column to `returns` table for consistency with challans

  2. Security
    - Maintain existing RLS policies
    - No additional security changes needed

  3. Notes
    - These fields allow tracking damaged and lost plates during returns
    - Supports better inventory management and billing accuracy
    - Driver name field maintains consistency between issue and return challans
*/

-- Add damaged_quantity column to return_line_items table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'return_line_items' AND column_name = 'damaged_quantity'
  ) THEN
    ALTER TABLE return_line_items ADD COLUMN damaged_quantity integer DEFAULT 0;
  END IF;
END $$;

-- Add lost_quantity column to return_line_items table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'return_line_items' AND column_name = 'lost_quantity'
  ) THEN
    ALTER TABLE return_line_items ADD COLUMN lost_quantity integer DEFAULT 0;
  END IF;
END $$;

-- Add driver_name column to returns table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'returns' AND column_name = 'driver_name'
  ) THEN
    ALTER TABLE returns ADD COLUMN driver_name text;
  END IF;
END $$;

-- Add comments to explain the purpose of these fields
COMMENT ON COLUMN return_line_items.damaged_quantity IS 'Number of plates returned in damaged condition';
COMMENT ON COLUMN return_line_items.lost_quantity IS 'Number of plates reported as lost during return';
COMMENT ON COLUMN returns.driver_name IS 'Name of the driver who delivered the returned plates';