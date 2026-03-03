import google.auth
from google.auth import impersonated_credentials
from google import genai
import warnings

# Suppress Vertex AI SDK deprecation warnings (for transitional dependencies if any)
warnings.filterwarnings("ignore", category=UserWarning, module="vertexai.generative_models")
warnings.filterwarnings("ignore", category=UserWarning, module="vertexai._model_garden")

import asyncio
from typing import List
from llama_index.llms.google_genai import GoogleGenAI
from llama_index.embeddings.google_genai import GoogleGenAIEmbedding
from app.config import settings


class VertexService:
    def __init__(self):
        self._credentials = None
        self._client = None
        self._models = {}

    @property
    def credentials(self):
        if self._credentials is None:
            base_credentials, _ = google.auth.default()
            
            if settings.GOOGLE_SERVICE_ACCOUNT:
                self._credentials = impersonated_credentials.Credentials(
                    source_credentials=base_credentials,
                    target_principal=settings.GOOGLE_SERVICE_ACCOUNT,
                    target_scopes=["https://www.googleapis.com/auth/cloud-platform"],
                )
            else:
                self._credentials = base_credentials
                
        return self._credentials

    @property
    def client(self):
        if self._client is None:
            self._client = genai.Client(
                vertexai=True,
                project=settings.GOOGLE_PROJECT_ID,
                location=settings.GOOGLE_LOCATION,
                credentials=self.credentials,
            )
        return self._client

    def get_generative_model(self, model_name="gemini-2.0-flash", response_schema=None):
        # Returns a wrapper that mimics the old GenerativeModel.generate_content API
        class ModelWrapper:
            def __init__(self, client, model_id, response_schema=None):
                self.client = client
                self.model_id = model_id
                self.config = {}
                if response_schema:
                    self.config["response_mime_type"] = "application/json"
                    self.config["response_schema"] = response_schema
            
            def generate_content(self, contents, **kwargs):
                # Merge instance config with kwarg config if it exists
                config = {**self.config}
                if "config" in kwargs:
                    config.update(kwargs.pop("config"))
                
                return self.client.models.generate_content(
                    model=self.model_id,
                    contents=contents,
                    config=config,
                    **kwargs
                )
        
        return ModelWrapper(self.client, model_name, response_schema)

    def get_llama_llm(self, model="gemini-2.0-flash"):
        return GoogleGenAI(
            model=model,
            vertexai_config={
                "project": settings.GOOGLE_PROJECT_ID,
                "location": settings.GOOGLE_LOCATION,
                "credentials": self.credentials,
            }
        )

    async def get_embeddings(self, text: str, model_name: str = "text-embedding-004") -> List[float]:
        # Direct SDK call for embeddings (async friendly via executor if needed, or if SDK supports it)
        # The new SDK has a synchronous interface, we'll wrap it in to_thread
        
        # We must use the async client directly to avoid httpx cross-thread closure issues
        async_client = genai.Client(
            vertexai=True,
            project=settings.GOOGLE_PROJECT_ID,
            location=settings.GOOGLE_LOCATION,
            credentials=self.credentials,
        ).aio
        
        response = await async_client.models.embed_content(
            model=model_name,
            contents=text
        )
        return response.embeddings[0].values

    def get_llama_embed_model(self, model_name="text-embedding-004"):
        return GoogleGenAIEmbedding(
            model_name=model_name,
            vertexai_config={
                "project": settings.GOOGLE_PROJECT_ID,
                "location": settings.GOOGLE_LOCATION,
                "credentials": self.credentials,
            }
        )


vertex_service = VertexService()