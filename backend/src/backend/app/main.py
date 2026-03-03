import traceback
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from app.config import settings
from app.api.im_routes import router as im_router
from app.api.business_unit_routes import router as business_unit_router
from app.logging import get_logger

from fastapi.middleware.cors import CORSMiddleware

logger = get_logger(__name__)

app = FastAPI(
    title="Project Finance AI Engine",
    description="Backend for Automated IM Generation. Upload documents, extract facts, reconcile conflicts, and generate Information Memorandums with citations.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(business_unit_router, prefix="/api/business-units", tags=["Business Units"])
app.include_router(im_router, prefix="/api/business-units", tags=["Intelligence"])


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch unhandled exceptions and return a structured error response. HTTPException is handled by FastAPI."""
    if isinstance(exc, HTTPException):
        raise exc
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An internal server error occurred.",
            "type": type(exc).__name__,
        },
    )

@app.get("/")
def root():
    return {"status": "ok", "message": "Project Finance AI Engine Running"}


@app.get("/health")
def health_check():
    """Health check for load balancers and monitoring. Verifies critical dependencies."""
    checks = {"api": "ok"}
    try:
        # Supabase connectivity
        from app.services.supabase_service import supabase_service
        supabase_service.client.table("business_units").select("id").limit(1).execute()
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "error"

    try:
        # Storage directory writable
        import os
        storage_dir = settings.STORAGE_DIR
        if os.path.exists(storage_dir) and os.access(storage_dir, os.W_OK):
            checks["storage"] = "ok"
        else:
            os.makedirs(storage_dir, exist_ok=True)
            checks["storage"] = "ok"
    except Exception:
        checks["storage"] = "error"

    status = "healthy" if all(v == "ok" for v in checks.values()) else "degraded"
    return {"status": status, "checks": checks}
