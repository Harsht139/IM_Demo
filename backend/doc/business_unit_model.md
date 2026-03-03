# Business Unit (BU) Model & Data Scoping

The platform uses a "Business Unit" model to manage multiple project finance deals independently within the same infrastructure.

## Data Isolation
Each BU is treated as an isolated workspace. This ensures:
- **Zero Cross-Talk**: Document extractions and RAG indexes from Project A never manifest in Project B's queries.
- **Project-Specific Schema**: Dynamic schema discovery is scoped to the context of the BU's uploaded documents.

## Directory Structure
Files are persisted in the `STORAGE_DIR` with the following hierarchy:
```
storage/
  └── {bu_id}/
      └── files/
          ├── doc1.pdf
          └── doc2.docx
```

## Scoping in Logic
- **Indexing**: `rag_service.index_documents(data, bu_id=bu_id)` ensures vector embeddings are tagged with the BU identifier.
- **Querying**: `rag_service.query_with_citations(query, bu_id=bu_id)` applies a strict metadata filter during the retrieval phase.
- **Supabase Integration**: Data tables (`documents`, `generated_outputs`) use the `bu_id` as a foreign key to enforce relational scoping.
