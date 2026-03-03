# Services Deep Dive

## Reconciliation Service
The Reconciliation Service is responsible for turning disparate document extractions into a single "Source of Truth".

### Conflict Resolution Heuristics
Located in `ConflictDetector`, we apply several logic layers to recommend values:
1. **Keyword Priority**: Documents containing keywords like "Sanction", "PPA", or "Final" receive higher weight.
2. **Numeric Tolerance**: Differences within 1% are treated as identical to avoid noise.
3. **Reasoning Check**: LLM-provided reasoning is evaluated for specificity.

### Schema Alignment
Located in `SchemaAligner`, this component maps extracted metrics (e.g., "EBIDTA FY24") to the Deal Schema (e.g., "EBITDA") using:
- Case-insensitive exact matching.
- Bidirectional substring matching (for significant strings > 3 chars).

---

## IM Synthesis Service
`IMService` uses a multi-stage prompt engineering strategy to generate banking-grade documents.

### Tone Variations
- **Standard**: Professional, balanced banking tone.
- **Conservative**: Focuses on risk mitigants and downside protection.
- **Strong**: Bullish, growth-oriented, highlighting upside potential.

---

## RAG & Vector Operations
Using LlamaIndex and Google Vertex AI:
- **Index Scoping**: Every query is filtered by the `{bu_id}` metadata to prevent data leakage between projects.
- **Citations**: Returns exact text snippets and source file references for every generated answer.
