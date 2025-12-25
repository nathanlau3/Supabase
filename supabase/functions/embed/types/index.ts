
export interface EmbedRequest {
  ids: number[];
  table: string;
  contentColumn: string;
  embeddingColumn: string;
}

export interface DocumentRow {
  id: number;
  [key: string]: any;
}

export interface EmbeddingUpdate {
  id: number;
  embedding: number[];
}

export interface Config {
  supabaseUrl: string;
  supabaseAnonKey: string;
  embeddingServiceUrl: string;
}
