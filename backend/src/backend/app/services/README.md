# Services Layer - Profinance Nexus Backend

The `services` directory is the core of the application's business logic. Each service is specialized and decoupled from others to ensure testability and maintainability.

## Core Services
- **`SupabaseService`**: The primary data access layer. Wraps the Supabase client with retry logic and Pydantic model mapping.
- **`IngestionService`**: Orchestrates the multi-stage document ingestion pipeline:
    1. Upload to storage.
    2. Extraction with Docling.
    3. Indexing with RAGService.
- **`ExtractionService`**: Integrates with the **Docling** library. It doesn't just extract text; it captures the structural layout (headings, tables, lists) and precise bounding boxes for every element.
- **`ReconciliationService`**: Analyzes extracted facts across multiple documents. It identifies conflicts and applies truth-heuristics to resolve them.
- **`IMService`**: The synthesis engine. It prompt-engineers Gemini 2.0 to generate structured IM drafts, incorporating pinpoint citations from the reconciliation data.
- **`RAGService`**: Custom retrieval pipeline using Supabase `pgvector` for semantic search on document chunks.

## Interaction Pattern
Services typically interact via the `SupabaseService` for state persistence and use the `app.models.schema` for data interchange.
