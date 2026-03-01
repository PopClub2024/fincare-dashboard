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
        throw new Error(`AUTH_ERROR: HTTP ${res.status}`);
      }
      if (res.status === 429 || res.status >= 500) {
        await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, attempt), 10000)));
        lastError = new Error(`HTTP ${res.status}: ${text.substring(0, 200)}`);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.substring(0, 500)}`);
      try { return JSON.parse(text); } catch { return { content: text }; }
    } catch (e) {
      if ((e as Error).message?.startsWith("AUTH_ERROR:")) throw e;
      lastError = e as Error;
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, attempt), 10000)));
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

// ─── FK Lookups ────────────────────────────────────────────────
async function buildLookupMaps(supabase: any, clinicaId: string) {
  const [medicosRes, conveniosRes, pacientesRes] = await Promise.all([
    supabase.from("medicos").select("id, feegow_id, especialidade").eq("clinica_id", clinicaId),
    supabase.from("convenios").select("id, feegow_id, nome").eq("clinica_id", clinicaId),
    supabase.from("pacientes").select("id, feegow_id").eq("clinica_id", clinicaId),
  ]);

  const medicos = new Map<string, { id: string; especialidade: string | null }>();
  for (const m of (medicosRes.data || [])) if (m.feegow_id) medicos.set(m.feegow_id, { id: m.id, especialidade: m.especialidade });
  const convenios = new Map<string, { id: string; nome: string }>();
  for (const c of (conveniosRes.data || [])) if (c.feegow_id) convenios.set(c.feegow_id, { id: c.id, nome: c.nome });
  const pacientes = new Map<string, string>();
  for (const p of (pacientesRes.data || [])) if (p.feegow_id) pacientes.set(p.feegow_id, p.id);
  return { medicos, convenios, pacientes };
}

// ─── Payment form mapping ──────────────────────────────────────
function mapFormaPagamento(feegowId: number | null, description?: any): string | null {
  const map: Record<number, string> = {
    1: "dinheiro", 2: "cartao_credito", 3: "cartao_debito",
    4: "pix", 5: "convenio_nf", 6: "dinheiro",
  };
  if (feegowId && map[feegowId]) return map[feegowId];
  const desc = String(description || "").toLowerCase();
  if (desc.includes("pix")) return "pix";
  if (desc.includes("créd") || desc.includes("credit")) return "cartao_credito";
  if (desc.includes("débi") || desc.includes("debit")) return "cartao_debito";
  if (desc.includes("dinh") || desc.includes("cash")) return "dinheiro";
  if (desc.includes("convên") || desc.includes("nf")) return "convenio_nf";
  return null;
}

// ─── SYNC METADATA ─────────────────────────────────────────────
async function syncMetadata(supabase: any, clinicaId: string, headers: Record<string, string>) {
  const result = { medicos: 0, salas: 0, convenios: 0, errors: [] as string[] };

  try {
    const data = await feegowFetch(`${FEEGOW_BASE}/professional/list`, headers);
    const profs = data.content || [];
    for (const prof of (Array.isArray(profs) ? profs : [])) {
      const fid = String(prof.profissional_id || prof.professional_id || prof.id || "");
      const espArr = prof.especialidades || [];
      const espNome = Array.isArray(espArr) && espArr.length > 0 ? espArr[0].nome_especialidade : (prof.specialty_name || null);
      const { error } = await supabase.from("medicos").upsert({
        clinica_id: clinicaId,
        feegow_id: fid,
        nome: prof.nome || prof.name || "Sem nome",
        especialidade: espNome,
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

  return result;
}

// ─── Fetch ALL appoints with pagination ────────────────────────
async function fetchAllAppoints(headers: Record<string, string>, dateStart: string, dateEnd: string): Promise<any[]> {
  const fd = toFeegowDate(dateStart);
  const td = toFeegowDate(dateEnd);
  const all: any[] = [];
  let page = 1;
  const maxPages = 50; // safety

  while (page <= maxPages) {
    try {
      const url = `${FEEGOW_BASE}/appoints/search?data_start=${fd}&data_end=${td}&list_procedures=1&page=${page}&perPage=200`;
      const data = await feegowFetch(url, headers);
      const content = data.content;
      let items: any[] = [];
      if (Array.isArray(content)) {
        items = content;
      } else if (content && typeof content === "object") {
        // content could be object keyed by date or id
        items = Object.values(content).flat();
      }
      if (items.length === 0) break;
      all.push(...items);
      // If we got fewer than perPage, no more pages
      if (items.length < 200) break;
      page++;
    } catch (e) {
      console.error(`appoints page ${page} error:`, e);
      break;
    }
  }
  return all;
}

// ─── Fetch ALL sales with pagination ───────────────────────────
async function fetchAllSales(headers: Record<string, string>, dateStart: string, dateEnd: string): Promise<any[]> {
  const all: any[] = [];
  let page = 1;
  while (page <= 20) {
    try {
      const url = `${FEEGOW_BASE}/financial/list-sales?date_start=${dateStart}&date_end=${dateEnd}&unidade_id=0&page=${page}&perPage=500`;
      const data = await feegowFetch(url, headers);
      const items = Array.isArray(data.content) ? data.content : [];
      if (items.length === 0) break;
      all.push(...items);
      if (items.length < 500) break;
      page++;
    } catch {
      break;
    }
  }
  return all;
}

// ─── Fetch invoices for financial detail ───────────────────────
async function fetchInvoices(headers: Record<string, string>, dateStart: string, dateEnd: string): Promise<any[]> {
  const fd = toFeegowDate(dateStart);
  const td = toFeegowDate(dateEnd);
  try {
    const url = `${FEEGOW_BASE}/financial/list-invoice?data_start=${fd}&data_end=${td}&tipo_transacao=C`;
    const data = await feegowFetch(url, headers);
    const content = data.content;
    if (Array.isArray(content)) return content;
    if (content && typeof content === "object") return Object.values(content);
    return [];
  } catch {
    return [];
  }
}

// ─── MAIN SYNC: Appoints + Sales/Invoices cross-reference ─────
async function syncPeriod(
  supabase: any,
  clinicaId: string,
  headers: Record<string, string>,
  dateStart: string,
  dateEnd: string,
) {
  const stats = {
    processados: 0, criados: 0, atualizados: 0, ignorados: 0,
    erros: [] as string[], detalhes: {} as any,
    itens_criados: 0, pagamentos_criados: 0,
  };

  const canProceed = await acquireLock(supabase, clinicaId, "sync", dateStart, dateEnd);
  if (!canProceed) return { ...stats, erros: ["Sync já em andamento para este período."] };

  const logId = await createLog(supabase, clinicaId, "feegow_sales", "sync_period", "appoints+sales+invoices", makeRequestHash(clinicaId, "sync", dateStart, dateEnd));

  try {
    const lookups = await buildLookupMaps(supabase, clinicaId);

    // ── Step 1: Fetch all data sources in parallel ──
    const [appoints, sales, invoices] = await Promise.all([
      fetchAllAppoints(headers, dateStart, dateEnd),
      fetchAllSales(headers, dateStart, dateEnd),
      fetchInvoices(headers, dateStart, dateEnd),
    ]);

    stats.detalhes.appoints_count = appoints.length;
    stats.detalhes.sales_count = sales.length;
    stats.detalhes.invoices_count = invoices.length;

    // ── Step 2: Build sales lookup by invoice_id ──
    const salesByInvoice = new Map<number, { amount: number; timestamp: string }>();
    for (const s of sales) {
      if (s.invoice_id) {
        salesByInvoice.set(Number(s.invoice_id), {
          amount: Number(s.amount || 0) || 0,
          timestamp: s.timestamp || "",
        });
      }
    }

    // ── Step 3: Build invoice lookup by id ──
    const invoiceById = new Map<string, any>();
    for (const inv of invoices) {
      const id = String(inv.invoice_id || inv.id || inv.fatura_id || "");
      if (id) invoiceById.set(id, inv);
    }

    // ── Step 4: Process each appointment ──
    const newPatients = new Map<string, string>();
    const vendaBatch: any[] = [];
    const itemBatch: any[] = [];
    const pagBatch: any[] = [];
    const seenFeegow = new Set<string>();

    for (const appt of appoints) {
      const feegowId = String(appt.agendamento_id || appt.id || "");
      if (!feegowId || seenFeegow.has(feegowId)) continue;
      seenFeegow.add(feegowId);
      stats.processados++;

      // Parse date (DD-MM-YYYY → YYYY-MM-DD)
      let dataComp = dateStart;
      const rawDate = appt.data || appt.date || "";
      if (rawDate) {
        if (rawDate.includes("-") && rawDate.split("-")[0].length === 2) {
          const [d, m, y] = rawDate.split("-");
          dataComp = `${y}-${m}-${d}`;
        } else if (rawDate.includes("-")) {
          dataComp = rawDate.split(" ")[0];
        }
      }

      // Doctor & Specialty
      const profFid = String(appt.profissional_id || appt.professional_id || "");
      let medicoId: string | null = null;
      let especialidade: string | null = null;
      if (profFid && lookups.medicos.has(profFid)) {
        const med = lookups.medicos.get(profFid)!;
        medicoId = med.id;
        especialidade = med.especialidade;
      }

      // Patient
      const patFid = String(appt.paciente_id || appt.patient_id || "");
      let pacienteId: string | null = null;
      if (patFid && lookups.pacientes.has(patFid)) {
        pacienteId = lookups.pacientes.get(patFid)!;
      } else if (patFid) {
        newPatients.set(patFid, "Paciente Feegow");
      }

      // Convenio
      const convFid = String(appt.convenio_id || "");
      let convenioId: string | null = null;
      let convenioNome: string | null = null;
      if (convFid && lookups.convenios.has(convFid)) {
        const conv = lookups.convenios.get(convFid)!;
        convenioId = conv.id;
        convenioNome = conv.nome;
      }

      // Procedure
      const procs = appt.procedimentos || appt.procedures || [];
      const procNome = procs[0]?.nome || procs[0]?.name || null;
      const procId = procs[0]?.procedimentoID || procs[0]?.procedimento_id || appt.procedimento_id || null;

      // Financial: try to find matching invoice or sale
      // The appt may not have invoice_id directly, try cross-ref
      let valorBruto = Number(appt.valor || appt.value || appt.valor_total_agendamento || 0) || 0;
      let desconto = 0;
      let valorPago = 0;
      let formaPagEnum: string | null = null;

      // Check if there's a linked invoice (by invoice_id if present)
      const invId = appt.invoice_id || appt.fatura_id;
      if (invId) {
        const sale = salesByInvoice.get(Number(invId));
        if (sale && sale.amount > 0) valorBruto = sale.amount;

        const inv = invoiceById.get(String(invId));
        if (inv) {
          if (!valorBruto) valorBruto = Number(inv.total || inv.amount || inv.valor || 0) || 0;
          desconto = Number(inv.discount || inv.desconto || 0) || 0;

          // Process payments from invoice
          const payments = inv.payments || inv.pagamentos || [];
          if (Array.isArray(payments)) {
            for (let idx = 0; idx < payments.length; idx++) {
              const pmt = payments[idx];
              const pmtValor = Number(pmt.amount || pmt.valor || pmt.value || 0) || 0;
              valorPago += pmtValor;
              const fmtId = Number(pmt.forma_pagamento_id || pmt.payment_method_id || 0);
              const fmtEnum = mapFormaPagamento(fmtId, pmt.payment_method || pmt.forma_pagamento);
              if (!formaPagEnum && fmtEnum) formaPagEnum = fmtEnum;

              pagBatch.push({
                clinica_id: clinicaId,
                feegow_invoice_id: String(invId),
                feegow_payment_id: String(pmt.payment_id || pmt.id || `${invId}_p${idx}`),
                data_pagamento: dataComp,
                forma_pagamento_feegow_id: fmtId || null,
                forma_pagamento: fmtEnum,
                valor_pago: pmtValor,
                parcelas: Number(pmt.installments || pmt.parcelas || 1) || 1,
                bandeira: pmt.brand || pmt.bandeira || null,
                nsu_tid_autorizacao: pmt.nsu || pmt.tid || pmt.authorization || null,
              });
            }
          }
        }
      }

      // Status
      const statusMap: Record<number, string> = {
        1: "agendado", 2: "confirmado", 3: "atendido", 4: "em_espera",
        5: "em_atendimento", 6: "faltou", 7: "cancelado_paciente", 11: "cancelado", 16: "cancelado",
        22: "atendido",
      };
      const statusPresenca = statusMap[Number(appt.status_id || 0)] || "agendado";

      // Status recebimento
      const statusRecebimento = valorPago >= valorBruto && valorBruto > 0 ? "recebido" : "a_receber";

      // vendas_itens
      itemBatch.push({
        clinica_id: clinicaId,
        feegow_invoice_id: String(invId || feegowId),
        feegow_item_id: `${feegowId}_0`,
        data_competencia: dataComp,
        procedimento_id: procId ? String(procId) : null,
        procedimento_nome: procNome,
        tipo: null,
        quantidade: procs.length || 1,
        valor_bruto_item: valorBruto,
        desconto_item: desconto,
        valor_liquido_item: valorBruto - desconto,
        medico_id: medicoId,
        especialidade,
        convenio: convenioNome,
      });

      // transacoes_vendas (valor_liquido is GENERATED, don't include)
      vendaBatch.push({
        clinica_id: clinicaId,
        feegow_id: feegowId,
        invoice_id: invId ? String(invId) : null,
        origem: "feegow",
        data_competencia: dataComp,
        valor_bruto: valorBruto,
        desconto,
        valor_pago: valorPago,
        descricao: procNome || `Agendamento #${feegowId}`,
        procedimento: procNome,
        especialidade,
        medico_id: medicoId,
        convenio_id: convenioId,
        paciente_id: pacienteId,
        forma_pagamento_enum: formaPagEnum,
        status_presenca: statusPresenca,
        status_recebimento: statusRecebimento,
        quantidade: procs.length || 1,
        parcelas: 1,
      });
    }

    // ── Also process invoices NOT matched to any appt ──
    for (const inv of invoices) {
      const invId = String(inv.invoice_id || inv.id || inv.fatura_id || "");
      // Check if already processed via appt
      if (!invId) continue;
      const fgId = `inv_${invId}`;
      if (seenFeegow.has(fgId)) continue;
      seenFeegow.add(fgId);
      stats.processados++;

      let dataComp = dateStart;
      const rawDate = inv.date || inv.data || inv.created_at || inv.timestamp || "";
      if (rawDate) {
        if (rawDate.includes("-") && rawDate.split("-")[0].length === 2) {
          const [d, m, y] = rawDate.split("-");
          dataComp = `${y}-${m}-${d}`;
        } else if (rawDate.includes("-")) {
          dataComp = rawDate.split(" ")[0];
        } else if (rawDate.includes("/")) {
          const [d, m, y] = rawDate.split("/");
          dataComp = `${y}-${m}-${d}`;
        }
      }

      const valorBruto = Number(inv.total || inv.amount || inv.valor || 0) || 0;
      const desconto = Number(inv.discount || inv.desconto || 0) || 0;
      let valorPago = 0;
      let formaPagEnum: string | null = null;

      const payments = inv.payments || inv.pagamentos || [];
      if (Array.isArray(payments)) {
        for (let idx = 0; idx < payments.length; idx++) {
          const pmt = payments[idx];
          const pmtValor = Number(pmt.amount || pmt.valor || pmt.value || 0) || 0;
          valorPago += pmtValor;
          const fmtId = Number(pmt.forma_pagamento_id || pmt.payment_method_id || 0);
          const fmtEnum = mapFormaPagamento(fmtId, pmt.payment_method || pmt.forma_pagamento);
          if (!formaPagEnum && fmtEnum) formaPagEnum = fmtEnum;

          pagBatch.push({
            clinica_id: clinicaId,
            feegow_invoice_id: invId,
            feegow_payment_id: String(pmt.payment_id || pmt.id || `${invId}_p${idx}`),
            data_pagamento: dataComp,
            forma_pagamento_feegow_id: fmtId || null,
            forma_pagamento: fmtEnum,
            valor_pago: pmtValor,
            parcelas: Number(pmt.installments || pmt.parcelas || 1) || 1,
            bandeira: pmt.brand || pmt.bandeira || null,
            nsu_tid_autorizacao: pmt.nsu || pmt.tid || pmt.authorization || null,
          });
        }
      }

      // Doctor from invoice
      const profFid = String(inv.professional_id || inv.profissional_id || "");
      let medicoId: string | null = null;
      let especialidade: string | null = null;
      if (profFid && lookups.medicos.has(profFid)) {
        const med = lookups.medicos.get(profFid)!;
        medicoId = med.id;
        especialidade = med.especialidade;
      }

      const patFid = String(inv.patient_id || inv.paciente_id || "");
      let pacienteId: string | null = null;
      if (patFid && lookups.pacientes.has(patFid)) {
        pacienteId = lookups.pacientes.get(patFid)!;
      }

      itemBatch.push({
        clinica_id: clinicaId,
        feegow_invoice_id: invId,
        feegow_item_id: `${invId}_0`,
        data_competencia: dataComp,
        procedimento_id: null,
        procedimento_nome: inv.description || inv.descricao || null,
        tipo: null,
        quantidade: 1,
        valor_bruto_item: valorBruto,
        desconto_item: desconto,
        valor_liquido_item: valorBruto - desconto,
        medico_id: medicoId,
        especialidade,
        convenio: null,
      });

      vendaBatch.push({
        clinica_id: clinicaId,
        feegow_id: fgId,
        invoice_id: invId,
        origem: "feegow_invoice",
        data_competencia: dataComp,
        valor_bruto: valorBruto,
        desconto,
        valor_pago: valorPago,
        descricao: inv.description || inv.descricao || `Invoice #${invId}`,
        procedimento: inv.description || null,
        especialidade,
        medico_id: medicoId,
        paciente_id: pacienteId,
        forma_pagamento_enum: formaPagEnum,
        status_recebimento: valorPago >= valorBruto && valorBruto > 0 ? "recebido" : "a_receber",
        quantidade: 1,
        parcelas: 1,
      });
    }

    // ── Auto-create missing patients ──
    if (newPatients.size > 0) {
      const patBatch = Array.from(newPatients.entries()).map(([fid, nome]) => ({
        clinica_id: clinicaId, feegow_id: fid, nome,
      }));
      const { data: created } = await supabase
        .from("pacientes")
        .upsert(patBatch, { onConflict: "clinica_id,feegow_id" })
        .select("id, feegow_id");
      if (created) {
        for (const p of created) {
          if (p.feegow_id) lookups.pacientes.set(p.feegow_id, p.id);
        }
        // Backfill paciente_id
        for (const v of vendaBatch) {
          if (!v.paciente_id) {
            const appt = appoints.find((a: any) => String(a.agendamento_id || a.id) === v.feegow_id);
            if (appt) {
              const pf = String(appt.paciente_id || "");
              if (pf && lookups.pacientes.has(pf)) v.paciente_id = lookups.pacientes.get(pf)!;
            }
          }
        }
      }
      stats.detalhes.patients_auto_created = newPatients.size;
    }

    // ── Batch upserts ──
    const BATCH = 100;

    for (let i = 0; i < itemBatch.length; i += BATCH) {
      const batch = itemBatch.slice(i, i + BATCH);
      const { error } = await supabase
        .from("vendas_itens")
        .upsert(batch, { onConflict: "clinica_id,feegow_invoice_id,feegow_item_id" });
      if (error) stats.erros.push(`vendas_itens: ${error.message}`);
      else stats.itens_criados += batch.length;
    }

    for (let i = 0; i < pagBatch.length; i += BATCH) {
      const batch = pagBatch.slice(i, i + BATCH);
      const { error } = await supabase
        .from("vendas_pagamentos")
        .upsert(batch, { onConflict: "clinica_id,feegow_invoice_id,feegow_payment_id" });
      if (error) stats.erros.push(`vendas_pagamentos: ${error.message}`);
      else stats.pagamentos_criados += batch.length;
    }

    for (let i = 0; i < vendaBatch.length; i += BATCH) {
      const batch = vendaBatch.slice(i, i + BATCH);
      const { data: upserted, error } = await supabase
        .from("transacoes_vendas")
        .upsert(batch, { onConflict: "clinica_id,feegow_id", ignoreDuplicates: false })
        .select("id");
      if (error) {
        // Fallback one-by-one
        for (const record of batch) {
          const { data: existing } = await supabase
            .from("transacoes_vendas").select("id")
            .eq("clinica_id", clinicaId).eq("feegow_id", record.feegow_id).maybeSingle();
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
      dateStart, dateEnd,
      total_vendas: vendaBatch.length,
      total_items: itemBatch.length,
      total_payments: pagBatch.length,
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

    if (!clinicaId) {
      return new Response(JSON.stringify({ error: "clinica_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!feegowApiKey) {
      return new Response(JSON.stringify({ error: "FEEGOW_API_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response: Record<string, any> = { success: true };

    // Metadata sync
    if (action === "full" || action === "metadata") {
      const logId = await createLog(supabase, clinicaId, "feegow_metadata", "sync_metadata", "professional+salas+insurance");
      const metaResult = await syncMetadata(supabase, clinicaId, feegowHeaders);
      await finishLog(supabase, logId, metaResult.errors.length > 0 ? "erro_parcial" : "sucesso", {
        processados: metaResult.medicos + metaResult.salas + metaResult.convenios,
        criados: metaResult.medicos + metaResult.salas + metaResult.convenios,
        erros: metaResult.errors, detalhes: metaResult,
      });
      response.metadata = metaResult;
    }

    // Sales sync (daily chunks for performance)
    if (action === "full" || action === "sales" || action === "invoices") {
      const end = body.date_end || new Date().toISOString().split("T")[0];
      const start = body.date_start || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

      // 3-day chunks to avoid timeout
      const chunks: { start: string; end: string }[] = [];
      let chunkStart = new Date(start);
      const endDate = new Date(end);
      while (chunkStart <= endDate) {
        const chunkEnd = new Date(chunkStart);
        chunkEnd.setDate(chunkEnd.getDate() + 2);
        if (chunkEnd > endDate) chunkEnd.setTime(endDate.getTime());
        chunks.push({
          start: chunkStart.toISOString().split("T")[0],
          end: chunkEnd.toISOString().split("T")[0],
        });
        chunkStart = new Date(chunkEnd);
        chunkStart.setDate(chunkStart.getDate() + 1);
      }

      const totalStats = {
        processados: 0, criados: 0, atualizados: 0, ignorados: 0,
        erros: [] as string[], itens_criados: 0, pagamentos_criados: 0,
      };

      for (const chunk of chunks) {
        const result = await syncPeriod(supabase, clinicaId, feegowHeaders, chunk.start, chunk.end);
        totalStats.processados += result.processados;
        totalStats.criados += result.criados;
        totalStats.atualizados += result.atualizados;
        totalStats.ignorados += result.ignorados;
        totalStats.itens_criados += result.itens_criados;
        totalStats.pagamentos_criados += result.pagamentos_criados;
        totalStats.erros.push(...result.erros);
      }

      response.sales = { ...totalStats, chunks_count: chunks.length };
    }

    // Update integration status
    await supabase.from("integracoes").upsert({
      clinica_id: clinicaId, tipo: "feegow", status: "ativo",
      ultima_sincronizacao: new Date().toISOString(),
    }, { onConflict: "clinica_id,tipo" });

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("sync-feegow error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
