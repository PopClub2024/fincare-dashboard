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

// ─── OFX Parser ─────────────────────────────────────────────────
function parseOFX(ofxContent: string) {
  const transactions: Array<{
    fitid: string;
    type: string;
    date: string;
    amount: number;
    name: string;
    memo: string;
  }> = [];

  const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;
  while ((match = trnRegex.exec(ofxContent)) !== null) {
    const block = match[1];
    const getValue = (tag: string) => {
      const m = new RegExp(`<${tag}>([^<\\n]+)`, "i").exec(block);
      return m ? m[1].trim() : "";
    };

    const dtPosted = getValue("DTPOSTED");
    const dateStr = dtPosted.length >= 8
      ? `${dtPosted.slice(0, 4)}-${dtPosted.slice(4, 6)}-${dtPosted.slice(6, 8)}`
      : new Date().toISOString().split("T")[0];

    transactions.push({
      fitid: getValue("FITID"),
      type: getValue("TRNTYPE"),
      date: dateStr,
      amount: parseFloat(getValue("TRNAMT") || "0"),
      name: getValue("NAME"),
      memo: getValue("MEMO"),
    });
  }

  return transactions;
}

// ─── Helpers ────────────────────────────────────────────────────
function jsonResponse(data: any, status = 200) {
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
    let ofxContent = "";

    const contentType = req.headers.get("content-type") || "";

    // ── Parse request ──────────────────────────────────────────
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      clinica_id = (formData.get("clinica_id") as string) || "";
      filename = (formData.get("filename") as string) || "";

      const file = formData.get("file") as File | null;
      if (!file) {
        return jsonResponse({ error: "Campo 'file' obrigatório no multipart" }, 400);
      }
      if (!filename) {
        filename = file.name || "upload.ofx";
      }

      // Validate extension
      const ext = filename.split(".").pop()?.toLowerCase();
      if (ext !== "ofx") {
        return jsonResponse({ error: "Arquivo deve ter extensão .ofx" }, 400);
      }

      ofxContent = await file.text();
    } else if (contentType.includes("application/json")) {
      const body = await req.json();
      clinica_id = body.clinica_id || "";
      filename = body.filename || "import.ofx";

      if (body.ofx_content) {
        ofxContent = body.ofx_content;
      } else if (body.file_base64) {
        ofxContent = atob(body.file_base64);
      }
    } else {
      return jsonResponse({ error: "Content-Type deve ser multipart/form-data ou application/json" }, 400);
    }

    // ── Validations ────────────────────────────────────────────
    if (!clinica_id) {
      return jsonResponse({ error: "clinica_id obrigatório" }, 400);
    }
    if (!ofxContent) {
      return jsonResponse({ error: "Conteúdo OFX vazio" }, 400);
    }

    // ── Parse OFX ──────────────────────────────────────────────
    const transactions = parseOFX(ofxContent);
    if (transactions.length === 0) {
      return jsonResponse({ error: "Nenhuma transação encontrada no OFX" }, 400);
    }

    // ── Idempotency via hash ───────────────────────────────────
    const fileHash = await sha256(clinica_id + ofxContent);
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
        duplicates_count: transactions.length,
        period_start: null,
        period_end: null,
      });
    }

    // ── Determine period ───────────────────────────────────────
    const dates = transactions.map((t) => t.date).sort();
    const period_start = dates[0];
    const period_end = dates[dates.length - 1];

    // ── Create import_run ──────────────────────────────────────
    const { data: run } = await supabase
      .from("import_runs")
      .insert({
        clinica_id,
        tipo: "banco_ofx",
        origem: "webhook",
        arquivo_nome: filename,
        arquivo_hash: fileHash,
        periodo_inicio: period_start,
        periodo_fim: period_end,
        registros_total: transactions.length,
      })
      .select("id")
      .single();

    const importRunId = run?.id;

    // ── Process transactions ───────────────────────────────────
    let created = 0;
    let skipped = 0;
    let matched = 0;
    let matched_recebiveis = 0;
    const errors: string[] = [];

    for (const txn of transactions) {
      // CREDITS → reconcile with receivables
      if (txn.amount > 0) {
        const { data: matchVenda } = await supabase
          .from("transacoes_vendas")
          .select("id, valor_bruto")
          .eq("clinica_id", clinica_id)
          .eq("status_recebimento", "a_receber")
          .gte("valor_bruto", txn.amount * 0.98)
          .lte("valor_bruto", txn.amount * 1.02)
          .eq("data_competencia", txn.date)
          .limit(1)
          .maybeSingle();

        if (matchVenda) {
          await supabase
            .from("transacoes_vendas")
            .update({ status_recebimento: "recebido", status_conciliacao: "conciliado" })
            .eq("id", matchVenda.id);

          await supabase.from("transacoes_recebimentos").insert({
            clinica_id,
            venda_id: matchVenda.id,
            valor: txn.amount,
            data_recebimento: txn.date,
            origem: "ofx_bancario",
            referencia_externa: txn.fitid,
            observacao: `Conciliação OFX - ${txn.name || txn.memo}`.trim(),
          });
          matched_recebiveis++;
        } else {
          skipped++;
        }
        continue;
      }

      // DEBITS → reconcile with contas_pagar_lancamentos
      const { data: existing } = await supabase
        .from("contas_pagar_lancamentos")
        .select("id")
        .eq("clinica_id", clinica_id)
        .eq("ofx_transaction_id", txn.fitid)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      const absVal = Math.abs(txn.amount);
      const { data: matchLanc } = await supabase
        .from("contas_pagar_lancamentos")
        .select("id, valor, descricao")
        .eq("clinica_id", clinica_id)
        .eq("data_competencia", txn.date)
        .gte("valor", absVal * 0.98)
        .lte("valor", absVal * 1.02)
        .is("ofx_transaction_id", null)
        .limit(1)
        .maybeSingle();

      if (matchLanc) {
        await supabase
          .from("contas_pagar_lancamentos")
          .update({
            ofx_transaction_id: txn.fitid,
            status: "classificado",
            data_pagamento: txn.date,
          })
          .eq("id", matchLanc.id);
        matched++;
      } else {
        const { error } = await supabase.from("contas_pagar_lancamentos").insert({
          clinica_id,
          descricao: txn.name || txn.memo || "Importação OFX",
          valor: absVal,
          data_competencia: txn.date,
          data_pagamento: txn.date,
          status: "a_classificar",
          ofx_transaction_id: txn.fitid,
          observacao: `Auto-importado OFX. ${txn.memo || ""}`.trim(),
        });
        if (error) {
          errors.push(`FITID ${txn.fitid}: ${error.message}`);
        } else {
          created++;
        }
      }
    }

    const imported_count = created + matched + matched_recebiveis;
    const duplicates_count = skipped;
    const finalStatus = errors.length > 0 ? (imported_count > 0 ? "erro_parcial" : "erro") : "sucesso";

    // ── Update import_run ──────────────────────────────────────
    await supabase.from("import_runs").update({
      status: finalStatus,
      registros_criados: created + matched_recebiveis,
      registros_atualizados: matched,
      registros_ignorados: skipped,
      erros: errors,
      detalhes: { matched_recebiveis, matched_lancamentos: matched, created_lancamentos: created },
      finished_at: new Date().toISOString(),
    }).eq("id", importRunId);

    // ── Log in integracao_logs ──────────────────────────────────
    await supabase.from("integracao_logs").insert({
      clinica_id,
      integracao: "import-ofx",
      endpoint: "import-ofx",
      acao: "import_ofx",
      status: finalStatus,
      inicio: new Date().toISOString(),
      fim: new Date().toISOString(),
      registros_processados: transactions.length,
      registros_criados: created + matched_recebiveis,
      registros_atualizados: matched,
      registros_ignorados: skipped,
      detalhes: { filename, period_start, period_end, content_type: contentType.split(";")[0] },
      erros: errors.length > 0 ? errors : null,
    });

    return jsonResponse({
      ok: true,
      imported_count,
      duplicates_count,
      period_start,
      period_end,
      import_run_id: importRunId,
    });
  } catch (e) {
    console.error("import-ofx error:", e);
    return jsonResponse({ error: e.message }, 500);
  }
});
