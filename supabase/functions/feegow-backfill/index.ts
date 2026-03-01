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
    const days = body.days || 90;
    const windowSize = body.window_size || 7;

    if (!clinicaId) {
      return new Response(JSON.stringify({ error: "clinica_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Concurrency guard: check for running backfill in last 15 min
    const { data: running } = await supabase
      .from("integracao_logs")
      .select("id")
      .eq("clinica_id", clinicaId)
      .eq("integracao", "feegow_backfill")
      .eq("status", "em_andamento")
      .gte("inicio", new Date(Date.now() - 15 * 60 * 1000).toISOString())
      .limit(1);

    if (running && running.length > 0) {
      return new Response(
        JSON.stringify({ error: "Backfill já em andamento. Aguarde a conclusão do processo atual." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create master log
    const { data: masterLog } = await supabase
      .from("integracao_logs")
      .insert({
        clinica_id: clinicaId,
        integracao: "feegow_backfill",
        acao: "backfill",
        endpoint: `backfill ${days} dias em janelas de ${windowSize}`,
        status: "em_andamento",
      })
      .select("id")
      .single();

    const masterLogId = masterLog?.id;

    const endDate = new Date();
    const startDate = new Date(Date.now() - days * 86400000);

    const windows: Array<{ start: string; end: string }> = [];
    let cur = new Date(startDate);

    while (cur < endDate) {
      const windowEnd = new Date(Math.min(cur.getTime() + windowSize * 86400000, endDate.getTime()));
      windows.push({
        start: cur.toISOString().split("T")[0],
        end: windowEnd.toISOString().split("T")[0],
      });
      cur = new Date(windowEnd.getTime() + 86400000);
    }

    const results: Array<{
      window: string;
      status: string;
      criados: number;
      atualizados: number;
      erros: string[];
    }> = [];

    let totalCriados = 0;
    let totalAtualizados = 0;
    let totalErros: string[] = [];

    for (const w of windows) {
      try {
        const syncUrl = `${supabaseUrl}/functions/v1/sync-feegow`;
        const res = await fetch(syncUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            clinica_id: clinicaId,
            action: "sales",
            date_start: w.start,
            date_end: w.end,
          }),
        });

        const text = await res.text();
        let data: any;
        try { data = JSON.parse(text); } catch { data = { error: text.substring(0, 200) }; }

        if (!res.ok) {
          const errMsg = data?.error || `HTTP ${res.status}`;
          totalErros.push(`Window ${w.start}-${w.end}: ${errMsg}`);
          results.push({ window: `${w.start} → ${w.end}`, status: "erro", criados: 0, atualizados: 0, erros: [errMsg] });
          continue;
        }

        const criados = data?.sales?.criados || 0;
        const atualizados = data?.sales?.atualizados || 0;
        const erros = data?.sales?.erros || [];

        totalCriados += criados;
        totalAtualizados += atualizados;
        totalErros = totalErros.concat(erros);

        results.push({
          window: `${w.start} → ${w.end}`,
          status: erros.length > 0 ? "erro_parcial" : "sucesso",
          criados,
          atualizados,
          erros,
        });
      } catch (e: any) {
        totalErros.push(`Window ${w.start}-${w.end}: ${e.message}`);
        results.push({
          window: `${w.start} → ${w.end}`,
          status: "erro",
          criados: 0,
          atualizados: 0,
          erros: [e.message],
        });
      }
    }

    // Update master log
    if (masterLogId) {
      await supabase
        .from("integracao_logs")
        .update({
          status: totalErros.length > 0 ? "erro_parcial" : "sucesso",
          fim: new Date().toISOString(),
          registros_criados: totalCriados,
          registros_atualizados: totalAtualizados,
          registros_processados: totalCriados + totalAtualizados,
          erros: totalErros.slice(0, 50),
          detalhes: { days, windowSize, windows: results.length, results },
        })
        .eq("id", masterLogId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        windows_processed: results.length,
        total_criados: totalCriados,
        total_atualizados: totalAtualizados,
        total_erros: totalErros.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("feegow-backfill error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
