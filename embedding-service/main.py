"""
Separate embedding service to avoid Supabase Edge Function CPU limits.
Run this alongside your Supabase instance.

Install: pip install fastapi uvicorn sentence-transformers
Run: uvicorn main:app --host 0.0.0.0 --port 8001
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from typing import List

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model once at startup
# Using multilingual-e5-small: Better multilingual performance, excellent Indonesian support
# Still 384 dimensions (same as gte-small), so no DB schema changes needed
model = SentenceTransformer('intfloat/multilingual-e5-small')

class EmbedRequest(BaseModel):
    texts: List[str]
    text_type: str = "passage"  # "query" or "passage"

@app.post("/embed")
async def create_embeddings(request: EmbedRequest):
    # multilingual-e5-small requires prefixes for optimal performance
    # Use "query: " for search queries and "passage: " for documents
    if request.text_type == "query":
        prefixed_texts = [f"query: {text}" for text in request.texts]
    else:  # passage (default)
        prefixed_texts = [f"passage: {text}" for text in request.texts]

    embeddings = model.encode(prefixed_texts, normalize_embeddings=True)
    return {
        "embeddings": embeddings.tolist()
    }

@app.get("/health")
async def health():
    return {"status": "ok"}
