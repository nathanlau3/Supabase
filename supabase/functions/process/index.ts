
import { createClient } from "@supabase/supabase-js";
import { loadConfig } from "./lib/config.ts";
import { DocumentRepository } from "./repositories/document-repository.ts";
import { StorageService } from "./services/storage-service.ts";
import { MarkdownService } from "./services/markdown-service.ts";
import type { ProcessRequest } from "./types/index.ts";

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

    const { document_id }: ProcessRequest = await req.json();
    console.log("Received process request for document:", document_id);

    const documentRepository = new DocumentRepository(supabase);
    const storageService = new StorageService(supabase);
    const markdownService = new MarkdownService();

    const document = await documentRepository.getDocumentById(document_id);

    const fileContents = await storageService.downloadFile(
      document.storage_object_path
    );

    const processedMd = markdownService.processContent(fileContents);

    const sections = processedMd.sections.map(({ content }) => ({
      document_id,
      content,
    }));

    await documentRepository.saveSections(sections);

    console.log(
      `Successfully processed ${sections.length} sections for file '${document.name}'`
    );

    return new Response(null, {
      status: 204,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Unexpected error in process function:", error);
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
