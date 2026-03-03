# API Reference

The backend exposes a RESTful API powered by FastAPI. Base URL in development: `http://localhost:8000/api`.

## Business Unit Management
`Prefix: /api/business-units`

### List All BUs
- **GET** `/`
- Returns a summary of all active projects/business units.

### Create BU
- **POST** `/`
- Body: `business_unit_in: BusinessUnitCreate`
- Initializes a new project workspace.

### Get Unified Stats
- **GET** `/stats/unified`
- Provides global analytics across all BUs (document counts, synthesis counts).

---

## Intelligence Operations
`Prefix: /api/business-units/{bu_id}`

### Upload Documents
- **POST** `/upload`
- Multipart Form: `files: List[UploadFile]`
- **Workflow**: Saves files -> Extracts content -> Indexes for RAG -> Performs Reconciliation.

### Semantic Query (RAG)
- **POST** `/query`
- Body: `{"query": "string"}`
- Performs a vector search against BU-scoped documents and returns a response with citations.

### Generate IM Draft
- **POST** `/generate`
- Body: `recon_result: ReconciliationResult`
- Synthesizes a full Information Memorandum from reconciled facts.

### Section Regeneration
- **POST** `/regenerate-section`
- Query Params: `section_id`, `tone`
- Regenerates a specific section of the IM with a targeted tone (Standard, Conservative, Strong).

---

### Exporting Outputs
- **POST** `/export`
    - Body: `im_data: IMResponse`
    - Query: `format` (docx/pdf)
    - Returns: Direct file stream.
- **POST** `/{bu_id}/export/drive`
    - Body: `im_data: IMResponse`
    - Returns: Google Drive link after cloud upload.
