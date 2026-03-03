-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Update documents table to support Docling JSON
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS docling_json JSONB;

-- 3. Create document_chunks table for vector search
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_unit_id UUID REFERENCES business_units(id) ON DELETE CASCADE,
    filename TEXT,
    content TEXT,
    embedding vector(768), -- text-embedding-004 is 768 dimensions
    metadata JSONB, -- {page_number: int, bbox: [f,f,f,f], label: string}
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS or Indexes if needed
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx ON document_chunks USING ivfflat (embedding vector_cosine_ops);

-- 5. Stored Procedure for Vector Search
CREATE OR REPLACE FUNCTION match_document_chunks (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  filter_bu_id UUID
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  filename TEXT,
  metadata JSONB,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.content,
    dc.filename,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  WHERE dc.business_unit_id = filter_bu_id
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 6. Create generated_outputs table for persistent IMs
CREATE TABLE IF NOT EXISTS generated_outputs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_unit_id UUID REFERENCES business_units(id) ON DELETE CASCADE,
    type TEXT, -- e.g., 'IM'
    content JSONB, -- stores {sections: [...], sources: [...]}
    status TEXT DEFAULT 'DRAFT',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Add is_recommended to facts table
ALTER TABLE facts 
ADD COLUMN IF NOT EXISTS is_recommended BOOLEAN DEFAULT FALSE;

