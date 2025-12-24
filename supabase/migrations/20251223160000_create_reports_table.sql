-- Create reports table to store report officer data
create table reports (
  id int primary key,  -- Using external K3I API ID
  code text not null,
  description text,
  report_category_id int,
  report_category_name text,
  report_category_icon text,
  report_category_color text,
  officer_name text,
  address text,
  latitude numeric,
  longitude numeric,
  polda_id int,
  polda_name text,
  polda_logo text,
  polres_id int,
  polres_name text,
  nrp text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Create index on created_at for ordering
create index idx_reports_created_at on reports(created_at desc);

-- Create index on category for filtering
create index idx_reports_category on reports(report_category_id);

-- Row Level Security
alter table reports enable row level security;

-- Policy: Anyone authenticated can read reports
create policy "Authenticated users can read reports"
on reports for select to authenticated using (true);

-- Policy: Authenticated users can insert reports (for sync functionality)
create policy "Authenticated users can insert reports"
on reports for insert to authenticated with check (true);

-- Policy: Service role can manage all reports
create policy "Service role can manage reports"
on reports for all to service_role using (true);

-- Create trigger to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_reports_updated_at
  before update on reports
  for each row
  execute function update_updated_at_column();
