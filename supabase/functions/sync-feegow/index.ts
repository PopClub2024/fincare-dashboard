import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FEEGOW_BASE = "https://api.feegow.com/v1/api";

// ─── Helpers ────────────────────────────────────────────────────
function toFeegowDate(iso: string): string {
  // YYYY-MM-DD → DD-MM-YYYY
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

async function createLog(supabase: any, clinicaId: string, integracao: string, acao: string, endpoint: string) {
  const { data } = await supabase
    .from("integracao_logs")
    .insert({ clinica_id: clinicaId, integracao, acao, endpoint, status: "em_andamento" })
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
      // 401/403: fail immediately, no retry
      if (res.status === 401 || res.status === 403) {
        throw new Error(`AUTH_ERROR: HTTP ${res.status} - Token inválido ou sem permissão`);
      }
      // 429 or 5xx: retry with backoff
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
      if (e.message?.startsWith("AUTH_ERROR:")) throw e;
      lastError = e;
      if (attempt < maxRetries - 1) {
        const waitMs = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(r => setTimeout(r, waitMs));
      }
    }
  }
  throw lastError || new Error("Max retries exceeded");
}

// ─── SYNC METADATA ─────────────────────────────────────────────
async function syncMetadata(supabase: any, clinicaId: string, headers: Record<string, string>) {
  const result = { medicos: 0, salas: 0, convenios: 0, pacientes: 0, errors: [] as string[] };

  // Médicos
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
  } catch (e) { result.errors.push(`Médicos: ${e.message}`); }

  // Salas
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
  } catch (e) { result.errors.push(`Salas: ${e.message}`); }

  // Convênios
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
  } catch (e) { result.errors.push(`Convênios: ${e.message}`); }

  // Pacientes
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
  } catch (e) { result.errors.push(`Pacientes: ${e.message}`); }

  return result;
}

// ─── SYNC SALES ────────────────────────────────────────────────
// Strategy: Try /financial/list-sales first (internal Feegow endpoint).
// Fallback: /appoints/search with list_procedures=1 (documented public API).
async function syncSales(
  supabase: any,
  clinicaId: string,
  headers: Record<string, string>,
  dateStart: string,
  dateEnd: string,
  unidadeId: number = 0
) {
  const stats = { processados: 0, criados: 0, atualizados: 0, ignorados: 0, erros: [] as string[], fonte: "" };
  const logId = await createLog(supabase, clinicaId, "feegow_sales", "sync_sales", "financial/list-sales|appoints/search");

  try {
    let sales: any[] = [];
    let fonte = "";

    // ─── Attempt 1: /financial/list-sales (multiple path/param variations)
    const variations = [
      // date_start YYYY-MM-DD
      `${FEEGOW_BASE}/financial/list-sales?date_start=${dateStart}&date_end=${dateEnd}&unidade_id=${unidadeId}`,
      // data_start DD-MM-YYYY (Feegow pattern)
      `${FEEGOW_BASE}/financial/list-sales?data_start=${toFeegowDate(dateStart)}&data_end=${toFeegowDate(dateEnd)}&unidade_id=${unidadeId}`,
      // Without /api/ prefix
      `https://api.feegow.com/v1/financial/list-sales?date_start=${dateStart}&date_end=${dateEnd}&unidade_id=${unidadeId}`,
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
        // If success but empty, try next variation
        if (data.success === true) {
          fonte = "financial/list-sales";
          break;
        }
      } catch {
        // Try next variation
      }
    }

    // ─── Attempt 2: Fallback to /appoints/search (documented, confirmed working)
    if (sales.length === 0 && fonte === "") {
      try {
        const url = `${FEEGOW_BASE}/appoints/search?data_start=${toFeegowDate(dateStart)}&data_end=${toFeegowDate(dateEnd)}&list_procedures=1`;
        const data = await feegowFetch(url, headers);
        sales = data.content || [];
        fonte = "appoints/search";
      } catch (e) {
        stats.erros.push(`Fallback appoints/search: ${e.message}`);
      }
    }

    stats.fonte = fonte;

    // ─── Process sales ──────────────────────────────────────
    for (const sale of sales) {
      stats.processados++;

      // Determine the Feegow ID based on source
      const feegowId = String(
        sale.sale_id || sale.agendamento_id || sale.schedule_id || sale.id || ""
      );
      if (!feegowId) {
        stats.ignorados++;
        continue;
      }

      // Resolve medico_id
      let medicoId: string | null = null;
      const profId = sale.professional_id || sale.profissional_id;
      if (profId) {
        const { data: med } = await supabase
          .from("medicos").select("id")
          .eq("clinica_id", clinicaId)
          .eq("feegow_id", String(profId))
          .maybeSingle();
        medicoId = med?.id ?? null;
      }

      // Resolve convenio_id
      let convenioId: string | null = null;
      const insId = sale.insurance_id || sale.convenio_id;
      if (insId) {
        const { data: conv } = await supabase
          .from("convenios").select("id")
          .eq("clinica_id", clinicaId)
          .eq("feegow_id", String(insId))
          .maybeSingle();
        convenioId = conv?.id ?? null;
      }

      // Resolve paciente_id
      let pacienteId: string | null = null;
      const patId = sale.patient_id || sale.paciente_id;
      if (patId) {
        const { data: pac } = await supabase
          .from("pacientes").select("id")
          .eq("clinica_id", clinicaId)
          .eq("feegow_id", String(patId))
          .maybeSingle();
        pacienteId = pac?.id ?? null;
      }

      // Payment method mapping
      const pmMap: Record<string, string> = {
        "1": "dinheiro", "2": "cartao_debito", "3": "cartao_credito",
        "4": "cheque", "5": "deposito", "6": "transferencia",
        "7": "boleto", "11": "debito_automatico", "15": "pix",
      };
      const pmId = String(sale.payment_method || sale.forma_pagamento_id || "");
      const formaPagamento = pmMap[pmId] || sale.payment_method_name || sale.forma_pagamento || null;

      // forma_pagamento_enum
      let fpEnum: string | null = null;
      if (["2"].includes(pmId)) fpEnum = "cartao_debito";
      else if (["3"].includes(pmId)) fpEnum = "cartao_credito";
      else if (["15"].includes(pmId)) fpEnum = "pix";
      else if (["1"].includes(pmId)) fpEnum = "dinheiro";
      else if (["7"].includes(pmId)) fpEnum = "boleto";
      else if (["5", "6"].includes(pmId)) fpEnum = "transferencia";

      // Status presença (from appoints)
      let statusPresenca: string | null = null;
      const statusId = sale.status_id || sale.status;
      if (statusId) {
        const sid = Number(statusId);
        if (sid === 3) statusPresenca = "atendido";
        else if (sid === 6) statusPresenca = "faltou";
        else if ([11, 16].includes(sid)) statusPresenca = "cancelado";
        else if ([1, 7].includes(sid)) statusPresenca = "confirmado";
        else statusPresenca = "confirmado";
      }

      // Determine date - Feegow appoints use DD-MM-YYYY, financial uses YYYY-MM-DD
      let dataCompetencia = dateStart;
      const rawDate = sale.date || sale.data;
      if (rawDate) {
        if (rawDate.includes("-") && rawDate.length === 10) {
          // Could be YYYY-MM-DD or DD-MM-YYYY
          const parts = rawDate.split("-");
          if (parts[0].length === 4) {
            dataCompetencia = rawDate; // YYYY-MM-DD
          } else {
            dataCompetencia = `${parts[2]}-${parts[1]}-${parts[0]}`; // DD-MM-YYYY → YYYY-MM-DD
          }
        }
      }

      const valor = Number(sale.total_value || sale.value || sale.valor || 0);

      const vendaData: Record<string, any> = {
        clinica_id: clinicaId,
        feegow_id: feegowId,
        invoice_id: sale.invoice_id ? String(sale.invoice_id) : null,
        origem: fonte === "financial/list-sales" ? "feegow_sales" : "feegow_appoints",
        data_competencia: dataCompetencia,
        valor_bruto: valor,
        descricao: sale.procedure_name || sale.procedimento_nome || sale.notes || sale.notas || null,
        procedimento: sale.procedure_name || sale.procedimento_nome || null,
        especialidade: sale.specialty_name || sale.especialidade_nome || null,
        medico_id: medicoId,
        convenio_id: convenioId,
        paciente_id: pacienteId,
        forma_pagamento: formaPagamento,
        forma_pagamento_enum: fpEnum,
        status_presenca: statusPresenca,
        parcelas: sale.installments ? Number(sale.installments) : 1,
        quantidade: sale.quantity ? Number(sale.quantity) : 1,
      };

      // Idempotency: check by feegow_id
      const { data: existing } = await supabase
        .from("transacoes_vendas")
        .select("id")
        .eq("clinica_id", clinicaId)
        .eq("feegow_id", feegowId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("transacoes_vendas")
          .update(vendaData)
          .eq("id", existing.id);
        if (error) stats.erros.push(`Update ${feegowId}: ${error.message}`);
        else stats.atualizados++;
      } else {
        const { error } = await supabase
          .from("transacoes_vendas")
          .insert(vendaData);
        if (error) stats.erros.push(`Insert ${feegowId}: ${error.message}`);
        else stats.criados++;
      }
    }

    await finishLog(supabase, logId, stats.erros.length > 0 ? "erro_parcial" : "sucesso", {
      ...stats,
      detalhes: { dateStart, dateEnd, unidadeId, fonte, total: sales.length },
    });
  } catch (e) {
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
    const action = body.action || "full"; // "full" | "metadata" | "sales"
    const dateStart = body.date_start;
    const dateEnd = body.date_end;
    const unidadeId = body.unidade_id ?? 0;

    if (!clinicaId) {
      return new Response(JSON.stringify({ error: "clinica_id obrigatório" }), {
        status: 400,
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
  } catch (e) {
    console.error("sync-feegow error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
