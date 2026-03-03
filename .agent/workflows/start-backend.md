---
description: How to start the backend server
---

To start the backend server, follow these steps:

1. Navigate to the backend directory:
```bash
cd backend
```

2. Run the server using `uv`:
```bash
PYTHONPATH=src/backend uv run uvicorn app.main:app --reload
```

Alternatively, if you are already in the `backend` directory:
```bash
PYTHONPATH=src/backend uv run uvicorn app.main:app --reload
```
