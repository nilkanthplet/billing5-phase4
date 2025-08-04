-- Update the challans policies to include driver_name
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."challans";
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON "public"."challans";
DROP POLICY IF EXISTS "Enable update for authenticated users" ON "public"."challans";
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON "public"."challans";

-- Recreate policies with driver_name field
CREATE POLICY "Enable read access for authenticated users"
ON "public"."challans"
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert for authenticated users"
ON "public"."challans"
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users"
ON "public"."challans"
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users"
ON "public"."challans"
FOR DELETE
TO authenticated
USING (true);

-- Grant permissions for the new column
GRANT ALL ON "public"."challans" TO authenticated;
GRANT ALL ON "public"."challans" TO service_role;
