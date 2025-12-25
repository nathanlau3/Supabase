
import type { SupabaseClient } from "@supabase/supabase-js";

export class StorageService {
  constructor(private supabase: SupabaseClient) {}

  async downloadFile(storagePath: string): Promise<string> {
    console.log("Downloading file from storage:", storagePath);

    const { data: file, error } = await this.supabase.storage
      .from("files")
      .download(storagePath);

    if (error || !file) {
      console.error("Failed to download file:", error);
      throw new Error("Failed to download storage object");
    }

    const fileContents = await file.text();
    console.log("File downloaded successfully, size:", fileContents.length);

    return fileContents;
  }
}
