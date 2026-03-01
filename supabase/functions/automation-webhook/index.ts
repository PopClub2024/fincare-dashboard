import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Auth ───────────────────────────────────────────────────────
function verifyWebhookAuth(req: Request): boolean {
  const secret = Deno.env.get("MAKE_WEBHOOK_SECRET");
  if (!secret) return false;
  const provided = req.headers.get("x-webhook-secret") || "";
  return provided === secret;
}

// ─── SHA-256 hash for idempotency ───────────────────────────────
async function sha256(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Helpers ────────────────────────────────────────────────────
function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callEdgeFunction(supabaseUrl: string, serviceKey: string, functionName: string, body: any) {
  const res = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text.substring(0, 500) }; }
  return { ok: res.ok, status: res.status, data };
}

// ─── Action: feegow_run_month ───────────────────────────────────
async function feegowRunMonth(supabase: any, supabaseUrl: string, serviceKey: string, body: any) {
  const { clinica_id, year, month } = body;
  if (!clinica_id || !year || !month) {
    return jsonResponse({ error: "clinica_id, year, month obrigatórios" }, 400);
  }

  const dateStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const dateEnd = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;

  // Upsert run record (idempotent by clinica_id + year + month)
  const { data: existingRun } = await supabase
    .from("feegow_sync_runs")
    .select("id, status")
    .eq("clinica_id", clinica_id)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  let runId: string;
  if (existingRun) {
    // Re-run: reset status
    await supabase.from("feegow_sync_runs")
      .update({ status: "em_andamento", healthcheck_ok: null, sync_invoices_ok: null, validate_sales_ok: null, totals: {}, errors: [], finished_at: null })
      .eq("id", existingRun.id);
    runId = existingRun.id;
  } else {
    const { data: newRun } = await supabase.from("feegow_sync_runs")
      .insert({ clinica_id, year, month })
      .select("id")
      .single();
    runId = newRun?.id;
  }

  const errors: string[] = [];
  const totals: any = {};

  // Step 1: Healthcheck
  const hc = await callEdgeFunction(supabaseUrl, serviceKey, "feegow-healthcheck", { clinica_id });
  const healthOk = hc.ok && hc.data?.ok;
  totals.healthcheck = hc.data;
  if (!healthOk) {
    errors.push(`Healthcheck falhou: ${hc.data?.error || "unknown"}`);
    await supabase.from("feegow_sync_runs")
      .update({ status: "erro", healthcheck_ok: false, errors, totals, finished_at: new Date().toISOString() })
      .eq("id", runId);
    return jsonResponse({ success: false, run_id: runId, step: "healthcheck", errors });
  }

  // Step 2: Sync sales (using existing sync-feegow with full action)
  const sync = await callEdgeFunction(supabaseUrl, serviceKey, "sync-feegow", {
    clinica_id, action: "full", date_start: dateStart, date_end: dateEnd,
  });
  const syncOk = sync.ok && sync.data?.success;
  totals.sync = sync.data;
  if (!syncOk) {
    errors.push(`Sync falhou: ${JSON.stringify(sync.data?.error || sync.data?.sales?.erros || "unknown").substring(0, 200)}`);
  }

  // Step 3: Validate — count vendas loaded vs sales response
  const { count: vendasCount } = await supabase
    .from("transacoes_vendas")
    .select("id", { count: "exact", head: true })
    .eq("clinica_id", clinica_id)
    .gte("data_competencia", dateStart)
    .lte("data_competencia", dateEnd);

  const syncedCount = sync.data?.sales?.processados || 0;
  const validateOk = vendasCount != null && vendasCount > 0;
  totals.validation = { vendas_db: vendasCount, sync_processados: syncedCount, match: vendasCount === syncedCount };

  if (!validateOk) {
    errors.push(`Validação: ${vendasCount || 0} vendas no DB vs ${syncedCount} processados`);
  }

  const finalStatus = errors.length === 0 ? "sucesso" : (syncOk ? "erro_parcial" : "erro");

  await supabase.from("feegow_sync_runs")
    .update({
      status: finalStatus,
      healthcheck_ok: healthOk,
      sync_invoices_ok: syncOk,
      validate_sales_ok: validateOk,
      totals,
      errors,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);

  return jsonResponse({ success: errors.length === 0, run_id: runId, status: finalStatus, totals, errors });
}

// ─── Action: import_bank_statement ──────────────────────────────
async function importBankStatement(supabase: any, supabaseUrl: string, serviceKey: string, body: any) {
  const { clinica_id, file_content, file_url, file_name, banco, conta, periodo_inicio, periodo_fim } = body;
  if (!clinica_id) return jsonResponse({ error: "clinica_id obrigatório" }, 400);

  let content = file_content;
  // If file_url provided (from Make), download it
  if (!content && file_url) {
    const res = await fetch(file_url);
    content = await res.text();
  }
  if (!content) return jsonResponse({ error: "file_content ou file_url obrigatório" }, 400);

  // Idempotency check via hash
  const fileHash = await sha256(clinica_id + content);
  const { data: existing } = await supabase
    .from("import_runs")
    .select("id, status")
    .eq("clinica_id", clinica_id)
    .eq("arquivo_hash", fileHash)
    .maybeSingle();

  if (existing) {
    return jsonResponse({ success: true, message: "Arquivo já processado anteriormente", import_run_id: existing.id, status: existing.status });
  }

  // Create import run
  const { data: run } = await supabase.from("import_runs")
    .insert({
      clinica_id, tipo: "banco_ofx", origem: "webhook",
      arquivo_nome: file_name || "extrato_banco.ofx",
      arquivo_hash: fileHash,
      periodo_inicio, periodo_fim,
    })
    .select("id")
    .single();

  // Call existing import-ofx function
  const result = await callEdgeFunction(supabaseUrl, serviceKey, "import-ofx", {
    clinica_id, ofx_content: content,
  });

  const status = result.ok ? (result.data?.errors?.length > 0 ? "erro_parcial" : "sucesso") : "erro";

  await supabase.from("import_runs")
    .update({
      status,
      registros_total: result.data?.total || 0,
      registros_criados: result.data?.created || 0,
      registros_atualizados: result.data?.matched || 0,
      registros_ignorados: result.data?.skipped || 0,
      erros: result.data?.errors || [],
      detalhes: result.data,
      finished_at: new Date().toISOString(),
    })
    .eq("id", run?.id);

  return jsonResponse({ success: result.ok, import_run_id: run?.id, ...result.data });
}

// ─── Action: import_getnet_statement ────────────────────────────
async function importGetnetStatement(supabase: any, supabaseUrl: string, serviceKey: string, body: any) {
  const { clinica_id, file_content, file_url, file_name, tipo_extrato } = body;
  if (!clinica_id || !tipo_extrato) return jsonResponse({ error: "clinica_id e tipo_extrato obrigatórios" }, 400);

  let content = file_content;
  if (!content && file_url) {
    const res = await fetch(file_url);
    content = await res.text();
  }
  if (!content) return jsonResponse({ error: "file_content ou file_url obrigatório" }, 400);

  const fileHash = await sha256(clinica_id + content);
  const { data: existing } = await supabase
    .from("import_runs")
    .select("id, status")
    .eq("clinica_id", clinica_id)
    .eq("arquivo_hash", fileHash)
    .maybeSingle();

  if (existing) {
    return jsonResponse({ success: true, message: "Arquivo já processado", import_run_id: existing.id });
  }

  const { data: run } = await supabase.from("import_runs")
    .insert({
      clinica_id, tipo: `getnet_${tipo_extrato}`, origem: "webhook",
      arquivo_nome: file_name || `getnet_${tipo_extrato}.csv`,
      arquivo_hash: fileHash,
    })
    .select("id")
    .single();

  const result = await callEdgeFunction(supabaseUrl, serviceKey, "import-getnet-csv", {
    clinica_id, csv_content: content, tipo_extrato, nome_arquivo: file_name,
  });

  const status = result.ok ? (result.data?.errors?.length > 0 ? "erro_parcial" : "sucesso") : "erro";

  await supabase.from("import_runs")
    .update({
      status,
      registros_total: result.data?.total_transacoes || 0,
      registros_criados: result.data?.created || 0,
      registros_ignorados: result.data?.skipped || 0,
      erros: result.data?.errors || [],
      detalhes: result.data,
      periodo_inicio: result.data?.periodo?.inicio,
      periodo_fim: result.data?.periodo?.fim,
      finished_at: new Date().toISOString(),
    })
    .eq("id", run?.id);

  return jsonResponse({ success: result.ok, import_run_id: run?.id, ...result.data });
}

// ─── Action: run_reconciliation ─────────────────────────────────
async function runReconciliation(supabase: any, supabaseUrl: string, serviceKey: string, body: any) {
  const { clinica_id, start_date, end_date } = body;
  if (!clinica_id || !start_date || !end_date) {
    return jsonResponse({ error: "clinica_id, start_date, end_date obrigatórios" }, 400);
  }

  const result = await callEdgeFunction(supabaseUrl, serviceKey, "run-reconciliation", {
    clinica_id, date_start: start_date, date_end: end_date,
  });

  return jsonResponse({ success: result.ok, ...result.data });
}

// ─── Action: import_repasses_medicos ────────────────────────────
async function importRepassesMedicos(supabase: any, body: any) {
  const { clinica_id, repasses } = body;
  if (!clinica_id || !Array.isArray(repasses) || repasses.length === 0) {
    return jsonResponse({ error: "clinica_id e repasses[] obrigatórios" }, 400);
  }

  // Find plano_contas for repasse médico (19.1)
  const { data: plano } = await supabase
    .from("plano_contas")
    .select("id")
    .eq("clinica_id", clinica_id)
    .eq("codigo_estruturado", "19.1")
    .maybeSingle();

  if (!plano) {
    return jsonResponse({ error: "Plano de contas 19.1 (Mão de Obra Médica) não encontrado" }, 400);
  }

  // Hash for idempotency
  const contentHash = await sha256(clinica_id + JSON.stringify(repasses));
  const { data: existing } = await supabase
    .from("import_runs")
    .select("id, status")
    .eq("clinica_id", clinica_id)
    .eq("arquivo_hash", contentHash)
    .maybeSingle();

  if (existing) {
    return jsonResponse({ success: true, message: "Repasses já processados", import_run_id: existing.id });
  }

  const { data: run } = await supabase.from("import_runs")
    .insert({
      clinica_id, tipo: "repasse_medico", origem: "webhook",
      arquivo_hash: contentHash,
      registros_total: repasses.length,
    })
    .select("id")
    .single();

  let criados = 0;
  let rejeitados = 0;
  const erros: string[] = [];

  // Lookup medicos
  const { data: medicos } = await supabase
    .from("medicos")
    .select("id, nome")
    .eq("clinica_id", clinica_id);
  const medicoMap = new Map((medicos || []).map((m: any) => [m.nome.toLowerCase().trim(), m.id]));

  for (const r of repasses) {
    if (!r.ref_dia_trabalhado) {
      rejeitados++;
      erros.push(`Linha rejeitada: ref_dia_trabalhado vazio (medico: ${r.medico || "?"})`);
      continue;
    }

    if (!r.valor || Number(r.valor) <= 0) {
      rejeitados++;
      erros.push(`Linha rejeitada: valor inválido (medico: ${r.medico || "?"}, ref: ${r.ref_dia_trabalhado})`);
      continue;
    }

    const medicoId = r.medico ? medicoMap.get(r.medico.toLowerCase().trim()) : null;

    const { error } = await supabase.from("contas_pagar_lancamentos").insert({
      clinica_id,
      plano_contas_id: plano.id,
      tipo_despesa: "variavel",
      ref_dia_trabalhado: r.ref_dia_trabalhado,
      data_competencia: r.ref_dia_trabalhado,
      valor: Number(r.valor),
      descricao: `Repasse médico${r.medico ? " - " + r.medico : ""} ref:${r.ref_dia_trabalhado}`,
      fornecedor: r.medico || null,
      medico_id: medicoId || null,
      observacao: r.observacao || null,
      status: "a_classificar",
    });

    if (error) {
      rejeitados++;
      erros.push(`Erro inserindo repasse ${r.medico}/${r.ref_dia_trabalhado}: ${error.message}`);
    } else {
      criados++;
    }
  }

  const status = rejeitados > 0 ? (criados > 0 ? "erro_parcial" : "erro") : "sucesso";

  await supabase.from("import_runs")
    .update({
      status,
      registros_criados: criados,
      registros_rejeitados: rejeitados,
      erros,
      finished_at: new Date().toISOString(),
    })
    .eq("id", run?.id);

  return jsonResponse({ success: criados > 0, import_run_id: run?.id, criados, rejeitados, erros });
}

// ─── MAIN ROUTER ────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check: webhook secret OR service role OR valid Supabase JWT
  if (!verifyWebhookAuth(req)) {
    const authHeader = req.headers.get("authorization") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const isServiceRole = authHeader.includes(serviceKey) || authHeader === `Bearer ${serviceKey}`;
    
    if (!isServiceRole) {
      // Try validating as a logged-in user via Supabase JWT
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const token = authHeader.replace("Bearer ", "");
      if (!token) {
        return jsonResponse({ error: "Unauthorized. Provide x-webhook-secret header or valid auth token." }, 401);
      }
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: claims, error: claimsErr } = await userClient.auth.getUser(token);
      if (claimsErr || !claims?.user) {
        return jsonResponse({ error: "Unauthorized. Invalid auth token." }, 401);
      }
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (!action) {
      return jsonResponse({
        error: "action obrigatório",
        actions_disponiveis: [
          "feegow_run_month",
          "import_bank_statement",
          "import_getnet_statement",
          "run_reconciliation",
          "import_repasses_medicos",
        ],
      }, 400);
    }

    switch (action) {
      case "feegow_run_month":
        return await feegowRunMonth(supabase, supabaseUrl, serviceKey, body);
      case "import_bank_statement":
        return await importBankStatement(supabase, supabaseUrl, serviceKey, body);
      case "import_getnet_statement":
        return await importGetnetStatement(supabase, supabaseUrl, serviceKey, body);
      case "run_reconciliation":
        return await runReconciliation(supabase, supabaseUrl, serviceKey, body);
      case "import_repasses_medicos":
        return await importRepassesMedicos(supabase, body);
      default:
        return jsonResponse({ error: `Action '${action}' desconhecida` }, 400);
    }
  } catch (e: any) {
    console.error("automation-webhook error:", e);
    return jsonResponse({ error: e.message }, 500);
  }
});
