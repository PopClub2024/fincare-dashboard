import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple OFX parser
function parseOFX(ofxContent: string) {
  const transactions: Array<{
    fitid: string;
    type: string;
    date: string;
    amount: number;
    name: string;
    memo: string;
  }> = [];

  // Find all STMTTRN blocks
  const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;
  while ((match = trnRegex.exec(ofxContent)) !== null) {
    const block = match[1];
    const getValue = (tag: string) => {
      const m = new RegExp(`<${tag}>([^<\\n]+)`, "i").exec(block);
      return m ? m[1].trim() : "";
    };

    const dtPosted = getValue("DTPOSTED");
    // OFX dates: YYYYMMDDHHMMSS
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

  return transactions;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { clinica_id, ofx_content } = await req.json();
    if (!clinica_id || !ofx_content) {
      return new Response(JSON.stringify({ error: "clinica_id and ofx_content required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const transactions = parseOFX(ofx_content);
    if (transactions.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhuma transação encontrada no OFX" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let created = 0;
    let skipped = 0;
    let matched = 0;
    const errors: string[] = [];

    for (const txn of transactions) {
      // Only process debits (negative amounts)
      if (txn.amount >= 0) {
        skipped++;
        continue;
      }

      // Check if already imported
      const { data: existing } = await supabase
        .from("contas_pagar_lancamentos")
        .select("id")
        .eq("clinica_id", clinica_id)
        .eq("ofx_transaction_id", txn.fitid)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      // Check if there's a matching lancamento by date + approximate value
      const absVal = Math.abs(txn.amount);
      const { data: matchLanc } = await supabase
        .from("contas_pagar_lancamentos")
        .select("id, valor, descricao")
        .eq("clinica_id", clinica_id)
        .eq("data_competencia", txn.date)
        .gte("valor", absVal * 0.98)
        .lte("valor", absVal * 1.02)
        .is("ofx_transaction_id", null)
        .limit(1)
        .maybeSingle();

      if (matchLanc) {
        // Conciliate: link OFX to existing lancamento
        await supabase
          .from("contas_pagar_lancamentos")
          .update({
            ofx_transaction_id: txn.fitid,
            status: "classificado",
            data_pagamento: txn.date,
          })
          .eq("id", matchLanc.id);
        matched++;
      } else {
        // No match: create sem_comprovante lancamento
        const { error } = await supabase
          .from("contas_pagar_lancamentos")
          .insert({
            clinica_id,
            descricao: txn.name || txn.memo || "Importação OFX",
            valor: absVal,
            data_competencia: txn.date,
            data_pagamento: txn.date,
            status: "a_classificar",
            ofx_transaction_id: txn.fitid,
            observacao: `Auto-importado OFX. ${txn.memo || ""}`.trim(),
          });
        if (error) {
          errors.push(`FITID ${txn.fitid}: ${error.message}`);
        } else {
          created++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: transactions.length,
        created,
        matched,
        skipped,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("import-ofx error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
