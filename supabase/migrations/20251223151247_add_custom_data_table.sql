-- Table to store embeddings for report officer data
-- This allows semantic search over reports alongside documents

create table report_embeddings (
  id bigint primary key generated always as identity,
  report_id int not null unique,  -- References the actual report ID
  searchable_content text not null,  -- Combined text for embedding
  embedding vector(384),  -- Same dimension as document_sections
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Create vector index for fast similarity search
create index on report_embeddings using hnsw (embedding vector_ip_ops);

-- Row Level Security
alter table report_embeddings enable row level security;

-- Policy: Anyone authenticated can read embeddings
create policy "Authenticated users can read report embeddings"
on report_embeddings for select to authenticated using (true);

-- Policy: Authenticated users can insert/update embeddings
create policy "Authenticated users can insert report embeddings"
on report_embeddings for insert to authenticated with check (true);

create policy "Authenticated users can update report embeddings"
on report_embeddings for update to authenticated using (true);

-- Policy: Service role can manage all embeddings
create policy "Service role can manage embeddings"
on report_embeddings for all to service_role using (true);

-- Function to generate searchable content from report fields
create or replace function generate_report_searchable_content(
  category_name text,
  officer_name text,
  description text,
  address text,
  polda_name text,
  polres_name text
)
returns text
language plpgsql
as $$
begin
  return concat_ws(' | ',
    'Kategori: ' || coalesce(category_name, ''),
    'Petugas: ' || coalesce(officer_name, ''),
    'Lokasi: ' || coalesce(address, ''),
    'Polda: ' || coalesce(polda_name, ''),
    'Polres: ' || coalesce(polres_name, ''),
    'Deskripsi: ' || coalesce(description, '')
  );
end;
$$;

-- Function to match both documents AND reports
create or replace function match_all_content(
  query_embedding vector(384),
  match_threshold float,
  match_count int default 10
)
returns table (
  id bigint,
  content text,
  source_type text,  -- 'document' or 'report'
  similarity float
)
language plpgsql
as $$
begin
  return query
  -- Search documents
  select
    ds.id,
    ds.content,
    'document'::text as source_type,
    (1 - (ds.embedding <=> query_embedding))::float as similarity
  from document_sections ds
  where 1 - (ds.embedding <=> query_embedding) > match_threshold

  union all

  -- Search reports
  select
    re.id,
    re.searchable_content as content,
    'report'::text as source_type,
    (1 - (re.embedding <=> query_embedding))::float as similarity
  from report_embeddings re
  where 1 - (re.embedding <=> query_embedding) > match_threshold

  order by similarity desc
  limit match_count;
end;
$$;

-- Function to match only reports
create or replace function match_reports(
  query_embedding vector(384),
  match_threshold float,
  match_count int default 5
)
returns table (
  id bigint,
  report_id int,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    re.id,
    re.report_id,
    re.searchable_content as content,
    (1 - (re.embedding <=> query_embedding))::float as similarity
  from report_embeddings re
  where 1 - (re.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
end;
$$;
