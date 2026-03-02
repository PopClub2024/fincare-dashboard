import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Auth ───────────────────────────────────────────────────────
function verifyAutomationToken(req: Request): boolean {
  const secret = Deno.env.get("AUTOMATION_TOKEN");
  if (!secret) return false;

  // Primary: x-webhook-secret header
  const webhookSecret = req.headers.get("x-webhook-secret") || "";
  if (webhookSecret && webhookSecret === secret) return true;

  // Fallback: Authorization: Bearer <AUTOMATION_TOKEN>
  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.replace("Bearer ", "");
  if (bearer && bearer === secret) return true;

  return false;
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

// ─── Logging ────────────────────────────────────────────────────
async function logIntegracao(supabase: any, params: {
  clinica_id: string;
  action: string;
  status: string;
  headers_present: string[];
  detalhes?: any;
  erros?: any;
}) {
  try {
    await supabase.from("integracao_logs").insert({
      clinica_id: params.clinica_id,
      integracao: "automation-webhook",
      endpoint: "automation-webhook",
      acao: params.action,
      status: params.status,
      detalhes: { headers_present: params.headers_present, ...(params.detalhes || {}) },
      erros: params.erros || null,
      inicio: new Date().toISOString(),
      fim: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Failed to log integracao:", e);
  }
}

function getHeadersPresent(req: Request): string[] {
  const present: string[] = [];
  if (req.headers.get("x-webhook-secret")) present.push("x-webhook-secret");
  if (req.headers.get("authorization")) present.push("authorization");
  if (req.headers.get("content-type")) present.push("content-type");
  return present;
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

  const { data: existingRun } = await supabase
    .from("feegow_sync_runs")
    .select("id, status")
    .eq("clinica_id", clinica_id)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  let runId: string;
  if (existingRun) {
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

  const sync = await callEdgeFunction(supabaseUrl, serviceKey, "sync-feegow", {
    clinica_id, action: "full", date_start: dateStart, date_end: dateEnd,
  });
  const syncOk = sync.ok && sync.data?.success;
  totals.sync = sync.data;
  if (!syncOk) {
    errors.push(`Sync falhou: ${JSON.stringify(sync.data?.error || sync.data?.sales?.erros || "unknown").substring(0, 200)}`);
  }

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
    return jsonResponse({ success: true, message: "Arquivo já processado anteriormente", import_run_id: existing.id, status: existing.status });
  }

  const { data: run } = await supabase.from("import_runs")
    .insert({
      clinica_id, tipo: "banco_ofx", origem: "webhook",
      arquivo_nome: file_name || "extrato_banco.ofx",
      arquivo_hash: fileHash,
      periodo_inicio, periodo_fim,
    })
    .select("id")
    .single();

  const result = await callEdgeFunction(supabaseUrl, serviceKey, "import-ofx", {
    clinica_id, ofx_content: content,
  });

  const status = result.ok ? (result.data?.errors?.length > 0 ? "erro_parcial" : "sucesso") : "erro";

  // Derive period from imported data or params
  const importPeriodStart = periodo_inicio || result.data?.period_start || null;
  const importPeriodEnd = periodo_fim || result.data?.period_end || null;

  await supabase.from("import_runs")
    .update({
      status,
      registros_total: result.data?.total || 0,
      registros_criados: result.data?.created || 0,
      registros_atualizados: result.data?.matched || 0,
      registros_ignorados: result.data?.skipped || 0,
      erros: result.data?.errors || [],
      detalhes: result.data,
      periodo_inicio: importPeriodStart,
      periodo_fim: importPeriodEnd,
      finished_at: new Date().toISOString(),
    })
    .eq("id", run?.id);

  // Auto-chain: run reconciliation after import
  if (result.ok && importPeriodStart && importPeriodEnd) {
    try {
      console.log(`Auto-chaining run-reconciliation for ${importPeriodStart} → ${importPeriodEnd}`);
      const reconResult = await callEdgeFunction(supabaseUrl, serviceKey, "run-reconciliation", {
        clinica_id, date_start: importPeriodStart, date_end: importPeriodEnd,
      });
      console.log(`Auto-reconciliation result: ok=${reconResult.ok}`);
      // Also sync feegow caixa for the same period to ensure base is updated
      await callEdgeFunction(supabaseUrl, serviceKey, "sync-feegow", {
        clinica_id, action: "recebimentos_agregados", date_start: importPeriodStart, date_end: importPeriodEnd,
      });
    } catch (e: any) {
      console.error("Auto-chain reconciliation error:", e.message);
    }
  }

  return jsonResponse({ success: result.ok, import_run_id: run?.id, auto_reconciled: !!(result.ok && importPeriodStart && importPeriodEnd), ...result.data });
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

  const getnetPeriodStart = result.data?.periodo?.inicio || null;
  const getnetPeriodEnd = result.data?.periodo?.fim || null;

  await supabase.from("import_runs")
    .update({
      status,
      registros_total: result.data?.total_transacoes || 0,
      registros_criados: result.data?.created || 0,
      registros_ignorados: result.data?.skipped || 0,
      erros: result.data?.errors || [],
      detalhes: result.data,
      periodo_inicio: getnetPeriodStart,
      periodo_fim: getnetPeriodEnd,
      finished_at: new Date().toISOString(),
    })
    .eq("id", run?.id);

  // Auto-chain: run reconciliation after Getnet import
  if (result.ok && getnetPeriodStart && getnetPeriodEnd) {
    try {
      console.log(`Auto-chaining run-reconciliation for Getnet ${getnetPeriodStart} → ${getnetPeriodEnd}`);
      await callEdgeFunction(supabaseUrl, serviceKey, "run-reconciliation", {
        clinica_id, date_start: getnetPeriodStart, date_end: getnetPeriodEnd,
      });
      // Sync feegow caixa to keep CR agregado fresh
      await callEdgeFunction(supabaseUrl, serviceKey, "sync-feegow", {
        clinica_id, action: "recebimentos_agregados", date_start: getnetPeriodStart, date_end: getnetPeriodEnd,
      });
    } catch (e: any) {
      console.error("Auto-chain reconciliation error (Getnet):", e.message);
    }
  }

  return jsonResponse({ success: result.ok, import_run_id: run?.id, auto_reconciled: !!(result.ok && getnetPeriodStart && getnetPeriodEnd), ...result.data });
}

// ─── Action: import_getnet_recebiveis ───────────────────────────
async function importGetnetRecebiveis(supabase: any, supabaseUrl: string, serviceKey: string, body: any) {
  const { clinica_id, file_content, file_url, file_name, layout, mes_ref } = body;
  if (!clinica_id) return jsonResponse({ error: "clinica_id obrigatório" }, 400);

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

  const result = await callEdgeFunction(supabaseUrl, serviceKey, "import-getnet-recebiveis", {
    clinica_id, csv_content: content, filename: file_name, layout, mes_ref,
  });

  return jsonResponse({ success: result.ok, ...result.data });
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

  const { data: plano } = await supabase
    .from("plano_contas")
    .select("id")
    .eq("clinica_id", clinica_id)
    .eq("codigo_estruturado", "19.1")
    .maybeSingle();

  if (!plano) {
    return jsonResponse({ error: "Plano de contas 19.1 (Mão de Obra Médica) não encontrado" }, 400);
  }

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

// ─── Helper: generate date chunks (2-day windows) ──────────────
function generateDateChunks(dateStart: string, dateEnd: string, chunkDays = 2): { start: string; end: string }[] {
  const chunks: { start: string; end: string }[] = [];
  let cur = new Date(dateStart + "T00:00:00Z");
  const end = new Date(dateEnd + "T00:00:00Z");
  while (cur <= end) {
    const chunkEnd = new Date(cur);
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + chunkDays - 1);
    if (chunkEnd > end) chunkEnd.setTime(end.getTime());
    chunks.push({
      start: cur.toISOString().slice(0, 10),
      end: chunkEnd.toISOString().slice(0, 10),
    });
    cur.setUTCDate(cur.getUTCDate() + chunkDays);
  }
  return chunks;
}

// ─── Action: sync_feegow (async with job tracking) ──────────────
async function syncFeegow(supabase: any, supabaseUrl: string, serviceKey: string, body: any) {
  const { clinica_id, unidade_id, date_start, date_end } = body;
  if (!clinica_id || !date_start || !date_end) {
    return jsonResponse({ error: "clinica_id, date_start, date_end obrigatórios" }, 400);
  }

  const params = { date_start, date_end, unidade_id: unidade_id || null };

  // Idempotency + lock: check for active job with same params
  const { data: existingJob } = await supabase
    .from("integracao_jobs")
    .select("id, status, progress")
    .eq("clinica_id", clinica_id)
    .eq("job_type", "sync_feegow")
    .in("status", ["queued", "running"])
    .eq("params->>date_start", date_start)
    .eq("params->>date_end", date_end)
    .maybeSingle();

  if (existingJob) {
    return new Response(JSON.stringify({
      success: true,
      message: "Job já em andamento",
      job_id: existingJob.id,
      status: existingJob.status,
      progress: existingJob.progress,
    }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Create job record
  const { data: job, error: jobErr } = await supabase
    .from("integracao_jobs")
    .insert({ clinica_id, job_type: "sync_feegow", params, status: "queued" })
    .select("id")
    .single();

  if (jobErr) {
    // Unique constraint violation = concurrent duplicate
    if (jobErr.code === "23505") {
      return new Response(JSON.stringify({
        success: true,
        message: "Job duplicado detectado, já em andamento",
      }), { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return jsonResponse({ error: `Erro criando job: ${jobErr.message}` }, 500);
  }

  const jobId = job.id;

  // Return 202 immediately, then run sync in background
  const responsePromise = new Response(JSON.stringify({
    success: true,
    job_id: jobId,
    status: "queued",
    message: "Sync agendado. Use action job_status para acompanhar.",
  }), {
    status: 202,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  // Fire-and-forget background execution using EdgeRuntime.waitUntil
  const bgWork = (async () => {
    try {
      await supabase.from("integracao_jobs")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", jobId);

      const chunks = generateDateChunks(date_start, date_end, 2);
      let completedChunks = 0;
      let totalProcessados = 0;
      let totalErros = 0;
      const chunkResults: any[] = [];

      for (const chunk of chunks) {
        const chunkStart = Date.now();
        const result = await callEdgeFunction(supabaseUrl, serviceKey, "sync-feegow", {
          clinica_id,
          unidade_id: unidade_id || null,
          action: "full",
          date_start: chunk.start,
          date_end: chunk.end,
        });

        completedChunks++;
        const processados = result.data?.sales?.processados || 0;
        const erros = result.data?.sales?.erros || 0;
        totalProcessados += processados;
        totalErros += erros;

        chunkResults.push({
          chunk: `${chunk.start} → ${chunk.end}`,
          ok: result.ok,
          processados,
          erros,
          duration_ms: Date.now() - chunkStart,
        });

        // Update progress
        await supabase.from("integracao_jobs")
          .update({
            progress: {
              chunks_total: chunks.length,
              chunks_completed: completedChunks,
              pct: Math.round((completedChunks / chunks.length) * 100),
              current_chunk: `${chunk.start} → ${chunk.end}`,
              total_processados: totalProcessados,
              total_erros: totalErros,
            },
          })
          .eq("id", jobId);

        // Log each chunk
        await logIntegracao(supabase, {
          clinica_id,
          action: "sync_feegow_chunk",
          status: result.ok ? "sucesso" : "erro",
          headers_present: [],
          detalhes: { job_id: jobId, chunk: chunk, result_summary: { processados, erros } },
        });
      }

      // Finalize
      const finalStatus = totalErros > 0 ? (totalProcessados > 0 ? "completed_partial" : "failed") : "completed";
      await supabase.from("integracao_jobs")
        .update({
          status: finalStatus,
          finished_at: new Date().toISOString(),
          progress: {
            chunks_total: chunks.length,
            chunks_completed: completedChunks,
            pct: 100,
            total_processados: totalProcessados,
            total_erros: totalErros,
            chunk_results: chunkResults,
          },
        })
        .eq("id", jobId);

    } catch (e: any) {
      console.error("sync_feegow job error:", e);
      await supabase.from("integracao_jobs")
        .update({
          status: "failed",
          error: e.message?.substring(0, 500),
          finished_at: new Date().toISOString(),
        })
        .eq("id", jobId);
    }
  })();

  // Use waitUntil if available (Deno Deploy), otherwise just fire-and-forget
  if (typeof (globalThis as any).EdgeRuntime?.waitUntil === "function") {
    (globalThis as any).EdgeRuntime.waitUntil(bgWork);
  } else {
    // In Supabase edge runtime, we rely on the promise executing before shutdown
    bgWork.catch((e) => console.error("Background sync error:", e));
  }

  return responsePromise;
}

// ─── Action: job_status ─────────────────────────────────────────
async function jobStatus(supabase: any, body: any) {
  const { job_id, clinica_id } = body;
  if (!job_id) return jsonResponse({ error: "job_id obrigatório" }, 400);

  const query = supabase
    .from("integracao_jobs")
    .select("id, clinica_id, job_type, params, status, progress, started_at, finished_at, error, created_at")
    .eq("id", job_id);

  if (clinica_id) query.eq("clinica_id", clinica_id);

  const { data, error } = await query.maybeSingle();

  if (error) return jsonResponse({ error: error.message }, 500);
  if (!data) return jsonResponse({ error: "Job não encontrado" }, 404);

  return jsonResponse(data);
}

// ─── Action: autopilot_run ──────────────────────────────────────
async function autopilotRun(supabase: any, supabaseUrl: string, serviceKey: string, body: any) {
  const { clinica_id } = body;
  if (!clinica_id) return jsonResponse({ error: "clinica_id obrigatório" }, 400);

  const result = await callEdgeFunction(supabaseUrl, serviceKey, "autopilot-run", {
    clinica_id,
    trigger: "webhook",
  });

  return jsonResponse({ success: result.ok, ...result.data });
}

// ─── Action: recalculate_kpis ───────────────────────────────────
async function recalculateKpis(supabase: any, body: any) {
  const { clinica_id, start_date, end_date } = body;
  if (!clinica_id) return jsonResponse({ error: "clinica_id obrigatório" }, 400);

  const sd = start_date || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const ed = end_date || new Date().toISOString().slice(0, 10);

  // Call existing DB functions
  const { data: dre, error: dreErr } = await supabase.rpc("get_dre", { _start_date: sd, _end_date: ed });
  const { data: cash, error: cashErr } = await supabase.rpc("get_cash_kpis", { _start_date: sd, _end_date: ed });

  return jsonResponse({
    success: !dreErr && !cashErr,
    dre: dreErr ? { error: dreErr.message } : { ok: true },
    cash: cashErr ? { error: cashErr.message } : { ok: true },
    periodo: { start_date: sd, end_date: ed },
  });
}

// ─── Action: process_comprovante ────────────────────────────────
async function processComprovante(supabase: any, supabaseUrl: string, serviceKey: string, body: any) {
  const { clinica_id, arquivo_url, arquivo_nome } = body;
  if (!clinica_id || !arquivo_url) return jsonResponse({ error: "clinica_id e arquivo_url obrigatórios" }, 400);

  const result = await callEdgeFunction(supabaseUrl, serviceKey, "process-comprovante", {
    clinica_id, arquivo_url, arquivo_nome,
  });

  return jsonResponse({ success: result.ok, ...result.data });
}

// ─── MAIN ROUTER ────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const headersPresent = getHeadersPresent(req);

  // Auth: AUTOMATION_TOKEN via x-webhook-secret or Bearer, or valid Supabase JWT
  if (!verifyAutomationToken(req)) {
    // Try validating as a logged-in user via Supabase JWT
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return jsonResponse({ error: "Unauthorized. Provide x-webhook-secret header or valid auth token." }, 401);
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: claims, error: claimsErr } = await userClient.auth.getUser(token);
    if (claimsErr || !claims?.user) {
      return jsonResponse({ error: "Unauthorized. Provide x-webhook-secret header or valid auth token." }, 401);
    }
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const clinica_id = body.clinica_id || null;

    if (!action) {
      return jsonResponse({
        error: "action obrigatório",
        actions_disponiveis: [
          "feegow_run_month",
          "sync_feegow",
          "import_bank_statement",
          "import_getnet_statement",
          "import_getnet_recebiveis",
          "run_reconciliation",
          "import_repasses_medicos",
          "autopilot_run",
          "recalculate_kpis",
          "process_comprovante",
          "job_status",
        ],
      }, 400);
    }

    let response: Response;

    switch (action) {
      case "feegow_run_month":
        response = await feegowRunMonth(supabase, supabaseUrl, serviceKey, body);
        break;
      case "sync_feegow":
        response = await syncFeegow(supabase, supabaseUrl, serviceKey, body);
        break;
      case "import_bank_statement":
        response = await importBankStatement(supabase, supabaseUrl, serviceKey, body);
        break;
      case "import_getnet_statement":
        response = await importGetnetStatement(supabase, supabaseUrl, serviceKey, body);
        break;
      case "import_getnet_recebiveis":
        response = await importGetnetRecebiveis(supabase, supabaseUrl, serviceKey, body);
        break;
      case "run_reconciliation":
        response = await runReconciliation(supabase, supabaseUrl, serviceKey, body);
        break;
      case "import_repasses_medicos":
        response = await importRepassesMedicos(supabase, body);
        break;
      case "autopilot_run":
        response = await autopilotRun(supabase, supabaseUrl, serviceKey, body);
        break;
      case "recalculate_kpis":
        response = await recalculateKpis(supabase, body);
        break;
      case "process_comprovante":
        response = await processComprovante(supabase, supabaseUrl, serviceKey, body);
        break;
      case "job_status":
        response = await jobStatus(supabase, body);
        break;
      default:
        response = jsonResponse({ error: `Action '${action}' desconhecida` }, 400);
    }

    // Log to integracao_logs
    const responseStatus = response.status >= 200 && response.status < 300 ? "sucesso" : "erro";
    if (clinica_id) {
      await logIntegracao(supabase, {
        clinica_id,
        action,
        status: responseStatus,
        headers_present: headersPresent,
      });
    }

    return response;
  } catch (e: any) {
    console.error("automation-webhook error:", e);
    return jsonResponse({ error: e.message }, 500);
  }
});
