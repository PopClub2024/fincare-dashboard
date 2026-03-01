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
  for (const m of (medicosRes.data || [])) if (m.feegow_id) medicos.set(m.feegow_id, m.id);
  const convenios = new Map<string, string>();
  for (const c of (conveniosRes.data || [])) if (c.feegow_id) convenios.set(c.feegow_id, c.id);
  const pacientes = new Map<string, string>();
  for (const p of (pacientesRes.data || [])) if (p.feegow_id) pacientes.set(p.feegow_id, p.id);
  return { medicos, convenios, pacientes };
}

// ─── SYNC METADATA (skip patients to avoid timeout) ────────────
async function syncMetadata(supabase: any, clinicaId: string, headers: Record<string, string>, includePatients = false) {
  const result = { medicos: 0, salas: 0, convenios: 0, pacientes: 0, errors: [] as string[] };

  // Professionals
  try {
    const data = await feegowFetch(`${FEEGOW_BASE}/professional/list`, headers);
    const profs = data.content || [];
    for (const prof of (Array.isArray(profs) ? profs : [])) {
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

  // Treatment places (salas)
  try {
    const data = await feegowFetch(`${FEEGOW_BASE}/treatment-place/list`, headers);
    const places = data.content || [];
    for (const place of (Array.isArray(places) ? places : [])) {
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

  // Insurance (convênios)
  try {
    const data = await feegowFetch(`${FEEGOW_BASE}/insurance/list`, headers);
    const insurances = data.content || [];
    for (const ins of (Array.isArray(insurances) ? insurances : [])) {
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

  // Patients (optional - can be very large and cause timeouts)
  if (includePatients) {
    try {
      const data = await feegowFetch(`${FEEGOW_BASE}/patient/list`, headers);
      const patients = data.content || [];
      for (const pat of (Array.isArray(patients) ? patients : [])) {
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
  }

  return result;
}

// ─── SYNC SALES ────────────────────────────────────────────────
// Strategy: 
//   1. Use appoints/search (rich data: patient, doctor, procedure, status)
//   2. Build financial map from list-sales (invoice_id → amount)
//   3. Also auto-create patients found in appoints that don't exist yet
async function syncSales(
  supabase: any,
  clinicaId: string,
  headers: Record<string, string>,
  dateStart: string,
  dateEnd: string,
  unidadeId: number = 0
) {
  const stats = { processados: 0, criados: 0, atualizados: 0, ignorados: 0, erros: [] as string[], fonte: "", detalhes: {} as any };
  const requestHash = makeRequestHash(clinicaId, "sales", dateStart, dateEnd);

  const canProceed = await acquireLock(supabase, clinicaId, "sales", dateStart, dateEnd);
  if (!canProceed) {
    return { ...stats, erros: ["Sync já em andamento para este período."] };
  }

  const logId = await createLog(supabase, clinicaId, "feegow_sales", "sync_sales", "appoints/search+list-sales", requestHash);

  try {
    // ─── Step 1: Fetch financial data from list-sales ───
    const salesMap = new Map<number, { amount: number; timestamp: string; type: string }>();
    try {
      const url = `${FEEGOW_BASE}/financial/list-sales?date_start=${dateStart}&date_end=${dateEnd}&unidade_id=${unidadeId}`;
      const data = await feegowFetch(url, headers);
      const items = data.content || [];
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item.invoice_id) {
            salesMap.set(Number(item.invoice_id), {
              amount: Number(item.amount || 0),
              timestamp: item.timestamp || "",
              type: item.type || "gross",
            });
          }
        }
      }
      stats.detalhes.list_sales_count = salesMap.size;
    } catch (e: any) {
      stats.detalhes.list_sales_error = e.message;
    }

    // ─── Step 2: Fetch rich appointment data ───
    let appointments: any[] = [];
    try {
      const fd = toFeegowDate(dateStart);
      const td = toFeegowDate(dateEnd);
      const url = `${FEEGOW_BASE}/appoints/search?data_start=${fd}&data_end=${td}&list_procedures=1`;
      const data = await feegowFetch(url, headers);
      appointments = data.content || [];
      if (!Array.isArray(appointments)) appointments = [];
      stats.fonte = "appoints/search";
      stats.detalhes.appoints_count = appointments.length;
    } catch (e: any) {
      stats.erros.push(`appoints/search: ${e.message}`);
    }

    // ─── Step 3: Load FK lookups ───
    const lookups = await buildLookupMaps(supabase, clinicaId);

    // Status mapping
    const statusMap: Record<number, string> = {
      1: "agendado", 2: "confirmado", 3: "atendido", 4: "em_espera",
      5: "em_atendimento", 6: "faltou", 7: "cancelado_paciente",
      11: "cancelado", 16: "cancelado", 22: "agendado",
    };

    // ─── Step 4: Build upsert records ───
    const upsertBatch: any[] = [];
    const newPatients: Map<string, string> = new Map(); // feegow_id → name placeholder

    for (const appt of appointments) {
      stats.processados++;

      const feegowId = String(appt.agendamento_id || appt.id || "");
      if (!feegowId || feegowId === "0") {
        stats.ignorados++;
        continue;
      }

      const profId = appt.profissional_id || appt.professional_id;
      const convId = appt.convenio_id || appt.insurance_id;
      const patId = appt.paciente_id || appt.patient_id;

      // Parse date (DD-MM-YYYY → YYYY-MM-DD)
      let dataCompetencia = dateStart;
      const rawDate = appt.data || appt.date;
      if (rawDate) {
        if (rawDate.includes("-")) {
          const parts = rawDate.split("-");
          if (parts[0].length === 2) {
            // DD-MM-YYYY
            dataCompetencia = `${parts[2]}-${parts[1]}-${parts[0]}`;
          } else {
            dataCompetencia = rawDate;
          }
        }
      }

      // Get financial value - default to 0 if null/undefined
      const rawValor = appt.valor ?? appt.value ?? appt.valor_total_agendamento ?? 0;
      const valor = Number(rawValor) || 0;

      // Status
      const statusId = Number(appt.status_id || appt.status || 0);
      const statusPresenca = statusMap[statusId] || "agendado";

      // Auto-register patients not in our lookup
      if (patId && !lookups.pacientes.has(String(patId))) {
        newPatients.set(String(patId), appt.paciente_nome || appt.patient_name || "Paciente Feegow");
      }

      // Procedure info
      const procedimentos = appt.procedimentos || appt.procedures || [];
      const procedimentoNome = procedimentos.length > 0
        ? (procedimentos[0].nome || procedimentos[0].name || `Proc#${procedimentos[0].procedimentoID || procedimentos[0].procedure_id || ""}`)
        : null;

      upsertBatch.push({
        clinica_id: clinicaId,
        feegow_id: feegowId,
        invoice_id: null, // appoints don't have invoice_id
        origem: "feegow_appoints",
        data_competencia: dataCompetencia,
        valor_bruto: valor,
        descricao: procedimentoNome || appt.notas || appt.notes || null,
        procedimento: procedimentoNome,
        especialidade: appt.especialidade_nome || null,
        medico_id: profId ? (lookups.medicos.get(String(profId)) || null) : null,
        convenio_id: convId ? (lookups.convenios.get(String(convId)) || null) : null,
        paciente_id: patId ? (lookups.pacientes.get(String(patId)) || null) : null,
        forma_pagamento: null, // appoints don't have payment info
        forma_pagamento_enum: null,
        status_presenca: statusPresenca,
        parcelas: 1,
        quantidade: procedimentos.length || 1,
      });
    }

    // ─── Step 4b: Also process list-sales invoices that have financial data ───
    // Create records from list-sales for invoices not covered by appoints
    for (const [invoiceId, sale] of salesMap) {
      // Parse timestamp to date
      let dataComp = dateStart;
      if (sale.timestamp) {
        const datePart = sale.timestamp.split(" ")[0]; // "2026-01-02 13:58:17" → "2026-01-02"
        if (datePart) dataComp = datePart;
      }

      upsertBatch.push({
        clinica_id: clinicaId,
        feegow_id: `inv_${invoiceId}`,
        invoice_id: String(invoiceId),
        origem: "feegow_sales",
        data_competencia: dataComp,
        valor_bruto: sale.amount,
        descricao: `Invoice #${invoiceId}`,
        procedimento: null,
        especialidade: null,
        medico_id: null,
        convenio_id: null,
        paciente_id: null,
        forma_pagamento: null,
        forma_pagamento_enum: null,
        status_presenca: null,
        parcelas: 1,
        quantidade: 1,
      });
      stats.processados++;
    }

    // ─── Step 5: Auto-create missing patients ───
    if (newPatients.size > 0) {
      const patBatch = Array.from(newPatients.entries()).map(([fid, nome]) => ({
        clinica_id: clinicaId,
        feegow_id: fid,
        nome,
      }));
      const { data: created } = await supabase
        .from("pacientes")
        .upsert(patBatch, { onConflict: "clinica_id,feegow_id" })
        .select("id, feegow_id");
      if (created) {
        for (const p of created) {
          if (p.feegow_id) lookups.pacientes.set(p.feegow_id, p.id);
        }
        // Update paciente_id in batch
        for (const rec of upsertBatch) {
          if (!rec.paciente_id && rec.origem === "feegow_appoints") {
            // Try to find the patient from the appt data
            const appt = appointments.find(a => String(a.agendamento_id || a.id) === rec.feegow_id);
            if (appt) {
              const patFid = String(appt.paciente_id || appt.patient_id || "");
              if (patFid && lookups.pacientes.has(patFid)) {
                rec.paciente_id = lookups.pacientes.get(patFid);
              }
            }
          }
        }
      }
      stats.detalhes.patients_auto_created = newPatients.size;
    }

    // ─── Step 6: Upsert in batches of 100 ───
    const BATCH_SIZE = 100;
    for (let i = 0; i < upsertBatch.length; i += BATCH_SIZE) {
      const batch = upsertBatch.slice(i, i + BATCH_SIZE);
      const { data: upserted, error } = await supabase
        .from("transacoes_vendas")
        .upsert(batch, { onConflict: "clinica_id,feegow_id", ignoreDuplicates: false })
        .select("id");

      if (error) {
        stats.erros.push(`Upsert batch ${i / BATCH_SIZE + 1}: ${error.message}`);
        // Fallback one-by-one
        for (const record of batch) {
          const { data: existing } = await supabase
            .from("transacoes_vendas")
            .select("id")
            .eq("clinica_id", clinicaId)
            .eq("feegow_id", record.feegow_id)
            .maybeSingle();
          if (existing) {
            const { error: upErr } = await supabase.from("transacoes_vendas").update(record).eq("id", existing.id);
            if (upErr) stats.erros.push(`Update ${record.feegow_id}: ${upErr.message}`);
            else stats.atualizados++;
          } else {
            const { error: insErr } = await supabase.from("transacoes_vendas").insert(record);
            if (insErr) stats.erros.push(`Insert ${record.feegow_id}: ${insErr.message}`);
            else stats.criados++;
          }
        }
      } else {
        stats.atualizados += (upserted?.length || batch.length);
      }
    }

    stats.detalhes = {
      ...stats.detalhes,
      dateStart, dateEnd, unidadeId,
      total_appoints: appointments.length,
      total_invoices: salesMap.size,
      total_batch: upsertBatch.length,
    };

    await finishLog(supabase, logId, stats.erros.length > 0 ? "erro_parcial" : "sucesso", stats);
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

    // ── Metadata sync (skip patients by default to avoid timeout) ──
    if (action === "full" || action === "metadata") {
      const includePatients = body.include_patients === true;
      const logId = await createLog(supabase, clinicaId, "feegow_metadata", "sync_metadata", "professional+salas+insurance");
      const metaResult = await syncMetadata(supabase, clinicaId, feegowHeaders, includePatients);
      await finishLog(supabase, logId, metaResult.errors.length > 0 ? "erro_parcial" : "sucesso", {
        processados: metaResult.medicos + metaResult.salas + metaResult.convenios + metaResult.pacientes,
        criados: metaResult.medicos + metaResult.salas + metaResult.convenios + metaResult.pacientes,
        erros: metaResult.errors,
        detalhes: metaResult,
      });
      response.metadata = metaResult;
    }

    // ── Sales sync (weekly chunks to avoid timeout) ──
    if (action === "full" || action === "sales") {
      const end = dateEnd || new Date().toISOString().split("T")[0];
      const start = dateStart || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

      // Split into weekly chunks to avoid timeout
      const chunks: { start: string; end: string }[] = [];
      let chunkStart = new Date(start);
      const endDate = new Date(end);
      while (chunkStart <= endDate) {
        const chunkEnd = new Date(chunkStart);
        chunkEnd.setDate(chunkEnd.getDate() + 6);
        if (chunkEnd > endDate) chunkEnd.setTime(endDate.getTime());
        chunks.push({
          start: chunkStart.toISOString().split("T")[0],
          end: chunkEnd.toISOString().split("T")[0],
        });
        chunkStart = new Date(chunkEnd);
        chunkStart.setDate(chunkStart.getDate() + 1);
      }

      const allResults: any[] = [];
      const totalStats = { processados: 0, criados: 0, atualizados: 0, ignorados: 0, erros: [] as string[], fonte: "" };

      for (const chunk of chunks) {
        const chunkResult = await syncSales(supabase, clinicaId, feegowHeaders, chunk.start, chunk.end, unidadeId);
        allResults.push({ ...chunk, ...chunkResult });
        totalStats.processados += chunkResult.processados;
        totalStats.criados += chunkResult.criados;
        totalStats.atualizados += chunkResult.atualizados;
        totalStats.ignorados += chunkResult.ignorados;
        totalStats.erros.push(...chunkResult.erros);
        if (chunkResult.fonte) totalStats.fonte = chunkResult.fonte;
      }

      response.sales = { ...totalStats, chunks: allResults };
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
