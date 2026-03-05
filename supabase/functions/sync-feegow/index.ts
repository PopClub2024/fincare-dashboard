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
      if (res.status === 401 || res.status === 403) throw new Error(`AUTH_ERROR: HTTP ${res.status}`);
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
      if (attempt < maxRetries - 1) await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, attempt), 10000)));
    }
  }
  throw lastError || new Error("Max retries exceeded");
}

// ─── Concurrency guard ─────────────────────────────────────────
async function acquireLock(supabase: any, clinicaId: string, action: string, dateStart: string, dateEnd: string): Promise<boolean> {
  const hash = makeRequestHash(clinicaId, action, dateStart, dateEnd);
  const { data } = await supabase
    .from("integracao_logs").select("id")
    .eq("clinica_id", clinicaId).eq("request_hash", hash).eq("status", "em_andamento")
    .gte("inicio", new Date(Date.now() - 10 * 60 * 1000).toISOString()).limit(1);
  return !data || data.length === 0;
}

// ─── FK Lookups ────────────────────────────────────────────────
async function buildLookupMaps(supabase: any, clinicaId: string, headers: Record<string, string>) {
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

  const procedimentos = new Map<string, string>();
  try {
    const data = await feegowFetch(`${FEEGOW_BASE}/procedures/list`, headers);
    const procs = data.content || [];
    const procList = Array.isArray(procs) ? procs : Object.values(procs).flat();
    for (const p of procList) {
      const pid = String(p.procedimento_id || p.procedure_id || p.id || "");
      const nome = p.nome || p.name || p.procedimento_nome || "";
      if (pid && nome) procedimentos.set(pid, nome);
    }
    console.log(`Loaded ${procedimentos.size} procedure names from Feegow`);
  } catch (e: any) {
    console.error("Failed to load procedures:", e.message);
  }

  return { medicos, convenios, pacientes, procedimentos };
}

// ─── Payment form mapping (Feegow forma_pagamento IDs) ─────────
function mapFormaPagamento(feegowId: number | null, description?: any): string | null {
  const map: Record<number, string> = {
    1: "dinheiro", 2: "cartao_credito", 3: "cartao_debito",
    4: "pix", 5: "convenio_nf", 6: "dinheiro",
    8: "cartao_credito", 9: "cartao_debito", 15: "pix",
  };
  if (feegowId && map[feegowId]) return map[feegowId];
  const desc = String(description || "").toLowerCase();
  if (desc.includes("pix")) return "pix";
  if (desc.includes("créd") || desc.includes("credit")) return "cartao_credito";
  if (desc.includes("débi") || desc.includes("debit")) return "cartao_debito";
  if (desc.includes("dinh") || desc.includes("cash")) return "dinheiro";
  if (desc.includes("convên") || desc.includes("nf")) return "convenio_nf";
  if (desc.includes("boleto")) return "boleto";
  return null;
}

// Map Feegow forma_pagamento ID to meio_recebimento enum
function mapFormaPagamentoToMeio(fpId: number | null, fpDesc?: string): string {
  if (fpId === 1 || fpId === 6) return "dinheiro";
  if (fpId === 8 || fpId === 2) return "cartao_credito";
  if (fpId === 9 || fpId === 3) return "cartao_debito";
  if (fpId === 15 || fpId === 4) return "pix";
  if (fpId === 5) return "convenio";
  const desc = String(fpDesc || "").toLowerCase();
  if (desc.includes("pix")) return "pix";
  if (desc.includes("créd") || desc.includes("credit")) return "cartao_credito";
  if (desc.includes("débi") || desc.includes("debit")) return "cartao_debito";
  if (desc.includes("dinh") || desc.includes("cash")) return "dinheiro";
  if (desc.includes("boleto")) return "boleto";
  if (desc.includes("convên")) return "convenio";
  return "outros";
}

// ─── Bandeira mapping from Feegow IDs ──────────────────────────
function mapBandeira(bandeiraId: number | null, bandeiraNome?: string): string | null {
  if (bandeiraNome) return bandeiraNome;
  const map: Record<number, string> = {
    1: "Visa", 2: "Mastercard", 3: "Elo", 4: "Amex",
    5: "Hipercard", 6: "Diners", 7: "Sorocred",
  };
  if (bandeiraId && map[bandeiraId]) return map[bandeiraId];
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
        clinica_id: clinicaId, feegow_id: fid, nome: prof.nome || prof.name || "Sem nome",
        especialidade: espNome, crm: prof.crm || null, documento: prof.cpf || null, ativo: prof.active !== false,
      }, { onConflict: "clinica_id,feegow_id" });
      if (!error) result.medicos++; else result.errors.push(`Médico ${prof.name}: ${error.message}`);
    }
  } catch (e: any) { result.errors.push(`Médicos: ${e.message}`); }
  try {
    const data = await feegowFetch(`${FEEGOW_BASE}/treatment-place/list`, headers);
    const places = data.content || [];
    for (const place of (Array.isArray(places) ? places : [])) {
      const { error } = await supabase.from("salas").upsert({
        clinica_id: clinicaId, feegow_id: String(place.treatment_place_id || place.id),
        nome: place.name || place.nome || "Sem nome", capacidade: place.capacity || 1, ativo: place.active !== false,
      }, { onConflict: "clinica_id,feegow_id" });
      if (!error) result.salas++; else result.errors.push(`Sala ${place.name}: ${error.message}`);
    }
  } catch (e: any) { result.errors.push(`Salas: ${e.message}`); }
  try {
    const data = await feegowFetch(`${FEEGOW_BASE}/insurance/list`, headers);
    const insurances = data.content || [];
    const insList = Array.isArray(insurances) ? insurances : Object.values(insurances).flat();
    for (const ins of insList) {
      const fid = String(ins.convenio_id || ins.insurance_id || ins.id || "");
      if (!fid || fid === "undefined" || fid === "null") continue;
      const { error } = await supabase.from("convenios").upsert({
        clinica_id: clinicaId, feegow_id: fid,
        nome: ins.nome_fantasia || ins.name || ins.nome || "Sem nome", ativo: ins.active !== false,
      }, { onConflict: "clinica_id,feegow_id" });
      if (!error) result.convenios++; else result.errors.push(`Convênio ${ins.name}: ${error.message}`);
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
  while (page <= 50) {
    try {
      const url = `${FEEGOW_BASE}/appoints/search?data_start=${fd}&data_end=${td}&list_procedures=1&page=${page}&perPage=200`;
      const data = await feegowFetch(url, headers);
      const content = data.content;
      let items: any[] = [];
      if (Array.isArray(content)) items = content;
      else if (content && typeof content === "object") items = Object.values(content).flat();
      if (items.length === 0) break;
      all.push(...items);
      if (items.length < 200) break;
      page++;
    } catch (e) { console.error(`appoints page ${page} error:`, e); break; }
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
    } catch { break; }
  }
  return all;
}

// ─── Fetch ALL invoices with pagination ────────────────────────
async function fetchAllInvoices(headers: Record<string, string>, dateStart: string, dateEnd: string, extraParams = ""): Promise<any[]> {
  const fd = toFeegowDate(dateStart);
  const td = toFeegowDate(dateEnd);
  const all: any[] = [];
  let page = 1;
  while (page <= 20) {
    try {
      const url = `${FEEGOW_BASE}/financial/list-invoice?data_start=${fd}&data_end=${td}&unidade_id=0${extraParams}&page=${page}&perPage=500`;
      const data = await feegowFetch(url, headers);
      const items = Array.isArray(data.content) ? data.content : [];
      if (items.length === 0) break;
      all.push(...items);
      if (items.length < 500) break;
      page++;
    } catch (e: any) {
      console.error(`list-invoice page ${page} error:`, e.message);
      break;
    }
  }
  return all;
}

// ─── Parse Feegow date (DD-MM-YYYY or YYYY-MM-DD) to ISO ──────
function parseFeegowDateToIso(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = String(raw).split(" ")[0];
  if (!d) return null;
  if (d.includes("-") && d.split("-")[0].length === 2) {
    const [dd, mm, yy] = d.split("-");
    return `${yy}-${mm}-${dd}`;
  }
  return d;
}

// ─── Parse Feegow value (may be centavos or BRL) ───────────────
function parseFeegowValue(v: any, divideBy100 = false): number {
  if (v == null) return 0;
  if (typeof v === "number") return divideBy100 ? v / 100 : v;
  const s = String(v).replace(/[R$\s.]/g, "").replace(",", ".");
  const n = Number(s) || 0;
  return divideBy100 ? n / 100 : n;
}

// ─── MAIN SYNC: Appoints primary + Sales for financial values ──
async function syncPeriod(
  supabase: any, clinicaId: string, headers: Record<string, string>,
  dateStart: string, dateEnd: string,
) {
  const stats = {
    processados: 0, criados: 0, atualizados: 0, ignorados: 0,
    erros: [] as string[], detalhes: {} as any, itens_criados: 0, pagamentos_criados: 0,
  };

  const canProceed = await acquireLock(supabase, clinicaId, "sync", dateStart, dateEnd);
  if (!canProceed) return { ...stats, erros: ["Sync já em andamento para este período."] };

  const logId = await createLog(supabase, clinicaId, "feegow_sales", "sync_period", "appoints+sales", makeRequestHash(clinicaId, "sync", dateStart, dateEnd));

  try {
    const lookups = await buildLookupMaps(supabase, clinicaId, headers);

    const [appoints, sales] = await Promise.all([
      fetchAllAppoints(headers, dateStart, dateEnd),
      fetchAllSales(headers, dateStart, dateEnd),
    ]);

    stats.detalhes.appoints_count = appoints.length;
    stats.detalhes.sales_count = sales.length;

    interface SaleEntry {
      invoice_id: number; amount: number; matched: boolean;
      professional_id?: string; patient_id?: string; insurance_id?: string;
      procedure_name?: string; description?: string; payment_type?: number;
    }
    const salesByDate = new Map<string, SaleEntry[]>();
    for (const s of sales) {
      const amt = Number(s.amount || s.valor || 0) || 0;
      if (amt <= 0) continue;
      const saleDate = (s.timestamp || s.data || "").split(" ")[0];
      if (!saleDate) continue;
      const arr = salesByDate.get(saleDate) || [];
      arr.push({
        invoice_id: Number(s.invoice_id || s.id),
        amount: amt,
        matched: false,
        professional_id: String(s.profissional_id || s.professional_id || s.doctor_id || ""),
        patient_id: String(s.paciente_id || s.patient_id || ""),
        insurance_id: String(s.convenio_id || s.insurance_id || ""),
        procedure_name: s.procedimento_nome || s.procedure_name || s.descricao || null,
        description: s.descricao || s.description || null,
        payment_type: Number(s.forma_pagamento_id || s.payment_type_id || 0),
      });
      salesByDate.set(saleDate, arr);
    }

    const newPatients = new Map<string, string>();
    const vendaBatch: any[] = [];
    const itemBatch: any[] = [];
    const operacaoBatch: any[] = [];
    const seenFeegow = new Set<string>();

    for (const appt of appoints) {
      const feegowId = String(appt.agendamento_id || appt.id || "");
      if (!feegowId || seenFeegow.has(feegowId)) continue;
      seenFeegow.add(feegowId);
      stats.processados++;

      let dataComp = dateStart;
      const rawDate = appt.data || appt.date || "";
      if (rawDate) {
        const parsed = parseFeegowDateToIso(rawDate);
        if (parsed) dataComp = parsed;
      }

      const profFid = String(appt.profissional_id || appt.professional_id || "");
      let medicoId: string | null = null;
      let especialidade: string | null = null;
      if (profFid && lookups.medicos.has(profFid)) {
        const med = lookups.medicos.get(profFid)!;
        medicoId = med.id;
        especialidade = med.especialidade;
      }

      const patFid = String(appt.paciente_id || appt.patient_id || "");
      let pacienteId: string | null = null;
      if (patFid && lookups.pacientes.has(patFid)) {
        pacienteId = lookups.pacientes.get(patFid)!;
      } else if (patFid) {
        newPatients.set(patFid, "Paciente Feegow");
      }

      const convFid = String(appt.convenio_id || appt.insurance_id || appt.convenio?.id || "");
      let convenioId: string | null = null;
      let convenioNome: string | null = null;
      if (convFid && lookups.convenios.has(convFid)) {
        const conv = lookups.convenios.get(convFid)!;
        convenioId = conv.id;
        convenioNome = conv.nome;
      }

      const procs = appt.procedimentos || appt.procedures || appt.lista_procedimentos || [];
      let procNome: string | null = null;
      if (Array.isArray(procs) && procs.length > 0) {
        const p = procs[0];
        procNome = p.nome || p.name || p.procedimento_nome || null;
        if (!procNome) {
          const pid = String(p.procedimentoID || p.procedimento_id || p.procedure_id || "");
          if (pid && lookups.procedimentos.has(pid)) procNome = lookups.procedimentos.get(pid)!;
        }
      }
      if (!procNome && appt.procedimento_id) {
        const pid = String(appt.procedimento_id);
        if (lookups.procedimentos.has(pid)) procNome = lookups.procedimentos.get(pid)!;
      }

      const statusMap: Record<number, string> = {
        1: "agendado", 2: "confirmado", 3: "atendido", 4: "em_espera",
        5: "em_atendimento", 6: "faltou", 7: "cancelado_paciente", 11: "cancelado", 16: "cancelado", 22: "atendido",
      };
      const statusPresenca = statusMap[Number(appt.status_id || 0)] || "agendado";
      // Skip only clinic-initiated cancellations; keep "faltou" and "cancelado_paciente"
      if (statusPresenca === "cancelado") {
        stats.ignorados++;
        continue;
      }

      const isFaltaOuCancelado = ["faltou", "cancelado_paciente"].includes(statusPresenca);

      let valorBruto = 0;
      let invoiceId: string | null = null;
      if (!isFaltaOuCancelado) {
        valorBruto = parseFeegowValue(appt.valor_total_agendamento) || parseFeegowValue(appt.valor);
        if (valorBruto <= 0) {
          const dateSales = salesByDate.get(dataComp) || [];
          const unmatchedSale = dateSales.find(s => !s.matched);
          if (unmatchedSale) {
            valorBruto = unmatchedSale.amount;
            invoiceId = String(unmatchedSale.invoice_id);
            unmatchedSale.matched = true;
          }
        }
      }

      const statusRecebimento = "a_receber";

      itemBatch.push({
        clinica_id: clinicaId,
        feegow_invoice_id: invoiceId || feegowId,
        feegow_item_id: `${feegowId}_0`,
        data_competencia: dataComp,
        procedimento_id: null,
        procedimento_nome: procNome,
        tipo: null,
        quantidade: procs.length || 1,
        valor_bruto_item: valorBruto,
        desconto_item: 0,
        valor_liquido_item: valorBruto,
        medico_id: medicoId,
        especialidade,
        convenio: convenioNome,
      });

      operacaoBatch.push({
        clinica_id: clinicaId,
        feegow_agendamento_id: feegowId,
        data_competencia: dataComp,
        tipo: "consulta" as const,
        procedimento_nome: procNome,
        procedimento_id: appt.procedimento_id ? String(appt.procedimento_id) : null,
        especialidade,
        medico_id: medicoId,
        paciente_id: pacienteId,
        valor_bruto: valorBruto,
        desconto: 0,
        valor_liquido: valorBruto,
        status_presenca: statusPresenca as any,
        forma_pagamento_original: null as string | null,
        feegow_refs: { agendamento_id: feegowId, invoice_id: invoiceId },
      });

      vendaBatch.push({
        clinica_id: clinicaId,
        feegow_id: feegowId,
        invoice_id: invoiceId,
        origem: "feegow",
        data_competencia: dataComp,
        valor_bruto: valorBruto,
        desconto: 0,
        valor_pago: 0,
        descricao: procNome || `Agendamento #${feegowId}`,
        procedimento: procNome,
        especialidade,
        medico_id: medicoId,
        convenio_id: convenioId,
        paciente_id: pacienteId,
        forma_pagamento_enum: null,
        status_presenca: statusPresenca,
        status_recebimento: statusRecebimento,
        quantidade: procs.length || 1,
        parcelas: 1,
      });
    }

    // Remaining unmatched sales as standalone
    for (const [saleDate, dateSales] of salesByDate.entries()) {
      for (const sale of dateSales) {
        if (sale.matched) continue;
        const fgId = `inv_${sale.invoice_id}`;
        if (seenFeegow.has(fgId)) continue;
        seenFeegow.add(fgId);
        stats.processados++;

        let medicoId: string | null = null;
        let especialidade: string | null = null;
        if (sale.professional_id && lookups.medicos.has(sale.professional_id)) {
          const med = lookups.medicos.get(sale.professional_id)!;
          medicoId = med.id;
          especialidade = med.especialidade;
        }
        let convenioId: string | null = null;
        if (sale.insurance_id && lookups.convenios.has(sale.insurance_id)) {
          convenioId = lookups.convenios.get(sale.insurance_id)!.id;
        }
        let pacienteId: string | null = null;
        if (sale.patient_id && lookups.pacientes.has(sale.patient_id)) {
          pacienteId = lookups.pacientes.get(sale.patient_id)!;
        } else if (sale.patient_id && sale.patient_id !== "" && sale.patient_id !== "undefined") {
          newPatients.set(sale.patient_id, "Paciente Feegow");
        }

        const procNome = sale.procedure_name || sale.description || null;
        const formaPgto = mapFormaPagamento(sale.payment_type || null, sale.description);

        vendaBatch.push({
          clinica_id: clinicaId, feegow_id: fgId, invoice_id: String(sale.invoice_id),
          origem: "feegow", data_competencia: saleDate, valor_bruto: sale.amount,
          desconto: 0, valor_pago: 0,
          descricao: procNome || `Venda #${sale.invoice_id}`,
          procedimento: procNome, especialidade, medico_id: medicoId,
          convenio_id: convenioId, paciente_id: pacienteId,
          forma_pagamento_enum: formaPgto, status_presenca: "atendido",
          status_recebimento: "a_receber", quantidade: 1, parcelas: 1,
        });
      }
    }

    // Auto-create missing patients
    if (newPatients.size > 0) {
      const patBatch = Array.from(newPatients.entries()).map(([fid, nome]) => ({ clinica_id: clinicaId, feegow_id: fid, nome }));
      const { data: created } = await supabase.from("pacientes").upsert(patBatch, { onConflict: "clinica_id,feegow_id" }).select("id, feegow_id");
      if (created) {
        for (const p of created) if (p.feegow_id) lookups.pacientes.set(p.feegow_id, p.id);
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

    // Batch upserts
    const BATCH = 100;
    for (let i = 0; i < itemBatch.length; i += BATCH) {
      const batch = itemBatch.slice(i, i + BATCH);
      const { error } = await supabase.from("vendas_itens").upsert(batch, { onConflict: "clinica_id,feegow_invoice_id,feegow_item_id" });
      if (error) stats.erros.push(`vendas_itens: ${error.message}`); else stats.itens_criados += batch.length;
    }
    for (let i = 0; i < vendaBatch.length; i += BATCH) {
      const batch = vendaBatch.slice(i, i + BATCH);
      const { data: upserted, error } = await supabase.from("transacoes_vendas")
        .upsert(batch, { onConflict: "clinica_id,feegow_id", ignoreDuplicates: false }).select("id");
      if (error) {
        for (const record of batch) {
          const { data: existing } = await supabase.from("transacoes_vendas").select("id")
            .eq("clinica_id", clinicaId).eq("feegow_id", record.feegow_id).maybeSingle();
          if (existing) {
            const { error: upErr } = await supabase.from("transacoes_vendas").update(record).eq("id", existing.id);
            if (upErr) stats.erros.push(`Update ${record.feegow_id}: ${upErr.message}`); else stats.atualizados++;
          } else {
            const { error: insErr } = await supabase.from("transacoes_vendas").insert(record);
            if (insErr) stats.erros.push(`Insert ${record.feegow_id}: ${insErr.message}`); else stats.criados++;
          }
        }
      } else {
        stats.atualizados += (upserted?.length || batch.length);
      }
    }

    // Upsert operacao_producao (granular)
    for (let i = 0; i < operacaoBatch.length; i += BATCH) {
      const batch = operacaoBatch.slice(i, i + BATCH);
      const { error } = await supabase.from("operacao_producao").upsert(batch, { onConflict: "clinica_id,feegow_agendamento_id" });
      if (error) stats.erros.push(`operacao_producao: ${error.message}`);
    }

    stats.detalhes = { ...stats.detalhes, dateStart, dateEnd, total_vendas: vendaBatch.length, total_items: itemBatch.length, total_operacao: operacaoBatch.length };
    await finishLog(supabase, logId, stats.erros.length > 0 ? "erro_parcial" : "sucesso", stats);
  } catch (e: any) {
    stats.erros.push(e.message);
    await finishLog(supabase, logId, "erro", stats);
  }
  return stats;
}

// ─── SYNC RECEBIVEIS AGREGADOS (Feegow list-invoice → contas_receber_agregado) ──
// This uses list-invoice broadly (origem_dado = feegow_invoice)
async function syncRecebiveisAgregados(
  supabase: any, clinicaId: string, headers: Record<string, string>,
  dateStart: string, dateEnd: string,
  origemDado: string = "feegow_invoice",
) {
  const stats = { processados: 0, criados: 0, atualizados: 0, ignorados: 0, erros: [] as string[], detalhes: {} as any };
  const logId = await createLog(supabase, clinicaId, "feegow_recebiveis", `sync_recebiveis_${origemDado}`, "financial/list-invoice");

  try {
    // For feegow_caixa, use tipo_conta=7 (Caixa)
    const extraParams = origemDado === "feegow_caixa" ? "&tipo_conta=7" : "";
    const invoices = await fetchAllInvoices(headers, dateStart, dateEnd, extraParams);
    stats.detalhes.invoices_count = invoices.length;
    console.log(`Fetched ${invoices.length} invoices (${origemDado}) from Feegow for ${dateStart} to ${dateEnd}`);

    if (invoices.length === 0) {
      // Fallback: aggregate from transacoes_vendas when Feegow returns nothing
      if (origemDado === "feegow_caixa") {
        const fallbackStats = await buildAgregadoFromVendas(supabase, clinicaId, dateStart, dateEnd);
        stats.criados = fallbackStats.criados;
        stats.atualizados = fallbackStats.atualizados;
        stats.detalhes.source = "fallback_transacoes_vendas";
      }
      await finishLog(supabase, logId, "sucesso", stats);
      return stats;
    }

    // Aggregate by date + meio + bandeira
    interface AggKey {
      data_base: string;
      meio: string;
      bandeira: string | null;
      competencia: string;
      valor: number;
      refs: any[];
    }
    const aggregated = new Map<string, AggKey>();

    for (const inv of invoices) {
      stats.processados++;

      const payments = inv.pagamentos || inv.payments || [];
      const invDate = parseFeegowDateToIso(inv.data || inv.date || inv.timestamp);

      if (Array.isArray(payments) && payments.length > 0) {
        for (const pmt of payments) {
          const dateIso = parseFeegowDateToIso(pmt.data || pmt.date) || invDate;
          if (!dateIso) continue;

          const fpId = Number(pmt.forma_pagamento || pmt.forma_pagamento_id || pmt.payment_type_id || 0);
          const fpDesc = pmt.forma_pagamento_desc || pmt.payment_type_name || "";
          const meio = mapFormaPagamentoToMeio(fpId, fpDesc);
          const bandeiraId = Number(pmt.bandeira_id || 0);
          const bandeira = mapBandeira(bandeiraId, pmt.bandeira_nome || pmt.bandeira || pmt.card_brand || "");
          let valor = parseFeegowValue(pmt.valor || pmt.amount || pmt.value);
          if (valor <= 0) continue;

          const competencia = dateIso.substring(0, 7) + "-01";
          const key = `${dateIso}|${meio}|${bandeira || ""}`;

          const existing = aggregated.get(key);
          if (existing) {
            existing.valor += valor;
            existing.refs.push({ invoice_id: inv.invoice_id || inv.id, pmt_id: pmt.id });
          } else {
            aggregated.set(key, {
              data_base: dateIso,
              meio,
              bandeira,
              competencia,
              valor,
              refs: [{ invoice_id: inv.invoice_id || inv.id, pmt_id: pmt.id }],
            });
          }
        }
      } else {
        if (!invDate) { stats.ignorados++; continue; }

        let valor = parseFeegowValue(inv.amount || inv.valor || inv.total);
        if (valor <= 0) { stats.ignorados++; continue; }

        const fpId = Number(inv.forma_pagamento_id || inv.payment_type_id || 0);
        const fpDesc = inv.forma_pagamento_desc || "";
        const meio = mapFormaPagamentoToMeio(fpId, fpDesc);
        const bandeiraId = Number(inv.bandeira_id || 0);
        const bandeira = mapBandeira(bandeiraId, inv.bandeira_nome || "");
        const competencia = invDate.substring(0, 7) + "-01";
        const key = `${invDate}|${meio}|${bandeira || ""}`;

        const existing = aggregated.get(key);
        if (existing) {
          existing.valor += valor;
          existing.refs.push({ invoice_id: inv.invoice_id || inv.id });
        } else {
          aggregated.set(key, {
            data_base: invDate,
            meio,
            bandeira,
            competencia,
            valor,
            refs: [{ invoice_id: inv.invoice_id || inv.id }],
          });
        }
      }
    }

    // Upsert into contas_receber_agregado
    await upsertAgregados(supabase, clinicaId, aggregated, origemDado, stats);

    stats.detalhes.aggregated_keys = aggregated.size;
    await finishLog(supabase, logId, stats.erros.length > 0 ? "erro_parcial" : "sucesso", stats);
  } catch (e: any) {
    stats.erros.push(e.message);
    await finishLog(supabase, logId, "erro", stats);
  }
  return stats;
}

// ─── Build agregado from transacoes_vendas (fallback) ──────────
async function buildAgregadoFromVendas(
  supabase: any, clinicaId: string, dateStart: string, dateEnd: string,
) {
  const stats = { criados: 0, atualizados: 0, erros: [] as string[] };

  const { data: vendas } = await supabase
    .from("transacoes_vendas")
    .select("data_competencia, forma_pagamento_enum, valor_bruto, status_recebimento")
    .eq("clinica_id", clinicaId)
    .gte("data_competencia", dateStart)
    .lte("data_competencia", dateEnd)
    .limit(5000);

  if (!vendas || vendas.length === 0) return stats;

  const meioMap: Record<string, string> = {
    cartao_credito: "cartao_credito", cartao_debito: "cartao_debito",
    pix: "pix", dinheiro: "dinheiro", convenio_nf: "convenio", boleto: "boleto",
  };

  interface AggKey { data_base: string; meio: string; bandeira: string | null; competencia: string; valor: number; refs: any[] }
  const aggregated = new Map<string, AggKey>();

  for (const v of vendas) {
    const meio = meioMap[v.forma_pagamento_enum || ""] || "dinheiro";
    const dataBase = v.data_competencia;
    const key = `${dataBase}|${meio}|`;
    const competencia = dataBase.substring(0, 7) + "-01";

    const existing = aggregated.get(key);
    if (existing) {
      existing.valor += Number(v.valor_bruto) || 0;
    } else {
      aggregated.set(key, {
        data_base: dataBase, meio, bandeira: null,
        competencia, valor: Number(v.valor_bruto) || 0, refs: [],
      });
    }
  }

  await upsertAgregados(supabase, clinicaId, aggregated, "feegow_caixa", stats);
  return stats;
}

// ─── Shared upsert logic for contas_receber_agregado ───────────
async function upsertAgregados(
  supabase: any, clinicaId: string,
  aggregated: Map<string, { data_base: string; meio: string; bandeira: string | null; competencia: string; valor: number; refs: any[] }>,
  origemDado: string, stats: any,
) {
  for (const [, agg] of aggregated) {
    try {
      let query = supabase
        .from("contas_receber_agregado")
        .select("id, valor_esperado")
        .eq("clinica_id", clinicaId)
        .eq("competencia", agg.competencia)
        .eq("data_base", agg.data_base)
        .eq("meio", agg.meio)
        .eq("origem_dado", origemDado);

      if (agg.bandeira) {
        query = query.eq("bandeira", agg.bandeira);
      } else {
        query = query.is("bandeira", null);
      }

      const { data: existing } = await query.maybeSingle();

      if (existing) {
        if (Math.abs(existing.valor_esperado - agg.valor) > 0.01) {
          await supabase.from("contas_receber_agregado").update({
            valor_esperado: agg.valor,
            referencias_json: agg.refs.length > 0 ? { feegow_invoices: agg.refs } : undefined,
            updated_at: new Date().toISOString(),
          }).eq("id", existing.id);
          stats.atualizados++;
        } else {
          stats.ignorados++;
        }
      } else {
        let tipoRecebivel = "getnet";
        if (agg.meio === "dinheiro") tipoRecebivel = "dinheiro";
        else if (agg.meio === "pix") tipoRecebivel = "pix_banco";
        else if (agg.meio === "convenio") tipoRecebivel = "convenio_nf";
        else if (agg.meio === "boleto") tipoRecebivel = "pix_banco";

        await supabase.from("contas_receber_agregado").insert({
          clinica_id: clinicaId,
          tipo_recebivel: tipoRecebivel,
          competencia: agg.competencia,
          data_base: agg.data_base,
          meio: agg.meio,
          bandeira: agg.bandeira,
          valor_esperado: agg.valor,
          valor_recebido: 0,
          status: "pendente",
          origem_dado: origemDado,
          origem_ref: { source: `feegow_${origemDado}` },
          referencias_json: agg.refs.length > 0 ? { feegow_invoices: agg.refs } : null,
        });
        stats.criados++;
      }
    } catch (e: any) {
      if (!e.message?.includes("duplicate")) {
        stats.erros.push(`Agg ${agg.data_base}|${agg.meio}: ${e.message}`);
      } else {
        stats.ignorados++;
      }
    }
  }
}

// ─── SYNC MEDICAL TRANSFERS (Repasses Médicos → CP) ───────────
async function syncMedicalTransfers(
  supabase: any, clinicaId: string, headers: Record<string, string>,
  dateStart: string, dateEnd: string,
) {
  const stats = { processados: 0, criados: 0, ignorados: 0, erros: [] as string[] };
  const logId = await createLog(supabase, clinicaId, "feegow_transfers", "sync_medical_transfers", "financial/list-medical-transfer");

  try {
    const fd = toFeegowDate(dateStart);
    const td = toFeegowDate(dateEnd);
    const url = `${FEEGOW_BASE}/financial/list-medical-transfer?data_start=${fd}&data_end=${td}`;
    const data = await feegowFetch(url, headers);
    const transfers = Array.isArray(data.content) ? data.content : [];
    stats.processados = transfers.length;

    if (transfers.length === 0) {
      await finishLog(supabase, logId, "sucesso", stats);
      return stats;
    }

    const { data: planoRow } = await supabase
      .from("plano_contas")
      .select("id")
      .eq("clinica_id", clinicaId)
      .eq("codigo_estruturado", "19.1")
      .maybeSingle();
    const planoContasId = planoRow?.id || null;

    const { data: medicos } = await supabase
      .from("medicos")
      .select("id, feegow_id, nome")
      .eq("clinica_id", clinicaId);
    const medMap = new Map<string, { id: string; nome: string }>();
    for (const m of (medicos || [])) if (m.feegow_id) medMap.set(m.feegow_id, { id: m.id, nome: m.nome });

    const batch: any[] = [];
    for (const t of transfers) {
      const valorCentavos = Number(t.valor || t.amount || t.value || 0);
      const valor = valorCentavos / 100;
      if (valor <= 0) { stats.ignorados++; continue; }

      const profFid = String(t.profissional_id || t.professional_id || t.doctor_id || "");
      const med = profFid ? medMap.get(profFid) : null;
      const dataRef = t.data || t.date || t.timestamp || dateStart;
      const dataCompIso = parseFeegowDateToIso(dataRef) || dateStart;

      const fgId = `transfer_${t.id || t.transfer_id || `${profFid}_${dataCompIso}`}`;

      batch.push({
        clinica_id: clinicaId,
        data_competencia: dataCompIso,
        ref_dia_trabalhado: dataCompIso,
        valor,
        descricao: `Repasse médico - ${med?.nome || profFid} ref:${dataCompIso}`,
        fornecedor: med?.nome || `Médico ${profFid}`,
        medico_id: med?.id || null,
        plano_contas_id: planoContasId,
        tipo_despesa: "variavel" as any,
        status: "pendente_conciliacao" as any,
        ofx_transaction_id: fgId,
      });
    }

    const BATCH = 50;
    for (let i = 0; i < batch.length; i += BATCH) {
      const chunk = batch.slice(i, i + BATCH);
      for (const record of chunk) {
        const { data: existing } = await supabase
          .from("contas_pagar_lancamentos")
          .select("id")
          .eq("clinica_id", clinicaId)
          .eq("ofx_transaction_id", record.ofx_transaction_id)
          .maybeSingle();
        if (existing) {
          stats.ignorados++;
        } else {
          const { error } = await supabase.from("contas_pagar_lancamentos").insert(record);
          if (error) stats.erros.push(`Transfer ${record.ofx_transaction_id}: ${error.message}`);
          else stats.criados++;
        }
      }
    }

    await finishLog(supabase, logId, stats.erros.length > 0 ? "erro_parcial" : "sucesso", {
      processados: stats.processados, criados: stats.criados, ignorados: stats.ignorados, erros: stats.erros,
    });
  } catch (e: any) {
    stats.erros.push(e.message);
    await finishLog(supabase, logId, "erro", stats);
  }
  return stats;
}

// ─── MAIN HANDLER ──────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const feegowApiKey = Deno.env.get("FEEGOW_API_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  const feegowHeaders = { "x-access-token": feegowApiKey, "Content-Type": "application/json" };

  try {
    const body = await req.json().catch(() => ({}));
    const clinicaId = body.clinica_id;
    const action = body.action || "full";

    if (!clinicaId) return new Response(JSON.stringify({ error: "clinica_id obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!feegowApiKey) return new Response(JSON.stringify({ error: "FEEGOW_API_KEY não configurada" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const response: Record<string, any> = { success: true };

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

    if (action === "full" || action === "sales" || action === "invoices") {
      const end = body.date_end || new Date().toISOString().split("T")[0];
      const start = body.date_start || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

      const chunks: { start: string; end: string }[] = [];
      let chunkStart = new Date(start);
      const endDate = new Date(end);
      while (chunkStart <= endDate) {
        const chunkEnd = new Date(chunkStart);
        chunkEnd.setDate(chunkEnd.getDate() + 2);
        if (chunkEnd > endDate) chunkEnd.setTime(endDate.getTime());
        chunks.push({ start: chunkStart.toISOString().split("T")[0], end: chunkEnd.toISOString().split("T")[0] });
        chunkStart = new Date(chunkEnd);
        chunkStart.setDate(chunkStart.getDate() + 1);
      }

      const totalStats = { processados: 0, criados: 0, atualizados: 0, ignorados: 0, erros: [] as string[], itens_criados: 0, pagamentos_criados: 0 };
      for (const chunk of chunks) {
        const result = await syncPeriod(supabase, clinicaId, feegowHeaders, chunk.start, chunk.end);
        totalStats.processados += result.processados;
        totalStats.criados += result.criados;
        totalStats.atualizados += result.atualizados;
        totalStats.itens_criados += result.itens_criados;
        totalStats.pagamentos_criados += result.pagamentos_criados;
        totalStats.erros.push(...result.erros);
      }
      response.sales = { ...totalStats, chunks_count: chunks.length };
    }

    // Sync recebiveis agregados from Feegow invoices (general)
    if (action === "full" || action === "recebiveis" || action === "invoices") {
      const end = body.date_end || new Date().toISOString().split("T")[0];
      const start = body.date_start || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
      const recebiveisResult = await syncRecebiveisAgregados(supabase, clinicaId, feegowHeaders, start, end, "feegow_invoice");
      response.recebiveis_agregados = recebiveisResult;
    }

    // NEW: Sync recebimentos agregados from Feegow Caixa (tipo_conta=7)
    if (action === "full" || action === "recebimentos_agregados" || action === "caixa") {
      const end = body.date_end || new Date().toISOString().split("T")[0];
      const start = body.date_start || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
      const caixaResult = await syncRecebiveisAgregados(supabase, clinicaId, feegowHeaders, start, end, "feegow_caixa");
      response.recebimentos_caixa = caixaResult;
    }

    // Sync medical transfers (repasses médicos → CP)
    if (action === "full" || action === "transfers") {
      const end = body.date_end || new Date().toISOString().split("T")[0];
      const start = body.date_start || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
      const transferResult = await syncMedicalTransfers(supabase, clinicaId, feegowHeaders, start, end);
      response.transfers = transferResult;
    }

    await supabase.from("integracoes").upsert({
      clinica_id: clinicaId, tipo: "feegow", status: "ativo", ultima_sincronizacao: new Date().toISOString(),
    }, { onConflict: "clinica_id,tipo" });

    return new Response(JSON.stringify(response), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("sync-feegow error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
