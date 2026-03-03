import os
from dotenv import load_dotenv

load_dotenv()

# Allowed file extensions for document upload (must match extraction_service support)
ALLOWED_UPLOAD_EXTENSIONS = {".pdf", ".docx", ".xlsx", ".csv", ".txt"}
# Block dangerous extensions
BLOCKED_EXTENSIONS = {".exe", ".sh", ".bat", ".cmd", ".ps1", ".py", ".js", ".html"}
MAX_UPLOAD_SIZE_MB = 50

class Settings:
    LLAMA_API_KEY: str = os.getenv("LLAMA_CLOUD_API_KEY")
    GOOGLE_PROJECT_ID: str = os.getenv("GOOGLE_PROJECT_ID", "ds-prototype-presales")
    GOOGLE_LOCATION: str = os.getenv("GOOGLE_LOCATION", "us-central1")
    GOOGLE_SERVICE_ACCOUNT: str = os.getenv("GOOGLE_SERVICE_ACCOUNT", "")
    STORAGE_DIR: str = os.getenv("STORAGE_DIR", "/tmp/profinance_nexus")
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")

settings = Settings()
