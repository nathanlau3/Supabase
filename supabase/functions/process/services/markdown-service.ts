
import { processMarkdown } from "../../_lib/markdown-parser.ts";
import type { ProcessedMarkdown } from "../types/index.ts";

export class MarkdownService {
  processContent(fileContents: string): ProcessedMarkdown {
    console.log("Processing markdown content, length:", fileContents.length);

    const processed = processMarkdown(fileContents);

    console.log("Processed into", processed.sections.length, "sections");
    return processed;
  }
}
