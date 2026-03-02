import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
  banco?: string;
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

interface LancamentoPendente {
  id: string;
  valor: number;
  data_competencia: string;
  data_vencimento: string | null;
  fornecedor: string | null;
  descricao: string | null;
  forma_pagamento: string | null;
}

interface ExpenseMatchResult {
  lancamento_id: string;
  transacao_bancaria_id: string;
  score: number;
  rule: string;
  divergencia: number;
  status: "conciliado" | "divergente";
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

function isFridayOrSaturday(dateStr: string): boolean {
  const day = new Date(dateStr).getDay();
  return day === 5 || day === 6;
}

function nextBusinessDay(dateStr: string): string {
  const d = new Date(dateStr);
  do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
  return d.toISOString().split("T")[0];
}

function isValidSettlementDate(saleDate: string, bankDate: string, previstoDate: string | null, toleranceDays = 2): boolean {
  const saleDateOnly = dateOnly(saleDate);
  const bankDateOnly = dateOnly(bankDate);
  if (previstoDate) {
    if (daysDiff(previstoDate, bankDateOnly) <= toleranceDays + 2) return true;
  }
  if (isFridayOrSaturday(saleDateOnly)) {
    const expectedDate = nextBusinessDay(saleDateOnly);
    if (daysDiff(expectedDate, bankDateOnly) <= toleranceDays) return true;
  }
  if (daysDiff(saleDateOnly, bankDateOnly) <= toleranceDays) return true;
  return false;
}

/** Normalize text for fuzzy matching: lowercase, no accents, no punctuation */
function normalizeText(s: string | null | undefined): string {
  if (!s) return "";
  return s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Simple text similarity (0-1) using shared words */
function textSimilarity(a: string, b: string): number {
  const wa = new Set(normalizeText(a).split(" ").filter(w => w.length > 2));
  const wb = new Set(normalizeText(b).split(" ").filter(w => w.length > 2));
  if (wa.size === 0 || wb.size === 0) return 0;
  let shared = 0;
  for (const w of wa) { if (wb.has(w)) shared++; }
  return shared / Math.max(wa.size, wb.size);
}

// ─── Step 1: Feegow Venda ↔ Getnet ─────────────────────────────
function matchVendasGetnet(vendas: Venda[], getnetTxs: GetnetTx[]): MatchResult[] {
  const results: MatchResult[] = [];
  const usedGetnet = new Set<string>();

  for (const venda of vendas) {
    let bestMatch: { gt: GetnetTx; score: number; div: number } | null = null;

    for (const gt of getnetTxs) {
      if (usedGetnet.has(gt.id)) continue;
      if (gt.venda_id && gt.venda_id !== venda.id) continue;

      const div = Math.abs(venda.valor_bruto - gt.valor_bruto);
      const pctDiff = venda.valor_bruto > 0 ? (div / venda.valor_bruto) * 100 : 100;
      if (pctDiff > 1 && div > 0.5) continue;

      const dias = daysDiff(venda.data_competencia, dateOnly(gt.data_venda));
      if (dias > 1) continue;

      let methodBonus = 0;
      if (venda.forma_pagamento_enum && gt.modalidade) {
        const fm = venda.forma_pagamento_enum.toLowerCase();
        const gm = gt.modalidade.toLowerCase();
        if ((fm.includes("credito") && gm.includes("cr")) ||
            (fm.includes("debito") && gm.includes("d")) ||
            (fm.includes("pix") && gt.tipo_extrato === "pix")) {
          methodBonus = 15;
        }
      }

      let parcelaBonus = 0;
      if (venda.parcelas && gt.parcelas && venda.parcelas === gt.parcelas) parcelaBonus = 5;

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
        venda_id: venda.id, getnet_id: bestMatch.gt.id, transacao_bancaria_id: null,
        score: bestMatch.score,
        metodo: bestMatch.div === 0 ? "exato_feegow_getnet" : "aproximado_feegow_getnet",
        divergencia: bestMatch.div, tipo: "venda_getnet",
        valor_bruto: bestMatch.gt.valor_bruto, valor_taxa: bestMatch.gt.valor_taxa,
        valor_liquido: bestMatch.gt.valor_liquido,
      });
    }
  }
  return results;
}

// ─── Step 2: Getnet ↔ Banco ────────────────────────────────────
function matchGetnetBanco(getnetTxs: GetnetTx[], creditos: TransacaoBancaria[]): MatchResult[] {
  const results: MatchResult[] = [];
  const usedBanco = new Set<string>();

  for (const gt of getnetTxs) {
    if (gt.transacao_bancaria_id) continue;
    let bestMatch: { tb: TransacaoBancaria; score: number; div: number } | null = null;

    for (const tb of creditos) {
      if (usedBanco.has(tb.id)) continue;
      const div = Math.abs(gt.valor_liquido - tb.valor);
      const pctDiff = gt.valor_liquido > 0 ? (div / gt.valor_liquido) * 100 : 100;
      if (pctDiff > 1 && div > 0.5) continue;

      const validDate = isValidSettlementDate(dateOnly(gt.data_venda), tb.data_transacao, gt.data_prevista_pagamento, 2);
      if (!validDate) {
        if (gt.data_prevista_pagamento) {
          if (daysDiff(gt.data_prevista_pagamento, tb.data_transacao) > 3) continue;
        } else {
          if (daysDiff(dateOnly(gt.data_venda), tb.data_transacao) > 5) continue;
        }
      }

      let score = 100 - pctDiff * 10;
      if (div === 0) score += 20;
      if (gt.data_prevista_pagamento && gt.data_prevista_pagamento === tb.data_transacao) score += 15;
      score = Math.max(0, Math.min(100, score));

      if (score > 50 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { tb, score, div };
      }
    }

    if (bestMatch) {
      usedBanco.add(bestMatch.tb.id);
      results.push({
        venda_id: null, getnet_id: gt.id, transacao_bancaria_id: bestMatch.tb.id,
        score: bestMatch.score,
        metodo: bestMatch.div === 0 ? "exato_getnet_banco" : "aproximado_getnet_banco",
        divergencia: bestMatch.div, tipo: "getnet_banco",
        valor_bruto: gt.valor_bruto, valor_taxa: gt.valor_taxa, valor_liquido: gt.valor_liquido,
      });
    }
  }
  return results;
}

// ─── Step 3: Débitos automáticos ────────────────────────────────
async function processDebitosAutomaticos(
  supabase: any, clinicaId: string, debitos: TransacaoBancaria[]
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
            .from("divida_parcelas_previstas").select("*")
            .eq("divida_id", regra.destino_id).eq("clinica_id", clinicaId)
            .eq("pago", false)
            .gte("competencia", dateOnly(debito.data_transacao))
            .order("competencia", { ascending: true }).limit(1).maybeSingle();

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
            .from("impostos_devidos").select("*")
            .eq("clinica_id", clinicaId).eq("imposto", regra.imposto)
            .eq("status", "aberto").order("competencia", { ascending: true })
            .limit(1).maybeSingle();

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
            descricao: debito.descricao, status: "pago", tipo_despesa: "variavel",
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

// ─── Step 4: Reconcile Expenses (AP ↔ Extrato Débitos) ──────────
async function reconcileExpenses(
  supabase: any,
  clinicaId: string,
  debitos: TransacaoBancaria[],
  toleranciaValor = 0.50,
  toleranciaDias = 3
): Promise<{ conciliados: number; divergentes: number; pendentes: number; erros: string[] }> {
  const stats = { conciliados: 0, divergentes: 0, pendentes: 0, erros: [] as string[] };

  // Load pending AP lancamentos
  const { data: lancamentos } = await supabase
    .from("contas_pagar_lancamentos")
    .select("id, valor, data_competencia, data_vencimento, fornecedor, descricao, forma_pagamento")
    .eq("clinica_id", clinicaId)
    .eq("status", "pendente_conciliacao")
    .is("data_pagamento", null);

  if (!lancamentos || lancamentos.length === 0) return stats;

  // Get already reconciled transaction IDs to avoid duplicates
  const { data: jaConc } = await supabase
    .from("conciliacao_despesas")
    .select("transacao_bancaria_id")
    .eq("clinica_id", clinicaId)
    .eq("status", "conciliado")
    .not("transacao_bancaria_id", "is", null);

  const usedTxIds = new Set((jaConc || []).map((r: any) => r.transacao_bancaria_id));

  // Also get already reconciled lancamento IDs
  const { data: jaLanc } = await supabase
    .from("conciliacao_despesas")
    .select("lancamento_id")
    .eq("clinica_id", clinicaId)
    .eq("status", "conciliado");

  const usedLancIds = new Set((jaLanc || []).map((r: any) => r.lancamento_id));

  // Filter available debits (negative/debito, pending, not used for getnet/receitas, not GETNET memo)
  const availableDebits = debitos.filter(d =>
    d.status === "pendente" &&
    !usedTxIds.has(d.id) &&
    !normalizeText(d.descricao).includes("getnet")
  );

  const usedDebits = new Set<string>();
  const matches: ExpenseMatchResult[] = [];

  for (const lanc of lancamentos as LancamentoPendente[]) {
    if (usedLancIds.has(lanc.id)) continue;

    const candidates: { tb: TransacaoBancaria; score: number; div: number; rule: string }[] = [];
    const lancVal = lanc.valor;
    const lancDate = lanc.data_vencimento || lanc.data_competencia;
    const lancForn = normalizeText(lanc.fornecedor);
    const lancDesc = normalizeText(lanc.descricao);
    const lancFp = (lanc.forma_pagamento || "").toLowerCase();

    for (const tb of availableDebits) {
      if (usedDebits.has(tb.id)) continue;

      const absVal = Math.abs(tb.valor);
      const valorDiff = Math.abs(lancVal - absVal);
      if (valorDiff > toleranciaValor && (lancVal > 0 ? valorDiff / lancVal * 100 : 100) > 2) continue;

      const dias = daysDiff(lancDate, dateOnly(tb.data_transacao));
      if (dias > toleranciaDias) continue;

      // Score calculation
      let score = 0;
      let rule = "";

      // Value score (0-60)
      if (valorDiff === 0) { score += 60; rule += "valor_exato "; }
      else if (valorDiff <= 0.10) { score += 55; rule += "valor_centavos "; }
      else if (valorDiff <= toleranciaValor) { score += 45; rule += "valor_tolerancia "; }
      else { score += 30; rule += "valor_pct "; }

      // Date score (0-25)
      if (dias === 0) { score += 25; rule += "data_exata "; }
      else if (dias === 1) { score += 20; rule += "data_d1 "; }
      else if (dias <= 2) { score += 15; rule += "data_d2 "; }
      else { score += 8; rule += "data_d3 "; }

      // Text similarity (0-15)
      const memo = normalizeText(tb.descricao);
      const simForn = textSimilarity(lancForn, memo);
      const simDesc = textSimilarity(lancDesc, memo);
      const textScore = Math.max(simForn, simDesc) * 15;
      score += textScore;
      if (textScore > 5) rule += "texto_similar ";

      // Bonus: payment method hints from memo
      if (memo.includes("pix") && (lancFp === "pix" || lancFp.includes("pix"))) {
        score += 10; rule += "pix_match ";
      } else if ((memo.includes("pagamento") && memo.includes("boleto")) && (lancFp === "boleto" || lancFp.includes("boleto"))) {
        score += 10; rule += "boleto_match ";
      } else if ((memo.includes("deb") || memo.includes("fatura")) && (lancFp === "debito_automatico" || lancFp.includes("debito"))) {
        score += 10; rule += "debito_match ";
      }

      score = Math.max(0, Math.min(100, score));
      candidates.push({ tb, score, div: valorDiff, rule: rule.trim() });
    }

    if (candidates.length === 0) {
      stats.pendentes++;
      continue;
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];

    // Check for ambiguity
    const hasAmbiguity = candidates.length > 1 && (candidates[1].score >= best.score - 5);

    if (best.score >= 80 && !hasAmbiguity) {
      // Auto-reconcile
      usedDebits.add(best.tb.id);
      matches.push({
        lancamento_id: lanc.id,
        transacao_bancaria_id: best.tb.id,
        score: best.score,
        rule: best.rule,
        divergencia: best.div,
        status: "conciliado",
      });
      stats.conciliados++;
    } else if (best.score >= 60 || hasAmbiguity) {
      // Divergent - needs review
      matches.push({
        lancamento_id: lanc.id,
        transacao_bancaria_id: best.tb.id,
        score: best.score,
        rule: best.rule + (hasAmbiguity ? " ambiguo" : ""),
        divergencia: best.div,
        status: "divergente",
      });
      stats.divergentes++;
    } else {
      stats.pendentes++;
    }
  }

  // Persist matches
  for (const m of matches) {
    try {
      // Update conciliacao_despesas (find existing or create)
      const { data: existing } = await supabase
        .from("conciliacao_despesas")
        .select("id")
        .eq("lancamento_id", m.lancamento_id)
        .eq("clinica_id", clinicaId)
        .in("status", ["pendente", "divergente"])
        .maybeSingle();

      if (existing) {
        await supabase.from("conciliacao_despesas").update({
          transacao_bancaria_id: m.transacao_bancaria_id,
          status: m.status,
          score: m.score,
          metodo_match: "auto_reconcile_expenses",
          rule_applied: m.rule,
          divergencia: m.divergencia,
          conciliado_em: m.status === "conciliado" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
      } else {
        await supabase.from("conciliacao_despesas").insert({
          clinica_id: clinicaId,
          lancamento_id: m.lancamento_id,
          transacao_bancaria_id: m.transacao_bancaria_id,
          status: m.status,
          score: m.score,
          metodo_match: "auto_reconcile_expenses",
          rule_applied: m.rule,
          divergencia: m.divergencia,
          conciliado_em: m.status === "conciliado" ? new Date().toISOString() : null,
        });
      }

      if (m.status === "conciliado") {
        // Update lancamento to pago
        const bankTx = debitos.find(d => d.id === m.transacao_bancaria_id);
        await supabase.from("contas_pagar_lancamentos").update({
          status: "pago",
          data_pagamento: bankTx ? dateOnly(bankTx.data_transacao) : new Date().toISOString().split("T")[0],
          match_score: m.score,
          match_rule: m.rule,
        }).eq("id", m.lancamento_id);

        // Mark bank transaction as used
        await supabase.from("transacoes_bancarias")
          .update({ status: "conciliado", categoria_auto: `ap_conciliado:${m.lancamento_id}` })
          .eq("id", m.transacao_bancaria_id);
      } else if (m.status === "divergente") {
        await supabase.from("contas_pagar_lancamentos").update({
          status: "divergente",
          match_score: m.score,
          match_rule: m.rule,
          needs_review: true,
        }).eq("id", m.lancamento_id);
      }
    } catch (e) {
      stats.erros.push(`Lanc ${m.lancamento_id}: ${e.message}`);
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
        .gte("data_competencia", dateStart).lte("data_competencia", dateEnd)
        .in("status_conciliacao", ["pendente"]),
      supabase
        .from("getnet_transacoes")
        .select("id, tipo_extrato, data_venda, valor_bruto, valor_taxa, valor_liquido, modalidade, forma_pagamento, parcelas, data_prevista_pagamento, comprovante_venda, status_conciliacao, venda_id, transacao_bancaria_id")
        .eq("clinica_id", clinicaId)
        .gte("data_venda", `${dateStart}T00:00:00`).lte("data_venda", `${dateEnd}T23:59:59`)
        .eq("status_conciliacao", "pendente"),
      supabase
        .from("transacoes_bancarias")
        .select("id, valor, data_transacao, tipo, descricao, status, fitid")
        .eq("clinica_id", clinicaId).eq("tipo", "credito").eq("status", "pendente")
        .gte("data_transacao", dateStart).lte("data_transacao", dateEnd),
      supabase
        .from("transacoes_bancarias")
        .select("id, valor, data_transacao, tipo, descricao, status, fitid, banco")
        .eq("clinica_id", clinicaId).eq("tipo", "debito").eq("status", "pendente")
        .gte("data_transacao", dateStart).lte("data_transacao", dateEnd),
    ]);

    const vendas: Venda[] = vendasRes.data || [];
    const getnetTxs: GetnetTx[] = getnetRes.data || [];
    const creditos: TransacaoBancaria[] = bancoCreditosRes.data || [];
    const debitos: TransacaoBancaria[] = (bancoDebitosRes.data || []) as any;

    // ── Step 1: Feegow ↔ Getnet ──────────────────────────────
    const matchesVG = matchVendasGetnet(vendas, getnetTxs);

    // ── Step 2: Getnet ↔ Banco ───────────────────────────────
    const matchesGB = matchGetnetBanco(getnetTxs, creditos);

    // ── Step 3: Triple merge ─────────────────────────────────
    const tripleMatches: MatchResult[] = [];
    for (const vg of matchesVG) {
      const gb = matchesGB.find((m) => m.getnet_id === vg.getnet_id);
      if (gb) {
        tripleMatches.push({
          venda_id: vg.venda_id, getnet_id: vg.getnet_id,
          transacao_bancaria_id: gb.transacao_bancaria_id,
          score: Math.min(vg.score, gb.score),
          metodo: "triplo_feegow_getnet_banco",
          divergencia: vg.divergencia + gb.divergencia, tipo: "triplo",
          valor_bruto: vg.valor_bruto, valor_taxa: vg.valor_taxa, valor_liquido: vg.valor_liquido,
        });
      }
    }

    const allMatches = [...matchesVG, ...matchesGB, ...tripleMatches];

    // ── Persist receita matches ──────────────────────────────
    let persisted = 0;
    let debitoStats = { processados: 0, baixados: 0, erros: [] as string[] };
    let expenseStats = { conciliados: 0, divergentes: 0, pendentes: 0, erros: [] as string[] };

    if (!dryRun) {
      for (const match of allMatches) {
        const { error } = await supabase.from("conciliacoes").insert({
          clinica_id: clinicaId, venda_id: match.venda_id,
          transacao_bancaria_id: match.transacao_bancaria_id,
          status: match.divergencia === 0 ? "conciliado" : "divergente",
          divergencia: match.divergencia,
          observacao: `Auto: ${match.metodo} (score: ${match.score}) | Bruto: ${match.valor_bruto} | Taxa: ${match.valor_taxa} | Líquido: ${match.valor_liquido}`,
          tipo: match.tipo, metodo_match: match.metodo, score: match.score,
        });

        if (!error) {
          persisted++;
          if (match.venda_id) {
            await supabase.from("transacoes_vendas").update({
              status_conciliacao: match.divergencia === 0 ? "conciliado" : "divergente",
              status_recebimento: match.transacao_bancaria_id ? "recebido" : "a_receber",
            }).eq("id", match.venda_id);
          }
          if (match.getnet_id) {
            const updates: any = { status_conciliacao: "conciliado" };
            if (match.venda_id) updates.venda_id = match.venda_id;
            if (match.transacao_bancaria_id) updates.transacao_bancaria_id = match.transacao_bancaria_id;
            await supabase.from("getnet_transacoes").update(updates).eq("id", match.getnet_id);
          }
          if (match.transacao_bancaria_id) {
            await supabase.from("transacoes_bancarias").update({ status: "conciliado" }).eq("id", match.transacao_bancaria_id);
          }
          if (match.tipo === "triplo" && match.venda_id) {
            await supabase.from("transacoes_recebimentos").insert({
              clinica_id: clinicaId, venda_id: match.venda_id,
              valor: match.valor_liquido, data_recebimento: dateStart,
              origem: "getnet",
              observacao: `Conciliação tripla - Bruto: ${match.valor_bruto}, Taxa: ${match.valor_taxa}`,
            });
          }
        }
      }

      // Step 4: Débitos automáticos (regras)
      debitoStats = await processDebitosAutomaticos(supabase, clinicaId, debitos);

      // Step 5: Reconcile Expenses (AP ↔ Extrato)
      expenseStats = await reconcileExpenses(supabase, clinicaId, debitos);
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
      despesas: {
        conciliadas: expenseStats.conciliados,
        divergentes: expenseStats.divergentes,
        pendentes: expenseStats.pendentes,
        erros: expenseStats.erros.length,
      },
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
      await supabase.from("integracao_logs").update({
        status: "sucesso", fim: new Date().toISOString(),
        registros_processados: allMatches.length + debitoStats.processados + (expenseStats.conciliados + expenseStats.divergentes),
        registros_criados: persisted + debitoStats.baixados + expenseStats.conciliados,
        detalhes: summary,
      }).eq("id", logId);
    }

    return new Response(JSON.stringify({ success: true, ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("run-reconciliation error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
