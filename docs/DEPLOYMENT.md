# Deployment Guide

## Overview

The Project Finance AI Engine consists of:

- **Backend**: FastAPI app (Python)
- **Frontend**: Static React build (Vite)
- **Database**: Supabase (PostgreSQL + pgvector)
- **AI**: Google Vertex AI (Gemini)

## Backend Deployment

### Option 1: Docker

```dockerfile
FROM python:3.13-slim
WORKDIR /app
RUN pip install uv
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev
COPY backend/src/ ./
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Option 2: Cloud Run / App Engine

1. Build and push the container image.
2. Set environment variables: `SUPABASE_URL`, `SUPABASE_KEY`, `GOOGLE_PROJECT_ID`, `GOOGLE_LOCATION`, `GOOGLE_SERVICE_ACCOUNT`.
3. Ensure the service account has Vertex AI and Storage permissions.

### Option 3: Traditional VPS

```bash
cd backend
source .venv/bin/activate
uv sync
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

Use a process manager (systemd, supervisord) or reverse proxy (nginx) for production.

## Frontend Deployment

```bash
cd frontend
npm run build
```

The `dist/` folder contains static assets. Serve them with:

- **Nginx**: Point `root` to `dist/` and configure `try_files` for SPA routing.
- **Vercel / Netlify**: Connect the repo and set build command to `npm run build`.
- **Cloudflare Pages**: Same as above.

## Environment Variables (Production)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_KEY` | Yes | Supabase anon/service key |
| `GOOGLE_PROJECT_ID` | Yes | GCP project ID |
| `GOOGLE_LOCATION` | Yes | Vertex AI region (e.g. `us-central1`) |
| `GOOGLE_SERVICE_ACCOUNT` | Yes | Path to service account JSON or JSON content |
| `STORAGE_DIR` | No | Local file storage path (default: `/tmp/profinance_nexus`) |

## CORS

Configure `allow_origins` in `main.py` for your frontend domain in production:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-frontend-domain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Supabase Setup

1. Create a Supabase project.
2. Run migrations for `business_units`, `documents`, `facts`, `generated_outputs`, `document_chunks`.

## Security Checklist

- [ ] Use HTTPS in production
- [ ] Restrict CORS origins
- [ ] Store secrets in a secrets manager (e.g. GCP Secret Manager)
- [ ] Enable Supabase RLS
- [ ] Restrict Vertex AI API access
