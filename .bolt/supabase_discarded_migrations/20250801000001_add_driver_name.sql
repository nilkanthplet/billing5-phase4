alter table public.challans
add column driver_name text;

-- Add a comment to the column
comment on column public.challans.driver_name is 'Name of the driver who received/returned the plates';
