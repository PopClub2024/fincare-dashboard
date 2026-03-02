import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function verifyAuth(req: Request, supabaseUrl: string, supabaseKey: string): Promise<boolean> {
  // Check AUTOMATION_TOKEN first (webhook/Make calls)
  const secret = Deno.env.get("AUTOMATION_TOKEN");
  const ws = req.headers.get("x-webhook-secret") || "";
  if (secret && ws && ws === secret) return true;
  const bearer = (req.headers.get("authorization") || "").replace("Bearer ", "");
  if (secret && bearer && bearer === secret) return true;

  // Fallback: validate user JWT
  if (bearer) {
    try {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || supabaseKey;
      const sb = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
      });
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

async function sha256(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Parse Brazilian decimal (1.234,56 → 1234.56) ──────────────
function parseBRL(raw: string): number {
  if (!raw || raw.trim() === "" || raw.trim() === "-") return 0;
  const cleaned = raw.trim().replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

// ─── Parse dd/MM/yyyy → yyyy-MM-dd ─────────────────────────────
function parseDateBR(raw: string): string | null {
  if (!raw || raw.trim() === "") return null;
  const parts = raw.trim().split("/");
  if (parts.length < 3) return null;
  const [d, m, y] = parts;
  if (!y || y.length < 4) return null;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

// ─── CSV parser with auto-detected delimiter ────────────────────
function parseCSV(content: string, sep: string): string[][] {
  const lines = content.split("\n").filter((l) => l.trim());
  return lines.map((line) => {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === sep && !inQuotes) { fields.push(current.trim()); current = ""; }
      else { current += ch; }
    }
    fields.push(current.trim());
    return fields;
  });
}

// ─── Normalizar bandeira_modalidade → meio_pagamento ────────────
function normalizeMeioPagamento(bandeira: string): string {
  const upper = (bandeira || "").toUpperCase();
  if (upper.includes("DÉBITO") || upper.includes("DEBITO") || upper.includes("DEB")) return "cartao_debito";
  if (upper.includes("CRÉDITO") || upper.includes("CREDITO") || upper.includes("CRED")) return "cartao_credito";
  if (upper.includes("PIX")) return "pix";
  return "outros";
}

// ─── Detect layout type from headers ────────────────────────────
type LayoutType = "detalhado" | "resumo" | "sintetico";

function detectLayout(headers: string[]): LayoutType | null {
  const joined = headers.join("|").toUpperCase();
  const colCount = headers.length;

  // DETALHADO: has NSU, AUTORIZAÇÃO, VALOR DA VENDA (~26 cols)
  if (
    (joined.includes("NSU") || joined.includes("COMPROVANTE DE VENDA")) &&
    joined.includes("VALOR DA VENDA") &&
    joined.includes("TIPO DE LAN")
  ) return "detalhado";

  // RESUMO: has STATUS, RECEBIMENTO, BANCO (~19 cols)
  if (
    joined.includes("STATUS") &&
    (joined.includes("RECEBIMENTO") || joined.includes("BANCO")) &&
    !joined.includes("VALOR DA VENDA")
  ) return "resumo";

  // SINTÉTICO: fewer columns, aggregated (~11 cols)
  if (colCount <= 14 && joined.includes("BANDEIRA") && !joined.includes("NSU")) return "sintetico";

  // Fallback by column count
  if (colCount >= 24) return "detalhado";
  if (colCount >= 16 && colCount <= 22) return "resumo";
  if (colCount <= 14) return "sintetico";

  return null;
}

// ─── Find column index by partial header name ───────────────────
function findCol(headers: string[], ...names: string[]): number {
  for (const name of names) {
    const upper = name.toUpperCase();
    const idx = headers.findIndex(h => h.toUpperCase().includes(upper));
    if (idx >= 0) return idx;
  }
  return -1;
}

function safeCol(row: string[], idx: number): string {
  if (idx < 0 || idx >= row.length) return "";
  return row[idx] || "";
}

// ─── Parse RESUMO layout ────────────────────────────────────────
function parseResumo(rows: string[][], headers: string[], clinicaId: string, mesRef: string, arquivoId: string | null): Record<string, unknown>[] {
  const iVenc = findCol(headers, "DATA DE VENCIMENTO", "VENCIMENTO");
  const iBand = findCol(headers, "BANDEIRA", "MODALIDADE");
  const iStatus = findCol(headers, "STATUS");
  const iReceb = findCol(headers, "RECEBIMENTO");
  const iValLiq = findCol(headers, "VALOR LÍQUIDO", "VALOR LIQUIDO", "VLR. LÍQUIDO");
  const iBanco = findCol(headers, "BANCO");
  const iAgencia = findCol(headers, "AGÊNCIA", "AGENCIA");
  const iConta = findCol(headers, "CONTA CORRENTE", "CONTA");

  const results: Record<string, unknown>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 5) continue;
    const bandeira = safeCol(r, iBand);
    const dataVenc = parseDateBR(safeCol(r, iVenc));
    if (!dataVenc) continue;

    results.push({
      clinica_id: clinicaId,
      mes_ref: mesRef,
      data_vencimento: dataVenc,
      bandeira_modalidade: bandeira,
      meio_pagamento: normalizeMeioPagamento(bandeira),
      status: safeCol(r, iStatus),
      recebimento: safeCol(r, iReceb),
      valor_liquido: parseBRL(safeCol(r, iValLiq)),
      banco: safeCol(r, iBanco),
      agencia: safeCol(r, iAgencia),
      conta_corrente: safeCol(r, iConta),
      arquivo_id: arquivoId,
    });
  }
  return results;
}

// ─── Parse DETALHADO layout ─────────────────────────────────────
function parseDetalhado(rows: string[][], headers: string[], clinicaId: string, mesRef: string, arquivoId: string | null): Record<string, unknown>[] {
  const iVenc = findCol(headers, "DATA DE VENCIMENTO", "VENCIMENTO");
  const iBand = findCol(headers, "BANDEIRA", "MODALIDADE");
  const iTipoLanc = findCol(headers, "TIPO DE LANÇAMENTO", "TIPO DE LANCAMENTO");
  const iLanc = findCol(headers, "LANÇAMENTO", "LANCAMENTO");
  const iValLiq = findCol(headers, "VALOR LÍQUIDO", "VALOR LIQUIDO", "VLR. LÍQUIDO");
  const iValLiquidado = findCol(headers, "VALOR LIQUIDADO");
  const iDataVenda = findCol(headers, "DATA DA VENDA");
  const iHoraVenda = findCol(headers, "HORA DA VENDA");
  const iValVenda = findCol(headers, "VALOR DA VENDA");
  const iDescontos = findCol(headers, "DESCONTOS");
  const iAutor = findCol(headers, "AUTORIZAÇÃO", "AUTORIZACAO");
  const iNsu = findCol(headers, "NSU", "COMPROVANTE DE VENDA");
  const iTerminal = findCol(headers, "TERMINAL", "TERMINAL LÓGICO");

  const results: Record<string, unknown>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 10) continue;
    const bandeira = safeCol(r, iBand);
    const dataVenc = parseDateBR(safeCol(r, iVenc));
    if (!dataVenc) continue;

    results.push({
      clinica_id: clinicaId,
      mes_ref: mesRef,
      data_vencimento: dataVenc,
      bandeira_modalidade: bandeira,
      meio_pagamento: normalizeMeioPagamento(bandeira),
      tipo_lancamento: safeCol(r, iTipoLanc),
      lancamento: safeCol(r, iLanc),
      valor_liquido: parseBRL(safeCol(r, iValLiq)),
      valor_liquidado: parseBRL(safeCol(r, iValLiquidado)),
      data_venda: parseDateBR(safeCol(r, iDataVenda)),
      hora_venda: safeCol(r, iHoraVenda),
      valor_venda: parseBRL(safeCol(r, iValVenda)),
      descontos: Math.abs(parseBRL(safeCol(r, iDescontos))),
      autorizacao: safeCol(r, iAutor),
      nsu: safeCol(r, iNsu),
      terminal_logico: safeCol(r, iTerminal),
      arquivo_id: arquivoId,
    });
  }
  return results;
}

// ─── Parse SINTÉTICO layout ─────────────────────────────────────
function parseSintetico(rows: string[][], headers: string[], clinicaId: string, mesRef: string, arquivoId: string | null): Record<string, unknown>[] {
  const iBand = findCol(headers, "BANDEIRA", "MODALIDADE");
  const iDataMov = findCol(headers, "DATA DA ÚLTIMA", "DATA ULTIMA", "MOVIMENTAÇÃO");
  const iValLiq = findCol(headers, "VALOR LÍQUIDO", "VALOR LIQUIDO");
  const iQtd = findCol(headers, "QUANTIDADE", "QTD");

  const results: Record<string, unknown>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 3) continue;
    const bandeira = safeCol(r, iBand);

    results.push({
      clinica_id: clinicaId,
      mes_ref: mesRef,
      bandeira_modalidade: bandeira,
      meio_pagamento: normalizeMeioPagamento(bandeira),
      data_ultima_movimentacao: parseDateBR(safeCol(r, iDataMov)),
      valor_liquido: parseBRL(safeCol(r, iValLiq)),
      quantidade: parseInt(safeCol(r, iQtd)) || 0,
      arquivo_id: arquivoId,
    });
  }
  return results;
}

// ─── MAIN ───────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!(await verifyAuth(req, supabaseUrl, supabaseKey))) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    let clinica_id = "";
    let filename = "";
    let csvContent = "";
    let mes_ref = ""; // yyyy-MM-dd (first day of month)
    let layout_override: string | null = null;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      clinica_id = (formData.get("clinica_id") as string) || "";
      filename = (formData.get("filename") as string) || "";
      mes_ref = (formData.get("mes_ref") as string) || "";
      layout_override = (formData.get("layout") as string) || null;

      const file = formData.get("file") as File | null;
      if (!file) return jsonResponse({ error: "Campo 'file' obrigatório" }, 400);
      if (!filename) filename = file.name || "upload.csv";

      csvContent = await file.text();
    } else if (contentType.includes("application/json")) {
      const body = await req.json();
      clinica_id = body.clinica_id || "";
      filename = body.nome_arquivo || body.filename || "import.csv";
      mes_ref = body.mes_ref || "";
      layout_override = body.layout || null;

      if (body.csv_content) csvContent = body.csv_content;
      else if (body.file_base64) csvContent = atob(body.file_base64);
    } else {
      return jsonResponse({ error: "Content-Type deve ser multipart/form-data ou application/json" }, 400);
    }

    if (!clinica_id) return jsonResponse({ error: "clinica_id obrigatório" }, 400);
    if (!csvContent) return jsonResponse({ error: "Conteúdo CSV vazio" }, 400);

    // Auto-detect mes_ref from filename if not provided (e.g. "Recebíveis_Fev_2026.csv")
    if (!mes_ref) {
      const monthMap: Record<string, string> = {
        jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
        jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
      };
      const fnLower = filename.toLowerCase();
      for (const [abbr, num] of Object.entries(monthMap)) {
        if (fnLower.includes(abbr)) {
          const yearMatch = fnLower.match(/20\d{2}/);
          if (yearMatch) {
            mes_ref = `${yearMatch[0]}-${num}-01`;
            break;
          }
        }
      }
    }
    if (!mes_ref) {
      mes_ref = new Date().toISOString().slice(0, 7) + "-01";
    }

    // Idempotency
    const fileHash = await sha256(clinica_id + csvContent);
    const { data: existingRun } = await supabase
      .from("import_runs")
      .select("id, status")
      .eq("clinica_id", clinica_id)
      .eq("arquivo_hash", fileHash)
      .maybeSingle();

    if (existingRun) {
      return jsonResponse({
        ok: true,
        message: "Arquivo já processado anteriormente",
        import_run_id: existingRun.id,
        imported_count: 0,
      });
    }

    // Parse CSV (semicolon default for Getnet)
    const firstLine = csvContent.split("\n")[0] || "";
    const semicolons = (firstLine.match(/;/g) || []).length;
    const commas = (firstLine.match(/,/g) || []).length;
    const sep = semicolons >= commas ? ";" : ",";

    const rows = parseCSV(csvContent, sep);
    if (rows.length < 2) return jsonResponse({ error: "CSV vazio ou sem dados" }, 400);

    const headers = rows[0];

    // Detect layout
    const layout: LayoutType | null = (layout_override as LayoutType) || detectLayout(headers);
    if (!layout) {
      return jsonResponse({ error: "Não foi possível detectar o layout do CSV (detalhado/resumo/sintetico)" }, 400);
    }

    // Create import_run
    const { data: run } = await supabase
      .from("import_runs")
      .insert({
        clinica_id,
        tipo: `getnet_recebiveis_${layout}`,
        origem: "webhook",
        arquivo_nome: filename,
        arquivo_hash: fileHash,
        periodo_inicio: mes_ref,
        registros_total: rows.length - 1,
      })
      .select("id")
      .single();

    const importRunId = run?.id;

    // Parse rows
    let parsed: Record<string, unknown>[] = [];
    if (layout === "resumo") {
      parsed = parseResumo(rows, headers, clinica_id, mes_ref, importRunId);
    } else if (layout === "detalhado") {
      parsed = parseDetalhado(rows, headers, clinica_id, mes_ref, importRunId);
    } else {
      parsed = parseSintetico(rows, headers, clinica_id, mes_ref, importRunId);
    }

    if (parsed.length === 0) {
      if (importRunId) {
        await supabase.from("import_runs").update({
          status: "sucesso", registros_criados: 0, finished_at: new Date().toISOString(),
        }).eq("id", importRunId);
      }
      return jsonResponse({ ok: true, imported_count: 0, layout, message: "Nenhum registro válido encontrado" });
    }

    // Generate row hashes for idempotency
    for (const row of parsed) {
      const hashInput = `${clinica_id}|${layout}|${JSON.stringify(row)}`;
      row.raw_hash = await sha256(hashInput);
    }

    // Upsert in batches
    const tableName = `getnet_recebiveis_${layout}`;
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];
    const batchSize = 50;

    for (let i = 0; i < parsed.length; i += batchSize) {
      const batch = parsed.slice(i, i + batchSize);
      const { error, count } = await supabase
        .from(tableName)
        .upsert(batch, { onConflict: "clinica_id,raw_hash", ignoreDuplicates: true })
        .select("id");

      if (error) {
        // Fallback: insert one by one
        for (const row of batch) {
          const { error: singleErr } = await supabase.from(tableName).upsert(row, { onConflict: "clinica_id,raw_hash", ignoreDuplicates: true });
          if (singleErr) {
            if (singleErr.code === "23505") skipped++;
            else errors.push(singleErr.message);
          } else {
            created++;
          }
        }
      } else {
        created += batch.length;
      }
    }

    const finalStatus = errors.length > 0 ? (created > 0 ? "erro_parcial" : "erro") : "sucesso";

    if (importRunId) {
      await supabase.from("import_runs").update({
        status: finalStatus,
        registros_criados: created,
        registros_ignorados: skipped,
        erros: errors.length > 0 ? errors : null,
        detalhes: { layout, separator: sep, mes_ref },
        finished_at: new Date().toISOString(),
      }).eq("id", importRunId);
    }

    // Log
    await supabase.from("integracao_logs").insert({
      clinica_id,
      integracao: "getnet",
      acao: `import_recebiveis_${layout}`,
      endpoint: "import-getnet-recebiveis",
      status: finalStatus,
      registros_processados: parsed.length,
      registros_criados: created,
      registros_ignorados: skipped,
      erros: errors.length > 0 ? errors : null,
      fim: new Date().toISOString(),
      detalhes: { layout, mes_ref, filename },
    });

    return jsonResponse({
      ok: true,
      layout,
      imported_count: created,
      duplicates_count: skipped,
      total_rows: parsed.length,
      mes_ref,
      import_run_id: importRunId,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    console.error("import-getnet-recebiveis error:", e);
    return jsonResponse({ error: e.message }, 500);
  }
});
