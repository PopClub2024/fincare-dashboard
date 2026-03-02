import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Auth ───────────────────────────────────────────────────────
function verifyAuth(req: Request): boolean {
  const secret = Deno.env.get("AUTOMATION_TOKEN");
  if (!secret) return false;
  const ws = req.headers.get("x-webhook-secret") || "";
  if (ws && ws === secret) return true;
  const bearer = (req.headers.get("authorization") || "").replace("Bearer ", "");
  if (bearer && bearer === secret) return true;
  return false;
}

// ─── Helpers ────────────────────────────────────────────────────
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

// ─── Detect separator (`;` or `,`) ──────────────────────────────
function detectSeparator(firstLine: string): string {
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return semicolons >= commas ? ";" : ",";
}

// ─── Parse CSV with auto-detected delimiter ─────────────────────
function parseCSV(content: string, sep: string): string[][] {
  const lines = content.split("\n").filter((l) => l.trim());
  return lines.map((line) => {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === sep && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  });
}

// ─── Parse Brazilian decimal (1.234,56 → 1234.56) ──────────────
function parseBRL(raw: string): number {
  if (!raw || raw.trim() === "") return 0;
  const cleaned = raw.trim().replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

// ─── Parse dd/MM/yyyy HH:mm → ISO string ───────────────────────
function parseDateTimeBR(raw: string): string {
  const [datePart, timePart] = raw.trim().split(" ");
  const [d, m, y] = datePart.split("/");
  const time = timePart || "00:00";
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${time}:00`;
}

// ─── Parse dd/MM/yyyy → yyyy-MM-dd ─────────────────────────────
function parseDateBR(raw: string): string | null {
  if (!raw || raw.trim() === "") return null;
  const [d, m, y] = raw.trim().split("/");
  if (!y) return null;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

// ─── Detect tipo from filename ──────────────────────────────────
function detectTipoFromFilename(filename: string): string | null {
  const upper = filename.toUpperCase();
  if (upper.includes("PIX")) return "pix";
  if (upper.includes("CARTAO") || upper.includes("CARTÃO")) return "cartao";
  return null;
}

// ─── Detect tipo from header columns ────────────────────────────
function detectTipoFromHeaders(headers: string[]): string | null {
  const joined = headers.join("|").toUpperCase();
  if (joined.includes("ID TRANSAÇÃO PIX") || joined.includes("INSTITUIÇÃO BANCÁRIA") || joined.includes("ID TRANSACAO PIX")) return "pix";
  if (joined.includes("BANDEIRA") || joined.includes("MODALIDADE") || joined.includes("FORMA DE PAGAMENTO")) return "cartao";
  return null;
}

// ─── Detect if CSV is a recebíveis layout (not vendas) ──────────
function isRecebiveisLayout(headers: string[]): string | null {
  const joined = headers.join("|").toUpperCase();
  // DETALHADO: has TIPO DE LANÇAMENTO + VALOR DA VENDA + NSU
  if ((joined.includes("NSU") || joined.includes("COMPROVANTE DE VENDA")) &&
      joined.includes("VALOR DA VENDA") && joined.includes("TIPO DE LAN")) return "detalhado";
  // RESUMO: has STATUS + RECEBIMENTO/BANCO + no VALOR DA VENDA
  if (joined.includes("STATUS") && (joined.includes("RECEBIMENTO") || joined.includes("BANCO")) &&
      !joined.includes("VALOR DA VENDA") && !joined.includes("ID TRANSAÇÃO PIX") &&
      !joined.includes("ID TRANSACAO PIX")) return "resumo";
  // SINTÉTICO: fewer cols, aggregated
  if (headers.length <= 14 && joined.includes("BANDEIRA") && !joined.includes("NSU") &&
      !joined.includes("AUTORIZAÇÃO") && !joined.includes("ID TRANSAÇÃO PIX")) return "sintetico";
  return null;
}

// ─── Parsed types ───────────────────────────────────────────────
interface ParsedCartao {
  tipo_extrato: "cartao";
  data_venda: string;
  bandeira: string;
  modalidade: string;
  forma_pagamento: string;
  status_transacao: string;
  parcelas: number;
  data_prevista_pagamento: string | null;
  numero_cartao: string;
  autorizacao: string;
  comprovante_venda: string;
  terminal: string;
  valor_bruto: number;
  valor_taxa: number;
  valor_liquido: number;
}

interface ParsedPix {
  tipo_extrato: "pix";
  data_venda: string;
  instituicao_bancaria: string;
  id_transacao_pix: string;
  comprovante_venda: string;
  terminal: string;
  valor_bruto: number;
  valor_taxa: number;
  valor_liquido: number;
  status_transacao: string;
}

function parseCartaoCSV(rows: string[][]): ParsedCartao[] {
  const results: ParsedCartao[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 18) continue;
    const status = r[7];
    if (status !== "Aprovada") continue;
    results.push({
      tipo_extrato: "cartao",
      data_venda: parseDateTimeBR(r[3]),
      bandeira: r[4],
      modalidade: r[5],
      forma_pagamento: r[6],
      status_transacao: status,
      parcelas: parseInt(r[8]) || 1,
      data_prevista_pagamento: parseDateBR(r[9]),
      numero_cartao: r[10],
      autorizacao: r[11],
      comprovante_venda: r[12],
      terminal: r[14],
      valor_bruto: parseBRL(r[15]),
      valor_taxa: Math.abs(parseBRL(r[16])),
      valor_liquido: parseBRL(r[17]),
    });
  }
  return results;
}

function parsePixCSV(rows: string[][]): ParsedPix[] {
  const results: ParsedPix[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 14) continue;
    const status = r[13];
    if (status !== "Paga") continue;
    results.push({
      tipo_extrato: "pix",
      data_venda: parseDateTimeBR(r[3]),
      instituicao_bancaria: r[4],
      id_transacao_pix: r[5],
      comprovante_venda: r[6],
      terminal: r[9],
      valor_bruto: parseBRL(r[10]),
      valor_taxa: Math.abs(parseBRL(r[11])),
      valor_liquido: parseBRL(r[12]),
      status_transacao: status,
    });
  }
  return results;
}

// ─── Main ───────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth
  if (!verifyAuth(req)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    let clinica_id = "";
    let filename = "";
    let csvContent = "";
    let tipo_extrato: string | null = null;

    const contentType = req.headers.get("content-type") || "";

    // ── Parse request ──────────────────────────────────────────
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      clinica_id = (formData.get("clinica_id") as string) || "";
      filename = (formData.get("filename") as string) || "";
      tipo_extrato = (formData.get("tipo_extrato") as string) || null;

      const file = formData.get("file") as File | null;
      if (!file) {
        return jsonResponse({ error: "Campo 'file' obrigatório no multipart" }, 400);
      }
      if (!filename) filename = file.name || "upload.csv";

      // Validate extension
      const ext = filename.split(".").pop()?.toLowerCase();
      if (ext !== "csv") {
        return jsonResponse({ error: "Arquivo deve ter extensão .csv" }, 400);
      }

      csvContent = await file.text();
    } else if (contentType.includes("application/json")) {
      const body = await req.json();
      clinica_id = body.clinica_id || "";
      filename = body.nome_arquivo || body.filename || "import.csv";
      tipo_extrato = body.tipo_extrato || null;

      if (body.csv_content) {
        csvContent = body.csv_content;
      } else if (body.file_base64) {
        csvContent = atob(body.file_base64);
      }
    } else {
      return jsonResponse({ error: "Content-Type deve ser multipart/form-data ou application/json" }, 400);
    }

    // ── Validations ────────────────────────────────────────────
    if (!clinica_id) {
      return jsonResponse({ error: "clinica_id obrigatório" }, 400);
    }
    if (!csvContent) {
      return jsonResponse({ error: "Conteúdo CSV vazio" }, 400);
    }

    // ── Idempotency via hash ───────────────────────────────────
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
        duplicates_count: 0,
        period_start: null,
        period_end: null,
      });
    }

    // ── Auto-detect separator ──────────────────────────────────
    const firstLine = csvContent.split("\n")[0] || "";
    const sep = detectSeparator(firstLine);

    // ── Parse CSV ──────────────────────────────────────────────
    const rows = parseCSV(csvContent, sep);
    if (rows.length < 2) {
      return jsonResponse({ error: "CSV vazio ou sem dados" }, 400);
    }

    // ── Check if this is a recebíveis layout → forward to import-getnet-recebiveis ──
    const recebiveisLayout = isRecebiveisLayout(rows[0]);
    if (recebiveisLayout) {
      console.log(`Detected recebíveis layout: ${recebiveisLayout}, forwarding to import-getnet-recebiveis`);
      const fwdResp = await fetch(`${supabaseUrl}/functions/v1/import-getnet-recebiveis`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          clinica_id,
          csv_content: csvContent,
          filename,
          layout: recebiveisLayout,
        }),
      });
      const fwdData = await fwdResp.json();
      return jsonResponse(fwdData, fwdResp.status);
    }

    // ── Auto-detect tipo (vendas only at this point) ───────────
    if (!tipo_extrato) {
      tipo_extrato = detectTipoFromFilename(filename);
    }
    if (!tipo_extrato) {
      tipo_extrato = detectTipoFromHeaders(rows[0]);
    }
    if (!tipo_extrato) {
      return jsonResponse({ error: "Não foi possível detectar tipo_extrato (pix/cartao). Envie no campo tipo_extrato ou nomeie o arquivo com PIX ou CARTAO." }, 400);
    }

    // ── Parse rows ─────────────────────────────────────────────
    let parsed: (ParsedCartao | ParsedPix)[] = [];
    if (tipo_extrato === "cartao") {
      parsed = parseCartaoCSV(rows);
    } else if (tipo_extrato === "pix") {
      parsed = parsePixCSV(rows);
    } else {
      return jsonResponse({ error: "tipo_extrato deve ser 'cartao' ou 'pix'" }, 400);
    }

    if (parsed.length === 0) {
      return jsonResponse({
        ok: true,
        imported_count: 0,
        duplicates_count: 0,
        message: "Nenhuma transação aprovada/paga encontrada",
        period_start: null,
        period_end: null,
        import_run_id: null,
      });
    }

    // ── Determine period ───────────────────────────────────────
    const dates = parsed.map((p) => p.data_venda).sort();
    const period_start = dates[0]?.split("T")[0];
    const period_end = dates[dates.length - 1]?.split("T")[0];

    // ── Create import_run ──────────────────────────────────────
    const { data: run } = await supabase
      .from("import_runs")
      .insert({
        clinica_id,
        tipo: `getnet_${tipo_extrato}`,
        origem: "webhook",
        arquivo_nome: filename,
        arquivo_hash: fileHash,
        periodo_inicio: period_start,
        periodo_fim: period_end,
        registros_total: parsed.length,
      })
      .select("id")
      .single();

    const importRunId = run?.id;

    // ── Upsert transactions ────────────────────────────────────
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const tx of parsed) {
      const record: Record<string, unknown> = {
        clinica_id,
        tipo_extrato: tx.tipo_extrato,
        data_venda: tx.data_venda,
        status_transacao: tx.status_transacao,
        comprovante_venda: tx.comprovante_venda,
        terminal: (tx as ParsedCartao | ParsedPix).terminal,
        valor_bruto: tx.valor_bruto,
        valor_taxa: tx.valor_taxa,
        valor_liquido: tx.valor_liquido,
        arquivo_id: importRunId,
      };

      if (tx.tipo_extrato === "cartao") {
        const c = tx as ParsedCartao;
        record.bandeira = c.bandeira;
        record.modalidade = c.modalidade;
        record.forma_pagamento = c.forma_pagamento;
        record.parcelas = c.parcelas;
        record.data_prevista_pagamento = c.data_prevista_pagamento;
        record.numero_cartao = c.numero_cartao;
        record.autorizacao = c.autorizacao;
      } else {
        const p = tx as ParsedPix;
        record.id_transacao_pix = p.id_transacao_pix;
        record.instituicao_bancaria = p.instituicao_bancaria;
      }

      const { error } = await supabase
        .from("getnet_transacoes")
        .upsert(record, { onConflict: "clinica_id,tipo_extrato,comprovante_venda" });

      if (error) {
        if (error.code === "23505") {
          skipped++;
        } else {
          errors.push(`CV ${tx.comprovante_venda}: ${error.message}`);
        }
      } else {
        created++;
      }
    }

    const imported_count = created;
    const duplicates_count = skipped;
    const finalStatus = errors.length > 0 ? (imported_count > 0 ? "erro_parcial" : "erro") : "sucesso";

    // ── Update import_run ──────────────────────────────────────
    if (importRunId) {
      await supabase.from("import_runs").update({
        status: finalStatus,
        registros_criados: created,
        registros_ignorados: skipped,
        erros: errors,
        detalhes: { tipo_extrato, separator: sep },
        finished_at: new Date().toISOString(),
      }).eq("id", importRunId);
    }

    // ── Log ────────────────────────────────────────────────────
    await supabase.from("integracao_logs").insert({
      clinica_id,
      integracao: "getnet",
      acao: `import_csv_${tipo_extrato}`,
      endpoint: "import-getnet-csv",
      status: finalStatus,
      registros_processados: parsed.length,
      registros_criados: created,
      registros_ignorados: skipped,
      erros: errors.length > 0 ? errors : null,
      fim: new Date().toISOString(),
      detalhes: { periodo: { inicio: period_start, fim: period_end }, tipo_extrato, filename },
    });

    const totais = parsed.reduce(
      (acc, tx) => ({
        bruto: acc.bruto + tx.valor_bruto,
        taxa: acc.taxa + tx.valor_taxa,
        liquido: acc.liquido + tx.valor_liquido,
      }),
      { bruto: 0, taxa: 0, liquido: 0 }
    );

    return jsonResponse({
      ok: true,
      imported_count,
      duplicates_count,
      period_start,
      period_end,
      import_run_id: importRunId,
      total_transacoes: parsed.length,
      totais,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    console.error("import-getnet-csv error:", e);
    return jsonResponse({ error: e.message }, 500);
  }
});
