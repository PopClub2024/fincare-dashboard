import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FEEGOW_BASE_URL = "https://api.feegow.com/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const feegowApiKey = Deno.env.get("FEEGOW_API_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { rascunho_id, clinica_id } = await req.json();

    if (!rascunho_id || !clinica_id) {
      return new Response(JSON.stringify({ error: "rascunho_id e clinica_id são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Validate rascunho status = 'aprovado'
    const { data: rascunho, error: rErr } = await supabase
      .from("precos_rascunho")
      .select("*")
      .eq("id", rascunho_id)
      .eq("clinica_id", clinica_id)
      .single();

    if (rErr || !rascunho) {
      return new Response(JSON.stringify({ error: "Rascunho não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (rascunho.status !== "aprovado") {
      return new Response(JSON.stringify({ error: `Rascunho deve estar 'aprovado' para publicar. Status atual: ${rascunho.status}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get rascunho items that haven't been confirmed yet
    const { data: items } = await supabase
      .from("precos_rascunho_itens")
      .select("*, procedimentos(nome, codigo_feegow), pagadores(nome, codigo_feegow)")
      .eq("rascunho_id", rascunho_id)
      .eq("clinica_id", clinica_id)
      .in("status_sync_feegow", ["nao_enviado", "erro"]);

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum item pendente para sincronizar" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const feegowHeaders = {
      "x-access-token": feegowApiKey,
      "Content-Type": "application/json",
    };

    const results: { item_id: string; status: string; response: any }[] = [];
    let allSuccess = true;

    // 3. For each item, attempt to update in Feegow
    for (const item of items) {
      const procedimento = (item as any).procedimentos;
      const codigoFeegow = procedimento?.codigo_feegow;

      if (!codigoFeegow) {
        // No Feegow code - mark as confirmed (local-only procedure)
        await supabase
          .from("precos_rascunho_itens")
          .update({ status_sync_feegow: "confirmado", feegow_response: { nota: "Sem codigo_feegow - atualizado apenas localmente" } })
          .eq("id", item.id);
        results.push({ item_id: item.id, status: "confirmado", response: { nota: "Local only" } });
        continue;
      }

      try {
        // Call Feegow API to update price
        const payload = {
          procedure_id: codigoFeegow,
          value: item.novo_preco_bruto,
        };

        const res = await fetch(`${FEEGOW_BASE_URL}/procedure/update-value`, {
          method: "PUT",
          headers: feegowHeaders,
          body: JSON.stringify(payload),
        });

        const responseBody = await res.json().catch(() => ({ status: res.status }));

        if (res.ok) {
          await supabase
            .from("precos_rascunho_itens")
            .update({ status_sync_feegow: "confirmado", feegow_response: responseBody })
            .eq("id", item.id);
          results.push({ item_id: item.id, status: "confirmado", response: responseBody });
        } else {
          allSuccess = false;
          await supabase
            .from("precos_rascunho_itens")
            .update({ status_sync_feegow: "erro", feegow_response: responseBody })
            .eq("id", item.id);
          results.push({ item_id: item.id, status: "erro", response: responseBody });
        }
      } catch (e) {
        allSuccess = false;
        const errMsg = { error: e.message };
        await supabase
          .from("precos_rascunho_itens")
          .update({ status_sync_feegow: "erro", feegow_response: errMsg })
          .eq("id", item.id);
        results.push({ item_id: item.id, status: "erro", response: errMsg });
      }
    }

    // 4. Log the sync attempt
    await supabase.from("feegow_sync_log").insert({
      clinica_id,
      tipo: "update_precos",
      rascunho_id,
      payload: { items: items.map(i => ({ id: i.id, preco: i.novo_preco_bruto })) },
      response: { results },
      status: allSuccess ? "sucesso" : "parcial",
    });

    // 5. If ALL items confirmed, apply to official prices and mark rascunho as published
    if (allSuccess) {
      for (const item of items) {
        // Close previous vigência
        await supabase
          .from("precos_procedimento")
          .update({ vigente_ate: new Date(new Date(item.vigente_de).getTime() - 86400000).toISOString().split("T")[0] })
          .eq("clinica_id", clinica_id)
          .eq("pagador_id", item.pagador_id)
          .eq("procedimento_id", item.procedimento_id)
          .eq("status", "publicado")
          .is("vigente_ate", null);

        // Insert new official price
        await supabase.from("precos_procedimento").insert({
          clinica_id,
          pagador_id: item.pagador_id,
          procedimento_id: item.procedimento_id,
          preco_bruto: item.novo_preco_bruto,
          repasse_medico: item.novo_repasse || 0,
          vigente_de: item.vigente_de,
          status: "publicado",
          origem: "manual",
        });
      }

      // Mark rascunho as published
      await supabase
        .from("precos_rascunho")
        .update({ status: "publicado" })
        .eq("id", rascunho_id);
    }

    return new Response(JSON.stringify({
      success: true,
      all_confirmed: allSuccess,
      total: items.length,
      confirmed: results.filter(r => r.status === "confirmado").length,
      errors: results.filter(r => r.status === "erro").length,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
