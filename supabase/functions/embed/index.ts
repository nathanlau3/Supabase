import { createClient } from '@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
const embeddingServiceUrl = Deno.env.get('EMBEDDING_SERVICE_URL') || 'http://host.docker.internal:8001';

Deno.serve(async (req) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({
        error: 'Missing environment variables.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const authorization = req.headers.get('Authorization');

  if (!authorization) {
    return new Response(
      JSON.stringify({ error: `No authorization header passed` }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        authorization,
      },
    },
    auth: {
      persistSession: false,
    },
  });

  const { ids, table, contentColumn, embeddingColumn } = await req.json();

  const { data: rows, error: selectError } = await supabase
    .from(table)
    .select(`id, ${contentColumn}` as '*')
    .in('id', ids)
    .is(embeddingColumn, null);

  if (selectError) {
    return new Response(JSON.stringify({ error: selectError }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Batch all texts together for efficient processing
  const textsToEmbed = rows
    .map(row => row[contentColumn])
    .filter(content => content);

  if (textsToEmbed.length === 0) {
    return new Response(null, {
      status: 204,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Call external embedding service running on your M3 Mac
  const embeddingResponse = await fetch(`${embeddingServiceUrl}/embed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ texts: textsToEmbed }),
  });

  if (!embeddingResponse.ok) {
    return new Response(
      JSON.stringify({ error: 'Failed to generate embeddings' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const { embeddings } = await embeddingResponse.json();

  // Update rows with embeddings
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const { id } = row;
    const embedding = JSON.stringify(embeddings[i]);

    const { error } = await supabase
      .from(table)
      .update({
        [embeddingColumn]: embedding,
      })
      .eq('id', id);

    if (error) {
      console.error(
        `Failed to save embedding on '${table}' table with id ${id}`
      );
    }

    console.log(
      `Generated embedding ${JSON.stringify({
        table,
        id,
        contentColumn,
        embeddingColumn,
      })}`
    );
  }

  return new Response(null, {
    status: 204,
    headers: { 'Content-Type': 'application/json' },
  });
});
