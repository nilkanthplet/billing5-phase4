-- Add driver_name column to returns table
ALTER TABLE returns ADD COLUMN driver_name text;

-- Update RLS policies to include driver_name
CREATE POLICY "Enable read access for authenticated users" ON public.returns
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Enable insert access for admin users" ON public.returns
    FOR INSERT TO authenticated
    WITH CHECK (auth.jwt()->>'isAdmin' = 'true');

CREATE POLICY "Enable update access for admin users" ON public.returns
    FOR UPDATE TO authenticated
    USING (auth.jwt()->>'isAdmin' = 'true')
    WITH CHECK (auth.jwt()->>'isAdmin' = 'true');
