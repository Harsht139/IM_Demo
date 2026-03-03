# Project Finance AI Engine (Profinance Nexus)

An intelligent platform that automates **Information Memorandum (IM)** synthesis from complex project finance documents. Upload PDFs, DOCX, and Excel files; extract structured facts; reconcile conflicts; and generate professional IM drafts with pinpoint citations.

## Features

- **Document Ingestion**: Upload PDF, DOCX, XLSX, CSV, and TXT files
- **AI-Powered Extraction**: Docling for structural extraction with bounding-box coordinates
- **Conflict Reconciliation**: Detect and resolve conflicting facts across documents with truth heuristics
- **IM Synthesis**: Generate structured IM drafts using Gemini 2.0
- **Export**: Download as DOCX/PDF or upload to Google Drive
- **Citation Navigation**: Jump from IM sections to source document locations

## Documentation

- **[Product Requirements (PRD)](prd.md)**: Overview of features, target audience, and user flows.
- **[System Architecture](backend/doc/architecture.md)**: Detailed technical design and data flow.
- **[Technology Stack](tech_stack.md)**: Breakdown of backend, frontend, and infrastructure tools.

## Tech Stack

- **Backend**: Python 3.13, FastAPI, Docling, Supabase (PostgreSQL + pgvector), Google Vertex AI (Gemini)
- **Frontend**: React 19, TypeScript, Vite, Zustand, Tailwind CSS, Framer Motion

## Prerequisites

- Python 3.13+
- Node.js 18+
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- Supabase project
- Google Cloud project with Vertex AI enabled

## Quick Start

### 1. Clone and setup

```bash
cd demo
```

### 2. Backend setup

```bash
cd backend
source .venv/bin/activate   # or: .venv\Scripts\activate on Windows
uv sync
```

### 3. Environment variables

Create `backend/.env`:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key

# Google Cloud / Vertex AI
GOOGLE_PROJECT_ID=your-gcp-project-id
GOOGLE_LOCATION=us-central1
GOOGLE_SERVICE_ACCOUNT=path/to/service-account.json

# Optional
STORAGE_DIR=/tmp/profinance_nexus
LLAMA_CLOUD_API_KEY=your-key  # if using Llama parsing
```

### 4. Run backend

```bash
cd backend
source .venv/bin/activate
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

### 5. Run frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## API Documentation

When the backend is running, visit:

- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

## Project Structure

```
demo/
├── backend/
│   ├── src/backend/app/
│   │   ├── api/           # FastAPI routes
│   │   ├── services/      # Business logic
│   │   ├── models/       # Pydantic schemas
│   │   └── main.py
│   ├── doc/architecture.md
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── api/           # API client
│   │   ├── components/
│   │   ├── views/
│   │   └── store/
│   └── package.json
└── README.md
```

## Architecture

See [backend/doc/architecture.md](backend/doc/architecture.md) for the system design and data flow.

## E2E Tests

```bash
# From project root
npm install
npx playwright install   # Install browsers (one-time)

# Run E2E tests (uses existing frontend dev server if running)
npm run test:e2e
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
