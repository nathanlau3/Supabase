/// <reference lib="deno.ns" />

import { createClient } from "@supabase/supabase-js";
import { streamText } from "ai";
import { codeBlock } from "common-tags";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

type LLMType = "gpt-3.5-turbo" | "llama3.1";

// Environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
const llmType: LLMType =
  (Deno.env.get("LLM_TYPE") as LLMType) || "gpt-3.5-turbo";
const embeddingServiceUrl =
  Deno.env.get("EMBEDDING_SERVICE_URL") || "http://host.docker.internal:8001";

// OpenAI configuration
const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
const openaiProvider = createOpenAI({
  apiKey: openaiApiKey || "",
});

// Llama configuration (via ZeroTier)
const llamaBaseUrl = Deno.env.get("LLAMA_BASE_URL"); // e.g., "http://your-zerotier-ip:11434"
const llamaProvider = createOpenAI({
  baseURL: llamaBaseUrl || "http://localhost:11434/v1",
  apiKey: "ollama", // Ollama doesn't require real API key
});

// Helper function to get the appropriate model based on LLM type
function getModel(type: LLMType) {
  switch (type) {
    case "gpt-3.5-turbo":
      return openaiProvider("gpt-3.5-turbo");
    case "llama3.1":
      return llamaProvider("llama3.1");
    default:
      console.warn(`Unknown LLM type: ${type}, defaulting to gpt-3.5-turbo`);
      return openaiProvider("gpt-3.5-turbo");
  }
}

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
    // Using text_type: "query" for proper multilingual-e5-small prefix
    console.log("Fetching embeddings from:", embeddingServiceUrl);
    const embeddingResponse = await fetch(`${embeddingServiceUrl}/embed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ texts: queryVariations, text_type: "query" }),
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
        result.data.forEach(
          (doc: {
            id: number;
            content: string;
            source_type: string;
            similarity: number;
          }) => {
            const key = `${doc.source_type}-${doc.id}`;
            if (!documentMap.has(key)) {
              documentMap.set(key, doc);
            }
          },
        );
      }
    });

    const documents = Array.from(documentMap.values());
    const matchError = searchResults.find((r) => r.error)?.error;

    const docCount = documents.filter(
      (d) => (d as { source_type: string }).source_type === "document",
    ).length;
    const reportCount = documents.filter(
      (d) => (d as { source_type: string }).source_type === "report",
    ).length;

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

    console.log("Starting streamText with LLM:", llmType);
    try {
      const result = streamText({
        model: getModel(llmType),
        system: systemPrompt,
        messages: messages,
        maxTokens: 1024,
        temperature: 0,
        maxSteps: 5,
        tools: {
          count_reports: {
            description:
              "Count reports from the database. Use this for questions like 'how many reports', 'berapa jumlah laporan', 'total laporan', etc. Can filter by category, location (polda/polres), or officer name.",
            parameters: z.object({
              category: z
                .string()
                .optional()
                .describe(
                  "Filter by report category name (e.g., 'Pungli', 'Premanisme')",
                ),
              polda_name: z
                .string()
                .optional()
                .describe("Filter by Polda name"),
              polres_name: z
                .string()
                .optional()
                .describe("Filter by Polres name"),
              officer_name: z
                .string()
                .optional()
                .describe("Filter by officer name"),
            }),
            execute: async ({
              category,
              polda_name,
              polres_name,
              officer_name,
            }: {
              category?: string;
              polda_name?: string;
              polres_name?: string;
              officer_name?: string;
            }) => {
              console.log("Executing count_reports tool with filters:", {
                category,
                polda_name,
                polres_name,
                officer_name,
              });

              let query = supabase
                .from("reports")
                .select("*", { count: "exact", head: true });

              if (category) {
                query = query.ilike("report_category_name", `%${category}%`);
              }
              if (polda_name) {
                query = query.ilike("polda_name", `%${polda_name}%`);
              }
              if (polres_name) {
                query = query.ilike("polres_name", `%${polres_name}%`);
              }
              if (officer_name) {
                query = query.ilike("officer_name", `%${officer_name}%`);
              }

              const { count, error } = await query;

              if (error) {
                console.error("Count error:", error);
                return { error: error.message };
              }

              return {
                count: count || 0,
                filters: { category, polda_name, polres_name, officer_name },
              };
            },
          },
          get_report_stats: {
            description:
              "Get aggregated statistics about reports. Use for questions about report distribution, top categories, top locations, etc.",
            parameters: z.object({
              group_by: z
                .enum(["category", "polda", "polres", "officer"])
                .describe("What to group the reports by"),
              limit: z
                .number()
                .optional()
                .describe("Maximum number of results to return (default 10)"),
            }),
            execute: async ({
              group_by,
              limit = 10,
            }: {
              group_by: string;
              limit?: number;
            }) => {
              console.log("Executing get_report_stats tool:", {
                group_by,
                limit,
              });

              const columnMap: Record<string, string> = {
                category: "report_category_name",
                polda: "polda_name",
                polres: "polres_name",
                officer: "officer_name",
              };

              const column = columnMap[group_by];
              if (!column) {
                return { error: "Invalid group_by parameter" };
              }

              const { data, error } = await supabase
                .from("reports")
                .select(column);

              if (error) {
                console.error("Stats error:", error);
                return { error: error.message };
              }

              if (!data) {
                return { group_by, stats: [], total_groups: 0 };
              }

              // Count occurrences
              const counts: Record<string, number> = {};
              for (const row of data) {
                const value = (row as unknown as Record<string, string>)[
                  column
                ];
                if (value) {
                  counts[value] = (counts[value] || 0) + 1;
                }
              }

              // Convert to array and sort
              const stats = Object.entries(counts)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, limit);

              return { group_by, stats, total_groups: stats.length };
            },
          },
        },
      });

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
