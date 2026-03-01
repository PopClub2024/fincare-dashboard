import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    if (!clinicaId) {
      return new Response(JSON.stringify({ error: "clinica_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get pending card/PIX QR code receivables that should be auto-reconciled via Getnet
    // These are: cartao_credito, cartao_debito, pix with canal_pagamento = qrcode
    const { data: pendentes, error: fetchErr } = await supabase
      .from("transacoes_vendas")
      .select("id, valor_bruto, data_competencia, forma_pagamento, forma_pagamento_enum, canal_pagamento, feegow_id")
      .eq("clinica_id", clinicaId)
      .eq("status_recebimento", "a_receber")
      .or(
        "forma_pagamento_enum.eq.cartao_credito,forma_pagamento_enum.eq.cartao_debito,and(forma_pagamento_enum.eq.pix,canal_pagamento.eq.qrcode)"
      );

    if (fetchErr) {
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let conciliados = 0;
    const errors: string[] = [];

    // Auto-reconcile: mark as received and create recebimento record
    for (const venda of (pendentes || [])) {
      // Update venda status
      const { error: updErr } = await supabase
        .from("transacoes_vendas")
        .update({
          status_recebimento: "recebido",
          status_conciliacao: "conciliado",
        })
        .eq("id", venda.id);

      if (updErr) {
        errors.push(`Venda ${venda.id}: ${updErr.message}`);
        continue;
      }

      // Create recebimento
      const { error: insErr } = await supabase
        .from("transacoes_recebimentos")
        .insert({
          clinica_id: clinicaId,
          venda_id: venda.id,
          valor: venda.valor_bruto,
          data_recebimento: venda.data_competencia,
          origem: "getnet",
          observacao: `Baixa automática Getnet - ${venda.forma_pagamento_enum || venda.forma_pagamento}`,
        });

      if (insErr) {
        errors.push(`Recebimento ${venda.id}: ${insErr.message}`);
      } else {
        conciliados++;
      }
    }

    // Update integration status
    await supabase
      .from("integracoes")
      .upsert(
        {
          clinica_id: clinicaId,
          tipo: "getnet",
          status: errors.length > 0 ? "erro" : "ativo",
          ultima_sincronizacao: new Date().toISOString(),
        },
        { onConflict: "clinica_id,tipo" }
      );

    return new Response(
      JSON.stringify({
        success: true,
        total: (pendentes || []).length,
        conciliados,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("sync-getnet error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
