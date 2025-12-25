
export class EmbeddingService {
  constructor(private embeddingServiceUrl: string) {}

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    console.log("Fetching embeddings from:", this.embeddingServiceUrl);

    const response = await fetch(`${this.embeddingServiceUrl}/embed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ texts }),
    });

    console.log("Embedding response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Embedding service error:", errorText);
      throw new Error("Failed to generate embeddings");
    }

    const { embeddings } = await response.json();
    console.log("Embeddings generated:", embeddings.length);

    return embeddings;
  }
}
