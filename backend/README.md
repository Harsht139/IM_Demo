# Backend - Project Finance AI Engine

This is the core intelligence layer of the Profinance Nexus platform.

## Architecture & Services
The backend follows a modular service-oriented architecture:

- **api/**: FastAPI routes defining the public contract.
- **services/**: Business logic layer:
    - `IngestionService`: Handles file uploads and coordination.
    - `ExtractionService`: High-fidelity structural extraction with Docling.
    - `ReconciliationService`: Detects and resolves data conflicts.
    - `IMService`: Synthesizes final Information Memorandums with Gemini.
    - `RAGService`: Manages vector search and contextual retrieval.
    - `SupabaseService`: Direct interface with the data layer.
- **models/**: Pydantic schemas for request/response validation.

## Setup & Development
Requires Python 3.13 and `uv`.

1. **Install dependencies**: `uv sync`
2. **Setup environment**: Create `.env` based on root instructions.
3. **Run for development**: `uvicorn backend.app.main:app --reload`
4. **Run tests**: `pytest`

## Key Capabilities
- **Docling Integration**: Captures bounding box coordinates for every extracted element.
- **Structured LLM Output**: Uses Gemini's Pydantic response format for reliable data extraction.
- **PGVector Storage**: Efficient semantic search for large project documents.
