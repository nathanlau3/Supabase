
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentRow, EmbeddingUpdate } from "../types/index.ts";

export class DocumentRepository {
  constructor(private supabase: SupabaseClient) {}

  async getDocumentsWithoutEmbeddings(
    table: string,
    ids: number[],
    contentColumn: string,
    embeddingColumn: string
  ): Promise<DocumentRow[]> {
    console.log(`Fetching documents from '${table}' table:`, { ids, contentColumn, embeddingColumn });

    const { data: rows, error } = await this.supabase
      .from(table)
      .select(`id, ${contentColumn}` as "*")
      .in("id", ids)
      .is(embeddingColumn, null);

    if (error) {
      console.error(`Error fetching documents from '${table}':`, error);
      throw error;
    }

    console.log(`Found ${rows?.length || 0} documents without embeddings`);
    return rows || [];
  }

  async updateEmbeddings(
    table: string,
    updates: EmbeddingUpdate[],
    embeddingColumn: string
  ): Promise<void> {
    console.log(`Updating ${updates.length} embeddings in '${table}' table`);

    const updatePromises = updates.map(({ id, embedding }) =>
      this.supabase
        .from(table)
        .update({
          [embeddingColumn]: embedding,
        })
        .eq("id", id)
    );

    const results = await Promise.all(updatePromises);

    results.forEach((result, i) => {
      if (result.error) {
        console.error(
          `Failed to save embedding on '${table}' table with id ${updates[i].id}:`,
          result.error
        );
      } else {
        console.log(
          `Saved embedding for document ${updates[i].id} in '${table}' table`
        );
      }
    });
  }
}
