# API Layer - Profinance Nexus Backend

This directory contains the FastAPI routing logic, defining the public interface for the AI engine.

## Key Routers
- **`im_routes.py`**: Manages Information Memorandum (IM) synthesis, document ingestion, and fact reconciliation. This is the primary intelligence entry point.
- **`business_unit_routes.py`**: Handles CRUD operations for Business Units (Projects/Entities).

## Design Pattern
- **Dependency Injection**: Services are injected into routes to maintain a clear separation between the HTTP layer and the core logic.
- **Structured Responses**: All routes use Pydantic models (from `app.models.schema`) for consistent request validation and response serialization.
- **Error Handling**: Uses custom exception handlers to return standard JSON error responses.

## Endpoint Groups
- **Business Units**: `/api/business-units/`
- **Intelligence/IM**: `/api/business-units/{bu_id}/...` (nested under BU context)
