
import { createClient } from "@supabase/supabase-js";
import { loadConfig } from "./lib/config.ts";
import { EmbeddingService } from "./services/embedding-service.ts";
import { DocumentRepository } from "./repositories/document-repository.ts";
import type { EmbedRequest } from "./types/index.ts";

Deno.serve(async (req) => {
  try {
    const config = loadConfig();

    const authorization = req.headers.get("Authorization");
    if (!authorization) {
      console.error("No authorization header");
      return new Response(
        JSON.stringify({ error: "No authorization header passed" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      global: { headers: { authorization } },
      auth: { persistSession: false },
    });

    const { ids, table, contentColumn, embeddingColumn }: EmbedRequest = await req.json();
    console.log("Received embed request:", { table, ids: ids.length, contentColumn, embeddingColumn });

    const documentRepository = new DocumentRepository(supabase);
    const embeddingService = new EmbeddingService(config.embeddingServiceUrl);

    const rows = await documentRepository.getDocumentsWithoutEmbeddings(
      table,
      ids,
      contentColumn,
      embeddingColumn
    );

    const textsToEmbed = rows
      .map((row) => row[contentColumn])
      .filter((content) => content);

    if (textsToEmbed.length === 0) {
      console.log("No documents to embed");
      return new Response(null, {
        status: 204,
        headers: { "Content-Type": "application/json" },
      });
    }

    const embeddings = await embeddingService.generateEmbeddings(textsToEmbed);

    const updates = rows.map((row, i) => ({
      id: row.id,
      embedding: embeddings[i],
    }));

    await documentRepository.updateEmbeddings(table, updates, embeddingColumn);

    console.log(`Successfully embedded ${updates.length} documents`);
    return new Response(null, {
      status: 204,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Unexpected error in embed function:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({
        error: "An unexpected error occurred: " + errorMessage,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
