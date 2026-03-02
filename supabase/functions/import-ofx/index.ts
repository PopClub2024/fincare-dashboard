import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Auth ───────────────────────────────────────────────────────
async function verifyAuth(req: Request): Promise<boolean> {
  const secret = Deno.env.get("AUTOMATION_TOKEN");
  const ws = req.headers.get("x-webhook-secret") || "";
  if (secret && ws && ws === secret) return true;
  const bearer = (req.headers.get("authorization") || "").replace("Bearer ", "");
  if (secret && bearer && bearer === secret) return true;

  if (bearer) {
    try {
      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { global: { headers: { Authorization: `Bearer ${bearer}` } } },
      );
      const { data, error } = await sb.auth.getUser(bearer);
      if (!error && data?.user) return true;
    } catch { /* ignore */ }
  }
  return false;
}

// ─── Auto-classification rules ──────────────────────────────────
interface ClassificationRule {
  pattern: RegExp;
  tipo_despesa: "fixo" | "variavel";
  categoria: string;
  fornecedor_sugerido?: string;
}

const CLASSIFICATION_RULES: ClassificationRule[] = [
  // Impostos e taxas
  { pattern: /RECEITA FEDERAL|RFB|DARF|DARA PARC|SIMPLES NACIONAL/i, tipo_despesa: "fixo", categoria: "impostos", fornecedor_sugerido: "Receita Federal" },
  { pattern: /PREFEITURA|ISS|IPTU|ALVARA/i, tipo_despesa: "fixo", categoria: "impostos_municipais", fornecedor_sugerido: "Prefeitura" },
  { pattern: /SEFAZ|ICMS/i, tipo_despesa: "fixo", categoria: "impostos_estaduais", fornecedor_sugerido: "SEFAZ" },

  // Utilities
  { pattern: /ENEL|LIGHT|CEMIG|CPFL|ENERGISA|ELETRO|COELBA|CELPE|COSERN/i, tipo_despesa: "fixo", categoria: "energia", fornecedor_sugerido: "Energia Elétrica" },
  { pattern: /CEDAE|SABESP|COPASA|SANEAGO|EMBASA|COMPESA|AGUAS/i, tipo_despesa: "fixo", categoria: "agua_esgoto", fornecedor_sugerido: "Água e Esgoto" },
  { pattern: /CLARO|VIVO|TIM |OI S\.?A|NET SERVICOS|TELECOM|EMBRATEL/i, tipo_despesa: "fixo", categoria: "telefonia_internet", fornecedor_sugerido: "Telefonia/Internet" },
  { pattern: /GAS NATURAL|NATURGY|COMGAS|CEG|GASMIG/i, tipo_despesa: "fixo", categoria: "gas", fornecedor_sugerido: "Gás" },

  // Aluguel e condomínio
  { pattern: /ALUGUEL|LOCACAO|IMOBILIARIA|CONDOMINIO/i, tipo_despesa: "fixo", categoria: "aluguel", fornecedor_sugerido: "Imóvel" },

  // Folha e encargos
  { pattern: /FOLHA|SALARIO|REMUNERACAO|PAGTO SALARIO/i, tipo_despesa: "fixo", categoria: "folha_pagamento" },
  { pattern: /FGTS|CAIXA ECONOMICA.*GRF/i, tipo_despesa: "fixo", categoria: "encargos_trabalhistas", fornecedor_sugerido: "FGTS" },
  { pattern: /INSS|GPS|PREV.?SOCIAL|DATAPREV/i, tipo_despesa: "fixo", categoria: "encargos_trabalhistas", fornecedor_sugerido: "INSS" },

  // Seguros
  { pattern: /SEGURO|BRADESCO SEGUROS|PORTO SEGURO|SULAMERICA|UNIMED.*SEG/i, tipo_despesa: "fixo", categoria: "seguros" },

  // Convênios médicos / planos
  { pattern: /UNIMED|AMIL|BRADESCO SAUDE|SULAMERICA|NOTREDAME|HAPVIDA|CASSI/i, tipo_despesa: "variavel", categoria: "convenios" },

  // Materiais e suprimentos
  { pattern: /FARMACIA|DROGARIA|MATERIAL MEDICO|HOSPITALAR/i, tipo_despesa: "variavel", categoria: "materiais_medicos" },
  { pattern: /LABORATORIO|LABCLIN|DIAGNOSTICO/i, tipo_despesa: "variavel", categoria: "laboratorio" },

  // Marketing
  { pattern: /GOOGLE ADS|META ADS|FACEBOOK|INSTAGRAM|MARKETING|PUBLICIDADE/i, tipo_despesa: "variavel", categoria: "marketing" },

  // Software e tecnologia
  { pattern: /FEEGOW|TOTVS|SISTEMA|SOFTWARE|SAAS|MICROSOFT|GOOGLE CLOUD|AWS/i, tipo_despesa: "fixo", categoria: "tecnologia" },

  // Contabilidade e jurídico
  { pattern: /CONTABIL|ESCRITORIO|ADVOCACIA|JURIDICO|CRC|CRM|CONSELHO/i, tipo_despesa: "fixo", categoria: "servicos_profissionais" },

  // Empréstimos e financiamentos
  { pattern: /EMPRESTIMO|FINANCIAMENTO|PARCELA|AMORTIZA|CDC|CREDITO PESSOAL/i, tipo_despesa: "fixo", categoria: "emprestimos" },

  // Cartão de crédito
  { pattern: /CARTAO|FATURA|ANUIDADE/i, tipo_despesa: "variavel", categoria: "cartao_credito" },

  // Débito automático genérico
  { pattern: /DEB AUT|DEBITO AUTOMATICO/i, tipo_despesa: "variavel", categoria: "debito_automatico" },

  // PIX genérico
  { pattern: /PIX ENVIADO|PIX TRANSF/i, tipo_despesa: "variavel", categoria: "transferencia_pix" },

  // Boleto genérico
  { pattern: /PAGAMENTO DE BOLETO|PAG BOLETO|BOLETO/i, tipo_despesa: "variavel", categoria: "boleto" },

  // TED/DOC
  { pattern: /TED|DOC|TRANSF BANCARIA/i, tipo_despesa: "variavel", categoria: "transferencia" },
];

function classifyTransaction(description: string): { tipo_despesa: string; categoria: string; fornecedor_sugerido: string | null; status: string } {
  const desc = (description || "").toUpperCase();
  for (const rule of CLASSIFICATION_RULES) {
    if (rule.pattern.test(desc)) {
      return {
        tipo_despesa: rule.tipo_despesa,
        categoria: rule.categoria,
        fornecedor_sugerido: rule.fornecedor_sugerido || null,
        status: "classificado",
      };
    }
  }
  return { tipo_despesa: "variavel", categoria: "", fornecedor_sugerido: null, status: "a_classificar" };
}

// ─── Detect credit meio_recebimento from description ────────────
function detectMeioRecebimento(description: string): string {
  const desc = (description || "").toUpperCase();
  if (/PIX/i.test(desc)) return "pix";
  if (/TED|DOC|TRANSF/i.test(desc)) return "transferencia";
  if (/BOLETO/i.test(desc)) return "boleto";
  if (/CARTAO|CREDITO/i.test(desc)) return "cartao_credito";
  if (/DEBITO/i.test(desc)) return "cartao_debito";
  return "outros";
}

// ─── OFX Parser ─────────────────────────────────────────────────
interface ParsedOFX {
  bankId: string;
  acctId: string;
  acctType: string;
  transactions: Array<{
    fitid: string;
    type: string;
    date: string;
    amount: number;
    name: string;
    memo: string;
  }>;
}

function parseOFX(ofxContent: string): ParsedOFX {
  // Extract bank account info
  const getBankVal = (tag: string) => {
    const m = new RegExp(`<${tag}>([^<\\n]+)`, "i").exec(ofxContent);
    return m ? m[1].trim() : "";
  };
  const bankId = getBankVal("BANKID");
  const acctId = getBankVal("ACCTID");
  const acctType = getBankVal("ACCTTYPE");

  const transactions: ParsedOFX["transactions"] = [];
  const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;
  while ((match = trnRegex.exec(ofxContent)) !== null) {
    const block = match[1];
    const getValue = (tag: string) => {
      const m = new RegExp(`<${tag}>([^<\\n]+)`, "i").exec(block);
      return m ? m[1].trim() : "";
    };

    const dtPosted = getValue("DTPOSTED");
    const dateStr = dtPosted.length >= 8
      ? `${dtPosted.slice(0, 4)}-${dtPosted.slice(4, 6)}-${dtPosted.slice(6, 8)}`
      : new Date().toISOString().split("T")[0];

    transactions.push({
      fitid: getValue("FITID"),
      type: getValue("TRNTYPE"),
      date: dateStr,
      amount: parseFloat(getValue("TRNAMT") || "0"),
      name: getValue("NAME"),
      memo: getValue("MEMO"),
    });
  }

  return { bankId, acctId, acctType, transactions };
}

// ─── Text normalization ─────────────────────────────────────────
function normalizeText(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

// ─── Helpers ────────────────────────────────────────────────────
function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Main ───────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!(await verifyAuth(req))) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    let clinica_id = "";
    let filename = "";
    let ofxContent = "";

    const contentType = req.headers.get("content-type") || "";

    // ── Parse request ──────────────────────────────────────────
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      clinica_id = (formData.get("clinica_id") as string)
        || (formData.get("id_da_clinica") as string)
        || "";
      filename = (formData.get("filename") as string) || "";

      const file = (formData.get("file") as File)
        || (formData.get("arquivo") as File)
        || null;
      if (!file) {
        return jsonResponse({ error: "Campo 'file' obrigatório no multipart" }, 400);
      }
      if (!filename) filename = file.name || "upload.ofx";

      const ext = filename.split(".").pop()?.toLowerCase();
      if (ext !== "ofx") {
        return jsonResponse({ error: "Arquivo deve ter extensão .ofx" }, 400);
      }
      ofxContent = await file.text();
    } else if (contentType.includes("application/json")) {
      const body = await req.json();
      clinica_id = body.clinica_id || "";
      filename = body.filename || "import.ofx";
      if (body.ofx_content) {
        ofxContent = body.ofx_content;
      } else if (body.file_base64) {
        ofxContent = atob(body.file_base64);
      }
    } else {
      return jsonResponse({ error: "Content-Type deve ser multipart/form-data ou application/json" }, 400);
    }

    if (!clinica_id) return jsonResponse({ error: "clinica_id obrigatório" }, 400);
    if (!ofxContent) return jsonResponse({ error: "Conteúdo OFX vazio" }, 400);

    // ── Parse OFX ──────────────────────────────────────────────
    const parsed = parseOFX(ofxContent);
    const { transactions, bankId, acctId } = parsed;
    if (transactions.length === 0) {
      return jsonResponse({ error: "Nenhuma transação encontrada no OFX" }, 400);
    }

    const bancoRef = [bankId, acctId].filter(Boolean).join(" / ") || filename.split("_")[0] || "Desconhecido";

    // ── Idempotency via hash ───────────────────────────────────
    const fileHash = await sha256(clinica_id + ofxContent);
    const { data: existingRun } = await supabase
      .from("import_runs")
      .select("id, status")
      .eq("clinica_id", clinica_id)
      .eq("arquivo_hash", fileHash)
      .maybeSingle();

    if (existingRun) {
      return jsonResponse({
        ok: true,
        message: "Arquivo já processado anteriormente",
        import_run_id: existingRun.id,
        imported_count: 0,
        duplicates_count: transactions.length,
        creditos: 0,
        debitos: 0,
      });
    }

    // ── Determine period ───────────────────────────────────────
    const dates = transactions.map((t) => t.date).sort();
    const period_start = dates[0];
    const period_end = dates[dates.length - 1];

    // ── Create import_run ──────────────────────────────────────
    const { data: run } = await supabase
      .from("import_runs")
      .insert({
        clinica_id,
        tipo: "banco_ofx",
        origem: "webhook",
        arquivo_nome: filename,
        arquivo_hash: fileHash,
        periodo_inicio: period_start,
        periodo_fim: period_end,
        registros_total: transactions.length,
      })
      .select("id")
      .single();

    const importRunId = run?.id;

    // ── Process transactions ───────────────────────────────────
    let debitos_criados = 0;
    let creditos_criados = 0;
    let matched_ap = 0;
    let matched_ar = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const txn of transactions) {
      const descricao = [txn.name, txn.memo].filter(Boolean).join(" - ");

      // Insert into transacoes_bancarias
      const { data: bankTxn, error: bankErr } = await supabase
        .from("transacoes_bancarias")
        .insert({
          clinica_id,
          fitid: txn.fitid,
          tipo: txn.amount > 0 ? "credito" : "debito",
          valor: txn.amount,
          data_transacao: txn.date,
          descricao,
          status: "importado",
        })
        .select("id")
        .maybeSingle();

      if (bankErr) {
        if (bankErr.code === "23505") { skipped++; continue; }
        errors.push(`FITID ${txn.fitid}: ${bankErr.message}`);
        continue;
      }

      const bankTxnId = bankTxn?.id;

      // ════════════════════════════════════════════════════════
      // CRÉDITOS (dinheiro entrando) → Contas a RECEBER
      // ════════════════════════════════════════════════════════
      if (txn.amount > 0) {
        const meio = detectMeioRecebimento(descricao);

        // Try to match with existing vendas (recebiveis)
        const { data: matchVenda } = await supabase
          .from("transacoes_vendas")
          .select("id, valor_bruto")
          .eq("clinica_id", clinica_id)
          .eq("status_recebimento", "a_receber")
          .gte("valor_bruto", txn.amount * 0.98)
          .lte("valor_bruto", txn.amount * 1.02)
          .eq("data_competencia", txn.date)
          .limit(1)
          .maybeSingle();

        if (matchVenda) {
          await supabase
            .from("transacoes_vendas")
            .update({ status_recebimento: "recebido", status_conciliacao: "conciliado" })
            .eq("id", matchVenda.id);

          await supabase.from("transacoes_recebimentos").insert({
            clinica_id,
            venda_id: matchVenda.id,
            valor: txn.amount,
            data_recebimento: txn.date,
            origem: "ofx_bancario",
            referencia_externa: txn.fitid,
            observacao: `Conciliação OFX - ${descricao}`.trim(),
          });
          matched_ar++;
        }

        // Always create contas_receber_agregado entry for credits
        const { error: crErr } = await supabase.from("contas_receber_agregado").insert({
          clinica_id,
          competencia: txn.date.slice(0, 7) + "-01", // first of month
          data_base: txn.date,
          data_recebimento: txn.date,
          meio: meio as any,
          tipo_recebivel: meio === "pix" ? "pix_banco" : "getnet",
          valor_esperado: txn.amount,
          valor_recebido: txn.amount,
          status: "recebido",
          origem_dado: "banco_credito",
          origem_ref: { fitid: txn.fitid, banco: bancoRef, descricao },
        });

        if (crErr) {
          errors.push(`CR FITID ${txn.fitid}: ${crErr.message}`);
        } else {
          creditos_criados++;
        }
        continue;
      }

      // ════════════════════════════════════════════════════════
      // DÉBITOS (dinheiro saindo) → Contas a PAGAR
      // ════════════════════════════════════════════════════════
      const absVal = Math.abs(txn.amount);
      const classification = classifyTransaction(descricao);

      // Try matching with pending conciliacao_despesas
      const { data: pendingConciliacoes } = await supabase
        .from("conciliacao_despesas")
        .select("id, lancamento_id, match_key")
        .eq("clinica_id", clinica_id)
        .eq("status", "pendente");

      let matchedExpense = false;
      if (pendingConciliacoes && pendingConciliacoes.length > 0) {
        const lancIds = pendingConciliacoes.map((p: any) => p.lancamento_id);
        const { data: lancs } = await supabase
          .from("contas_pagar_lancamentos")
          .select("id, valor, data_competencia, fornecedor, descricao")
          .in("id", lancIds);
        const lancMap = new Map((lancs || []).map((l: any) => [l.id, l]));

        const txnDate = new Date(txn.date);
        const txnDescNorm = normalizeText(descricao);

        for (const pc of pendingConciliacoes) {
          const l = lancMap.get(pc.lancamento_id);
          if (!l) continue;

          const valorDiff = Math.abs(l.valor - absVal);
          if (valorDiff > 0.50) continue;

          const lancDate = new Date(l.data_competencia);
          const daysDiff = Math.abs((txnDate.getTime() - lancDate.getTime()) / 86400000);
          if (daysDiff > 3) continue;

          const fornNorm = normalizeText(l.fornecedor || l.descricao || "");
          const textMatch = fornNorm && txnDescNorm.includes(fornNorm.slice(0, 6));
          const score = textMatch ? 95 : (valorDiff < 0.01 && daysDiff < 1 ? 90 : 70);

          await supabase.from("conciliacao_despesas").update({
            status: valorDiff > 0.01 ? "divergente" : "conciliado",
            transacao_bancaria_id: bankTxnId,
            score,
            metodo_match: valorDiff < 0.01 && daysDiff < 1 ? "valor_data_exato" : "valor_fuzzy",
            divergencia: valorDiff,
            conciliado_em: new Date().toISOString(),
            observacao: `Auto-conciliado via OFX. Diff: R$${valorDiff.toFixed(2)}, dias: ${daysDiff.toFixed(0)}`,
          }).eq("id", pc.id);

          await supabase.from("contas_pagar_lancamentos").update({
            status: "pago",
            data_pagamento: txn.date,
            ofx_transaction_id: txn.fitid,
            banco_referencia: bancoRef,
          }).eq("id", pc.lancamento_id);

          matched_ap++;
          matchedExpense = true;
          break;
        }
      }

      // Try matching existing lancamentos (legacy flow)
      if (!matchedExpense) {
        const { data: matchLanc } = await supabase
          .from("contas_pagar_lancamentos")
          .select("id, valor, descricao")
          .eq("clinica_id", clinica_id)
          .eq("data_competencia", txn.date)
          .gte("valor", absVal * 0.98)
          .lte("valor", absVal * 1.02)
          .is("ofx_transaction_id", null)
          .not("status", "eq", "pendente_conciliacao")
          .limit(1)
          .maybeSingle();

        if (matchLanc) {
          await supabase
            .from("contas_pagar_lancamentos")
            .update({
              ofx_transaction_id: txn.fitid,
              status: "pago",
              data_pagamento: txn.date,
              banco_referencia: bancoRef,
            })
            .eq("id", matchLanc.id);
          matched_ap++;
        } else {
          // Create new lancamento with auto-classification
          const { error } = await supabase.from("contas_pagar_lancamentos").insert({
            clinica_id,
            descricao: descricao || "Importação OFX",
            fornecedor: classification.fornecedor_sugerido || null,
            valor: absVal,
            data_competencia: txn.date,
            data_pagamento: txn.date,
            status: classification.status as any,
            tipo_despesa: classification.tipo_despesa as any,
            ofx_transaction_id: txn.fitid,
            banco_referencia: bancoRef,
            observacao: classification.categoria
              ? `Auto-classificado: ${classification.categoria}. ${txn.memo || ""}`.trim()
              : `Auto-importado OFX. ${txn.memo || ""}`.trim(),
          });
          if (error) {
            errors.push(`FITID ${txn.fitid}: ${error.message}`);
          } else {
            debitos_criados++;
          }
        }
      }
    }

    const imported_count = debitos_criados + creditos_criados + matched_ap + matched_ar;
    const finalStatus = errors.length > 0 ? (imported_count > 0 ? "erro_parcial" : "erro") : "sucesso";

    // ── Update import_run ──────────────────────────────────────
    await supabase.from("import_runs").update({
      status: finalStatus,
      registros_criados: debitos_criados + creditos_criados,
      registros_atualizados: matched_ap + matched_ar,
      registros_ignorados: skipped,
      erros: errors,
      detalhes: {
        debitos_criados,
        creditos_criados,
        matched_ap,
        matched_ar,
        banco: bancoRef,
      },
      finished_at: new Date().toISOString(),
    }).eq("id", importRunId);

    // ── Log ────────────────────────────────────────────────────
    await supabase.from("integracao_logs").insert({
      clinica_id,
      integracao: "import-ofx",
      endpoint: "import-ofx",
      acao: "import_ofx",
      status: finalStatus,
      inicio: new Date().toISOString(),
      fim: new Date().toISOString(),
      registros_processados: transactions.length,
      registros_criados: debitos_criados + creditos_criados,
      registros_atualizados: matched_ap + matched_ar,
      registros_ignorados: skipped,
      detalhes: { filename, period_start, period_end, banco: bancoRef },
      erros: errors.length > 0 ? errors : null,
    });

    return jsonResponse({
      ok: true,
      imported_count,
      duplicates_count: skipped,
      debitos_criados,
      creditos_criados,
      matched_ap,
      matched_ar,
      banco: bancoRef,
      period_start,
      period_end,
      import_run_id: importRunId,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    console.error("import-ofx error:", e);
    return jsonResponse({ error: e.message }, 500);
  }
});
