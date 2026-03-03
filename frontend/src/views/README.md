# Views layer - Profinance Nexus Frontend

Views represent top-level page components or large organizational units within the application.

## Key Views
- **`DashboardView`**: Overview of active business units and project statuses.
- **`BusinessUnitDetailView`**: The central workspace for a project. Manages document uploads and status tracking.
- **`ExtractionView`**: Deep-dive into document analysis and structural extraction results.
- **`ReconciliationView`**: Interface for resolving conflicting facts identified by the AI.
- **`IMSynthesisView`**: The final production surface where Information Memorandums are generated, reviewed, and exported.

## Routing
Routes are defined in the main `App.tsx` (or `router.tsx`) and map to these views.

## Interaction with State
Views are the primary consumers of **Zustand stores** (e.g., `useBusinessUnitStore`, `useIMStore`). They orchestrate data fetching and pass it down to specialized components.
