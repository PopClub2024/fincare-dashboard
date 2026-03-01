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
function mapFormaPagamento(feegowId: number | null, description?: string): string | null {
  // Common Feegow payment form IDs
  const map: Record<number, string> = {
    1: "dinheiro", 2: "cartao_credito", 3: "cartao_debito",
    4: "pix", 5: "convenio_nf", 6: "dinheiro",
  };
  if (feegowId && map[feegowId]) return map[feegowId];
  // Try by description
  const desc = (description || "").toLowerCase();
  if (desc.includes("pix")) return "pix";
  if (desc.includes("créd") || desc.includes("credit")) return "cartao_credito";
  if (desc.includes("débi") || desc.includes("debit")) return "cartao_debito";
  if (desc.includes("dinh") || desc.includes("cash")) return "dinheiro";
  if (desc.includes("convên") || desc.includes("nf")) return "convenio_nf";
  return null;
}

// ─── SYNC METADATA ─────────────────────────────────────────────
async function syncMetadata(supabase: any, clinicaId: string, headers: Record<string, string>, includePatients = false) {
  const result = { medicos: 0, salas: 0, convenios: 0, pacientes: 0, errors: [] as string[] };

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

// ─── SYNC INVOICES (NEW PRIMARY SOURCE) ────────────────────────
// Strategy:
//   1. financial/list-invoice → items + payments (primary financial data)
//   2. appoints/search → metadata complement (doctor, specialty, patient)
//   3. Upsert into vendas_itens, vendas_pagamentos, transacoes_vendas
async function syncInvoices(
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

  const canProceed = await acquireLock(supabase, clinicaId, "invoices", dateStart, dateEnd);
  if (!canProceed) return { ...stats, erros: ["Sync já em andamento para este período."] };

  const logId = await createLog(supabase, clinicaId, "feegow_sales", "sync_invoices", "list-invoice+appoints", makeRequestHash(clinicaId, "invoices", dateStart, dateEnd));

  try {
    const lookups = await buildLookupMaps(supabase, clinicaId);

    // ── Step 1: Fetch invoices (try DD-MM-YYYY format first) ──
    let invoices: any[] = [];
    const fd = toFeegowDate(dateStart);
    const td = toFeegowDate(dateEnd);
    
    // Audit showed: tipo_transacao is required (C/D/T), dates must be DD-MM-YYYY
    const urlVariants = [
      `${FEEGOW_BASE}/financial/list-invoice?date_start=${fd}&date_end=${td}&tipo_transacao=C`,
      `${FEEGOW_BASE}/financial/list-invoice?date_start=${fd}&date_end=${td}&tipo_transacao=T`,
    ];

    for (const url of urlVariants) {
      try {
        const data = await feegowFetch(url, headers);
        const content = data.content;
        if (Array.isArray(content)) invoices = content;
        else if (content && typeof content === "object") {
          // Sometimes it returns an object keyed by invoice_id
          invoices = Object.values(content);
        }
        if (invoices.length > 0) {
          stats.detalhes.invoice_url_used = url;
          break;
        }
      } catch (e: any) {
        stats.detalhes[`invoice_url_error_${urlVariants.indexOf(url)}`] = e.message;
      }
    }
    stats.detalhes.invoices_fetched = invoices.length;

    // ── Step 2: Fetch appointments for metadata complement ──
    const appointMap = new Map<string, any>(); // invoice_id or date+patient → appt data
    try {
      const url = `${FEEGOW_BASE}/appoints/search?data_start=${fd}&data_end=${td}&list_procedures=1`;
      const data = await feegowFetch(url, headers);
      const appts = Array.isArray(data.content) ? data.content : [];
      for (const appt of appts) {
        // Map by agendamento_id
        const key = String(appt.agendamento_id || appt.id || "");
        if (key) appointMap.set(key, appt);
        // Also map by patient+date for cross-reference
        const patKey = `${appt.paciente_id || appt.patient_id}_${appt.data || appt.date}`;
        if (!appointMap.has(patKey)) appointMap.set(patKey, appt);
      }
      stats.detalhes.appoints_for_metadata = appts.length;
    } catch (e: any) {
      stats.detalhes.appoints_error = e.message;
    }

    // ── Step 3: Process each invoice ──
    const vendaUpserts: any[] = [];
    const itemUpserts: any[] = [];
    const pagUpserts: any[] = [];
    const newPatients = new Map<string, string>();

    for (const inv of invoices) {
      stats.processados++;
      const invoiceId = String(inv.invoice_id || inv.id || inv.fatura_id || `unk_${stats.processados}`);

      // Parse date
      let dataComp = dateStart;
      const rawDate = inv.date || inv.data || inv.created_at || inv.timestamp || "";
      if (rawDate) {
        if (rawDate.includes("-") && rawDate.split("-")[0].length === 2) {
          const [d, m, y] = rawDate.split("-");
          dataComp = `${y}-${m}-${d}`;
        } else if (rawDate.includes("-")) {
          dataComp = rawDate.split(" ")[0]; // YYYY-MM-DD HH:MM:SS
        } else if (rawDate.includes("/")) {
          const [d, m, y] = rawDate.split("/");
          dataComp = `${y}-${m}-${d}`;
        }
      }

      // Financial values (invoice level)
      const valorBruto = Number(inv.total || inv.amount || inv.valor || inv.valor_bruto || inv.gross_amount || 0) || 0;
      const desconto = Number(inv.discount || inv.desconto || inv.discount_amount || 0) || 0;
      const valorLiquido = Number(inv.net_amount || inv.valor_liquido || 0) || (valorBruto - desconto);

      // Patient
      const patFid = String(inv.patient_id || inv.paciente_id || "");
      let pacienteId: string | null = null;
      if (patFid && lookups.pacientes.has(patFid)) {
        pacienteId = lookups.pacientes.get(patFid)!;
      } else if (patFid) {
        newPatients.set(patFid, inv.patient_name || inv.paciente_nome || "Paciente Feegow");
      }

      // Doctor (from invoice or appt complement)
      const profFid = String(inv.professional_id || inv.profissional_id || "");
      let medicoId: string | null = null;
      let especialidade: string | null = inv.specialty_name || inv.especialidade || null;
      if (profFid && lookups.medicos.has(profFid)) {
        const med = lookups.medicos.get(profFid)!;
        medicoId = med.id;
        if (!especialidade) especialidade = med.especialidade;
      }

      // Try appt complement
      if (!medicoId || !especialidade) {
        const patDateKey = `${patFid}_${rawDate}`;
        const appt = appointMap.get(invoiceId) || appointMap.get(patDateKey);
        if (appt) {
          if (!medicoId) {
            const apptProf = String(appt.profissional_id || appt.professional_id || "");
            if (apptProf && lookups.medicos.has(apptProf)) {
              const med = lookups.medicos.get(apptProf)!;
              medicoId = med.id;
              if (!especialidade) especialidade = med.especialidade;
            }
          }
          if (!especialidade) {
            especialidade = appt.especialidade_nome || appt.specialty_name || null;
          }
        }
      }

      // Insurance/Convenio
      const convFid = String(inv.insurance_id || inv.convenio_id || "");
      let convenioId: string | null = null;
      let convenioNome: string | null = null;
      if (convFid && lookups.convenios.has(convFid)) {
        const conv = lookups.convenios.get(convFid)!;
        convenioId = conv.id;
        convenioNome = conv.nome;
      }

      // ── Process items (procedures) ──
      const items = inv.items || inv.itens || inv.procedures || [];
      let procedimentoNome: string | null = null;
      if (Array.isArray(items) && items.length > 0) {
        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];
          const itemId = String(item.item_id || item.id || `${invoiceId}_${idx}`);
          const itemBruto = Number(item.amount || item.valor || item.price || item.valor_bruto || 0) || 0;
          const itemDesconto = Number(item.discount || item.desconto || 0) || 0;
          const itemLiquido = Number(item.net_amount || item.valor_liquido || 0) || (itemBruto - itemDesconto);
          const itemNome = item.procedure_name || item.procedimento_nome || item.name || item.nome || null;

          if (!procedimentoNome && itemNome) procedimentoNome = itemNome;

          // Item doctor override
          let itemMedico = medicoId;
          const itemProfFid = String(item.professional_id || item.profissional_id || "");
          if (itemProfFid && lookups.medicos.has(itemProfFid)) {
            itemMedico = lookups.medicos.get(itemProfFid)!.id;
          }

          itemUpserts.push({
            clinica_id: clinicaId,
            feegow_invoice_id: invoiceId,
            feegow_item_id: itemId,
            data_competencia: dataComp,
            procedimento_id: String(item.procedure_id || item.procedimento_id || ""),
            procedimento_nome: itemNome,
            tipo: item.type || item.tipo || null,
            quantidade: Number(item.quantity || item.quantidade || 1) || 1,
            valor_bruto_item: itemBruto,
            desconto_item: itemDesconto,
            valor_liquido_item: itemLiquido,
            medico_id: itemMedico,
            especialidade: especialidade,
            convenio: convenioNome,
          });
        }
      } else {
        // No item breakdown → create single synthetic item
        itemUpserts.push({
          clinica_id: clinicaId,
          feegow_invoice_id: invoiceId,
          feegow_item_id: `${invoiceId}_0`,
          data_competencia: dataComp,
          procedimento_id: null,
          procedimento_nome: inv.description || inv.descricao || null,
          tipo: null,
          quantidade: 1,
          valor_bruto_item: valorBruto,
          desconto_item: desconto,
          valor_liquido_item: valorLiquido,
          medico_id: medicoId,
          especialidade,
          convenio: convenioNome,
        });
        procedimentoNome = inv.description || inv.descricao || null;
      }

      // ── Process payments ──
      const payments = inv.payments || inv.pagamentos || [];
      let valorPago = 0;
      let formaPagEnum: string | null = null;
      if (Array.isArray(payments) && payments.length > 0) {
        for (let idx = 0; idx < payments.length; idx++) {
          const pmt = payments[idx];
          const pmtId = String(pmt.payment_id || pmt.id || `${invoiceId}_p${idx}`);
          const pmtValor = Number(pmt.amount || pmt.valor || pmt.value || 0) || 0;
          valorPago += pmtValor;

          const fmtId = Number(pmt.forma_pagamento_id || pmt.payment_method_id || 0);
          const fmtEnum = mapFormaPagamento(fmtId, pmt.payment_method || pmt.forma_pagamento || "");
          if (!formaPagEnum && fmtEnum) formaPagEnum = fmtEnum;

          pagUpserts.push({
            clinica_id: clinicaId,
            feegow_invoice_id: invoiceId,
            feegow_payment_id: pmtId,
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

      // Payment from top-level if no sub-payments
      if (!formaPagEnum) {
        const fpId = Number(inv.payment_method_id || inv.forma_pagamento_id || 0);
        formaPagEnum = mapFormaPagamento(fpId, inv.payment_method || inv.forma_pagamento || "");
      }
      if (valorPago === 0 && valorBruto > 0 && formaPagEnum && formaPagEnum !== "convenio_nf") {
        valorPago = valorBruto; // Assume paid if payment method exists
      }

      // Determine status
      const statusRecebimento = valorPago >= valorBruto ? "recebido" : "a_receber";

      // ── Aggregate record for transacoes_vendas ──
      vendaUpserts.push({
        clinica_id: clinicaId,
        feegow_id: invoiceId,
        invoice_id: invoiceId,
        origem: "feegow_invoice",
        data_competencia: dataComp,
        valor_bruto: valorBruto,
        desconto,
        valor_liquido: valorLiquido,
        valor_pago: valorPago,
        descricao: procedimentoNome || `Invoice #${invoiceId}`,
        procedimento: procedimentoNome,
        especialidade,
        medico_id: medicoId,
        convenio_id: convenioId,
        paciente_id: pacienteId,
        forma_pagamento: inv.payment_method || inv.forma_pagamento || null,
        forma_pagamento_enum: formaPagEnum,
        status_recebimento: statusRecebimento,
        quantidade: items.length || 1,
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
        for (const v of vendaUpserts) {
          if (!v.paciente_id) {
            const inv = invoices.find((i: any) => String(i.invoice_id || i.id || i.fatura_id) === v.feegow_id);
            if (inv) {
              const pf = String(inv.patient_id || inv.paciente_id || "");
              if (pf && lookups.pacientes.has(pf)) v.paciente_id = lookups.pacientes.get(pf)!;
            }
          }
        }
      }
      stats.detalhes.patients_auto_created = newPatients.size;
    }

    // ── Upsert vendas_itens in batches ──
    const BATCH = 100;
    for (let i = 0; i < itemUpserts.length; i += BATCH) {
      const batch = itemUpserts.slice(i, i + BATCH);
      const { error } = await supabase
        .from("vendas_itens")
        .upsert(batch, { onConflict: "clinica_id,feegow_invoice_id,feegow_item_id" });
      if (error) stats.erros.push(`vendas_itens batch ${i / BATCH}: ${error.message}`);
      else stats.itens_criados += batch.length;
    }

    // ── Upsert vendas_pagamentos in batches ──
    for (let i = 0; i < pagUpserts.length; i += BATCH) {
      const batch = pagUpserts.slice(i, i + BATCH);
      const { error } = await supabase
        .from("vendas_pagamentos")
        .upsert(batch, { onConflict: "clinica_id,feegow_invoice_id,feegow_payment_id" });
      if (error) stats.erros.push(`vendas_pagamentos batch ${i / BATCH}: ${error.message}`);
      else stats.pagamentos_criados += batch.length;
    }

    // ── Upsert transacoes_vendas in batches ──
    for (let i = 0; i < vendaUpserts.length; i += BATCH) {
      const batch = vendaUpserts.slice(i, i + BATCH);
      const { data: upserted, error } = await supabase
        .from("transacoes_vendas")
        .upsert(batch, { onConflict: "clinica_id,feegow_id", ignoreDuplicates: false })
        .select("id");
      if (error) {
        stats.erros.push(`transacoes_vendas batch ${i / BATCH}: ${error.message}`);
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

    // ── If invoices returned 0, fallback to appoints/search + list-sales ──
    if (invoices.length === 0) {
      stats.detalhes.fallback = "appoints_search";
      const fallbackResult = await syncSalesFallback(supabase, clinicaId, headers, dateStart, dateEnd, lookups);
      stats.processados += fallbackResult.processados;
      stats.criados += fallbackResult.criados;
      stats.atualizados += fallbackResult.atualizados;
      stats.erros.push(...fallbackResult.erros);
      stats.detalhes.fallback_stats = fallbackResult;
    }

    stats.detalhes = {
      ...stats.detalhes,
      dateStart, dateEnd,
      total_invoices: invoices.length,
      total_items: itemUpserts.length,
      total_payments: pagUpserts.length,
      total_vendas: vendaUpserts.length,
    };

    await finishLog(supabase, logId, stats.erros.length > 0 ? "erro_parcial" : "sucesso", stats);
  } catch (e: any) {
    stats.erros.push(e.message);
    await finishLog(supabase, logId, "erro", stats);
  }

  return stats;
}

// ─── FALLBACK: appoints/search + list-sales ────────────────────
async function syncSalesFallback(
  supabase: any, clinicaId: string, headers: Record<string, string>,
  dateStart: string, dateEnd: string, lookups: any
) {
  const stats = { processados: 0, criados: 0, atualizados: 0, erros: [] as string[] };

  // Fetch appoints
  let appts: any[] = [];
  try {
    const url = `${FEEGOW_BASE}/appoints/search?data_start=${toFeegowDate(dateStart)}&data_end=${toFeegowDate(dateEnd)}&list_procedures=1`;
    const data = await feegowFetch(url, headers);
    appts = Array.isArray(data.content) ? data.content : [];
  } catch (e: any) { stats.erros.push(`appoints fallback: ${e.message}`); }

  // Fetch sales for financial
  const salesMap = new Map<number, number>();
  try {
    const url = `${FEEGOW_BASE}/financial/list-sales?date_start=${dateStart}&date_end=${dateEnd}&unidade_id=0`;
    const data = await feegowFetch(url, headers);
    const items = Array.isArray(data.content) ? data.content : [];
    for (const item of items) {
      if (item.invoice_id) salesMap.set(Number(item.invoice_id), Number(item.amount || 0));
    }
  } catch (_) {}

  const statusMap: Record<number, string> = {
    1: "agendado", 2: "confirmado", 3: "atendido", 4: "em_espera",
    5: "em_atendimento", 6: "faltou", 7: "cancelado_paciente", 11: "cancelado", 16: "cancelado",
  };

  const batch: any[] = [];
  for (const appt of appts) {
    stats.processados++;
    const feegowId = String(appt.agendamento_id || appt.id || "");
    if (!feegowId) continue;

    let dataComp = dateStart;
    const rawDate = appt.data || appt.date;
    if (rawDate?.includes("-")) {
      const parts = rawDate.split("-");
      dataComp = parts[0].length === 2 ? `${parts[2]}-${parts[1]}-${parts[0]}` : rawDate;
    }

    const valor = Number(appt.valor ?? appt.value ?? 0) || 0;
    const profFid = String(appt.profissional_id || appt.professional_id || "");
    const med = profFid ? lookups.medicos.get(profFid) : null;

    const procs = appt.procedimentos || appt.procedures || [];
    const procNome = procs[0]?.nome || procs[0]?.name || null;

    batch.push({
      clinica_id: clinicaId,
      feegow_id: feegowId,
      origem: "feegow_appoints",
      data_competencia: dataComp,
      valor_bruto: valor,
      desconto: 0,
      valor_liquido: valor,
      valor_pago: 0,
      descricao: procNome,
      procedimento: procNome,
      especialidade: appt.especialidade_nome || (med?.especialidade) || null,
      medico_id: med?.id || null,
      status_presenca: statusMap[Number(appt.status_id || 0)] || "agendado",
      quantidade: procs.length || 1,
    });
  }

  for (let i = 0; i < batch.length; i += 100) {
    const chunk = batch.slice(i, i + 100);
    const { data: upserted, error } = await supabase
      .from("transacoes_vendas")
      .upsert(chunk, { onConflict: "clinica_id,feegow_id", ignoreDuplicates: false })
      .select("id");
    if (error) stats.erros.push(`Fallback upsert: ${error.message}`);
    else stats.atualizados += (upserted?.length || chunk.length);
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
      const includePatients = body.include_patients === true;
      const logId = await createLog(supabase, clinicaId, "feegow_metadata", "sync_metadata", "professional+salas+insurance");
      const metaResult = await syncMetadata(supabase, clinicaId, feegowHeaders, includePatients);
      await finishLog(supabase, logId, metaResult.errors.length > 0 ? "erro_parcial" : "sucesso", {
        processados: metaResult.medicos + metaResult.salas + metaResult.convenios + metaResult.pacientes,
        criados: metaResult.medicos + metaResult.salas + metaResult.convenios + metaResult.pacientes,
        erros: metaResult.errors, detalhes: metaResult,
      });
      response.metadata = metaResult;
    }

    // Sales/Invoice sync (daily chunks for performance)
    if (action === "full" || action === "sales" || action === "invoices") {
      const end = dateEnd || new Date().toISOString().split("T")[0];
      const start = dateStart || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

      // Daily chunks to avoid timeout and handle pagination limits
      const chunks: { start: string; end: string }[] = [];
      let chunkStart = new Date(start);
      const endDate = new Date(end);
      while (chunkStart <= endDate) {
        const chunkEnd = new Date(chunkStart);
        chunkEnd.setDate(chunkEnd.getDate() + 2); // 3-day chunks
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
      const allResults: any[] = [];

      for (const chunk of chunks) {
        const result = await syncInvoices(supabase, clinicaId, feegowHeaders, chunk.start, chunk.end);
        allResults.push({ ...chunk, ...result });
        totalStats.processados += result.processados;
        totalStats.criados += result.criados;
        totalStats.atualizados += result.atualizados;
        totalStats.ignorados += result.ignorados;
        totalStats.itens_criados += result.itens_criados;
        totalStats.pagamentos_criados += result.pagamentos_criados;
        totalStats.erros.push(...result.erros);
      }

      response.sales = { ...totalStats, chunks_count: chunks.length, chunks: allResults };
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
