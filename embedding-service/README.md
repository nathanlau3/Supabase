# Embedding Service for M3 Mac

This service runs ML embeddings locally on your M3 Mac, avoiding Supabase Edge Function CPU limits.

## Setup

The service is already configured! Just run from the project root:

```bash
./start-embedding-service.sh
```

This will:
- Use your M3's Neural Engine for fast inference
- Load the model once at startup
- Reuse it for all requests (very fast!)
- Run on http://localhost:8001

## Manual Setup (if needed)

```bash
cd embedding-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Run Manually

```bash
cd embedding-service
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

## Test

```bash
curl -X POST http://localhost:8001/embed \
  -H "Content-Type: application/json" \
  -d '{"texts": ["Hello world", "Test embedding"]}'
```

## How it works

The edge function at `supabase/functions/embed/index.ts` calls this service via HTTP to generate embeddings, offloading the heavy ML computation to your powerful M3 chip.
