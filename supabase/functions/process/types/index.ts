
export interface ProcessRequest {
  document_id: number;
}

export interface Document {
  id: number;
  name: string;
  storage_object_path: string;
  [key: string]: any;
}

export interface ProcessedMarkdown {
  sections: Section[];
}

export interface Section {
  content: string;
}

export interface DocumentSection {
  document_id: number;
  content: string;
}

export interface Config {
  supabaseUrl: string;
  supabaseAnonKey: string;
}
