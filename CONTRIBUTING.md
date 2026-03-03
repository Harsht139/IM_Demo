# Contributing to Project Finance AI Engine

Thank you for your interest in contributing.

## Development Setup

1. **Backend**
   ```bash
   cd backend
   source .venv/bin/activate
   uv sync
   ```

2. **Frontend**
   ```bash
   cd frontend
   npm install
   ```

3. **Environment**: Copy `backend/.env.example` to `backend/.env` and fill in your credentials.

## Running Tests

**Backend:**
```bash
cd backend
source .venv/bin/activate
PYTHONPATH=src/backend pytest
# With coverage:
PYTHONPATH=src/backend pytest --cov=app --cov-report=term-missing
```

**E2E (Playwright):**
```bash
npx playwright install   # one-time
npm run test:e2e
```

## Code Style

- **Backend**: Use [Ruff](https://docs.astral.sh/ruff/) for linting and formatting.
  ```bash
  ruff check .
  ruff format .
  ```
- **Frontend**: Use ESLint and Prettier (if configured).

## Pull Request Process

1. Create a feature branch from `main`.
2. Make your changes with clear commits.
3. Ensure tests pass.
4. Open a PR with a description of the change and any related issues.

## Architecture

Familiarize yourself with [backend/doc/architecture.md](backend/doc/architecture.md) before making significant changes.
