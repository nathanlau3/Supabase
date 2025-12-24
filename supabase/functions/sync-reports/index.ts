import { createClient } from "@supabase/supabase-js";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
const embeddingServiceUrl =
  Deno.env.get("EMBEDDING_SERVICE_URL") || "http://host.docker.internal:8001";

/**
 * Syncs report data from view_report_officer to report_embeddings table
 * with vector embeddings for semantic search
 *
 * Usage:
 * POST /functions/v1/sync-reports
 * Body: { "report_ids": [1, 2, 3] } // Optional: sync specific reports
 *       { "sync_all": true }         // Sync all reports
 */
Deno.serve(async (req) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({ error: "Missing environment variables." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const authorization = req.headers.get("Authorization");

  if (!authorization) {
    return new Response(
      JSON.stringify({ error: "No authorization header passed" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
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

  const { report_ids, sync_all } = await req.json();

  // Fetch reports from the view
  let query = supabase
    .from("view_report_officer")
    .select(
      "id, report_category_name, officer_name, description, address, polda_name, polres_name",
    );

  if (!sync_all && report_ids && report_ids.length > 0) {
    query = query.in("id", report_ids);
  }

  const { data: reports, error: fetchError } = await query;

  if (fetchError) {
    console.error("Error fetching reports:", fetchError);
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!reports || reports.length === 0) {
    return new Response(
      JSON.stringify({ message: "No reports found to sync" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  console.log(`Syncing ${reports.length} reports...`);

  // Generate searchable content for each report
  // Using more natural language for better semantic search
  const searchableContents = reports.map((report) => {
    const parts = [];

    // Use natural Indonesian sentences
    if (report.report_category_name) {
      parts.push(`Laporan ${report.report_category_name}`);
    }

    if (report.description) {
      parts.push(report.description);
    }

    if (report.officer_name) {
      parts.push(`Petugas ${report.officer_name}`);
    }

    if (report.address) {
      parts.push(`Lokasi ${report.address}`);
    }

    if (report.polda_name) {
      parts.push(`Polda ${report.polda_name}`);
    }

    if (report.polres_name) {
      parts.push(`Polres ${report.polres_name}`);
    }

    return parts.filter(Boolean).join(". ");
  });

  // Generate embeddings in batch
  // Using text_type: "passage" for document embeddings (default)
  console.log("Generating embeddings...");
  const embeddingResponse = await fetch(`${embeddingServiceUrl}/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ texts: searchableContents, text_type: "passage" }),
  });

  if (!embeddingResponse.ok) {
    const errorText = await embeddingResponse.text();
    console.error("Embedding service error:", errorText);
    return new Response(
      JSON.stringify({ error: "Failed to generate embeddings" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const { embeddings } = await embeddingResponse.json();

  // Upsert to report_embeddings table
  const upsertData = reports.map((report, i) => ({
    report_id: report.id,
    searchable_content: searchableContents[i],
    embedding: embeddings[i],
    updated_at: new Date().toISOString(),
  }));

  const { error: upsertError } = await supabase
    .from("report_embeddings")
    .upsert(upsertData, { onConflict: "report_id" });

  if (upsertError) {
    console.error("Error upserting embeddings:", upsertError);
    return new Response(JSON.stringify({ error: upsertError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log(`Successfully synced ${reports.length} reports`);

  return new Response(
    JSON.stringify({
      success: true,
      synced_count: reports.length,
      message: `Successfully synced ${reports.length} reports`,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
});
