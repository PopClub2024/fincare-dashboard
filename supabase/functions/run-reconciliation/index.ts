import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Types ──────────────────────────────────────────────────────
interface Venda {
  id: string; valor_bruto: number; data_competencia: string;
  forma_pagamento_enum: string | null; parcelas: number | null;
  feegow_id: string | null; invoice_id: string | null;
  status_conciliacao: string; status_recebimento: string; convenio_id: string | null;
}
interface GetnetTx {
  id: string; tipo_extrato: string; data_venda: string; valor_bruto: number;
  valor_taxa: number; valor_liquido: number; modalidade: string | null;
  forma_pagamento: string | null; parcelas: number; data_prevista_pagamento: string | null;
  comprovante_venda: string; status_conciliacao: string;
  venda_id: string | null; transacao_bancaria_id: string | null;
}
interface TransacaoBancaria {
  id: string; valor: number; data_transacao: string; tipo: string;
  descricao: string | null; status: string; fitid: string; banco?: string;
}
interface MatchResult {
  venda_id: string | null; getnet_id: string | null; transacao_bancaria_id: string | null;
  score: number; metodo: string; divergencia: number; tipo: string;
  valor_bruto: number; valor_taxa: number; valor_liquido: number;
}
interface LancamentoPendente {
  id: string; valor: number; data_competencia: string; data_vencimento: string | null;
  fornecedor: string | null; descricao: string | null; forma_pagamento: string | null;
}
interface ExpenseMatchResult {
  lancamento_id: string; transacao_bancaria_id: string;
  score: number; rule: string; divergencia: number; status: "conciliado" | "divergente";
}
interface GetnetRecebivel {
  id: string; data_vencimento: string; bandeira_modalidade: string | null;
  meio_pagamento: string | null; valor_liquido: number; status: string | null; recebimento: string | null;
}
interface RecebiveisMatchResult {
  banco_tx_id: string; getnet_resumo_id: string;
  score: number; rule: string; divergencia: number; status: "conciliado" | "divergente";
}
interface GetnetDetalhado {
  id: string; data_venda: string | null; valor_venda: number;
  meio_pagamento: string | null; nsu: string | null; autorizacao: string | null;
  tipo_lancamento: string | null; lancamento: string | null;
}
interface VendaGatewayMatch {
  getnet_detalhado_id: string; feegow_venda_id: string;
  score: number; rule: string; divergencia: number; status: "conciliado" | "divergente";
}

// ─── Helpers ────────────────────────────────────────────────────
function daysDiff(a: string, b: string): number {
  return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
}
function dateOnly(d: string): string { return d.split("T")[0]; }
function isFridayOrSaturday(dateStr: string): boolean {
  const day = new Date(dateStr).getDay(); return day === 5 || day === 6;
}
function nextBusinessDay(dateStr: string): string {
  const d = new Date(dateStr);
  do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
  return d.toISOString().split("T")[0];
}
function isValidSettlementDate(saleDate: string, bankDate: string, previstoDate: string | null, toleranceDays = 2): boolean {
  const saleDateOnly = dateOnly(saleDate);
  const bankDateOnly = dateOnly(bankDate);
  if (previstoDate && daysDiff(previstoDate, bankDateOnly) <= toleranceDays + 2) return true;
  if (isFridayOrSaturday(saleDateOnly)) {
    const expectedDate = nextBusinessDay(saleDateOnly);
    if (daysDiff(expectedDate, bankDateOnly) <= toleranceDays) return true;
  }
  return daysDiff(saleDateOnly, bankDateOnly) <= toleranceDays;
}
function normalizeText(s: string | null | undefined): string {
  if (!s) return "";
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}
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
        if ((fm.includes("credito") && gm.includes("cr")) || (fm.includes("debito") && gm.includes("d")) || (fm.includes("pix") && gt.tipo_extrato === "pix")) methodBonus = 15;
      }
      let parcelaBonus = 0;
      if (venda.parcelas && gt.parcelas && venda.parcelas === gt.parcelas) parcelaBonus = 5;
      let score = 100 - pctDiff * 10 - dias * 5 + methodBonus + parcelaBonus;
      if (div === 0) score += 20;
      score = Math.max(0, Math.min(100, score));
      if (score > 60 && (!bestMatch || score > bestMatch.score)) bestMatch = { gt, score, div };
    }
    if (bestMatch) {
      usedGetnet.add(bestMatch.gt.id);
      results.push({
        venda_id: venda.id, getnet_id: bestMatch.gt.id, transacao_bancaria_id: null,
        score: bestMatch.score, metodo: bestMatch.div === 0 ? "exato_feegow_getnet" : "aproximado_feegow_getnet",
        divergencia: bestMatch.div, tipo: "venda_getnet",
        valor_bruto: bestMatch.gt.valor_bruto, valor_taxa: bestMatch.gt.valor_taxa, valor_liquido: bestMatch.gt.valor_liquido,
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
        if (gt.data_prevista_pagamento) { if (daysDiff(gt.data_prevista_pagamento, tb.data_transacao) > 3) continue; }
        else { if (daysDiff(dateOnly(gt.data_venda), tb.data_transacao) > 5) continue; }
      }
      let score = 100 - pctDiff * 10;
      if (div === 0) score += 20;
      if (gt.data_prevista_pagamento && gt.data_prevista_pagamento === tb.data_transacao) score += 15;
      score = Math.max(0, Math.min(100, score));
      if (score > 50 && (!bestMatch || score > bestMatch.score)) bestMatch = { tb, score, div };
    }
    if (bestMatch) {
      usedBanco.add(bestMatch.tb.id);
      results.push({
        venda_id: null, getnet_id: gt.id, transacao_bancaria_id: bestMatch.tb.id,
        score: bestMatch.score, metodo: bestMatch.div === 0 ? "exato_getnet_banco" : "aproximado_getnet_banco",
        divergencia: bestMatch.div, tipo: "getnet_banco",
        valor_bruto: gt.valor_bruto, valor_taxa: gt.valor_taxa, valor_liquido: gt.valor_liquido,
      });
    }
  }
  return results;
}

// ─── Step 3: Débitos automáticos ────────────────────────────────
async function processDebitosAutomaticos(supabase: any, clinicaId: string, debitos: TransacaoBancaria[]): Promise<{ processados: number; baixados: number; erros: string[] }> {
  const stats = { processados: 0, baixados: 0, erros: [] as string[] };
  const { data: regras } = await supabase.from("regras_conciliacao_debito").select("*").eq("clinica_id", clinicaId).eq("ativo", true).order("prioridade", { ascending: true });
  if (!regras || regras.length === 0) return stats;
  for (const debito of debitos) {
    if (debito.status !== "pendente") continue;
    stats.processados++;
    for (const regra of regras) {
      try {
        const regex = new RegExp(regra.descricao_regex, "i");
        if (!regex.test(debito.descricao || "")) continue;
        if (regra.tipo_destino === "divida" && regra.destino_id) {
          const { data: parcela } = await supabase.from("divida_parcelas_previstas").select("*").eq("divida_id", regra.destino_id).eq("clinica_id", clinicaId).eq("pago", false).gte("competencia", dateOnly(debito.data_transacao)).order("competencia", { ascending: true }).limit(1).maybeSingle();
          if (parcela) {
            const diff = Math.abs(parcela.pmt - debito.valor);
            const pctDiff = parcela.pmt > 0 ? (diff / parcela.pmt) * 100 : 100;
            if (pctDiff > regra.tolerancia_pct && diff > regra.tolerancia_abs) continue;
            await supabase.from("divida_parcelas_previstas").update({ pago: true }).eq("id", parcela.id);
            await supabase.from("divida_pagamentos").insert({ clinica_id: clinicaId, divida_id: regra.destino_id, data_pagamento: debito.data_transacao, valor_pago: debito.valor, principal_amortizado: parcela.amortizacao, juros_pago: parcela.juros, origem: "extrato", transacao_bancaria_id: debito.fitid, observacao: `Auto-conciliado: ${debito.descricao}` });
            const { data: divida } = await supabase.from("dividas").select("saldo").eq("id", regra.destino_id).single();
            if (divida) await supabase.from("dividas").update({ saldo: Math.max(0, divida.saldo - (parcela.amortizacao || debito.valor)) }).eq("id", regra.destino_id);
            await supabase.from("transacoes_bancarias").update({ status: "conciliado", categoria_auto: `divida:${regra.destino_id}` }).eq("id", debito.id);
            stats.baixados++; break;
          }
        } else if (regra.tipo_destino === "imposto" && regra.imposto) {
          const { data: imposto } = await supabase.from("impostos_devidos").select("*").eq("clinica_id", clinicaId).eq("imposto", regra.imposto).eq("status", "aberto").order("competencia", { ascending: true }).limit(1).maybeSingle();
          if (imposto) {
            const diff = Math.abs(imposto.valor_devido - debito.valor);
            const pctDiff = imposto.valor_devido > 0 ? (diff / imposto.valor_devido) * 100 : 100;
            if (pctDiff > regra.tolerancia_pct && diff > regra.tolerancia_abs) continue;
            await supabase.from("imposto_pagamentos").insert({ clinica_id: clinicaId, impostos_devidos_id: imposto.id, data_pagamento: debito.data_transacao, valor_pago: debito.valor, origem: "extrato", transacao_bancaria_id: debito.fitid });
            const novoValorPago = (imposto.valor_pago || 0) + debito.valor;
            await supabase.from("impostos_devidos").update({ valor_pago: novoValorPago, status: novoValorPago >= imposto.valor_devido ? "pago" : "aberto" }).eq("id", imposto.id);
            await supabase.from("transacoes_bancarias").update({ status: "conciliado", categoria_auto: `imposto:${regra.imposto}` }).eq("id", debito.id);
            stats.baixados++; break;
          }
        } else if (regra.tipo_destino === "conta_pagar") {
          await supabase.from("contas_pagar_lancamentos").insert({ clinica_id: clinicaId, data_competencia: debito.data_transacao, data_pagamento: debito.data_transacao, valor: debito.valor, descricao: debito.descricao, status: "pago", tipo_despesa: "variavel", forma_pagamento: "debito_automatico", ofx_transaction_id: debito.fitid, plano_contas_id: regra.destino_id });
          await supabase.from("transacoes_bancarias").update({ status: "conciliado", categoria_auto: `ap:${regra.destino_id}` }).eq("id", debito.id);
          stats.baixados++; break;
        }
      } catch (e: any) {
        stats.erros.push(`Regra ${regra.id} / debito ${debito.fitid}: ${e.message}`);
      }
    }
  }
  return stats;
}

// ─── Step 4: Reconcile Expenses (AP ↔ Extrato Débitos) ──────────
async function reconcileExpenses(supabase: any, clinicaId: string, debitos: TransacaoBancaria[], toleranciaValor = 0.50, toleranciaDias = 3): Promise<{ conciliados: number; divergentes: number; pendentes: number; erros: string[] }> {
  const stats = { conciliados: 0, divergentes: 0, pendentes: 0, erros: [] as string[] };
  const { data: lancamentos } = await supabase.from("contas_pagar_lancamentos").select("id, valor, data_competencia, data_vencimento, fornecedor, descricao, forma_pagamento").eq("clinica_id", clinicaId).eq("status", "pendente_conciliacao").is("data_pagamento", null);
  if (!lancamentos || lancamentos.length === 0) return stats;
  const { data: jaConc } = await supabase.from("conciliacao_despesas").select("transacao_bancaria_id").eq("clinica_id", clinicaId).eq("status", "conciliado").not("transacao_bancaria_id", "is", null);
  const usedTxIds = new Set((jaConc || []).map((r: any) => r.transacao_bancaria_id));
  const { data: jaLanc } = await supabase.from("conciliacao_despesas").select("lancamento_id").eq("clinica_id", clinicaId).eq("status", "conciliado");
  const usedLancIds = new Set((jaLanc || []).map((r: any) => r.lancamento_id));
  const availableDebits = debitos.filter(d => d.status === "pendente" && !usedTxIds.has(d.id) && !normalizeText(d.descricao).includes("getnet"));
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
      let score = 0; let rule = "";
      if (valorDiff === 0) { score += 60; rule += "valor_exato "; }
      else if (valorDiff <= 0.10) { score += 55; rule += "valor_centavos "; }
      else if (valorDiff <= toleranciaValor) { score += 45; rule += "valor_tolerancia "; }
      else { score += 30; rule += "valor_pct "; }
      if (dias === 0) { score += 25; rule += "data_exata "; }
      else if (dias === 1) { score += 20; rule += "data_d1 "; }
      else if (dias <= 2) { score += 15; rule += "data_d2 "; }
      else { score += 8; rule += "data_d3 "; }
      const memo = normalizeText(tb.descricao);
      const simForn = textSimilarity(lancForn, memo);
      const simDesc = textSimilarity(lancDesc, memo);
      const textScore = Math.max(simForn, simDesc) * 15;
      score += textScore;
      if (textScore > 5) rule += "texto_similar ";
      if (memo.includes("pix") && (lancFp === "pix" || lancFp.includes("pix"))) { score += 10; rule += "pix_match "; }
      else if ((memo.includes("pagamento") && memo.includes("boleto")) && (lancFp === "boleto" || lancFp.includes("boleto"))) { score += 10; rule += "boleto_match "; }
      else if ((memo.includes("deb") || memo.includes("fatura")) && (lancFp === "debito_automatico" || lancFp.includes("debito"))) { score += 10; rule += "debito_match "; }
      score = Math.max(0, Math.min(100, score));
      candidates.push({ tb, score, div: valorDiff, rule: rule.trim() });
    }
    if (candidates.length === 0) { stats.pendentes++; continue; }
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    const hasAmbiguity = candidates.length > 1 && (candidates[1].score >= best.score - 5);
    if (best.score >= 80 && !hasAmbiguity) {
      usedDebits.add(best.tb.id);
      matches.push({ lancamento_id: lanc.id, transacao_bancaria_id: best.tb.id, score: best.score, rule: best.rule, divergencia: best.div, status: "conciliado" });
      stats.conciliados++;
    } else if (best.score >= 60 || hasAmbiguity) {
      matches.push({ lancamento_id: lanc.id, transacao_bancaria_id: best.tb.id, score: best.score, rule: best.rule + (hasAmbiguity ? " ambiguo" : ""), divergencia: best.div, status: "divergente" });
      stats.divergentes++;
    } else { stats.pendentes++; }
  }
  for (const m of matches) {
    try {
      const { data: existing } = await supabase.from("conciliacao_despesas").select("id").eq("lancamento_id", m.lancamento_id).eq("clinica_id", clinicaId).in("status", ["pendente", "divergente"]).maybeSingle();
      if (existing) {
        await supabase.from("conciliacao_despesas").update({ transacao_bancaria_id: m.transacao_bancaria_id, status: m.status, score: m.score, metodo_match: "auto_reconcile_expenses", rule_applied: m.rule, divergencia: m.divergencia, conciliado_em: m.status === "conciliado" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", existing.id);
      } else {
        await supabase.from("conciliacao_despesas").insert({ clinica_id: clinicaId, lancamento_id: m.lancamento_id, transacao_bancaria_id: m.transacao_bancaria_id, status: m.status, score: m.score, metodo_match: "auto_reconcile_expenses", rule_applied: m.rule, divergencia: m.divergencia, conciliado_em: m.status === "conciliado" ? new Date().toISOString() : null });
      }
      if (m.status === "conciliado") {
        const bankTx = debitos.find(d => d.id === m.transacao_bancaria_id);
        await supabase.from("contas_pagar_lancamentos").update({ status: "pago", data_pagamento: bankTx ? dateOnly(bankTx.data_transacao) : new Date().toISOString().split("T")[0], match_score: m.score, match_rule: m.rule }).eq("id", m.lancamento_id);
        await supabase.from("transacoes_bancarias").update({ status: "conciliado", categoria_auto: `ap_conciliado:${m.lancamento_id}` }).eq("id", m.transacao_bancaria_id);
      } else if (m.status === "divergente") {
        await supabase.from("contas_pagar_lancamentos").update({ status: "divergente", match_score: m.score, match_rule: m.rule, needs_review: true }).eq("id", m.lancamento_id);
      }
    } catch (e: any) { stats.erros.push(`Lanc ${m.lancamento_id}: ${e.message}`); }
  }
  return stats;
}

// ─── Step 5: Banco ↔ Getnet Recebíveis (RESUMO) ────────────────
async function reconcileRecebiveisGetnet(supabase: any, clinicaId: string, creditos: TransacaoBancaria[], toleranciaValor = 0.50): Promise<{ conciliados: number; divergentes: number; pendentes: number; erros: string[] }> {
  const stats = { conciliados: 0, divergentes: 0, pendentes: 0, erros: [] as string[] };
  const { data: recebiveis } = await supabase.from("getnet_recebiveis_resumo").select("id, data_vencimento, bandeira_modalidade, meio_pagamento, valor_liquido, status, recebimento").eq("clinica_id", clinicaId);
  if (!recebiveis || recebiveis.length === 0) return stats;
  const { data: jaConc } = await supabase.from("conciliacao_recebiveis").select("banco_tx_id, getnet_resumo_id").eq("clinica_id", clinicaId).eq("status", "conciliado");
  const usedBancoIds = new Set((jaConc || []).map((r: any) => r.banco_tx_id));
  const usedResumoIds = new Set((jaConc || []).map((r: any) => r.getnet_resumo_id));
  const getnetCreditos = creditos.filter(c => c.status === "pendente" && !usedBancoIds.has(c.id) && normalizeText(c.descricao).includes("getnet"));
  const regularCreditos = getnetCreditos.filter(c => !normalizeText(c.descricao).includes("antecipacao"));
  const usedCreditos = new Set<string>();
  const usedRecebiveis = new Set<string>();
  const matches: RecebiveisMatchResult[] = [];

  for (const receb of recebiveis as GetnetRecebivel[]) {
    if (usedResumoIds.has(receb.id) || usedRecebiveis.has(receb.id)) continue;
    let best: { tb: TransacaoBancaria; score: number; div: number; rule: string } | null = null;
    for (const tb of regularCreditos) {
      if (usedCreditos.has(tb.id)) continue;
      const div = Math.abs(receb.valor_liquido - tb.valor);
      if (div > toleranciaValor && (receb.valor_liquido > 0 ? div / receb.valor_liquido * 100 : 100) > 2) continue;
      const dias = daysDiff(receb.data_vencimento, dateOnly(tb.data_transacao));
      if (dias > 3) continue;
      let score = 0; let rule = "";
      if (div === 0) { score += 60; rule += "valor_exato "; } else if (div <= 0.10) { score += 55; rule += "valor_centavos "; } else { score += 40; rule += "valor_tolerancia "; }
      if (dias === 0) { score += 25; rule += "data_exata "; } else if (dias === 1) { score += 18; rule += "data_d1 "; } else { score += 10; rule += `data_d${dias} `; }
      const memo = normalizeText(tb.descricao);
      const bandeira = normalizeText(receb.bandeira_modalidade);
      if (bandeira && memo) {
        const keywords = bandeira.split(" ").filter(w => w.length > 2);
        for (const kw of keywords) { if (memo.includes(kw)) { score += 10; rule += `bandeira_${kw} `; break; } }
      }
      if (memo.includes("debito") && receb.meio_pagamento === "cartao_debito") { score += 5; rule += "meio_debito "; }
      else if (memo.includes("credito") && receb.meio_pagamento === "cartao_credito") { score += 5; rule += "meio_credito "; }
      score = Math.max(0, Math.min(100, score));
      if (score > 50 && (!best || score > best.score)) best = { tb, score, div, rule: rule.trim() };
    }
    if (!best) { stats.pendentes++; continue; }
    usedCreditos.add(best.tb.id);
    usedRecebiveis.add(receb.id);
    const status = best.score >= 75 ? "conciliado" : "divergente";
    matches.push({ banco_tx_id: best.tb.id, getnet_resumo_id: receb.id, score: best.score, rule: best.rule, divergencia: best.div, status });
    if (status === "conciliado") stats.conciliados++; else stats.divergentes++;
  }
  for (const m of matches) {
    try {
      const { data: existing } = await supabase.from("conciliacao_recebiveis").select("id").eq("getnet_resumo_id", m.getnet_resumo_id).eq("clinica_id", clinicaId).in("status", ["pendente", "divergente"]).maybeSingle();
      if (existing) {
        await supabase.from("conciliacao_recebiveis").update({ banco_tx_id: m.banco_tx_id, status: m.status, score: m.score, rule_applied: m.rule, divergencia: m.divergencia, updated_at: new Date().toISOString() }).eq("id", existing.id);
      } else {
        await supabase.from("conciliacao_recebiveis").insert({ clinica_id: clinicaId, banco_tx_id: m.banco_tx_id, getnet_resumo_id: m.getnet_resumo_id, status: m.status, score: m.score, rule_applied: m.rule, divergencia: m.divergencia });
      }
      if (m.status === "conciliado") {
        await supabase.from("transacoes_bancarias").update({ status: "conciliado", categoria_auto: `getnet_recebivel:${m.getnet_resumo_id}` }).eq("id", m.banco_tx_id);
      }
    } catch (e: any) { stats.erros.push(`Recebivel ${m.getnet_resumo_id}: ${e.message}`); }
  }
  return stats;
}

// ─── Step 6b: Detalhado ↔ Resumo (composition) ─────────────────
async function reconcileDetalhadoResumo(supabase: any, clinicaId: string): Promise<{ vinculados: number; erros: string[] }> {
  const stats = { vinculados: 0, erros: [] as string[] };
  const { data: resumos } = await supabase.from("getnet_recebiveis_resumo").select("id, data_vencimento, bandeira_modalidade, valor_liquido").eq("clinica_id", clinicaId);
  if (!resumos || resumos.length === 0) return stats;
  const { data: detalhados } = await supabase.from("getnet_recebiveis_detalhado").select("id, data_vencimento, bandeira_modalidade, valor_liquido, resumo_id").eq("clinica_id", clinicaId);
  if (!detalhados || detalhados.length === 0) return stats;
  const unlinked = detalhados.filter((d: any) => !d.resumo_id);
  const groupedDet = new Map<string, any[]>();
  for (const d of unlinked) {
    const key = `${d.data_vencimento}|${(d.bandeira_modalidade || "").toUpperCase().trim()}`;
    if (!groupedDet.has(key)) groupedDet.set(key, []);
    groupedDet.get(key)!.push(d);
  }
  for (const resumo of resumos as any[]) {
    const key = `${resumo.data_vencimento}|${(resumo.bandeira_modalidade || "").toUpperCase().trim()}`;
    const candidates = groupedDet.get(key);
    if (!candidates || candidates.length === 0) continue;
    const sumLiq = candidates.reduce((s: number, d: any) => s + (d.valor_liquido || 0), 0);
    const diff = Math.abs(sumLiq - resumo.valor_liquido);
    if (diff <= 1.0) {
      for (const d of candidates) {
        const { error } = await supabase.from("getnet_recebiveis_detalhado").update({ resumo_id: resumo.id }).eq("id", d.id);
        if (error) stats.erros.push(`Det ${d.id}: ${error.message}`); else stats.vinculados++;
      }
      groupedDet.delete(key);
    }
  }
  return stats;
}

// ─── Step 7: Getnet Detalhado ↔ Feegow Vendas ──────────────────
async function reconcileVendasGateway(supabase: any, clinicaId: string, dateStart: string, dateEnd: string, toleranciaValor = 1.0, toleranciaDias = 2): Promise<{ conciliados: number; divergentes: number; pendentes: number; cobertura_pct: number; erros: string[] }> {
  const stats = { conciliados: 0, divergentes: 0, pendentes: 0, cobertura_pct: 0, erros: [] as string[] };
  const { data: detalhados } = await supabase.from("getnet_recebiveis_detalhado").select("id, data_venda, valor_venda, meio_pagamento, nsu, autorizacao, tipo_lancamento, lancamento").eq("clinica_id", clinicaId).not("data_venda", "is", null);
  if (!detalhados || detalhados.length === 0) return stats;
  const salesOnly = (detalhados as GetnetDetalhado[]).filter(d => !d.tipo_lancamento || (!normalizeText(d.tipo_lancamento).includes("negociacoes") && !normalizeText(d.lancamento).includes("cedido")));
  const { data: vendas } = await supabase.from("transacoes_vendas").select("id, valor_bruto, valor_pago, data_competencia, forma_pagamento_enum").eq("clinica_id", clinicaId).gte("data_competencia", dateStart).lte("data_competencia", dateEnd).in("forma_pagamento_enum", ["cartao_credito", "cartao_debito", "credito", "debito"]);
  if (!vendas || vendas.length === 0) { stats.pendentes = salesOnly.length; return stats; }
  const { data: jaConc } = await supabase.from("conciliacao_vendas_gateway").select("getnet_detalhado_id, feegow_venda_id").eq("clinica_id", clinicaId).eq("status", "conciliado");
  const usedGetnet = new Set((jaConc || []).map((r: any) => r.getnet_detalhado_id));
  const usedFeegow = new Set((jaConc || []).map((r: any) => r.feegow_venda_id));
  const matches: VendaGatewayMatch[] = [];
  const usedG = new Set<string>(); const usedF = new Set<string>();

  for (const det of salesOnly) {
    if (usedGetnet.has(det.id) || usedG.has(det.id)) continue;
    if (!det.data_venda || det.valor_venda <= 0) { stats.pendentes++; continue; }
    let best: { v: any; score: number; div: number; rule: string } | null = null;
    for (const v of vendas as any[]) {
      if (usedFeegow.has(v.id) || usedF.has(v.id)) continue;
      const feegowVal = v.valor_pago || v.valor_bruto;
      const div = Math.abs(det.valor_venda - feegowVal);
      if (div > toleranciaValor) continue;
      const dias = daysDiff(det.data_venda!, v.data_competencia);
      if (dias > toleranciaDias) continue;
      let score = 0; let rule = "";
      if (div === 0) { score += 60; rule += "valor_exato "; } else if (div <= 0.10) { score += 50; rule += "valor_centavos "; } else { score += 35; rule += "valor_tolerancia "; }
      if (dias === 0) { score += 25; rule += "data_exata "; } else if (dias === 1) { score += 15; rule += "data_d1 "; } else { score += 8; rule += "data_d2 "; }
      const fp = (v.forma_pagamento_enum || "").toLowerCase();
      if (det.meio_pagamento === "cartao_debito" && fp.includes("debito")) { score += 10; rule += "meio_match "; }
      else if (det.meio_pagamento === "cartao_credito" && fp.includes("credito")) { score += 10; rule += "meio_match "; }
      score = Math.max(0, Math.min(100, score));
      if (score > 50 && (!best || score > best.score)) best = { v, score, div, rule: rule.trim() };
    }
    if (!best) { stats.pendentes++; continue; }
    usedG.add(det.id); usedF.add(best.v.id);
    const status = best.score >= 75 ? "conciliado" : "divergente";
    matches.push({ getnet_detalhado_id: det.id, feegow_venda_id: best.v.id, score: best.score, rule: best.rule, divergencia: best.div, status });
    if (status === "conciliado") stats.conciliados++; else stats.divergentes++;
  }
  for (const m of matches) {
    try {
      await supabase.from("conciliacao_vendas_gateway").upsert({ clinica_id: clinicaId, getnet_detalhado_id: m.getnet_detalhado_id, feegow_venda_id: m.feegow_venda_id, score: m.score, match_confidence: m.score >= 90 ? "alta" : m.score >= 75 ? "media" : "baixa", rule_applied: m.rule, status: m.status, divergencia: m.divergencia }, { onConflict: "getnet_detalhado_id" });
    } catch (e: any) { stats.erros.push(`VendaGW ${m.getnet_detalhado_id}: ${e.message}`); }
  }
  stats.cobertura_pct = salesOnly.length > 0 ? Math.round(stats.conciliados / salesOnly.length * 100) : 0;
  return stats;
}

// ─── Step 8: Convenios NF ↔ Banco (Pipeline 3) ─────────────────
async function reconcileConveniosNF(supabase: any, clinicaId: string, creditos: TransacaoBancaria[], toleranciaValor = 1.0, toleranciaDias = 60): Promise<{ conciliados: number; glosa_parcial: number; divergentes: number; pendentes: number; erros: string[] }> {
  const stats = { conciliados: 0, glosa_parcial: 0, divergentes: 0, pendentes: 0, erros: [] as string[] };
  const { data: nfs } = await supabase.from("convenios_nf").select("id, convenio_id, credenciador_pagador, competencia, valor_esperado, valor_recebido, status, convenios(nome, credenciador_pagador)").eq("clinica_id", clinicaId).in("status", ["enviada", "a_receber"]);
  if (!nfs || nfs.length === 0) return stats;
  const { data: jaConc } = await supabase.from("convenios_nf").select("banco_tx_id").eq("clinica_id", clinicaId).not("banco_tx_id", "is", null);
  const usedBancoIds = new Set((jaConc || []).map((r: any) => r.banco_tx_id));
  const availableCreditos = creditos.filter(c => c.status === "pendente" && !usedBancoIds.has(c.id));
  const usedCreditos = new Set<string>();

  for (const nf of nfs as any[]) {
    const pagador = (nf.credenciador_pagador || nf.convenios?.credenciador_pagador || nf.convenios?.nome || "").toUpperCase();
    if (!pagador) { stats.pendentes++; continue; }
    const searchTerms = pagador.split(",").map((s: string) => s.trim().toUpperCase()).filter((s: string) => s.length > 2);
    if (searchTerms.length === 0) { stats.pendentes++; continue; }
    let best: { tb: TransacaoBancaria; score: number } | null = null;
    for (const tb of availableCreditos) {
      if (usedCreditos.has(tb.id)) continue;
      const memo = (tb.descricao || "").toUpperCase();
      const memoMatch = searchTerms.some((term: string) => memo.includes(term));
      if (!memoMatch) continue;
      const nfDate = nf.competencia;
      const dias = daysDiff(nfDate, dateOnly(tb.data_transacao));
      if (dias > toleranciaDias) continue;
      const valorEsperado = nf.valor_esperado - (nf.valor_recebido || 0);
      const diff = Math.abs(tb.valor - valorEsperado);
      const pctDiff = valorEsperado > 0 ? (diff / valorEsperado) * 100 : 100;
      let score = 0;
      if (diff <= 0.10) score += 60; else if (diff <= toleranciaValor) score += 50; else if (pctDiff <= 5) score += 40; else if (pctDiff <= 15) score += 25; else continue;
      if (dias <= 5) score += 25; else if (dias <= 30) score += 15; else score += 5;
      score += 10;
      if (!best || score > best.score) best = { tb, score };
    }
    if (!best) { stats.pendentes++; continue; }
    usedCreditos.add(best.tb.id);
    const valorEsperado = nf.valor_esperado - (nf.valor_recebido || 0);
    const valorBanco = best.tb.valor;
    let newStatus: string; let valorGlosado = 0;
    if (Math.abs(valorBanco - valorEsperado) <= toleranciaValor) { newStatus = "paga"; stats.conciliados++; }
    else if (valorBanco < valorEsperado) { newStatus = "glosa_parcial"; valorGlosado = valorEsperado - valorBanco; stats.glosa_parcial++; }
    else { newStatus = "divergente"; stats.divergentes++; }
    try {
      await supabase.from("convenios_nf").update({ status: newStatus, valor_recebido: (nf.valor_recebido || 0) + valorBanco, valor_glosado: (nf.valor_glosado || 0) + valorGlosado, banco_tx_id: best.tb.id, updated_at: new Date().toISOString() }).eq("id", nf.id);
      await supabase.from("transacoes_bancarias").update({ status: "conciliado", categoria_auto: `convenio_nf:${nf.id}` }).eq("id", best.tb.id);
      await supabase.from("contas_receber_agregado").upsert({ clinica_id: clinicaId, tipo_recebivel: "convenio_nf", competencia: nf.competencia, data_base: nf.competencia, data_recebimento: dateOnly(best.tb.data_transacao), meio: "convenio", valor_esperado: nf.valor_esperado, valor_recebido: (nf.valor_recebido || 0) + valorBanco, status: newStatus === "paga" ? "recebido" : newStatus === "glosa_parcial" ? "parcial" : "divergente", nf_id: nf.id, origem_ref: { banco_tx_id: best.tb.id, convenio_id: nf.convenio_id } }, { onConflict: "id" });
      await supabase.from("conciliacao_receitas").insert({ clinica_id: clinicaId, competencia: nf.competencia, data_liquidacao: dateOnly(best.tb.data_transacao), camada: "convenio_nf_banco", status: newStatus === "paga" || newStatus === "glosa_parcial" ? "conciliado" : "divergente", score: best.score, motivo_divergencia: newStatus === "divergente" ? `Banco R$${valorBanco} > Esperado R$${valorEsperado}` : valorGlosado > 0 ? `Glosa R$${valorGlosado.toFixed(2)}` : null, refs: { nf_id: nf.id, banco_tx_id: best.tb.id } });
    } catch (e: any) { stats.erros.push(`NF ${nf.id}: ${e.message}`); }
  }
  return stats;
}

// ─── Step 9: Build/Update contas_receber_agregado from all reconciliation results ─
async function buildContasReceberAgregado(supabase: any, clinicaId: string, dateStart: string, dateEnd: string): Promise<{ criados: number; atualizados: number; erros: string[] }> {
  const stats = { criados: 0, atualizados: 0, erros: [] as string[] };

  // 9a: From Getnet Recebíveis reconciled with bank
  const { data: concRec } = await supabase
    .from("conciliacao_recebiveis")
    .select("id, banco_tx_id, getnet_resumo_id, status, score, rule_applied")
    .eq("clinica_id", clinicaId)
    .eq("status", "conciliado");

  if (concRec && concRec.length > 0) {
    for (const rec of concRec as any[]) {
      const { data: resumo } = await supabase.from("getnet_recebiveis_resumo").select("data_vencimento, bandeira_modalidade, meio_pagamento, valor_liquido, mes_ref").eq("id", rec.getnet_resumo_id).single();
      if (!resumo) continue;
      const { data: bankTx } = await supabase.from("transacoes_bancarias").select("data_transacao").eq("id", rec.banco_tx_id).single();
      const competencia = resumo.mes_ref || resumo.data_vencimento;
      const meio = resumo.meio_pagamento === "cartao_debito" ? "cartao_debito" : "cartao_credito";
      try {
        // Check if already exists by conciliacao_id
        const { data: existing } = await supabase.from("contas_receber_agregado").select("id").eq("conciliacao_id", rec.id).eq("clinica_id", clinicaId).maybeSingle();
        if (existing) {
          await supabase.from("contas_receber_agregado").update({
            valor_recebido: resumo.valor_liquido, status: "recebido",
            data_recebimento: bankTx?.data_transacao ? dateOnly(bankTx.data_transacao) : null,
            updated_at: new Date().toISOString(),
          }).eq("id", existing.id);
          stats.atualizados++;
        } else {
          await supabase.from("contas_receber_agregado").insert({
            clinica_id: clinicaId, tipo_recebivel: "getnet", competencia, data_base: resumo.data_vencimento,
            data_recebimento: bankTx?.data_transacao ? dateOnly(bankTx.data_transacao) : null,
            data_prevista_recebimento: resumo.data_vencimento, meio, bandeira: resumo.bandeira_modalidade,
            valor_esperado: resumo.valor_liquido, valor_recebido: resumo.valor_liquido, status: "recebido",
            conciliacao_id: rec.id, origem_dado: "getnet_vendas",
            origem_ref: { getnet_resumo_id: rec.getnet_resumo_id, banco_tx_id: rec.banco_tx_id },
          });
          stats.criados++;
        }
      } catch (e: any) {
        if (!e.message?.includes("duplicate")) stats.erros.push(e.message);
      }
    }
  }

  // 9b: Update existing feegow_caixa/feegow_invoice records that now have bank matches
  // Match aggregated records with bank credits for cartão/pix
  const { data: pendenteCr } = await supabase
    .from("contas_receber_agregado")
    .select("id, data_base, meio, bandeira, valor_esperado, origem_dado")
    .eq("clinica_id", clinicaId)
    .in("status", ["pendente", "parcial"])
    .in("meio", ["cartao_credito", "cartao_debito", "pix"])
    .gte("data_base", dateStart)
    .lte("data_base", dateEnd);

  if (pendenteCr && pendenteCr.length > 0) {
    // Find matching getnet_vendas records that are already reconciled
    for (const cr of pendenteCr as any[]) {
      const { data: matchedGetnet } = await supabase
        .from("contas_receber_agregado")
        .select("valor_recebido")
        .eq("clinica_id", clinicaId)
        .eq("data_base", cr.data_base)
        .eq("meio", cr.meio)
        .eq("status", "recebido")
        .eq("origem_dado", "getnet_vendas");

      if (matchedGetnet && matchedGetnet.length > 0) {
        const totalRecebido = matchedGetnet.reduce((s: number, r: any) => s + (r.valor_recebido || 0), 0);
        if (totalRecebido > 0) {
          const newStatus = totalRecebido >= cr.valor_esperado ? "recebido" : "parcial";
          await supabase.from("contas_receber_agregado").update({
            valor_recebido: totalRecebido,
            status: newStatus,
            updated_at: new Date().toISOString(),
          }).eq("id", cr.id);
          stats.atualizados++;
        }
      }
    }
  }

  return stats;
}

// ─── Step 10: Reconcile PIX individually (bank ↔ Feegow vendas) ─
async function reconcilePixBanco(supabase: any, clinicaId: string, creditos: TransacaoBancaria[], dateStart: string, dateEnd: string): Promise<{ conciliados: number; divergentes: number; erros: string[] }> {
  const stats = { conciliados: 0, divergentes: 0, erros: [] as string[] };

  // PIX credits from bank that aren't GETNET
  const pixCreditos = creditos.filter(c =>
    c.status === "pendente" &&
    normalizeText(c.descricao).includes("pix") &&
    !normalizeText(c.descricao).includes("getnet")
  );
  if (pixCreditos.length === 0) return stats;

  // Load PIX vendas
  const { data: vendas } = await supabase
    .from("transacoes_vendas")
    .select("id, valor_bruto, data_competencia")
    .eq("clinica_id", clinicaId)
    .eq("forma_pagamento_enum", "pix")
    .eq("status_recebimento", "a_receber")
    .gte("data_competencia", dateStart)
    .lte("data_competencia", dateEnd);

  if (!vendas || vendas.length === 0) return stats;
  const usedVendas = new Set<string>();
  const usedCreditos = new Set<string>();

  for (const tb of pixCreditos) {
    if (usedCreditos.has(tb.id)) continue;
    let best: { v: any; score: number; div: number } | null = null;
    for (const v of vendas as any[]) {
      if (usedVendas.has(v.id)) continue;
      const div = Math.abs(v.valor_bruto - tb.valor);
      if (div > 0.50) continue;
      const dias = daysDiff(v.data_competencia, dateOnly(tb.data_transacao));
      if (dias > 1) continue;
      let score = div === 0 ? 80 : 65;
      if (dias === 0) score += 15; else score += 5;
      if (!best || score > best.score) best = { v, score, div };
    }
    if (best && best.score >= 75) {
      usedCreditos.add(tb.id);
      usedVendas.add(best.v.id);
      try {
        await supabase.from("transacoes_vendas").update({ status_recebimento: "recebido", status_conciliacao: "conciliado" }).eq("id", best.v.id);
        await supabase.from("transacoes_bancarias").update({ status: "conciliado", categoria_auto: `pix_venda:${best.v.id}` }).eq("id", tb.id);
        await supabase.from("conciliacoes").insert({
          clinica_id: clinicaId, venda_id: best.v.id, transacao_bancaria_id: tb.id,
          status: "conciliado", divergencia: best.div, tipo: "pix_banco",
          metodo_match: "pix_valor_data", score: best.score,
          observacao: `PIX auto-conciliado: R$${tb.valor}`,
        });
        stats.conciliados++;
      } catch (e: any) { stats.erros.push(`PIX ${tb.id}: ${e.message}`); }
    }
  }

  // Update CR agregado for PIX
  if (stats.conciliados > 0) {
    const { data: pixCr } = await supabase.from("contas_receber_agregado").select("id, data_base, valor_esperado").eq("clinica_id", clinicaId).eq("meio", "pix").in("status", ["pendente", "parcial"]).gte("data_base", dateStart).lte("data_base", dateEnd);
    for (const cr of (pixCr || []) as any[]) {
      const { data: recebidos } = await supabase.from("transacoes_vendas").select("valor_bruto").eq("clinica_id", clinicaId).eq("forma_pagamento_enum", "pix").eq("status_recebimento", "recebido").eq("data_competencia", cr.data_base);
      const totalRec = (recebidos || []).reduce((s: number, r: any) => s + (r.valor_bruto || 0), 0);
      if (totalRec > 0) {
        await supabase.from("contas_receber_agregado").update({
          valor_recebido: totalRec,
          status: totalRec >= cr.valor_esperado ? "recebido" : "parcial",
          updated_at: new Date().toISOString(),
        }).eq("id", cr.id);
      }
    }
  }

  return stats;
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
      return new Response(JSON.stringify({ error: "clinica_id, date_start e date_end obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: logData } = await supabase.from("integracao_logs").insert({ clinica_id: clinicaId, integracao: "conciliacao", acao: dryRun ? "dry_run" : "run", endpoint: "run-reconciliation", status: "em_andamento" }).select("id").single();
    const logId = logData?.id;

    // ── Load data ─────────────────────────────────────────────
    const [vendasRes, getnetRes, bancoCreditosRes, bancoDebitosRes] = await Promise.all([
      supabase.from("transacoes_vendas").select("id, valor_bruto, data_competencia, forma_pagamento_enum, parcelas, feegow_id, invoice_id, status_conciliacao, status_recebimento, convenio_id").eq("clinica_id", clinicaId).gte("data_competencia", dateStart).lte("data_competencia", dateEnd).in("status_conciliacao", ["pendente"]),
      supabase.from("getnet_transacoes").select("id, tipo_extrato, data_venda, valor_bruto, valor_taxa, valor_liquido, modalidade, forma_pagamento, parcelas, data_prevista_pagamento, comprovante_venda, status_conciliacao, venda_id, transacao_bancaria_id").eq("clinica_id", clinicaId).gte("data_venda", `${dateStart}T00:00:00`).lte("data_venda", `${dateEnd}T23:59:59`).eq("status_conciliacao", "pendente"),
      supabase.from("transacoes_bancarias").select("id, valor, data_transacao, tipo, descricao, status, fitid").eq("clinica_id", clinicaId).eq("tipo", "credito").eq("status", "pendente").gte("data_transacao", dateStart).lte("data_transacao", dateEnd),
      supabase.from("transacoes_bancarias").select("id, valor, data_transacao, tipo, descricao, status, fitid, banco").eq("clinica_id", clinicaId).eq("tipo", "debito").eq("status", "pendente").gte("data_transacao", dateStart).lte("data_transacao", dateEnd),
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
          venda_id: vg.venda_id, getnet_id: vg.getnet_id, transacao_bancaria_id: gb.transacao_bancaria_id,
          score: Math.min(vg.score, gb.score), metodo: "triplo_feegow_getnet_banco",
          divergencia: vg.divergencia + gb.divergencia, tipo: "triplo",
          valor_bruto: vg.valor_bruto, valor_taxa: vg.valor_taxa, valor_liquido: vg.valor_liquido,
        });
      }
    }

    const allMatches = [...matchesVG, ...matchesGB, ...tripleMatches];

    // ── Persist ──────────────────────────────────────────────
    let persisted = 0;
    let debitoStats = { processados: 0, baixados: 0, erros: [] as string[] };
    let expenseStats = { conciliados: 0, divergentes: 0, pendentes: 0, erros: [] as string[] };
    let recebiveisStats = { conciliados: 0, divergentes: 0, pendentes: 0, erros: [] as string[] };
    let vendasGwStats = { conciliados: 0, divergentes: 0, pendentes: 0, cobertura_pct: 0, erros: [] as string[] };
    let composicaoStats = { vinculados: 0, erros: [] as string[] };
    let convenioNfStats = { conciliados: 0, glosa_parcial: 0, divergentes: 0, pendentes: 0, erros: [] as string[] };
    let crAgregadoStats = { criados: 0, atualizados: 0, erros: [] as string[] };
    let pixStats = { conciliados: 0, divergentes: 0, erros: [] as string[] };

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
              clinica_id: clinicaId, venda_id: match.venda_id, valor: match.valor_liquido,
              data_recebimento: dateStart, origem: "getnet",
              observacao: `Conciliação tripla - Bruto: ${match.valor_bruto}, Taxa: ${match.valor_taxa}`,
            });
          }
        }
      }

      // Steps 4-10
      debitoStats = await processDebitosAutomaticos(supabase, clinicaId, debitos);
      expenseStats = await reconcileExpenses(supabase, clinicaId, debitos);
      recebiveisStats = await reconcileRecebiveisGetnet(supabase, clinicaId, creditos);
      composicaoStats = await reconcileDetalhadoResumo(supabase, clinicaId);
      vendasGwStats = await reconcileVendasGateway(supabase, clinicaId, dateStart, dateEnd);
      convenioNfStats = await reconcileConveniosNF(supabase, clinicaId, creditos);
      pixStats = await reconcilePixBanco(supabase, clinicaId, creditos, dateStart, dateEnd);
      crAgregadoStats = await buildContasReceberAgregado(supabase, clinicaId, dateStart, dateEnd);
    }

    const summary = {
      periodo: { start: dateStart, end: dateEnd },
      totais: { vendas_feegow: vendas.length, getnet_transacoes: getnetTxs.length, creditos_banco: creditos.length, debitos_banco: debitos.length },
      receitas: {
        feegow_getnet: { conciliadas: matchesVG.length, pendentes: vendas.length - matchesVG.length },
        getnet_banco: { conciliadas: matchesGB.length },
        getnet_recebiveis_banco: { conciliadas: recebiveisStats.conciliados, divergentes: recebiveisStats.divergentes, pendentes: recebiveisStats.pendentes },
        getnet_vendas_feegow: { conciliadas: vendasGwStats.conciliados, divergentes: vendasGwStats.divergentes, pendentes: vendasGwStats.pendentes, cobertura_pct: vendasGwStats.cobertura_pct },
        pix_banco: { conciliadas: pixStats.conciliados, divergentes: pixStats.divergentes },
        triplo: tripleMatches.length, total_persisted: persisted,
        composicao_detalhado_resumo: composicaoStats,
        convenios_nf: { conciliadas: convenioNfStats.conciliados, glosa_parcial: convenioNfStats.glosa_parcial, divergentes: convenioNfStats.divergentes, pendentes: convenioNfStats.pendentes },
        cr_agregado: crAgregadoStats,
      },
      debitos_automaticos: debitoStats,
      despesas: { conciliados: expenseStats.conciliados, divergentes: expenseStats.divergentes, pendentes: expenseStats.pendentes },
      erros: [...expenseStats.erros, ...recebiveisStats.erros, ...vendasGwStats.erros, ...convenioNfStats.erros, ...crAgregadoStats.erros, ...pixStats.erros],
    };

    if (logId) {
      await supabase.from("integracao_logs").update({ status: summary.erros.length > 0 ? "erro_parcial" : "sucesso", fim: new Date().toISOString(), detalhes: summary }).eq("id", logId);
    }

    return new Response(JSON.stringify({ success: true, ...summary }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("run-reconciliation error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
