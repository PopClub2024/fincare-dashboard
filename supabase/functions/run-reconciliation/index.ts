import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Types ──────────────────────────────────────────────────────
interface Venda {
  id: string;
  valor_bruto: number;
  data_competencia: string;
  forma_pagamento_enum: string | null;
  parcelas: number | null;
  feegow_id: string | null;
  invoice_id: string | null;
  status_conciliacao: string;
  status_recebimento: string;
  convenio_id: string | null;
}

interface GetnetTx {
  id: string;
  tipo_extrato: string;
  data_venda: string;
  valor_bruto: number;
  valor_taxa: number;
  valor_liquido: number;
  modalidade: string | null;
  forma_pagamento: string | null;
  parcelas: number;
  data_prevista_pagamento: string | null;
  comprovante_venda: string;
  status_conciliacao: string;
  venda_id: string | null;
  transacao_bancaria_id: string | null;
}

interface TransacaoBancaria {
  id: string;
  valor: number;
  data_transacao: string;
  tipo: string;
  descricao: string | null;
  status: string;
  fitid: string;
}

interface MatchResult {
  venda_id: string | null;
  getnet_id: string | null;
  transacao_bancaria_id: string | null;
  score: number;
  metodo: string;
  divergencia: number;
  tipo: string;
  valor_bruto: number;
  valor_taxa: number;
  valor_liquido: number;
}

// ─── Helpers ────────────────────────────────────────────────────
function daysDiff(a: string, b: string): number {
  return Math.abs(
    (new Date(a).getTime() - new Date(b).getTime()) / 86400000
  );
}

function dateOnly(d: string): string {
  return d.split("T")[0];
}

/** Check if date falls on Friday(5) or Saturday(6) */
function isFridayOrSaturday(dateStr: string): boolean {
  const day = new Date(dateStr).getDay();
  return day === 5 || day === 6;
}

/** Get next business day (skip Sat=6, Sun=0) */
function nextBusinessDay(dateStr: string): string {
  const d = new Date(dateStr);
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  return d.toISOString().split("T")[0];
}

/** Check if bankDate is an expected settlement date for the given sale/getnet date,
 *  considering that Friday/Saturday sales settle on next Monday */
function isValidSettlementDate(
  saleDate: string,
  bankDate: string,
  previstoDate: string | null,
  toleranceDays: number = 2
): boolean {
  const saleDateOnly = dateOnly(saleDate);
  const bankDateOnly = dateOnly(bankDate);

  // If Getnet provides expected payment date, use it with tolerance
  if (previstoDate) {
    const diff = daysDiff(previstoDate, bankDateOnly);
    // Allow tolerance + extra for weekend shifts
    if (diff <= toleranceDays + 2) return true;
  }

  // Business day rule: Fri/Sat → next Monday
  if (isFridayOrSaturday(saleDateOnly)) {
    const expectedDate = nextBusinessDay(saleDateOnly);
    // For debit: D+1 but adjusted for weekends
    if (daysDiff(expectedDate, bankDateOnly) <= toleranceDays) return true;
  }

  // Standard: D+0 to D+toleranceDays
  if (daysDiff(saleDateOnly, bankDateOnly) <= toleranceDays) return true;

  return false;
}

// ─── Step 1: Feegow Venda ↔ Getnet ─────────────────────────────
function matchVendasGetnet(
  vendas: Venda[],
  getnetTxs: GetnetTx[]
): MatchResult[] {
  const results: MatchResult[] = [];
  const usedGetnet = new Set<string>();

  for (const venda of vendas) {
    let bestMatch: { gt: GetnetTx; score: number; div: number } | null = null;

    for (const gt of getnetTxs) {
      if (usedGetnet.has(gt.id)) continue;
      if (gt.venda_id && gt.venda_id !== venda.id) continue;

      // Match by valor_bruto (exact or very close)
      const div = Math.abs(venda.valor_bruto - gt.valor_bruto);
      const pctDiff = venda.valor_bruto > 0 ? (div / venda.valor_bruto) * 100 : 100;
      if (pctDiff > 1 && div > 0.5) continue; // Very tight: 1% or R$0.50

      // Match by date (same day or D+1)
      const dias = daysDiff(venda.data_competencia, dateOnly(gt.data_venda));
      if (dias > 1) continue; // Venda and Getnet should be same day

      // Match payment method
      let methodBonus = 0;
      if (venda.forma_pagamento_enum && gt.modalidade) {
        const feegowMethod = venda.forma_pagamento_enum.toLowerCase();
        const getnetMethod = gt.modalidade.toLowerCase();
        if (
          (feegowMethod.includes("credito") && getnetMethod.includes("cr")) ||
          (feegowMethod.includes("debito") && getnetMethod.includes("d")) ||
          (feegowMethod.includes("pix") && gt.tipo_extrato === "pix")
        ) {
          methodBonus = 15;
        }
      }

      // Match parcelas
      let parcelaBonus = 0;
      if (venda.parcelas && gt.parcelas && venda.parcelas === gt.parcelas) {
        parcelaBonus = 5;
      }

      let score = 100 - pctDiff * 10 - dias * 5 + methodBonus + parcelaBonus;
      if (div === 0) score += 20;
      score = Math.max(0, Math.min(100, score));

      if (score > 60 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { gt, score, div };
      }
    }

    if (bestMatch) {
      usedGetnet.add(bestMatch.gt.id);
      results.push({
        venda_id: venda.id,
        getnet_id: bestMatch.gt.id,
        transacao_bancaria_id: null,
        score: bestMatch.score,
        metodo: bestMatch.div === 0 ? "exato_feegow_getnet" : "aproximado_feegow_getnet",
        divergencia: bestMatch.div,
        tipo: "venda_getnet",
        valor_bruto: bestMatch.gt.valor_bruto,
        valor_taxa: bestMatch.gt.valor_taxa,
        valor_liquido: bestMatch.gt.valor_liquido,
      });
    }
  }
  return results;
}

// ─── Step 2: Getnet ↔ Banco (by valor_liquido + data prevista) ──
function matchGetnetBanco(
  getnetTxs: GetnetTx[],
  creditos: TransacaoBancaria[]
): MatchResult[] {
  const results: MatchResult[] = [];
  const usedBanco = new Set<string>();

  // Group getnet by data_prevista_pagamento for batch matching
  for (const gt of getnetTxs) {
    if (gt.transacao_bancaria_id) continue;
    let bestMatch: { tb: TransacaoBancaria; score: number; div: number } | null = null;

    for (const tb of creditos) {
      if (usedBanco.has(tb.id)) continue;

      // Match by valor_liquido (what actually arrives in the bank)
      const div = Math.abs(gt.valor_liquido - tb.valor);
      const pctDiff = gt.valor_liquido > 0 ? (div / gt.valor_liquido) * 100 : 100;
      if (pctDiff > 1 && div > 0.5) continue;

      // Use business day settlement rules
      const validDate = isValidSettlementDate(
        dateOnly(gt.data_venda),
        tb.data_transacao,
        gt.data_prevista_pagamento,
        2
      );
      if (!validDate) {
        // Also check if bank date is near data_prevista_pagamento with wider window
        if (gt.data_prevista_pagamento) {
          const diff = daysDiff(gt.data_prevista_pagamento, tb.data_transacao);
          if (diff > 3) continue;
        } else {
          // No previsto date, use wider window for debit cards (D+1)
          const dayDiff = daysDiff(dateOnly(gt.data_venda), tb.data_transacao);
          if (dayDiff > 5) continue;
        }
      }

      let score = 100 - pctDiff * 10;
      if (div === 0) score += 20;
      // Bonus for matching on previsto date
      if (gt.data_prevista_pagamento && gt.data_prevista_pagamento === tb.data_transacao) {
        score += 15;
      }
      score = Math.max(0, Math.min(100, score));

      if (score > 50 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { tb, score, div };
      }
    }

    if (bestMatch) {
      usedBanco.add(bestMatch.tb.id);
      results.push({
        venda_id: null,
        getnet_id: gt.id,
        transacao_bancaria_id: bestMatch.tb.id,
        score: bestMatch.score,
        metodo: bestMatch.div === 0 ? "exato_getnet_banco" : "aproximado_getnet_banco",
        divergencia: bestMatch.div,
        tipo: "getnet_banco",
        valor_bruto: gt.valor_bruto,
        valor_taxa: gt.valor_taxa,
        valor_liquido: gt.valor_liquido,
      });
    }
  }
  return results;
}

// ─── Step 3: Débitos automáticos (same as before) ───────────────
async function processDebitosAutomaticos(
  supabase: any,
  clinicaId: string,
  debitos: TransacaoBancaria[]
): Promise<{ processados: number; baixados: number; erros: string[] }> {
  const stats = { processados: 0, baixados: 0, erros: [] as string[] };

  const { data: regras } = await supabase
    .from("regras_conciliacao_debito")
    .select("*")
    .eq("clinica_id", clinicaId)
    .eq("ativo", true)
    .order("prioridade", { ascending: true });

  if (!regras || regras.length === 0) return stats;

  for (const debito of debitos) {
    if (debito.status !== "pendente") continue;
    stats.processados++;

    for (const regra of regras) {
      try {
        const regex = new RegExp(regra.descricao_regex, "i");
        if (!regex.test(debito.descricao || "")) continue;

        if (regra.tipo_destino === "divida" && regra.destino_id) {
          const { data: parcela } = await supabase
            .from("divida_parcelas_previstas")
            .select("*")
            .eq("divida_id", regra.destino_id)
            .eq("clinica_id", clinicaId)
            .eq("pago", false)
            .gte("competencia", new Date(debito.data_transacao).toISOString().split("T")[0])
            .order("competencia", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (parcela) {
            const diff = Math.abs(parcela.pmt - debito.valor);
            const pctDiff = parcela.pmt > 0 ? (diff / parcela.pmt) * 100 : 100;
            if (pctDiff > regra.tolerancia_pct && diff > regra.tolerancia_abs) continue;

            await supabase.from("divida_parcelas_previstas").update({ pago: true }).eq("id", parcela.id);
            await supabase.from("divida_pagamentos").insert({
              clinica_id: clinicaId, divida_id: regra.destino_id,
              data_pagamento: debito.data_transacao, valor_pago: debito.valor,
              principal_amortizado: parcela.amortizacao, juros_pago: parcela.juros,
              origem: "extrato", transacao_bancaria_id: debito.fitid,
              observacao: `Auto-conciliado: ${debito.descricao}`,
            });

            const { data: divida } = await supabase.from("dividas").select("saldo").eq("id", regra.destino_id).single();
            if (divida) {
              await supabase.from("dividas")
                .update({ saldo: Math.max(0, divida.saldo - (parcela.amortizacao || debito.valor)) })
                .eq("id", regra.destino_id);
            }

            await supabase.from("transacoes_bancarias")
              .update({ status: "conciliado", categoria_auto: `divida:${regra.destino_id}` })
              .eq("id", debito.id);

            stats.baixados++;
            break;
          }
        } else if (regra.tipo_destino === "imposto" && regra.imposto) {
          const { data: imposto } = await supabase
            .from("impostos_devidos")
            .select("*")
            .eq("clinica_id", clinicaId)
            .eq("imposto", regra.imposto)
            .eq("status", "aberto")
            .order("competencia", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (imposto) {
            const diff = Math.abs(imposto.valor_devido - debito.valor);
            const pctDiff = imposto.valor_devido > 0 ? (diff / imposto.valor_devido) * 100 : 100;
            if (pctDiff > regra.tolerancia_pct && diff > regra.tolerancia_abs) continue;

            await supabase.from("imposto_pagamentos").insert({
              clinica_id: clinicaId, impostos_devidos_id: imposto.id,
              data_pagamento: debito.data_transacao, valor_pago: debito.valor,
              origem: "extrato", transacao_bancaria_id: debito.fitid,
            });

            const novoValorPago = (imposto.valor_pago || 0) + debito.valor;
            await supabase.from("impostos_devidos")
              .update({ valor_pago: novoValorPago, status: novoValorPago >= imposto.valor_devido ? "pago" : "aberto" })
              .eq("id", imposto.id);

            await supabase.from("transacoes_bancarias")
              .update({ status: "conciliado", categoria_auto: `imposto:${regra.imposto}` })
              .eq("id", debito.id);

            stats.baixados++;
            break;
          }
        } else if (regra.tipo_destino === "conta_pagar") {
          await supabase.from("contas_pagar_lancamentos").insert({
            clinica_id: clinicaId, data_competencia: debito.data_transacao,
            data_pagamento: debito.data_transacao, valor: debito.valor,
            descricao: debito.descricao, status: "pago", tipo_despesa: "fixo",
            forma_pagamento: "debito_automatico", ofx_transaction_id: debito.fitid,
            plano_contas_id: regra.destino_id,
          });

          await supabase.from("transacoes_bancarias")
            .update({ status: "conciliado", categoria_auto: `ap:${regra.destino_id}` })
            .eq("id", debito.id);

          stats.baixados++;
          break;
        }
      } catch (e) {
        stats.erros.push(`Regra ${regra.id} / debito ${debito.fitid}: ${e.message}`);
      }
    }
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
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json().catch(() => ({}));
    const clinicaId = body.clinica_id;
    const dateStart = body.date_start;
    const dateEnd = body.date_end;
    const dryRun = body.dry_run === true;

    if (!clinicaId || !dateStart || !dateEnd) {
      return new Response(
        JSON.stringify({ error: "clinica_id, date_start e date_end obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log
    const { data: logData } = await supabase
      .from("integracao_logs")
      .insert({
        clinica_id: clinicaId, integracao: "conciliacao",
        acao: dryRun ? "dry_run" : "run", endpoint: "run-reconciliation",
        status: "em_andamento",
      })
      .select("id")
      .single();
    const logId = logData?.id;

    // ── Load data ─────────────────────────────────────────────
    const [vendasRes, getnetRes, bancoCreditosRes, bancoDebitosRes] = await Promise.all([
      supabase
        .from("transacoes_vendas")
        .select("id, valor_bruto, data_competencia, forma_pagamento_enum, parcelas, feegow_id, invoice_id, status_conciliacao, status_recebimento, convenio_id")
        .eq("clinica_id", clinicaId)
        .gte("data_competencia", dateStart)
        .lte("data_competencia", dateEnd)
        .in("status_conciliacao", ["pendente"]),
      supabase
        .from("getnet_transacoes")
        .select("id, tipo_extrato, data_venda, valor_bruto, valor_taxa, valor_liquido, modalidade, forma_pagamento, parcelas, data_prevista_pagamento, comprovante_venda, status_conciliacao, venda_id, transacao_bancaria_id")
        .eq("clinica_id", clinicaId)
        .gte("data_venda", `${dateStart}T00:00:00`)
        .lte("data_venda", `${dateEnd}T23:59:59`)
        .eq("status_conciliacao", "pendente"),
      supabase
        .from("transacoes_bancarias")
        .select("id, valor, data_transacao, tipo, descricao, status, fitid")
        .eq("clinica_id", clinicaId)
        .eq("tipo", "credito")
        .eq("status", "pendente")
        .gte("data_transacao", dateStart)
        .lte("data_transacao", dateEnd),
      supabase
        .from("transacoes_bancarias")
        .select("id, valor, data_transacao, tipo, descricao, status, fitid, banco")
        .eq("clinica_id", clinicaId)
        .eq("tipo", "debito")
        .eq("status", "pendente")
        .gte("data_transacao", dateStart)
        .lte("data_transacao", dateEnd),
    ]);

    const vendas: Venda[] = vendasRes.data || [];
    const getnetTxs: GetnetTx[] = getnetRes.data || [];
    const creditos: TransacaoBancaria[] = bancoCreditosRes.data || [];
    const debitos: TransacaoBancaria[] = (bancoDebitosRes.data || []) as any;

    // ── Step 1: Feegow ↔ Getnet ──────────────────────────────
    const matchesVG = matchVendasGetnet(vendas, getnetTxs);

    // ── Step 2: Getnet ↔ Banco (créditos by valor_liquido) ───
    const matchesGB = matchGetnetBanco(getnetTxs, creditos);

    // ── Step 3: Merge para conciliação tripla ────────────────
    const tripleMatches: MatchResult[] = [];
    for (const vg of matchesVG) {
      const gb = matchesGB.find((m) => m.getnet_id === vg.getnet_id);
      if (gb) {
        tripleMatches.push({
          venda_id: vg.venda_id,
          getnet_id: vg.getnet_id,
          transacao_bancaria_id: gb.transacao_bancaria_id,
          score: Math.min(vg.score, gb.score),
          metodo: "triplo_feegow_getnet_banco",
          divergencia: vg.divergencia + gb.divergencia,
          tipo: "triplo",
          valor_bruto: vg.valor_bruto,
          valor_taxa: vg.valor_taxa,
          valor_liquido: vg.valor_liquido,
        });
      }
    }

    const allMatches = [...matchesVG, ...matchesGB, ...tripleMatches];

    // ── Persist ──────────────────────────────────────────────
    let persisted = 0;
    let debitoStats = { processados: 0, baixados: 0, erros: [] as string[] };

    if (!dryRun) {
      for (const match of allMatches) {
        const { error } = await supabase.from("conciliacoes").insert({
          clinica_id: clinicaId,
          venda_id: match.venda_id,
          transacao_bancaria_id: match.transacao_bancaria_id,
          status: match.divergencia === 0 ? "conciliado" : "divergente",
          divergencia: match.divergencia,
          observacao: `Auto: ${match.metodo} (score: ${match.score}) | Bruto: ${match.valor_bruto} | Taxa: ${match.valor_taxa} | Líquido: ${match.valor_liquido}`,
          tipo: match.tipo,
          metodo_match: match.metodo,
          score: match.score,
        });

        if (!error) {
          persisted++;

          // Update venda
          if (match.venda_id) {
            await supabase.from("transacoes_vendas")
              .update({
                status_conciliacao: match.divergencia === 0 ? "conciliado" : "divergente",
                status_recebimento: match.transacao_bancaria_id ? "recebido" : "a_receber",
              })
              .eq("id", match.venda_id);
          }

          // Update getnet transação
          if (match.getnet_id) {
            const updates: any = { status_conciliacao: "conciliado" };
            if (match.venda_id) updates.venda_id = match.venda_id;
            if (match.transacao_bancaria_id) updates.transacao_bancaria_id = match.transacao_bancaria_id;
            await supabase.from("getnet_transacoes").update(updates).eq("id", match.getnet_id);
          }

          // Update banco
          if (match.transacao_bancaria_id) {
            await supabase.from("transacoes_bancarias")
              .update({ status: "conciliado" })
              .eq("id", match.transacao_bancaria_id);
          }

          // Create recebimento for triple matches
          if (match.tipo === "triplo" && match.venda_id) {
            await supabase.from("transacoes_recebimentos").insert({
              clinica_id: clinicaId,
              venda_id: match.venda_id,
              valor: match.valor_liquido,
              data_recebimento: dateStart, // Will be refined
              origem: "getnet",
              observacao: `Conciliação tripla - Bruto: ${match.valor_bruto}, Taxa: ${match.valor_taxa}`,
            });
          }
        }
      }

      // Step 4: Débitos automáticos
      debitoStats = await processDebitosAutomaticos(supabase, clinicaId, debitos);
    }

    // ── Summary ──────────────────────────────────────────────
    const summary = {
      periodo: { start: dateStart, end: dateEnd },
      totais: {
        vendas_feegow: vendas.length,
        getnet_transacoes: getnetTxs.length,
        creditos_banco: creditos.length,
        debitos_banco: debitos.length,
      },
      matches: {
        feegow_getnet: matchesVG.length,
        getnet_banco: matchesGB.length,
        triplo: tripleMatches.length,
        total: allMatches.length,
        persisted,
      },
      debitos_automaticos: debitoStats,
      pendencias: {
        vendas_sem_match: vendas.length - matchesVG.length,
        getnet_sem_match: getnetTxs.length -
          new Set([...matchesVG.map((m) => m.getnet_id), ...matchesGB.map((m) => m.getnet_id)]).size,
        creditos_sem_match: creditos.length - matchesGB.length,
        debitos_sem_match: debitos.length - debitoStats.baixados,
      },
      taxas_getnet: {
        total_bruto: matchesVG.reduce((s, m) => s + m.valor_bruto, 0),
        total_taxa: matchesVG.reduce((s, m) => s + m.valor_taxa, 0),
        total_liquido: matchesVG.reduce((s, m) => s + m.valor_liquido, 0),
      },
      dry_run: dryRun,
    };

    if (logId) {
      await supabase.from("integracao_logs")
        .update({
          status: "sucesso", fim: new Date().toISOString(),
          registros_processados: allMatches.length + debitoStats.processados,
          registros_criados: persisted + debitoStats.baixados,
          detalhes: summary,
        })
        .eq("id", logId);
    }

    return new Response(JSON.stringify({ success: true, ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("run-reconciliation error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
