# Product Requirements Document (PRD) - Profinance Nexus

## 1. Project Overview
**Profinance Nexus** is an AI-powered engine designed for the project finance industry. It automates the extraction, reconciliation, and synthesis of data from complex financial and technical documents to generate high-quality **Information Memorandums (IM)**.

## 2. Target Audience
- Investment Bankers
- Project Finance Analysts
- Credit Risk Officers
- Advisory Firms

## 3. Key Features
### 3.1 Document Ingestion & Management
- Support for multiple file formats: PDF, DOCX, XLSX, CSV, TXT.
- Centralized storage and indexing via Supabase.

### 3.2 AI-Powered Extraction
- High-fidelity structural extraction using **Docling**.
- Capture of precise bounding box coordinates for text, tables, and headings to enable pinpoint citations.

### 3.3 Conflict Reconciliation
- Automated detection of data discrepancies across different source documents.
- Truth-heuristics based resolution (e.g., preference for more recent documents or specific keywords).
- Manual override capability for identified conflicts.

### 3.4 IM Synthesis
- Automated generation of structured IM drafts using **Gemini 2.0**.
- Dynamic tone adjustment (e.g., formal, institutional).
- Integration of "pinpoint citations" that link directly back to the source document coordinates.

### 3.5 Export & Integration
- Download generated IMs as DOCX or PDF.
- Optional upload to Google Drive.

## 4. User Flows
1. **Create Business Unit**: Define a project or entity context.
2. **Upload Documents**: Submit technical and financial files for analysis.
3. **Extract & Reconcile**: The system extracts facts and flags conflicts for user review.
4. **Generate IM**: Synthesize the final Information Memorandum.
5. **Review & Navigate**: Use citations to verify facts against original source documents.
6. **Export**: Finalize and download the document.
