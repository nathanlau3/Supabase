import { createClient } from "@supabase/supabase-js";
import { streamText } from "ai";
import { codeBlock } from "common-tags";
import { createOpenAI } from "@ai-sdk/openai";

const apiKey = Deno.env.get("OPENAI_API_KEY");
console.log("OpenAI API Key available:", !!apiKey, "Length:", apiKey?.length);

const openai = createOpenAI({
  apiKey: apiKey || "",
});

// These are automatically injected
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
const embeddingServiceUrl =
  Deno.env.get("EMBEDDING_SERVICE_URL") || "http://host.docker.internal:8001";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  try {
    // Handle CORS
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing environment variables");
      return new Response(
        JSON.stringify({
          error: "Missing environment variables.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const authorization = req.headers.get("Authorization");

    if (!authorization) {
      console.error("No authorization header");
      return new Response(
        JSON.stringify({ error: `No authorization header passed` }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
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

    const { messages } = await req.json();
    console.log("Received chat request with", messages.length, "messages");

    // Get the latest user message
    const lastMessage = messages[messages.length - 1];
    const userQuery = lastMessage?.content || "";
    console.log("Original query:", userQuery);

    // QUERY ENHANCEMENT: Generate multiple query variations for better retrieval
    // This helps find relevant docs even if query wording doesn't match exactly
    const queryVariations = [
      userQuery, // Original query
      // Add context from chat history if available
      messages.length > 1
        ? `${messages[messages.length - 2]?.content || ""} ${userQuery}`.trim()
        : userQuery,
    ];

    console.log("Query variations:", queryVariations.length);

    // Generate embeddings for all query variations
    console.log("Fetching embeddings from:", embeddingServiceUrl);
    const embeddingResponse = await fetch(`${embeddingServiceUrl}/embed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ texts: queryVariations }),
    });

    console.log("Embedding response status:", embeddingResponse.status);

    if (!embeddingResponse.ok) {
      const errorText = await embeddingResponse.text();
      console.error("Embedding service error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to generate embeddings for query" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const { embeddings } = await embeddingResponse.json();
    console.log("Embeddings generated:", embeddings.length);

    // MULTI-QUERY RETRIEVAL: Search with all query variations and merge results
    // This significantly improves recall by finding docs that match any variation
    const matchThreshold = 0.3;
    console.log(
      `Searching with ${embeddings.length} query variations, threshold ${matchThreshold}`,
    );

    // Search with each embedding variation
    // Now using match_all_content to search BOTH documents and reports
    const searchPromises = embeddings.map((embedding: number[]) =>
      supabase
        .rpc("match_all_content", {
          query_embedding: embedding,
          match_threshold: matchThreshold,
          match_count: 10,
        })
        .select("id, content, source_type, similarity"),
    );

    const searchResults = await Promise.all(searchPromises);

    // Merge and deduplicate results by ID + source_type, keeping unique items
    const documentMap = new Map();
    searchResults.forEach((result) => {
      if (result.data) {
        result.data.forEach((doc: { id: number; content: string; source_type: string; similarity: number }) => {
          const key = `${doc.source_type}-${doc.id}`;
          if (!documentMap.has(key)) {
            documentMap.set(key, doc);
          }
        });
      }
    });

    const documents = Array.from(documentMap.values());
    const matchError = searchResults.find((r) => r.error)?.error;

    const docCount = documents.filter((d) => (d as { source_type: string }).source_type === 'document').length;
    const reportCount = documents.filter((d) => (d as { source_type: string }).source_type === 'report').length;

    console.log(
      "Multi-query retrieval - unique items found:",
      documents.length,
      `(${docCount} documents, ${reportCount} reports)`,
      "error:",
      matchError,
    );

    if (matchError) {
      console.error("Match error details:", matchError);

      return new Response(
        JSON.stringify({
          error: "There was an error reading your documents, please try again.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const injectedDocs =
      documents && documents.length > 0
        ? documents.map(({ content }) => content).join("\n\n")
        : "No documents found";

    const systemPrompt = codeBlock`
    You're an AI assistant who answers questions about documents.

    You can respond in any language the user asks in, including Bahasa Indonesia and English.

    IMPORTANT INSTRUCTIONS:
    1. Answer based ONLY on the documents provided below
    2. If you find partial information, provide what you found and clearly state what's missing
    3. Cite specific details from the documents when answering
    4. If the question is completely unrelated to the documents, say:
       - English: "Sorry, I couldn't find any information on that."
       - Bahasa Indonesia: "Maaf, saya tidak menemukan informasi tentang itu."
    5. Keep your replies natural and conversational

    EXAMPLE OF GOOD PARTIAL ANSWER:
    User: "What was the common food and drink?"
    Good: "Based on the documents, the common foods were bread and grain. However, I don't see specific information about drinks."
    Bad: "Sorry, I couldn't find any information on that."

    Documents:
    ${injectedDocs}
  `;

    console.log("Starting streamText with OpenAI");
    try {
      const result = streamText({
        model: openai("gpt-3.5-turbo"),
        system: systemPrompt,
        messages: messages,
        maxTokens: 1024,
        temperature: 0,
        onFinish({ finishReason, usage }) {
          console.log("Stream finished:", { finishReason, usage });
        },
      });

      console.log("Returning streaming response");
      return result.toDataStreamResponse({ headers: corsHeaders });
    } catch (streamError) {
      console.error("StreamText error:", streamError);
      throw streamError;
    }
  } catch (error) {
    console.error("Unexpected error in chat function:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({
        error: "An unexpected error occurred: " + errorMessage,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
});
