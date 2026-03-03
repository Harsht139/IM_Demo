# Technology Stack - Profinance Nexus

The Profinance Nexus platform leverages modern, scalable technologies to handle complex document processing and AI tasks.

## Backend
- **Language**: Python 3.13
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) - High-performance asynchronous API framework.
- **Package Management**: [uv](https://docs.astral.sh/uv/) - Extremely fast Python package installer and resolver.
- **Document Processing**: [Docling](https://github.com/DS4SD/docling) - High-fidelity extraction from PDF, DOCX, etc.
- **AI Models**: 
    - [Google Vertex AI (Gemini 2.0)](https://cloud.google.com/vertex-ai) - Core reasoning and synthesis engine.
    - [Google Vertex Text Embeddings](https://cloud.google.com/vertex-ai/docs/generative-ai/embeddings/get-text-embeddings) - For semantic search.
- **Database**: [Supabase (PostgreSQL)](https://supabase.com/) - Relational data and vector search via `pgvector`.
- **Logging**: Custom structured logging for production observability.

## Frontend
- **Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand) - Lightweight and scalable state management.
- **Styling**: 
    - [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework.
    - [Framer Motion](https://www.framer.com/motion/) - For smooth UI animations and transitions.
- **Components**: [Lucide React](https://lucide.dev/) for iconography.
- **HTTP Client**: [Axios](https://axios-http.com/) for communication with the FastAPI backend.

## Infrastructure & Tools
- **Deployment**: Configured for modern cloud platforms (detailed in `docs/DEPLOYMENT.md`).
- **Testing**: 
    - [Pytest](https://docs.pytest.org/) for backend unit and integration tests.
    - [Playwright](https://playwright.dev/) for end-to-end (E2E) testing.
- **Environment Management**: `.env` files for configuration.
