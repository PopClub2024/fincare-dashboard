import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FEEGOW_BASE = "https://api.feegow.com/v1/api";

// ─── Helpers ────────────────────────────────────────────────────
function toFeegowDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

function makeRequestHash(clinicaId: string, action: string, dateStart: string, dateEnd: string): string {
  return `${clinicaId}:${action}:${dateStart}:${dateEnd}`;
}

async function createLog(supabase: any, clinicaId: string, integracao: string, acao: string, endpoint: string, requestHash?: string) {
  const { data } = await supabase
    .from("integracao_logs")
    .insert({ clinica_id: clinicaId, integracao, acao, endpoint, status: "em_andamento", request_hash: requestHash || null })
    .select("id")
    .single();
  return data?.id;
}

async function finishLog(supabase: any, logId: string | null, status: string, stats: Record<string, any>) {
  if (!logId) return;
  await supabase
    .from("integracao_logs")
    .update({
      status,
      fim: new Date().toISOString(),
      registros_processados: stats.processados ?? 0,
      registros_criados: stats.criados ?? 0,
      registros_atualizados: stats.atualizados ?? 0,
      registros_ignorados: stats.ignorados ?? 0,
      erros: stats.erros ?? [],
      detalhes: stats.detalhes ?? {},
    })
    .eq("id", logId);
}

async function feegowFetch(url: string, headers: Record<string, string>, method = "GET", body?: any, maxRetries = 3) {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const opts: RequestInit = { headers, method };
    if (body) opts.body = JSON.stringify(body);
    try {
      const res = await fetch(url, opts);
      const text = await res.text();
      if (res.status === 401 || res.status === 403) {
        throw new Error(`AUTH_ERROR: HTTP ${res.status} - Token inválido ou sem permissão`);
      }
      if (res.status === 429 || res.status >= 500) {
        const waitMs = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.warn(`Feegow ${res.status} on attempt ${attempt + 1}, retrying in ${waitMs}ms...`);
        await new Promise(r => setTimeout(r, waitMs));
        lastError = new Error(`HTTP ${res.status}: ${text.substring(0, 200)}`);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.substring(0, 500)}`);
      try { return JSON.parse(text); } catch { return { content: text }; }
    } catch (e) {
      if ((e as Error).message?.startsWith("AUTH_ERROR:")) throw e;
      lastError = e as Error;
      if (attempt < maxRetries - 1) {
        const waitMs = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(r => setTimeout(r, waitMs));
      }
    }
  }
  throw lastError || new Error("Max retries exceeded");
}

// ─── Concurrency guard ─────────────────────────────────────────
async function acquireLock(supabase: any, clinicaId: string, action: string, dateStart: string, dateEnd: string): Promise<boolean> {
  const hash = makeRequestHash(clinicaId, action, dateStart, dateEnd);
  // Check if there's a running log with the same hash in the last 10 minutes
  const { data } = await supabase
    .from("integracao_logs")
    .select("id")
    .eq("clinica_id", clinicaId)
    .eq("request_hash", hash)
    .eq("status", "em_andamento")
    .gte("inicio", new Date(Date.now() - 10 * 60 * 1000).toISOString())
    .limit(1);
  return !data || data.length === 0;
}

// ─── Batch FK resolution ────────────────────────────────────────
async function buildLookupMaps(supabase: any, clinicaId: string) {
  const [medicosRes, conveniosRes, pacientesRes] = await Promise.all([
    supabase.from("medicos").select("id, feegow_id").eq("clinica_id", clinicaId),
    supabase.from("convenios").select("id, feegow_id").eq("clinica_id", clinicaId),
    supabase.from("pacientes").select("id, feegow_id").eq("clinica_id", clinicaId),
  ]);

  const medicos = new Map<string, string>();
  for (const m of (medicosRes.data || [])) {
    if (m.feegow_id) medicos.set(m.feegow_id, m.id);
  }
  const convenios = new Map<string, string>();
  for (const c of (conveniosRes.data || [])) {
    if (c.feegow_id) convenios.set(c.feegow_id, c.id);
  }
  const pacientes = new Map<string, string>();
  for (const p of (pacientesRes.data || [])) {
    if (p.feegow_id) pacientes.set(p.feegow_id, p.id);
  }
  return { medicos, convenios, pacientes };
}

// ─── SYNC METADATA ─────────────────────────────────────────────
async function syncMetadata(supabase: any, clinicaId: string, headers: Record<string, string>) {
  const result = { medicos: 0, salas: 0, convenios: 0, pacientes: 0, errors: [] as string[] };

  try {
    const data = await feegowFetch(`${FEEGOW_BASE}/professional/list`, headers);
    for (const prof of (data.content || [])) {
      const { error } = await supabase.from("medicos").upsert({
        clinica_id: clinicaId,
        feegow_id: String(prof.professional_id || prof.id),
        nome: prof.name || prof.nome || "Sem nome",
        especialidade: prof.specialty_name || prof.especialidade || null,
        crm: prof.crm || null,
        documento: prof.cpf || null,
        ativo: prof.active !== false,
      }, { onConflict: "clinica_id,feegow_id" });
      if (!error) result.medicos++;
      else result.errors.push(`Médico ${prof.name}: ${error.message}`);
    }
  } catch (e: any) { result.errors.push(`Médicos: ${e.message}`); }

  try {
    const data = await feegowFetch(`${FEEGOW_BASE}/treatment-place/list`, headers);
    for (const place of (data.content || [])) {
      const { error } = await supabase.from("salas").upsert({
        clinica_id: clinicaId,
        feegow_id: String(place.treatment_place_id || place.id),
        nome: place.name || place.nome || "Sem nome",
        capacidade: place.capacity || 1,
        ativo: place.active !== false,
      }, { onConflict: "clinica_id,feegow_id" });
      if (!error) result.salas++;
      else result.errors.push(`Sala ${place.name}: ${error.message}`);
    }
  } catch (e: any) { result.errors.push(`Salas: ${e.message}`); }

  try {
    const data = await feegowFetch(`${FEEGOW_BASE}/insurance/list`, headers);
    for (const ins of (data.content || [])) {
      const { error } = await supabase.from("convenios").upsert({
        clinica_id: clinicaId,
        feegow_id: String(ins.insurance_id || ins.id),
        nome: ins.name || ins.nome || "Sem nome",
        ativo: ins.active !== false,
      }, { onConflict: "clinica_id,feegow_id" });
      if (!error) result.convenios++;
      else result.errors.push(`Convênio ${ins.name}: ${error.message}`);
    }
  } catch (e: any) { result.errors.push(`Convênios: ${e.message}`); }

  try {
    const data = await feegowFetch(`${FEEGOW_BASE}/patient/list`, headers);
    for (const pat of (data.content || [])) {
      const { error } = await supabase.from("pacientes").upsert({
        clinica_id: clinicaId,
        feegow_id: String(pat.patient_id || pat.id),
        nome: pat.name || pat.nome || "Sem nome",
        data_cadastro: pat.created_at || pat.data_cadastro || null,
      }, { onConflict: "clinica_id,feegow_id" });
      if (!error) result.pacientes++;
      else result.errors.push(`Paciente: ${error.message}`);
    }
  } catch (e: any) { result.errors.push(`Pacientes: ${e.message}`); }

  return result;
}

// ─── SYNC SALES (idempotent via upsert) ────────────────────────
async function syncSales(
  supabase: any,
  clinicaId: string,
  headers: Record<string, string>,
  dateStart: string,
  dateEnd: string,
  unidadeId: number = 0
) {
  const stats = { processados: 0, criados: 0, atualizados: 0, ignorados: 0, erros: [] as string[], fonte: "" };
  const requestHash = makeRequestHash(clinicaId, "sales", dateStart, dateEnd);

  // Concurrency guard
  const canProceed = await acquireLock(supabase, clinicaId, "sales", dateStart, dateEnd);
  if (!canProceed) {
    return { ...stats, erros: ["Sync já em andamento para este período. Aguarde a conclusão."] };
  }

  const logId = await createLog(supabase, clinicaId, "feegow_sales", "sync_sales", "financial/list-sales|appoints/search", requestHash);

  try {
    let sales: any[] = [];
    let fonte = "";

    // ─── Attempt 1: /financial/list-sales
    const variations = [
      `${FEEGOW_BASE}/financial/list-sales?date_start=${dateStart}&date_end=${dateEnd}&unidade_id=${unidadeId}`,
      `${FEEGOW_BASE}/financial/list-sales?data_start=${toFeegowDate(dateStart)}&data_end=${toFeegowDate(dateEnd)}&unidade_id=${unidadeId}`,
    ];

    for (const url of variations) {
      try {
        const data = await feegowFetch(url, headers);
        const items = data.content || data.data || [];
        if (Array.isArray(items) && items.length > 0) {
          sales = items;
          fonte = "financial/list-sales";
          break;
        }
        if (data.success === true) {
          fonte = "financial/list-sales";
          break;
        }
      } catch {
        // Try next variation
      }
    }

    // ─── Attempt 2: Fallback to /appoints/search
    if (sales.length === 0 && fonte === "") {
      try {
        const url = `${FEEGOW_BASE}/appoints/search?data_start=${toFeegowDate(dateStart)}&data_end=${toFeegowDate(dateEnd)}&list_procedures=1`;
        const data = await feegowFetch(url, headers);
        sales = data.content || [];
        fonte = "appoints/search";
      } catch (e: any) {
        stats.erros.push(`Fallback appoints/search: ${e.message}`);
      }
    }

    stats.fonte = fonte;

    // Batch-load FK lookups
    const lookups = await buildLookupMaps(supabase, clinicaId);

    // Payment method mapping
    const pmMap: Record<string, string> = {
      "1": "dinheiro", "2": "cartao_debito", "3": "cartao_credito",
      "4": "cheque", "5": "deposito", "6": "transferencia",
      "7": "boleto", "11": "debito_automatico", "15": "pix",
    };
    const fpEnumMap: Record<string, string> = {
      "2": "cartao_debito", "3": "cartao_credito", "15": "pix",
      "1": "dinheiro", "7": "boleto", "5": "transferencia", "6": "transferencia",
    };

    // Build batch of records for upsert
    const upsertBatch: any[] = [];

    for (const sale of sales) {
      stats.processados++;

      const feegowId = String(sale.sale_id || sale.agendamento_id || sale.schedule_id || sale.id || "");
      if (!feegowId) {
        stats.ignorados++;
        continue;
      }

      const profId = sale.professional_id || sale.profissional_id;
      const insId = sale.insurance_id || sale.convenio_id;
      const patId = sale.patient_id || sale.paciente_id;

      const pmId = String(sale.payment_method || sale.forma_pagamento_id || "");
      const formaPagamento = pmMap[pmId] || sale.payment_method_name || sale.forma_pagamento || null;

      // Status presença
      let statusPresenca: string | null = null;
      const statusId = sale.status_id || sale.status;
      if (statusId) {
        const sid = Number(statusId);
        if (sid === 3) statusPresenca = "atendido";
        else if (sid === 6) statusPresenca = "faltou";
        else if ([11, 16].includes(sid)) statusPresenca = "cancelado";
        else statusPresenca = "confirmado";
      }

      // Parse date
      let dataCompetencia = dateStart;
      const rawDate = sale.date || sale.data;
      if (rawDate) {
        if (rawDate.includes("-") && rawDate.length === 10) {
          const parts = rawDate.split("-");
          dataCompetencia = parts[0].length === 4 ? rawDate : `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }

      const valor = Number(sale.total_value || sale.value || sale.valor || 0);

      upsertBatch.push({
        clinica_id: clinicaId,
        feegow_id: feegowId,
        invoice_id: sale.invoice_id ? String(sale.invoice_id) : null,
        origem: fonte === "financial/list-sales" ? "feegow_sales" : "feegow_appoints",
        data_competencia: dataCompetencia,
        valor_bruto: valor,
        descricao: sale.procedure_name || sale.procedimento_nome || sale.notes || sale.notas || null,
        procedimento: sale.procedure_name || sale.procedimento_nome || null,
        especialidade: sale.specialty_name || sale.especialidade_nome || null,
        medico_id: profId ? (lookups.medicos.get(String(profId)) || null) : null,
        convenio_id: insId ? (lookups.convenios.get(String(insId)) || null) : null,
        paciente_id: patId ? (lookups.pacientes.get(String(patId)) || null) : null,
        forma_pagamento: formaPagamento,
        forma_pagamento_enum: fpEnumMap[pmId] || null,
        status_presenca: statusPresenca,
        parcelas: sale.installments ? Number(sale.installments) : 1,
        quantidade: sale.quantity ? Number(sale.quantity) : 1,
      });
    }

    // Upsert in batches of 100 for reliability
    const BATCH_SIZE = 100;
    for (let i = 0; i < upsertBatch.length; i += BATCH_SIZE) {
      const batch = upsertBatch.slice(i, i + BATCH_SIZE);
      const { data: upserted, error } = await supabase
        .from("transacoes_vendas")
        .upsert(batch, {
          onConflict: "clinica_id,feegow_id",
          ignoreDuplicates: false,
        })
        .select("id");

      if (error) {
        stats.erros.push(`Upsert batch ${i / BATCH_SIZE + 1}: ${error.message}`);
        // Fallback: try one-by-one for this batch
        for (const record of batch) {
          const { data: existing } = await supabase
            .from("transacoes_vendas")
            .select("id")
            .eq("clinica_id", clinicaId)
            .eq("feegow_id", record.feegow_id)
            .maybeSingle();

          if (existing) {
            const { error: upErr } = await supabase
              .from("transacoes_vendas")
              .update(record)
              .eq("id", existing.id);
            if (upErr) stats.erros.push(`Update ${record.feegow_id}: ${upErr.message}`);
            else stats.atualizados++;
          } else {
            const { error: insErr } = await supabase
              .from("transacoes_vendas")
              .insert(record);
            if (insErr) stats.erros.push(`Insert ${record.feegow_id}: ${insErr.message}`);
            else stats.criados++;
          }
        }
      } else {
        // Count created vs updated (upsert doesn't distinguish, so we estimate)
        // We'll count the total successfully processed
        stats.atualizados += (upserted?.length || batch.length);
      }
    }

    await finishLog(supabase, logId, stats.erros.length > 0 ? "erro_parcial" : "sucesso", {
      ...stats,
      detalhes: { dateStart, dateEnd, unidadeId, fonte, total: sales.length, batches: Math.ceil(upsertBatch.length / BATCH_SIZE) },
    });
  } catch (e: any) {
    stats.erros.push(e.message);
    await finishLog(supabase, logId, "erro", stats);
  }

  return stats;
}

// ─── MAIN HANDLER ──────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const feegowApiKey = Deno.env.get("FEEGOW_API_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const feegowHeaders = {
    "x-access-token": feegowApiKey,
    "Content-Type": "application/json",
  };

  try {
    const body = await req.json().catch(() => ({}));
    const clinicaId = body.clinica_id;
    const action = body.action || "full";
    const dateStart = body.date_start;
    const dateEnd = body.date_end;
    const unidadeId = body.unidade_id ?? 0;

    if (!clinicaId) {
      return new Response(JSON.stringify({ error: "clinica_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!feegowApiKey) {
      return new Response(JSON.stringify({ error: "FEEGOW_API_KEY não configurada no servidor" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response: Record<string, any> = { success: true };

    // ── Metadata sync ──
    if (action === "full" || action === "metadata") {
      const logId = await createLog(supabase, clinicaId, "feegow_metadata", "sync_metadata", "professional+salas+insurance+patient");
      const metaResult = await syncMetadata(supabase, clinicaId, feegowHeaders);
      await finishLog(supabase, logId, metaResult.errors.length > 0 ? "erro_parcial" : "sucesso", {
        processados: metaResult.medicos + metaResult.salas + metaResult.convenios + metaResult.pacientes,
        criados: metaResult.medicos + metaResult.salas + metaResult.convenios + metaResult.pacientes,
        erros: metaResult.errors,
        detalhes: metaResult,
      });
      response.metadata = metaResult;
    }

    // ── Sales sync ──
    if (action === "full" || action === "sales") {
      const end = dateEnd || new Date().toISOString().split("T")[0];
      const start = dateStart || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
      const salesResult = await syncSales(supabase, clinicaId, feegowHeaders, start, end, unidadeId);
      response.sales = salesResult;
    }

    // Update integration status
    await supabase
      .from("integracoes")
      .upsert({
        clinica_id: clinicaId,
        tipo: "feegow",
        status: "ativo",
        ultima_sincronizacao: new Date().toISOString(),
      }, { onConflict: "clinica_id,tipo" });

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("sync-feegow error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
