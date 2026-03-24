import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// =============================================
// RAG ENGINE — Motor de Retrieval-Augmented Generation
// Chunking, Embeddings, Cache (Redis ou PG), Busca Vetorial
// =============================================

interface RagRequest {
  clinica_id: string;
  agente_id: string;
  action:
    | "query"           // Buscar + gerar resposta
    | "ingest"          // Ingerir documento (chunk + embed)
    | "search"          // Apenas buscar chunks similares
    | "cache_lookup"    // Verificar cache
    | "cache_clear"     // Limpar cache
    | "stats";          // Estatísticas do agente
  // Para query/search
  query?: string;
  context?: string;       // Contexto adicional (ex: dados do paciente)
  max_chunks?: number;
  threshold?: number;
  knowledge_base_id?: string;
  // Para ingest
  documento?: {
    titulo: string;
    conteudo: string;
    tipo_arquivo?: string;
    metadados?: Record<string, unknown>;
  };
  // Configurações
  use_cache?: boolean;
  cache_ttl?: number;
}

// =============================================
// CHUNKING — Divide texto em pedaços com overlap
// =============================================
function chunkText(
  text: string,
  chunkSize = 512,
  overlap = 50
): { content: string; index: number; tokenEstimate: number }[] {
  const chunks: { content: string; index: number; tokenEstimate: number }[] = [];
  // Limpar texto
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  // Tentar dividir por parágrafos primeiro
  const paragraphs = cleaned.split(/\n\n+/);
  let currentChunk = "";
  let chunkIndex = 0;

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para);

    // Se o parágrafo sozinho excede o chunk_size, dividir por sentenças
    if (paraTokens > chunkSize) {
      if (currentChunk) {
        chunks.push({
          content: currentChunk.trim(),
          index: chunkIndex++,
          tokenEstimate: estimateTokens(currentChunk),
        });
        // Overlap: pegar últimas palavras
        const words = currentChunk.trim().split(/\s+/);
        currentChunk = words.slice(-overlap).join(" ") + "\n\n";
      }
      // Dividir parágrafo longo por sentenças
      const sentences = para.match(/[^.!?]+[.!?]+/g) || [para];
      for (const sentence of sentences) {
        if (estimateTokens(currentChunk + sentence) > chunkSize && currentChunk) {
          chunks.push({
            content: currentChunk.trim(),
            index: chunkIndex++,
            tokenEstimate: estimateTokens(currentChunk),
          });
          const words = currentChunk.trim().split(/\s+/);
          currentChunk = words.slice(-overlap).join(" ") + " ";
        }
        currentChunk += sentence + " ";
      }
    } else if (estimateTokens(currentChunk + para) > chunkSize) {
      // Chunk cheio, salvar e começar novo com overlap
      chunks.push({
        content: currentChunk.trim(),
        index: chunkIndex++,
        tokenEstimate: estimateTokens(currentChunk),
      });
      const words = currentChunk.trim().split(/\s+/);
      currentChunk = words.slice(-overlap).join(" ") + "\n\n" + para + "\n\n";
    } else {
      currentChunk += para + "\n\n";
    }
  }

  // Último chunk
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      index: chunkIndex,
      tokenEstimate: estimateTokens(currentChunk),
    });
  }

  return chunks;
}

function estimateTokens(text: string): number {
  // Estimativa: ~4 caracteres por token para português
  return Math.ceil(text.length / 4);
}

// =============================================
// EMBEDDINGS — Gerar vetor via API
// =============================================
async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  // Usar Anthropic Voyager ou OpenAI text-embedding-3-small
  // Fallback: OpenAI por ter melhor suporte a pgvector (1536 dims)
  const openaiKey = Deno.env.get("OPENAI_API_KEY") || apiKey;

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text.slice(0, 8000), // Limite de tokens
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Embedding API error: ${err}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// =============================================
// CACHE — Redis ou PostgreSQL fallback
// =============================================
async function cacheGet(
  supabase: any,
  clinicaId: string,
  agenteId: string,
  query: string,
  redisUrl?: string
): Promise<{ hit: boolean; data?: any }> {
  const cacheKey = await hashQuery(query);

  // Tentar Redis primeiro
  if (redisUrl) {
    try {
      const redis = await connectRedis(redisUrl);
      const key = `rag:${clinicaId}:${agenteId}:${cacheKey}`;
      const cached = await redis.get(key);
      if (cached) {
        // Incrementar hits no PG também
        await supabase
          .from("rag_cache")
          .update({ hits: supabase.sql`hits + 1` })
          .eq("cache_key", cacheKey)
          .eq("agente_id", agenteId);
        return { hit: true, data: JSON.parse(cached) };
      }
    } catch {
      // Redis indisponível, fallback para PG
    }
  }

  // Fallback: PostgreSQL
  const { data } = await supabase
    .from("rag_cache")
    .select("*")
    .eq("clinica_id", clinicaId)
    .eq("agente_id", agenteId)
    .eq("cache_key", cacheKey)
    .gt("expira_em", new Date().toISOString())
    .maybeSingle();

  if (data) {
    await supabase
      .from("rag_cache")
      .update({ hits: (data.hits || 0) + 1 })
      .eq("id", data.id);
    return { hit: true, data: data.resultado };
  }

  return { hit: false };
}

async function cacheSet(
  supabase: any,
  clinicaId: string,
  agenteId: string,
  query: string,
  resultado: any,
  resposta: string,
  ttl: number,
  redisUrl?: string
) {
  const cacheKey = await hashQuery(query);
  const expiraEm = new Date(Date.now() + ttl * 1000).toISOString();

  // Redis
  if (redisUrl) {
    try {
      const redis = await connectRedis(redisUrl);
      const key = `rag:${clinicaId}:${agenteId}:${cacheKey}`;
      await redis.set(key, JSON.stringify(resultado), "EX", ttl);
    } catch {
      // Silenciar — PG será usado
    }
  }

  // PostgreSQL (sempre salvar como fonte de verdade)
  await supabase.from("rag_cache").upsert(
    {
      clinica_id: clinicaId,
      agente_id: agenteId,
      cache_key: cacheKey,
      query_original: query,
      resultado,
      resposta_ia: resposta,
      expira_em: expiraEm,
      ttl_segundos: ttl,
    },
    { onConflict: "clinica_id,agente_id,cache_key" }
  );
}

async function hashQuery(query: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(query.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Placeholder para conexão Redis real
async function connectRedis(url: string): Promise<any> {
  // Em produção: usar https://deno.land/x/redis
  // const client = await connect({ hostname: ..., port: ... });
  throw new Error("Redis not configured — using PG fallback");
}

// =============================================
// GERAR RESPOSTA COM CONTEXTO RAG
// =============================================
async function generateRagResponse(
  query: string,
  chunks: { conteudo: string; metadados: any; similarity: number }[],
  agente: any,
  context: string,
  anthropicKey: string
): Promise<string> {
  const contextText = chunks
    .map(
      (c, i) =>
        `[Documento ${i + 1} (relevância: ${(c.similarity * 100).toFixed(1)}%)]\n${c.conteudo}`
    )
    .join("\n\n---\n\n");

  const systemPrompt = `${agente.prompt_sistema || "Você é um assistente especializado."}

## Base de Conhecimento
Use EXCLUSIVAMENTE as informações abaixo para fundamentar sua resposta.
Se a informação não estiver na base, diga que não encontrou dados relevantes.
NUNCA invente informações.

${contextText}

${context ? `\n## Contexto Adicional\n${context}` : ""}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: agente.modelo || "claude-sonnet-4-5-20241022",
      max_tokens: agente.limite_tokens || 4096,
      temperature: agente.temperatura || 0.7,
      system: systemPrompt,
      messages: [{ role: "user", content: query }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error: ${err}`);
  }

  const data = await response.json();
  return data.content[0]?.text || "Sem resposta.";
}

// =============================================
// MAIN HANDLER
// =============================================
serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();

  try {
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader! } } }
    );

    const body: RagRequest = await req.json();
    const { clinica_id, agente_id, action } = body;

    if (!clinica_id || !agente_id || !action) {
      throw new Error("clinica_id, agente_id e action são obrigatórios");
    }

    // Buscar config do agente
    const { data: agente } = await supabase
      .from("agentes_ia")
      .select("*")
      .eq("id", agente_id)
      .single();

    if (!agente) throw new Error("Agente não encontrado");
    if (!agente.ativo) throw new Error("Agente está desativado");

    const ragConfig = agente.rag_config || {};
    const chunkSize = ragConfig.chunk_size || 512;
    const chunkOverlap = ragConfig.chunk_overlap || 50;
    const matchThreshold = body.threshold || ragConfig.match_threshold || 0.7;
    const maxChunks = body.max_chunks || ragConfig.max_chunks || 5;
    const cacheTtl = body.cache_ttl || ragConfig.cache_ttl_seconds || 3600;
    const redisUrl = ragConfig.use_redis ? ragConfig.redis_url : null;

    // Buscar API keys
    const { data: apiKeys } = await supabase
      .from("api_keys")
      .select("*")
      .eq("clinica_id", clinica_id)
      .in("servico", ["anthropic__api_key", "openai__api_key"]);

    const anthropicKey =
      apiKeys?.find((k: any) => k.servico === "anthropic__api_key")
        ?.chave_encriptada || Deno.env.get("ANTHROPIC_API_KEY");
    const embeddingKey =
      apiKeys?.find((k: any) => k.servico === "openai__api_key")
        ?.chave_encriptada || Deno.env.get("OPENAI_API_KEY");

    // ========== ACTIONS ==========

    if (action === "ingest") {
      // INGERIR DOCUMENTO — Chunking + Embedding
      const doc = body.documento;
      if (!doc?.conteudo) throw new Error("documento.conteudo é obrigatório");

      // Hash para deduplicação
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(doc.conteudo)
      );
      const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      // Buscar knowledge_base do agente (criar se não existir)
      let kbId = body.knowledge_base_id;
      if (!kbId) {
        const { data: existingKb } = await supabase
          .from("rag_knowledge_bases")
          .select("id")
          .eq("agente_id", agente_id)
          .eq("clinica_id", clinica_id)
          .limit(1)
          .maybeSingle();

        if (existingKb) {
          kbId = existingKb.id;
        } else {
          const { data: newKb } = await supabase
            .from("rag_knowledge_bases")
            .insert({
              clinica_id,
              agente_id,
              nome: `Base do ${agente.nome}`,
              tipo: "documento",
            })
            .select("id")
            .single();
          kbId = newKb!.id;
        }
      }

      // Inserir documento
      const { data: docRow, error: docErr } = await supabase
        .from("rag_documentos")
        .upsert(
          {
            clinica_id,
            knowledge_base_id: kbId,
            titulo: doc.titulo,
            conteudo_original: doc.conteudo,
            tipo_arquivo: doc.tipo_arquivo || "txt",
            tamanho_bytes: encoder.encode(doc.conteudo).length,
            hash_conteudo: hashHex,
            metadados: doc.metadados || {},
            processado: false,
          },
          { onConflict: "knowledge_base_id,hash_conteudo" }
        )
        .select("id")
        .single();

      if (docErr) throw docErr;

      // Chunking
      const chunks = chunkText(doc.conteudo, chunkSize, chunkOverlap);

      // Deletar chunks antigos deste documento
      await supabase
        .from("rag_chunks")
        .delete()
        .eq("documento_id", docRow!.id);

      // Gerar embeddings e inserir chunks
      let insertedChunks = 0;
      for (const chunk of chunks) {
        if (!embeddingKey) throw new Error("API key de embedding não configurada");

        const embedding = await generateEmbedding(chunk.content, embeddingKey);

        await supabase.from("rag_chunks").insert({
          clinica_id,
          documento_id: docRow!.id,
          knowledge_base_id: kbId,
          agente_id,
          conteudo: chunk.content,
          chunk_index: chunk.index,
          token_count: chunk.tokenEstimate,
          metadados: {
            titulo_doc: doc.titulo,
            ...(doc.metadados || {}),
          },
          embedding: JSON.stringify(embedding),
        });
        insertedChunks++;
      }

      // Atualizar contadores
      await supabase
        .from("rag_documentos")
        .update({ processado: true, total_chunks: insertedChunks })
        .eq("id", docRow!.id);

      await supabase
        .from("rag_knowledge_bases")
        .update({
          total_documentos: supabase.sql`total_documentos + 1`,
          total_chunks: supabase.sql`total_chunks + ${insertedChunks}`,
          ultimo_processamento: new Date().toISOString(),
        })
        .eq("id", kbId);

      return new Response(
        JSON.stringify({
          ok: true,
          documento_id: docRow!.id,
          chunks_criados: insertedChunks,
          knowledge_base_id: kbId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "search" || action === "query") {
      if (!body.query) throw new Error("query é obrigatória");

      // Verificar cache
      if (body.use_cache !== false) {
        const cached = await cacheGet(
          supabase,
          clinica_id,
          agente_id,
          body.query,
          redisUrl
        );
        if (cached.hit) {
          // Log
          await supabase.from("rag_query_log").insert({
            clinica_id,
            agente_id,
            query: body.query,
            cache_hit: true,
            tempo_total_ms: Date.now() - startTime,
          });

          return new Response(
            JSON.stringify({
              ok: true,
              cache_hit: true,
              chunks: cached.data?.chunks || [],
              resposta: cached.data?.resposta || null,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Gerar embedding da query
      if (!embeddingKey) throw new Error("API key de embedding não configurada");
      const queryEmbedding = await generateEmbedding(body.query, embeddingKey);
      const searchTime = Date.now();

      // Busca vetorial
      const { data: chunks, error: searchErr } = await supabase.rpc(
        "rag_search",
        {
          _agente_id: agente_id,
          _query_embedding: JSON.stringify(queryEmbedding),
          _match_threshold: matchThreshold,
          _match_count: maxChunks,
          _knowledge_base_id: body.knowledge_base_id || null,
        }
      );

      if (searchErr) throw searchErr;
      const searchDuration = Date.now() - searchTime;

      let resposta: string | null = null;

      // Se action === "query", gerar resposta com Claude
      if (action === "query" && chunks && chunks.length > 0) {
        if (!anthropicKey)
          throw new Error("API key Anthropic não configurada");

        resposta = await generateRagResponse(
          body.query,
          chunks,
          agente,
          body.context || "",
          anthropicKey
        );

        // Salvar no cache
        await cacheSet(
          supabase,
          clinica_id,
          agente_id,
          body.query,
          { chunks, resposta },
          resposta,
          cacheTtl,
          redisUrl
        );

        // Atualizar consumo do agente
        const tokensEstimados = estimateTokens(body.query + (resposta || ""));
        const custoEstimado = (tokensEstimados / 1000000) * 3; // ~$3/MTok Sonnet
        await supabase
          .from("agentes_ia")
          .update({
            total_chamadas: (agente.total_chamadas || 0) + 1,
            total_tokens_consumidos:
              (agente.total_tokens_consumidos || 0) + tokensEstimado,
            gasto_atual_mes:
              (parseFloat(agente.gasto_atual_mes) || 0) + custoEstimado,
          })
          .eq("id", agente_id);
      }

      // Log
      await supabase.from("rag_query_log").insert({
        clinica_id,
        agente_id,
        query: body.query,
        chunks_retornados: chunks?.length || 0,
        score_medio:
          chunks && chunks.length > 0
            ? chunks.reduce((s: number, c: any) => s + c.similarity, 0) /
              chunks.length
            : 0,
        cache_hit: false,
        tempo_busca_ms: searchDuration,
        tempo_total_ms: Date.now() - startTime,
      });

      return new Response(
        JSON.stringify({
          ok: true,
          cache_hit: false,
          chunks: chunks || [],
          resposta,
          search_time_ms: searchDuration,
          total_time_ms: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "cache_clear") {
      const { data } = await supabase.rpc("rag_cache_cleanup");
      return new Response(
        JSON.stringify({ ok: true, deleted: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "stats") {
      const [kbRes, chunkRes, queryRes, cacheRes] = await Promise.all([
        supabase
          .from("rag_knowledge_bases")
          .select("*")
          .eq("agente_id", agente_id)
          .eq("clinica_id", clinica_id),
        supabase
          .from("rag_chunks")
          .select("id", { count: "exact", head: true })
          .eq("agente_id", agente_id),
        supabase
          .from("rag_query_log")
          .select("id", { count: "exact", head: true })
          .eq("agente_id", agente_id),
        supabase
          .from("rag_cache")
          .select("id", { count: "exact", head: true })
          .eq("agente_id", agente_id)
          .gt("expira_em", new Date().toISOString()),
      ]);

      return new Response(
        JSON.stringify({
          ok: true,
          knowledge_bases: kbRes.data || [],
          total_chunks: chunkRes.count || 0,
          total_queries: queryRes.count || 0,
          cache_entries: cacheRes.count || 0,
          agente: {
            nome: agente.nome,
            modelo: agente.modelo,
            rag_enabled: agente.rag_enabled,
            rag_config: agente.rag_config,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Ação desconhecida: ${action}`);
  } catch (error: any) {
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
