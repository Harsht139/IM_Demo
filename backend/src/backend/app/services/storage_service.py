import os
from typing import Optional
from app.config import settings
from app.services.supabase_service import supabase_service
from app.logging import get_logger

logger = get_logger(__name__)

class StorageService:
    def __init__(self):
        self.base_dir = settings.STORAGE_DIR
        self.bucket_name = "documents"
        self._ensure_storage()

    def _ensure_storage(self):
        if not os.path.exists(self.base_dir):
            os.makedirs(self.base_dir)
        
        # Ensure Supabase bucket exists (might fail if already exists or lacks perms, so we wrap in try)
        try:
            supabase_service.client.storage.create_bucket(self.bucket_name, options={"public": False})
            logger.info(f"Ensured Supabase bucket '{self.bucket_name}' exists.")
        except Exception:
            # Usually fails if bucket already exists, which is fine
            pass

    def save_file(self, bu_id: str, filename: str, content: bytes) -> str:
        # 1. Save locally (Cache)
        bu_dir = os.path.join(self.base_dir, bu_id, "files")
        os.makedirs(bu_dir, exist_ok=True)
        filepath = os.path.join(bu_dir, filename)
        
        # 1.1 Optional Linearization (mutool)
        if filename.lower().endswith(".pdf"):
            try:
                import subprocess
                import tempfile
                
                with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_in:
                    tmp_in.write(content)
                    tmp_in_path = tmp_in.name
                
                tmp_out_path = tmp_in_path + ".linear.pdf"
                
                # Use mutool clean -l for linearization
                logger.info(f"Linearizing {filename} for Fast Web View...")
                result = subprocess.run(
                    ["mutool", "clean", "-l", tmp_in_path, tmp_out_path],
                    capture_output=True, text=True, timeout=10
                )
                
                if result.returncode == 0 and os.path.exists(tmp_out_path):
                    with open(tmp_out_path, 'rb') as f:
                        content = f.read()
                    logger.info(f"Successfully linearized {filename}.")
                else:
                    logger.warning(f"Linearization failed for {filename}: {result.stderr}")
                    
                # Cleanup
                if os.path.exists(tmp_in_path): os.remove(tmp_in_path)
                if os.path.exists(tmp_out_path): os.remove(tmp_out_path)
            except Exception as e:
                logger.error(f"Error during PDF linearization for {filename}: {e}")

        with open(filepath, 'wb') as f:
            f.write(content)
        
        # 2. Save directly to Supabase Bucket (Source of Truth)
        supabase_path = f"{bu_id}/{filename}"
        try:
            supabase_service.client.storage.from_(self.bucket_name).upload(
                path=supabase_path,
                file=content,
                file_options={"upsert": "true"}
            )
            logger.info(f"Successfully uploaded {filename} to Supabase Storage.")
        except Exception as e:
            logger.error(f"Failed to upload {filename} to Supabase Storage: {e}")

        return filepath

    def get_file_path(self, bu_id: str, filename: str) -> Optional[str]:
        # 1. Check local cache
        filepath = os.path.join(self.base_dir, bu_id, "files", filename)
        if os.path.exists(filepath):
            return filepath
            
        # 2. File missing locally! Fetch from Supabase Cloud
        logger.warning(f"File {filename} missing from local cache. Fetching from Supabase...")
        supabase_path = f"{bu_id}/{filename}"
        try:
            file_bytes = supabase_service.client.storage.from_(self.bucket_name).download(supabase_path)
            if file_bytes:
                # Cache it locally for the next time
                bu_dir = os.path.join(self.base_dir, bu_id, "files")
                os.makedirs(bu_dir, exist_ok=True)
                with open(filepath, 'wb') as f:
                    f.write(file_bytes)
                logger.info(f"Successfully cached {filename} from Supabase.")
                return filepath
        except Exception as e:
            logger.error(f"Failed to download {filename} from Supabase Storage: {e}")
            
        return None

storage_service = StorageService()
