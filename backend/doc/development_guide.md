# Development & Testing Guide

## Local Setup
This project uses `uv` for lightning-fast dependency management and virtual environment standardisation.

### Execution
Run the backend server with auto-reload:
```bash
PYTHONPATH=src/backend uv run uvicorn app.main:app --reload
```

## Testing Protocol
We maintain a strict **90%+ coverage** target for core intelligence services.

### Running Tests
Always use `uv run` to ensure you are targeting the project's specific `.venv`:
```bash
# Run all tests
PYTHONPATH=src/backend uv run pytest tests/

# Run tests with coverage report
PYTHONPATH=src/backend uv run pytest --cov=app tests/
```

### Mocking Strategy (Important)
When testing LLM-dependent services:
- **VertexService**: Mock `_credentials` and `_client` to avoid actual cloud calls.
- **IMService**: Mock `_model` to provide deterministic synthesis responses.
- **StorageService**: Use temporary directories in fixtures to avoid unauthorized disk writes.
