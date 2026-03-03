import asyncio
import io
import json
import os
from typing import Optional
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from app.config import settings
from app.logging import get_logger

import google.auth

logger = get_logger(__name__)
from google.auth import impersonated_credentials
from google.auth.exceptions import DefaultCredentialsError

# Target folder ID extracted from the user's Drive URL
# https://drive.google.com/drive/folders/1r-k9sTAxXcecfg700-7EKJmfYQn8FY-l
DRIVE_FOLDER_ID = os.getenv("GOOGLE_DRIVE_FOLDER_ID", "1r-k9sTAxXcecfg700-7EKJmfYQn8FY-l")


class DriveService:
    def __init__(self):
        # Need the broader drive scope to upload into folders shared with the SA
        self.scopes = [
            'https://www.googleapis.com/auth/drive',
        ]
        self._service = None

    @property
    def service(self):
        if self._service is None:
            creds = self._load_creds()
            self._service = build('drive', 'v3', credentials=creds)
        return self._service

    def _load_creds(self):
        """
        Load credentials using ADC + optional service account impersonation.
        This matches how the rest of the backend authenticates.
        """
        try:
            base_credentials, _ = google.auth.default(scopes=self.scopes)

            if settings.GOOGLE_SERVICE_ACCOUNT:
                # Impersonate the target SA if configured
                creds = impersonated_credentials.Credentials(
                    source_credentials=base_credentials,
                    target_principal=settings.GOOGLE_SERVICE_ACCOUNT,
                    target_scopes=self.scopes,
                )
            else:
                creds = base_credentials

            return creds
        except DefaultCredentialsError:
            raise ValueError(
                "Google Drive credentials not found. "
                "Configure ADC or GOOGLE_SERVICE_ACCOUNT env var."
            )

    async def get_or_create_folder(self, name: str, parent_id: str = DRIVE_FOLDER_ID) -> str:
        """
        Finds a folder by name within a parent folder, or creates it if not found.
        """
        query = f"name = '{name}' and '{parent_id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
        
        results = await asyncio.to_thread(
            lambda: self.service.files().list(
                q=query,
                spaces='drive',
                fields='files(id, name)',
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
            ).execute()
        )
        
        files = results.get('files', [])
        if files:
            return files[0]['id']
            
        # Create folder if not found
        folder_metadata = {
            'name': name,
            'mimeType': 'application/vnd.google-apps.folder',
            'parents': [parent_id]
        }
        
        folder = await asyncio.to_thread(
            lambda: self.service.files().create(
                body=folder_metadata,
                fields='id',
                supportsAllDrives=True,
            ).execute()
        )
        
        return folder.get('id')

    async def upload_file(
        self,
        content: io.BytesIO,
        filename: str,
        mime_type: str,
        folder_id: str = DRIVE_FOLDER_ID,
        convert_to: Optional[str] = None,
    ) -> str:
        """
        Uploads a file into a specific Drive folder.
        
        IMPORTANT: The service account / user must have at least Editor access
        on the target folder. Share the folder with the SA email in Drive UI.
        
        convert_to: Optional Google Workspace mimeType (e.g. 'application/vnd.google-apps.document')
        
        Returns the webViewLink of the uploaded file.
        """
        file_metadata = {
            'name': filename,
            'parents': [folder_id],  # Upload into the specific folder
        }
        
        if convert_to:
            file_metadata['mimeType'] = convert_to
        
        # Ensure we are at the start of the buffer
        if hasattr(content, 'seek'):
            content.seek(0)
            
        media = MediaIoBaseUpload(content, mimetype=mime_type, resumable=True)

        # supportsAllDrives=True allows uploading into both Shared Drives and
        # regular folders that are shared with the service account.
        file = await asyncio.to_thread(
            lambda: self.service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id, webViewLink',
                supportsAllDrives=True,
            ).execute()
        )

        file_id = file.get('id')

        # Make file readable by anyone with the link
        try:
            await asyncio.to_thread(
                lambda: self.service.permissions().create(
                    fileId=file_id,
                    body={'type': 'anyone', 'role': 'reader'},
                    supportsAllDrives=True,
                ).execute()
            )
        except Exception as e:
            # Permission setting can fail on Shared Drives (managed by Workspace admin)
            # Non-fatal — the file is still uploaded and accessible to folder members
            logger.warning(f"Could not set public permission on file: {e}")

        # Re-fetch the webViewLink
        file = await asyncio.to_thread(
            lambda: self.service.files().get(
                fileId=file_id,
                fields='webViewLink',
                supportsAllDrives=True,
            ).execute()
        )

        return file.get('webViewLink', f"https://drive.google.com/file/d/{file_id}/view")


drive_service = DriveService()
