import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function verifyAuth(req: Request): Promise<boolean> {
  const secret = Deno.env.get("AUTOMATION_TOKEN");
  const ws = req.headers.get("x-webhook-secret") || "";
  if (secret && ws && ws === secret) return true;
  const bearer = (req.headers.get("authorization") || "").replace("Bearer ", "");
  if (secret && bearer && bearer === secret) return true;

  // Fallback: validate user JWT
  if (bearer) {
    try {
      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { global: { headers: { Authorization: `Bearer ${bearer}` } } },
      );
      const { data, error } = await sb.auth.getUser(bearer);
      if (!error && data?.user) return true;
    } catch { /* ignore */ }
  }
  return false;
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeError(e: unknown): { message: string; name: string; code?: string; details?: string; hint?: string } {
  if (e instanceof Error) {
    return { message: e.message, name: e.name };
  }
  if (e && typeof e === "object") {
    const obj = e as Record<string, unknown>;
    return {
      message: typeof obj.message === "string" ? obj.message : JSON.stringify(obj),
      name: typeof obj.name === "string" ? obj.name : "SupabaseError",
      code: typeof obj.code === "string" ? obj.code : undefined,
      details: typeof obj.details === "string" ? obj.details : undefined,
      hint: typeof obj.hint === "string" ? obj.hint : undefined,
    };
  }
  return { message: String(e), name: "UnknownError" };
}

// ── Enum normalization helpers ──────────────────────────────────────────────

const VALID_FORMA_PAGAMENTO = new Set([
  "pix", "dinheiro", "convenio_nf", "cartao_credito", "cartao_debito",
  "boleto", "transferencia", "debito_automatico", "ted_doc", "outros",
]);

const FORMA_PAGAMENTO_MAP: Record<string, string> = {
  "pix": "pix", "pix qrcode": "pix", "pix qr": "pix", "pix chave": "pix",
  "boleto": "boleto", "boleto bancario": "boleto", "boleto bancário": "boleto",
  "bol": "boleto", "pagamento boleto": "boleto",
  "cartao": "cartao_credito", "cartão": "cartao_credito", "credito": "cartao_credito",
  "crédito": "cartao_credito", "cartao credito": "cartao_credito", "cartão crédito": "cartao_credito",
  "cartao_credito": "cartao_credito",
  "debito": "cartao_debito", "débito": "cartao_debito", "cartao debito": "cartao_debito",
  "cartão débito": "cartao_debito", "cartao_debito": "cartao_debito",
  "transferencia": "transferencia", "transferência": "transferencia",
  "ted": "ted_doc", "doc": "ted_doc", "ted/doc": "ted_doc", "ted_doc": "ted_doc",
  "debito automatico": "debito_automatico", "débito automático": "debito_automatico",
  "debito_automatico": "debito_automatico",
  "dinheiro": "dinheiro", "especie": "dinheiro", "espécie": "dinheiro",
  "convenio_nf": "convenio_nf", "convenio": "convenio_nf",
  "outros": "outros",
};

function normalizeFormaPagamento(raw: string | null | undefined): { normalized: string | null; raw_value: string | null } {
  if (!raw) return { normalized: null, raw_value: null };
  const lower = raw.trim().toLowerCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ");
  const mapped = FORMA_PAGAMENTO_MAP[lower];
  if (mapped) return { normalized: mapped, raw_value: null };
  if (VALID_FORMA_PAGAMENTO.has(lower)) return { normalized: lower, raw_value: null };
  for (const [key, val] of Object.entries(FORMA_PAGAMENTO_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return { normalized: val, raw_value: raw };
  }
  return { normalized: null, raw_value: raw };
}

const VALID_TIPO_DESPESA = new Set(["fixa", "variavel"]);
const TIPO_DESPESA_MAP: Record<string, string> = {
  "fixo": "fixa", "fixa": "fixa", "custo fixo": "fixa", "fixos": "fixa", "fixas": "fixa",
  "variavel": "variavel", "variável": "variavel", "variáveis": "variavel",
  "custo variavel": "variavel", "custo variável": "variavel", "variaveis": "variavel",
};

function normalizeTipoDespesa(raw: string | null | undefined): { normalized: string | null; raw_value: string | null } {
  if (!raw) return { normalized: null, raw_value: null };
  const lower = raw.trim().toLowerCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ");
  const mapped = TIPO_DESPESA_MAP[lower];
  if (mapped) return { normalized: mapped, raw_value: null };
  if (VALID_TIPO_DESPESA.has(lower)) return { normalized: lower, raw_value: null };
  return { normalized: null, raw_value: raw };
}

const VALID_CANAIS = new Set(["qrcode", "chave_celular", "chave_cnpj", "maquininha", "boleto", "deposito", "outro"]);

function normalizeCanalPagamento(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase().replace(/[_\-]+/g, "_");
  return VALID_CANAIS.has(lower) ? lower : null;
}

// ── File hash for idempotency ───────────────────────────────────────────────

async function computeFileHash(bytes: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray).map(b => b.toString(16).padStart(2, "0")).join("");
}

function arrayBufferToBase64(buffer: Uint8Array): string {
  const CHUNK = 8192;
  let binary = "";
  for (let i = 0; i < buffer.length; i += CHUNK) {
    const chunk = buffer.subarray(i, i + CHUNK);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

// ── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!(await verifyAuth(req))) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    let clinica_id = "";
    let tipo = "";
    let descricao_hint = "";
    let fileBytes: Uint8Array | null = null;
    let fileName = "comprovante";
    let fileMime = "application/octet-stream";
    let image_base64 = "";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      // Accept aliases for clinica_id
      clinica_id = (formData.get("clinica_id") as string)
        || (formData.get("id_da_clinica") as string)
        || (formData.get("id_da_clínica") as string)
        || "";
      tipo = (formData.get("tipo") as string) || "";
      descricao_hint = (formData.get("descricao_hint") as string) || "";

      // Accept aliases for file
      const file = (formData.get("file") as File) || (formData.get("arquivo") as File) || null;
      if (!file) {
        return jsonResponse({ error: "Campo 'file' ou 'arquivo' obrigatório no multipart" }, 400);
      }
      const fnOverride = (formData.get("filename") as string) || "";
      fileName = fnOverride || file.name || "comprovante";
      fileMime = file.type || "application/octet-stream";
      if (!descricao_hint) descricao_hint = fileName;

      const allowedMimes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (!allowedMimes.includes(fileMime)) {
        return jsonResponse({ error: `Tipo não suportado: ${fileMime}. Aceitos: JPG, PNG, WebP, PDF` }, 400);
      }

      fileBytes = new Uint8Array(await file.arrayBuffer());
      image_base64 = arrayBufferToBase64(fileBytes);

    } else if (contentType.includes("application/json")) {
      const body = await req.json();
      clinica_id = body.clinica_id || body.id_da_clinica || "";
      tipo = body.tipo || "";
      descricao_hint = body.descricao_hint || body.arquivo_nome || "";
      image_base64 = body.image_base64 || body.file_base64 || "";
      fileName = body.filename || body.arquivo_nome || "comprovante";
      fileMime = body.mime_type || "image/jpeg";

      if (image_base64) {
        fileBytes = Uint8Array.from(atob(image_base64), c => c.charCodeAt(0));
      }
    } else {
      return jsonResponse({ error: "Content-Type deve ser multipart/form-data ou application/json" }, 400);
    }

    if (!clinica_id) {
      return jsonResponse({ error: "clinica_id obrigatório" }, 400);
    }
    if (!fileBytes || fileBytes.length === 0) {
      return jsonResponse({ error: "Arquivo obrigatório (file ou file_base64)" }, 400);
    }

    // ── Idempotency check by file hash ──────────────────────────────────
    const fileHash = await computeFileHash(fileBytes);

    const { data: existingComp } = await supabase
      .from("comprovantes")
      .select("id, lancamento_id")
      .eq("clinica_id", clinica_id)
      .eq("arquivo_hash", fileHash)
      .maybeSingle();

    if (existingComp) {
      console.log("Duplicate file detected, returning existing:", existingComp.id);
      return jsonResponse({
        ok: true,
        duplicate: true,
        comprovante_id: existingComp.id,
        conta_pagar_id: existingComp.lancamento_id,
        message: "Comprovante já processado (mesmo arquivo).",
      });
    }

    console.log("process-comprovante:", {
      clinica_id, tipo, filename: fileName, size_bytes: fileBytes.length,
      mime_type: fileMime, hash: fileHash.slice(0, 12),
      source: contentType.includes("multipart") ? "make" : "json",
    });

    // ── Upload file to storage ──────────────────────────────────────────
    const fileExt = fileName.split(".").pop()?.toLowerCase() || "jpg";
    const storagePath = `${clinica_id}/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${fileExt}`;

    const { error: uploadErr } = await supabase.storage
      .from("comprovantes")
      .upload(storagePath, fileBytes, { contentType: fileMime, upsert: false });

    if (uploadErr) {
      console.error("Storage upload error:", safeError(uploadErr));
      return jsonResponse({ error: `Erro ao salvar arquivo: ${uploadErr.message}` }, 500);
    }

    const { data: urlData } = supabase.storage.from("comprovantes").getPublicUrl(storagePath);
    const arquivo_url = urlData?.publicUrl || `${supabaseUrl}/storage/v1/object/public/comprovantes/${storagePath}`;

    // ── Create comprovante record ───────────────────────────────────────
    const { data: comprovante, error: compErr } = await supabase
      .from("comprovantes")
      .insert({
        clinica_id, arquivo_url, arquivo_nome: fileName,
        tipo_arquivo: fileMime, status: "pendente", arquivo_hash: fileHash,
      })
      .select("id")
      .single();

    if (compErr) {
      console.error("Comprovante insert error:", safeError(compErr));
      return jsonResponse({ error: `Erro ao criar comprovante: ${compErr.message}` }, 500);
    }
    const comprovante_id = comprovante.id;

    // ── Get plano de contas ─────────────────────────────────────────────
    const { data: planoContas } = await supabase
      .from("plano_contas")
      .select("id, codigo, codigo_estruturado, descricao, indicador, categoria")
      .eq("clinica_id", clinica_id)
      .eq("ativo", true);

    const planoList = (planoContas || [])
      .map((p: any) => `${p.codigo_estruturado} - ${p.descricao} (${p.categoria})`)
      .join("\n");

    // ── AI Extraction ───────────────────────────────────────────────────
    const systemPrompt = `Você é um assistente financeiro especializado em clínicas médicas.
Analise o comprovante de pagamento e extraia os dados estruturados.
Use o plano de contas abaixo para classificar:

${planoList}

Classifique também:
- tipo_custo: "fixo" ou "variavel"
- categoria sugerida
- subcategoria sugerida

Retorne usando a função extract_comprovante_data.
${descricao_hint ? `Dica: "${descricao_hint}"` : ""}
${tipo ? `Tipo: "${tipo}"` : ""}`;

    const mimeForAI = fileMime === "application/pdf" ? "application/pdf" : fileMime;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: [
            { type: "text", text: "Analise este comprovante de pagamento e extraia os dados." },
            { type: "image_url", image_url: { url: `data:${mimeForAI};base64,${image_base64}` } },
          ]},
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_comprovante_data",
            description: "Extrair dados do comprovante de pagamento",
            parameters: {
              type: "object",
              properties: {
                fornecedor: { type: "string" },
                valor: { type: "number" },
                data_pagamento: { type: "string", description: "YYYY-MM-DD" },
                descricao: { type: "string" },
                forma_pagamento: { type: "string" },
                canal_pagamento: { type: "string" },
                banco_referencia: { type: "string" },
                plano_contas_codigo_estruturado: { type: "string" },
                tipo_custo: { type: "string" },
                categoria_sugerida: { type: "string" },
                subcategoria_sugerida: { type: "string" },
                confianca: { type: "number" },
              },
              required: ["fornecedor", "valor", "data_pagamento"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_comprovante_data" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errText = await aiResponse.text();
      console.error("AI error:", status, errText.slice(0, 500));
      await supabase.from("comprovantes").update({ status: "erro", erro_processamento: `AI error: ${status}` }).eq("id", comprovante_id);
      if (status === 429) return jsonResponse({ error: "Rate limit. Tente novamente." }, 429);
      if (status === 402) return jsonResponse({ error: "Créditos de IA insuficientes." }, 402);
      return jsonResponse({ error: `Erro na IA: ${status}` }, 500);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      await supabase.from("comprovantes").update({ status: "erro", erro_processamento: "IA não retornou dados" }).eq("id", comprovante_id);
      return jsonResponse({ error: "IA não extraiu dados" }, 422);
    }

    const extracted = JSON.parse(toolCall.function.arguments);

    // ── Normalize all enums safely ──────────────────────────────────────
    const { normalized: formaPag, raw_value: formaPagRaw } = normalizeFormaPagamento(extracted.forma_pagamento);
    const { normalized: tipoDespesa, raw_value: tipoDespesaRaw } = normalizeTipoDespesa(extracted.tipo_custo);
    const canalPagamento = normalizeCanalPagamento(extracted.canal_pagamento);

    const needs_review = !formaPag || !tipoDespesa || !extracted.fornecedor || !extracted.valor;

    if (formaPagRaw) console.warn(`forma_pagamento não mapeada: "${extracted.forma_pagamento}" → null (raw salvo)`);
    if (tipoDespesaRaw) console.warn(`tipo_despesa não mapeado: "${extracted.tipo_custo}" → null (raw salvo)`);

    // ── Find plano_contas match ─────────────────────────────────────────
    let planoContasId: string | null = null;
    if (extracted.plano_contas_codigo_estruturado) {
      const { data: plano } = await supabase
        .from("plano_contas")
        .select("id")
        .eq("clinica_id", clinica_id)
        .eq("codigo_estruturado", extracted.plano_contas_codigo_estruturado)
        .maybeSingle();
      planoContasId = plano?.id || null;
    }

    // ── Update comprovante with extracted data ──────────────────────────
    await supabase.from("comprovantes").update({ status: "processado", dados_extraidos: extracted }).eq("id", comprovante_id);

    // ── Create lançamento (pendente conciliação) ────────────────────────
    const { data: lancamento, error: lancErr } = await supabase
      .from("contas_pagar_lancamentos")
      .insert({
        clinica_id,
        plano_contas_id: planoContasId,
        descricao: extracted.descricao || descricao_hint || fileName,
        fornecedor: extracted.fornecedor || null,
        valor: extracted.valor || 0,
        data_competencia: extracted.data_pagamento || new Date().toISOString().split("T")[0],
        data_vencimento: extracted.data_pagamento || null,
        data_pagamento: null,
        forma_pagamento: formaPag,
        forma_pagamento_raw: formaPagRaw || (formaPag ? null : extracted.forma_pagamento || null),
        canal_pagamento: canalPagamento,
        banco_referencia: extracted.banco_referencia || null,
        comprovante_id,
        tipo_despesa: tipoDespesa || "variavel",
        tipo_despesa_raw: tipoDespesaRaw || (tipoDespesa ? null : extracted.tipo_custo || null),
        status: "pendente_conciliacao",
        observacao: `Comprovante AI (pendente conciliação extrato). Confiança: ${extracted.confianca || "N/A"}%${needs_review ? " [NEEDS REVIEW]" : ""}`,
      })
      .select("id")
      .single();

    if (lancErr) {
      const errInfo = safeError(lancErr);
      console.error("Lancamento error:", errInfo);
      return jsonResponse({
        error: `Erro ao criar lançamento: ${errInfo.message}`,
        details: errInfo.details, code: errInfo.code, hint: errInfo.hint,
      }, 500);
    }

    await supabase.from("comprovantes").update({ lancamento_id: lancamento.id }).eq("id", comprovante_id);

    // ── Create conciliacao_despesas record ───────────────────────────────
    const matchKey = `${(extracted.valor || 0).toFixed(2)}|${extracted.data_pagamento || ""}|${(extracted.fornecedor || "").toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    await supabase.from("conciliacao_despesas").insert({
      clinica_id,
      lancamento_id: lancamento.id,
      status: "pendente",
      match_key: matchKey,
      observacao: "Aguardando extrato bancário para conciliação",
    });

    // ── Log ─────────────────────────────────────────────────────────────
    await supabase.from("integracao_logs").insert({
      clinica_id,
      integracao: "process-comprovante",
      endpoint: "process-comprovante",
      acao: "process_comprovante",
      status: "sucesso",
      inicio: new Date().toISOString(),
      fim: new Date().toISOString(),
      registros_processados: 1,
      registros_criados: 1,
      registros_atualizados: 0,
      registros_ignorados: 0,
      detalhes: {
        fileName, fileMime, fileHash: fileHash.slice(0, 16),
        size_bytes: fileBytes.length,
        confianca: extracted.confianca,
        needs_review,
        forma_pagamento_raw: formaPagRaw,
        tipo_despesa_raw: tipoDespesaRaw,
      },
      erros: null,
    });

    // ── Clean response ──────────────────────────────────────────────────
    return jsonResponse({
      ok: true,
      comprovante_id,
      conta_pagar_id: lancamento.id,
      comprovante_url: arquivo_url,
      extracted_summary: {
        fornecedor: extracted.fornecedor,
        valor: extracted.valor,
        data_pagamento: extracted.data_pagamento,
        descricao: extracted.descricao,
        forma_pagamento: formaPag,
      },
      suggested_classification: {
        tipo_custo: tipoDespesa,
        categoria: extracted.categoria_sugerida || null,
        subcategoria: extracted.subcategoria_sugerida || null,
        plano_contas_codigo: extracted.plano_contas_codigo_estruturado || null,
        plano_contas_id: planoContasId,
        confianca: extracted.confianca || null,
      },
      needs_review,
    });

  } catch (e) {
    const err = safeError(e);
    console.error("process-comprovante error:", err);
    return jsonResponse({ error: err.message }, 500);
  }
});
