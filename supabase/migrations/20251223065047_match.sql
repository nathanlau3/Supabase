create or replace function match_document_sections(
  embedding vector(384),
  match_threshold float
)
returns setof document_sections
language plpgsql
as $$
#variable_conflict use_variable
begin
  return query
  select *
  from document_sections
  where 1 - (document_sections.embedding <=> embedding) > match_threshold
	order by document_sections.embedding <=> embedding;
end;
$$;