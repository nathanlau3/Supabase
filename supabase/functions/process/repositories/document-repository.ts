
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Document, DocumentSection } from "../types/index.ts";

export class DocumentRepository {
  constructor(private supabase: SupabaseClient) {}

  async getDocumentById(documentId: number): Promise<Document> {
    console.log("Fetching document with id:", documentId);

    const { data: document, error } = await this.supabase
      .from("documents_with_storage_path")
      .select()
      .eq("id", documentId)
      .single();

    if (error || !document) {
      console.error("Failed to find document:", error);
      throw new Error("Failed to find uploaded document");
    }

    if (!document.storage_object_path) {
      throw new Error("Document has no storage path");
    }

    console.log("Found document:", document.name);
    return document;
  }

  async saveSections(sections: DocumentSection[]): Promise<void> {
    console.log("Saving", sections.length, "document sections");

    const { error } = await this.supabase
      .from("document_sections")
      .insert(sections);

    if (error) {
      console.error("Failed to save document sections:", error);
      throw new Error("Failed to save document sections");
    }

    console.log("Successfully saved all sections");
  }
}
