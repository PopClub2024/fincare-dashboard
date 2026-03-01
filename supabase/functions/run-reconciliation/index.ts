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

interface Recebimento {
  id: string;
  valor: number;
  data_recebimento: string;
  forma_pagamento: string | null;
  origem: string;
  venda_id: string | null;
  nsu: string | null;
  parcelas: number | null;
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
  recebimento_id: string | null;
  transacao_bancaria_id: string | null;
  score: number;
  metodo: string;
  divergencia: number;
  tipo: string;
}

// ─── Matching helpers ───────────────────────────────────────────
function daysDiff(a: string, b: string): number {
  return Math.abs(
    (new Date(a).getTime() - new Date(b).getTime()) / 86400000
  );
}

function matchScore(
  valorA: number,
  valorB: number,
  dataA: string,
  dataB: string,
  metodoA: string | null,
  metodoB: string | null,
  janelaMax: number = 5,
  toleranciaPct: number = 1
): { score: number; divergencia: number } {
  const divergencia = Math.abs(valorA - valorB);
  const pctDiff = valorA > 0 ? (divergencia / valorA) * 100 : 100;
  const dias = daysDiff(dataA, dataB);

  if (dias > janelaMax) return { score: 0, divergencia };
  if (pctDiff > toleranciaPct && divergencia > 1) return { score: 0, divergencia };

  let score = 100;
  // Penalizar por diferença de valor
  score -= pctDiff * 10;
  // Penalizar por diferença de dias
  score -= dias * 5;
  // Bonus se método bate
  if (metodoA && metodoB && metodoA === metodoB) score += 10;
  // Exact match bonus
  if (divergencia === 0) score += 20;

  return { score: Math.max(0, Math.min(100, score)), divergencia };
}

// ─── Step 1: Venda ↔ Recebimento ────────────────────────────────
function matchVendasRecebimentos(
  vendas: Venda[],
  recebimentos: Recebimento[]
): MatchResult[] {
  const results: MatchResult[] = [];
  const usedRecebimentos = new Set<string>();

  // Sort vendas by date for deterministic matching
  const sortedVendas = [...vendas].sort(
    (a, b) => a.data_competencia.localeCompare(b.data_competencia)
  );

  for (const venda of sortedVendas) {
    let bestMatch: { rec: Recebimento; score: number; divergencia: number } | null = null;

    for (const rec of recebimentos) {
      if (usedRecebimentos.has(rec.id)) continue;
      // If recebimento already linked to another venda, skip
      if (rec.venda_id && rec.venda_id !== venda.id) continue;

      const { score, divergencia } = matchScore(
        venda.valor_bruto,
        rec.valor,
        venda.data_competencia,
        rec.data_recebimento,
        venda.forma_pagamento_enum,
        rec.forma_pagamento,
        7, // janela de 7 dias
        2  // tolerância de 2%
      );

      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { rec, score, divergencia };
      }
    }

    if (bestMatch) {
      usedRecebimentos.add(bestMatch.rec.id);
      results.push({
        venda_id: venda.id,
        recebimento_id: bestMatch.rec.id,
        transacao_bancaria_id: null,
        score: bestMatch.score,
        metodo: bestMatch.divergencia === 0 ? "exato_valor_data" : "aproximado_valor_data",
        divergencia: bestMatch.divergencia,
        tipo: "venda_recebimento",
      });
    }
  }

  return results;
}

// ─── Step 2: Recebimento ↔ Banco (créditos) ─────────────────────
function matchRecebimentosBanco(
  recebimentos: Recebimento[],
  creditos: TransacaoBancaria[]
): MatchResult[] {
  const results: MatchResult[] = [];
  const usedBanco = new Set<string>();

  for (const rec of recebimentos) {
    let bestMatch: { tb: TransacaoBancaria; score: number; divergencia: number } | null = null;

    for (const tb of creditos) {
      if (usedBanco.has(tb.id)) continue;

      const { score, divergencia } = matchScore(
        rec.valor,
        tb.valor,
        rec.data_recebimento,
        tb.data_transacao,
        null,
        null,
        5,
        1
      );

      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { tb, score, divergencia };
      }
    }

    if (bestMatch) {
      usedBanco.add(bestMatch.tb.id);
      results.push({
        venda_id: null,
        recebimento_id: rec.id,
        transacao_bancaria_id: bestMatch.tb.id,
        score: bestMatch.score,
        metodo: bestMatch.divergencia === 0 ? "exato_banco" : "aproximado_banco",
        divergencia: bestMatch.divergencia,
        tipo: "recebimento_banco",
      });
    }
  }

  return results;
}

// ─── Step 3: Débitos automáticos (banco → AP/dívidas/impostos) ──
async function processDebitosAutomaticos(
  supabase: any,
  clinicaId: string,
  debitos: TransacaoBancaria[]
): Promise<{ processados: number; baixados: number; erros: string[] }> {
  const stats = { processados: 0, baixados: 0, erros: [] as string[] };

  // Load regras de conciliação
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

        // Check tolerância de valor
        if (regra.tipo_destino === "divida" && regra.destino_id) {
          // Buscar parcela prevista
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

            // Baixar parcela
            await supabase
              .from("divida_parcelas_previstas")
              .update({ pago: true })
              .eq("id", parcela.id);

            // Registrar pagamento
            await supabase.from("divida_pagamentos").insert({
              clinica_id: clinicaId,
              divida_id: regra.destino_id,
              data_pagamento: debito.data_transacao,
              valor_pago: debito.valor,
              principal_amortizado: parcela.amortizacao,
              juros_pago: parcela.juros,
              origem: "extrato",
              transacao_bancaria_id: debito.fitid,
              observacao: `Auto-conciliado: ${debito.descricao}`,
            });

            // Atualizar saldo da dívida
            await supabase.rpc("", {}); // We'll update saldo directly
            const { data: divida } = await supabase
              .from("dividas")
              .select("saldo")
              .eq("id", regra.destino_id)
              .single();

            if (divida) {
              await supabase
                .from("dividas")
                .update({ saldo: Math.max(0, divida.saldo - (parcela.amortizacao || debito.valor)) })
                .eq("id", regra.destino_id);
            }

            // Marcar transação bancária como conciliada
            await supabase
              .from("transacoes_bancarias")
              .update({ status: "conciliado", categoria_auto: `divida:${regra.destino_id}` })
              .eq("id", debito.id);

            stats.baixados++;
            break; // Matched, go to next debito
          }
        } else if (regra.tipo_destino === "imposto" && regra.imposto) {
          // Buscar imposto em aberto
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

            // Registrar pagamento de imposto
            await supabase.from("imposto_pagamentos").insert({
              clinica_id: clinicaId,
              impostos_devidos_id: imposto.id,
              data_pagamento: debito.data_transacao,
              valor_pago: debito.valor,
              origem: "extrato",
              transacao_bancaria_id: debito.fitid,
            });

            // Atualizar imposto
            const novoValorPago = (imposto.valor_pago || 0) + debito.valor;
            await supabase
              .from("impostos_devidos")
              .update({
                valor_pago: novoValorPago,
                status: novoValorPago >= imposto.valor_devido ? "pago" : "aberto",
              })
              .eq("id", imposto.id);

            // Marcar transação bancária
            await supabase
              .from("transacoes_bancarias")
              .update({ status: "conciliado", categoria_auto: `imposto:${regra.imposto}` })
              .eq("id", debito.id);

            stats.baixados++;
            break;
          }
        } else if (regra.tipo_destino === "conta_pagar") {
          // Criar lançamento de conta a pagar automaticamente
          await supabase.from("contas_pagar_lancamentos").insert({
            clinica_id: clinicaId,
            data_competencia: debito.data_transacao,
            data_pagamento: debito.data_transacao,
            valor: debito.valor,
            descricao: debito.descricao,
            status: "pago",
            tipo_despesa: "fixo",
            forma_pagamento: "debito_automatico",
            ofx_transaction_id: debito.fitid,
            banco_referencia: debito.banco,
            plano_contas_id: regra.destino_id,
          });

          await supabase
            .from("transacoes_bancarias")
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
        clinica_id: clinicaId,
        integracao: "conciliacao",
        acao: dryRun ? "dry_run" : "run",
        endpoint: "run-reconciliation",
        status: "em_andamento",
      })
      .select("id")
      .single();
    const logId = logData?.id;

    // ── Load data ─────────────────────────────────────────────
    const [vendasRes, recebimentosRes, bancoCreditosRes, bancoDebitosRes] = await Promise.all([
      supabase
        .from("transacoes_vendas")
        .select("id, valor_bruto, data_competencia, forma_pagamento_enum, parcelas, feegow_id, invoice_id, status_conciliacao, status_recebimento, convenio_id")
        .eq("clinica_id", clinicaId)
        .gte("data_competencia", dateStart)
        .lte("data_competencia", dateEnd)
        .in("status_conciliacao", ["pendente"]),
      supabase
        .from("transacoes_recebimentos")
        .select("id, valor, data_recebimento, forma_pagamento, origem, venda_id, nsu, parcelas")
        .eq("clinica_id", clinicaId)
        .gte("data_recebimento", dateStart)
        .lte("data_recebimento", dateEnd),
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
    const recebimentos: Recebimento[] = recebimentosRes.data || [];
    const creditos: TransacaoBancaria[] = bancoCreditosRes.data || [];
    const debitos: TransacaoBancaria[] = (bancoDebitosRes.data || []) as any;

    // ── Step 1: Match vendas ↔ recebimentos ──────────────────
    const matchesVR = matchVendasRecebimentos(vendas, recebimentos);

    // ── Step 2: Match recebimentos ↔ banco (créditos) ────────
    const matchesRB = matchRecebimentosBanco(recebimentos, creditos);

    // ── Step 3: Merge para conciliação tripla ────────────────
    // Se uma venda foi conciliada com um recebimento, e esse recebimento
    // foi conciliado com um crédito bancário, criar conciliação tripla
    const tripleMatches: MatchResult[] = [];
    for (const vr of matchesVR) {
      const rb = matchesRB.find((m) => m.recebimento_id === vr.recebimento_id);
      if (rb) {
        tripleMatches.push({
          venda_id: vr.venda_id,
          recebimento_id: vr.recebimento_id,
          transacao_bancaria_id: rb.transacao_bancaria_id,
          score: Math.min(vr.score, rb.score),
          metodo: "triplo_venda_recebimento_banco",
          divergencia: vr.divergencia + rb.divergencia,
          tipo: "triplo",
        });
      }
    }

    const allMatches = [...matchesVR, ...matchesRB, ...tripleMatches];

    // ── Persist (unless dry_run) ─────────────────────────────
    let persisted = 0;
    let debitoStats = { processados: 0, baixados: 0, erros: [] as string[] };

    if (!dryRun) {
      // Persist conciliações
      for (const match of allMatches) {
        const { error } = await supabase.from("conciliacoes").insert({
          clinica_id: clinicaId,
          venda_id: match.venda_id,
          recebimento_id: match.recebimento_id,
          transacao_bancaria_id: match.transacao_bancaria_id,
          status: match.divergencia === 0 ? "conciliado" : "divergente",
          divergencia: match.divergencia,
          observacao: `Auto: ${match.metodo} (score: ${match.score})`,
          tipo: match.tipo,
          metodo_match: match.metodo,
          score: match.score,
        });

        if (!error) {
          persisted++;

          // Update venda status
          if (match.venda_id) {
            await supabase
              .from("transacoes_vendas")
              .update({
                status_conciliacao: match.divergencia === 0 ? "conciliado" : "divergente",
                status_recebimento: "recebido",
              })
              .eq("id", match.venda_id);
          }

          // Update recebimento link
          if (match.recebimento_id && match.venda_id) {
            await supabase
              .from("transacoes_recebimentos")
              .update({ venda_id: match.venda_id })
              .eq("id", match.recebimento_id);
          }

          // Update transação bancária status
          if (match.transacao_bancaria_id) {
            await supabase
              .from("transacoes_bancarias")
              .update({ status: "conciliado" })
              .eq("id", match.transacao_bancaria_id);
          }
        }
      }

      // ── Step 4: Débitos automáticos ────────────────────────
      debitoStats = await processDebitosAutomaticos(supabase, clinicaId, debitos);
    }

    // ── Summary ──────────────────────────────────────────────
    const summary = {
      periodo: { start: dateStart, end: dateEnd },
      totais: {
        vendas: vendas.length,
        recebimentos: recebimentos.length,
        creditos_banco: creditos.length,
        debitos_banco: debitos.length,
      },
      matches: {
        venda_recebimento: matchesVR.length,
        recebimento_banco: matchesRB.length,
        triplo: tripleMatches.length,
        total: allMatches.length,
        persisted,
      },
      debitos_automaticos: debitoStats,
      pendencias: {
        vendas_sem_match: vendas.length - matchesVR.length,
        recebimentos_sem_match: recebimentos.length -
          new Set([...matchesVR.map((m) => m.recebimento_id), ...matchesRB.map((m) => m.recebimento_id)]).size,
        creditos_sem_match: creditos.length - matchesRB.length,
        debitos_sem_match: debitos.length - debitoStats.baixados,
      },
      dry_run: dryRun,
    };

    // Update log
    if (logId) {
      await supabase
        .from("integracao_logs")
        .update({
          status: "sucesso",
          fim: new Date().toISOString(),
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
