-- =============================================
-- RAG ENGINE: Embeddings, Chunks e Cache
-- Base de Conhecimento por Agente (HAG)
-- =============================================

-- Extensão para vetores (pgvector)
CREATE EXTENSION IF NOT EXISTS vector;

-- Base de conhecimento por agente
CREATE TABLE IF NOT EXISTS public.rag_knowledge_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  agente_id UUID NOT NULL REFERENCES public.agentes_ia(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'documento', -- documento, protocolo, faq, prontuario_modelo, procedimento
  ativo BOOLEAN DEFAULT true,
  total_documentos INTEGER DEFAULT 0,
  total_chunks INTEGER DEFAULT 0,
  ultimo_processamento TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Documentos fonte carregados na base de conhecimento
CREATE TABLE IF NOT EXISTS public.rag_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  knowledge_base_id UUID NOT NULL REFERENCES public.rag_knowledge_bases(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  conteudo_original TEXT NOT NULL,
  tipo_arquivo TEXT, -- txt, pdf, md, csv, html
  arquivo_url TEXT,
  tamanho_bytes INTEGER,
  hash_conteudo TEXT, -- SHA256 para deduplicação
  metadados JSONB DEFAULT '{}',
  processado BOOLEAN DEFAULT false,
  total_chunks INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para deduplicação
CREATE UNIQUE INDEX IF NOT EXISTS idx_rag_doc_hash
  ON public.rag_documentos(knowledge_base_id, hash_conteudo);

-- Chunks (pedaços do documento para embedding)
CREATE TABLE IF NOT EXISTS public.rag_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  documento_id UUID NOT NULL REFERENCES public.rag_documentos(id) ON DELETE CASCADE,
  knowledge_base_id UUID NOT NULL REFERENCES public.rag_knowledge_bases(id) ON DELETE CASCADE,
  agente_id UUID NOT NULL REFERENCES public.agentes_ia(id) ON DELETE CASCADE,
  conteudo TEXT NOT NULL,
  chunk_index INTEGER NOT NULL, -- posição no documento
  token_count INTEGER,
  metadados JSONB DEFAULT '{}', -- titulo_doc, secao, pagina, etc
  embedding vector(1536), -- OpenAI text-embedding-3-small ou equivalente
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índice vetorial para busca por similaridade (IVFFlat)
CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding
  ON public.rag_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Índice para busca por agente
CREATE INDEX IF NOT EXISTS idx_rag_chunks_agente
  ON public.rag_chunks(agente_id, knowledge_base_id);

-- Cache Redis-like no PostgreSQL (para quando Redis não disponível)
-- Em produção com Redis, esta tabela serve como fallback
CREATE TABLE IF NOT EXISTS public.rag_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  agente_id UUID NOT NULL REFERENCES public.agentes_ia(id),
  cache_key TEXT NOT NULL, -- hash da query
  query_original TEXT NOT NULL,
  resultado JSONB NOT NULL, -- chunks retornados + scores
  resposta_ia TEXT, -- resposta cacheada
  hits INTEGER DEFAULT 0,
  ttl_segundos INTEGER DEFAULT 3600, -- 1h default
  expira_em TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rag_cache_key
  ON public.rag_cache(clinica_id, agente_id, cache_key);

-- Índice para limpeza de expirados
CREATE INDEX IF NOT EXISTS idx_rag_cache_expira
  ON public.rag_cache(expira_em);

-- Log de consultas RAG (para analytics e melhoria)
CREATE TABLE IF NOT EXISTS public.rag_query_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  agente_id UUID NOT NULL REFERENCES public.agentes_ia(id),
  usuario_id UUID REFERENCES auth.users(id),
  query TEXT NOT NULL,
  chunks_retornados INTEGER,
  score_medio NUMERIC(5,4),
  cache_hit BOOLEAN DEFAULT false,
  tempo_busca_ms INTEGER,
  tempo_total_ms INTEGER,
  tokens_embedding INTEGER,
  tokens_resposta INTEGER,
  custo_estimado NUMERIC(8,4),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Função para busca por similaridade
CREATE OR REPLACE FUNCTION public.rag_search(
  _agente_id UUID,
  _query_embedding vector(1536),
  _match_threshold FLOAT DEFAULT 0.7,
  _match_count INT DEFAULT 5,
  _knowledge_base_id UUID DEFAULT NULL
)
RETURNS TABLE (
  chunk_id UUID,
  documento_id UUID,
  conteudo TEXT,
  metadados JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS chunk_id,
    c.documento_id,
    c.conteudo,
    c.metadados,
    1 - (c.embedding <=> _query_embedding) AS similarity
  FROM public.rag_chunks c
  WHERE c.agente_id = _agente_id
    AND (_knowledge_base_id IS NULL OR c.knowledge_base_id = _knowledge_base_id)
    AND 1 - (c.embedding <=> _query_embedding) > _match_threshold
  ORDER BY c.embedding <=> _query_embedding
  LIMIT _match_count;
END;
$$;

-- Função para limpar cache expirado
CREATE OR REPLACE FUNCTION public.rag_cache_cleanup()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.rag_cache WHERE expira_em < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Atualizar agentes_ia com campo de knowledge_base config
ALTER TABLE public.agentes_ia ADD COLUMN IF NOT EXISTS rag_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.agentes_ia ADD COLUMN IF NOT EXISTS rag_config JSONB DEFAULT '{
  "chunk_size": 512,
  "chunk_overlap": 50,
  "match_threshold": 0.7,
  "max_chunks": 5,
  "embedding_model": "text-embedding-3-small",
  "cache_ttl_seconds": 3600,
  "use_redis": false,
  "redis_url": null
}'::jsonb;
