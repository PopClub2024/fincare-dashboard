import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FEEGOW_BASE = "https://api.feegow.com/v1/api";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const feegowApiKey = Deno.env.get("FEEGOW_API_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const feegowHeaders = {
    "x-access-token": feegowApiKey,
    "Content-Type": "application/json",
  };

  try {
    const body = await req.json().catch(() => ({}));
    const clinicaId = body.clinica_id;
    const action = body.action || "healthcheck";

    // ─── Sample endpoints (no clinica_id required) ───
    if (action === "sample_sales") {
      const dateStart = body.date_start || "2026-01-01";
      const dateEnd = body.date_end || "2026-01-07";

      const results: Record<string, any> = {};

      // Try financial/list-sales (with unidade_id like sync does)
      try {
        const url = `${FEEGOW_BASE}/financial/list-sales?date_start=${dateStart}&date_end=${dateEnd}&unidade_id=0`;
        const res = await fetch(url, { headers: feegowHeaders });
        const data = await res.json();
        const items = data.content || data.data || [];
        results.list_sales = {
          status: res.status,
          top_level_keys: Object.keys(data),
          total_items: Array.isArray(items) ? items.length : typeof items,
          sample: Array.isArray(items) ? items.slice(0, 3) : items,
          content_type: typeof data.content,
        };
      } catch (e: any) {
        results.list_sales = { error: e.message };
      }

      // Try financial/list-invoice
      try {
        const url = `${FEEGOW_BASE}/financial/list-invoice?date_start=${dateStart}&date_end=${dateEnd}`;
        const res = await fetch(url, { headers: feegowHeaders });
        const data = await res.json();
        const items = data.content || data.data || [];
        results.list_invoice = {
          status: res.status,
          top_level_keys: Object.keys(data),
          total_items: Array.isArray(items) ? items.length : typeof items,
          sample: Array.isArray(items) ? items.slice(0, 3) : items,
          content_type: typeof data.content,
        };
      } catch (e: any) {
        results.list_invoice = { error: e.message };
      }

      // Try appoints/search
      try {
        const fd = dateStart.split("-").reverse().join("-");
        const td = dateEnd.split("-").reverse().join("-");
        const url = `${FEEGOW_BASE}/appoints/search?data_start=${fd}&data_end=${td}&list_procedures=1`;
        const res = await fetch(url, { headers: feegowHeaders });
        const data = await res.json();
        const items = data.content || data.data || [];
        results.appoints_search = {
          status: res.status,
          top_level_keys: Object.keys(data),
          total_items: Array.isArray(items) ? items.length : typeof items,
          sample: Array.isArray(items) ? items.slice(0, 3) : items,
          content_type: typeof data.content,
        };
      } catch (e: any) {
        results.appoints_search = { error: e.message };
      }

      return new Response(JSON.stringify(results, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "sample_metadata") {
      const endpoints = [
        { name: "professional", url: `${FEEGOW_BASE}/professional/list` },
        { name: "treatment_place", url: `${FEEGOW_BASE}/treatment-place/list` },
        { name: "insurance", url: `${FEEGOW_BASE}/insurance/list` },
      ];
      const results: Record<string, any> = {};
      for (const ep of endpoints) {
        try {
          const res = await fetch(ep.url, { headers: feegowHeaders });
          const data = await res.json();
          const items = data.content || data.data || [];
          results[ep.name] = {
            status: res.status,
            top_level_keys: Object.keys(data),
            total_items: Array.isArray(items) ? items.length : typeof items,
            sample: Array.isArray(items) ? items.slice(0, 2) : items,
          };
        } catch (e: any) {
          results[ep.name] = { error: e.message };
        }
      }
      return new Response(JSON.stringify(results, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Healthcheck (original) ───
    if (!clinicaId) {
      return new Response(JSON.stringify({ error: "clinica_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!feegowApiKey) {
      await supabase.from("integracao_logs").insert({
        clinica_id: clinicaId,
        integracao: "feegow",
        acao: "healthcheck",
        endpoint: "professional/list",
        status: "erro",
        fim: new Date().toISOString(),
        erros: [{ message: "FEEGOW_API_KEY não configurada" }],
      });
      return new Response(
        JSON.stringify({ ok: false, error: "Token Feegow não configurado no servidor", status_code: null, duration_ms: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const startTime = Date.now();
    let statusCode = 0;
    let ok = false;
    let errorMessage: string | null = null;
    let professionalCount = 0;

    try {
      const res = await fetch(`${FEEGOW_BASE}/professional/list`, { headers: feegowHeaders });
      statusCode = res.status;
      const text = await res.text();
      if (res.ok) {
        ok = true;
        try {
          const data = JSON.parse(text);
          professionalCount = (data.content || []).length;
        } catch {}
      } else if (statusCode === 401 || statusCode === 403) {
        errorMessage = "Token inválido ou sem permissão.";
      } else {
        errorMessage = `Feegow retornou HTTP ${statusCode}: ${text.substring(0, 200)}`;
      }
    } catch (e: any) {
      errorMessage = `Erro de rede: ${e.message}`;
    }

    const durationMs = Date.now() - startTime;

    await supabase.from("integracao_logs").insert({
      clinica_id: clinicaId,
      integracao: "feegow",
      acao: "healthcheck",
      endpoint: "professional/list",
      status: ok ? "sucesso" : "erro",
      fim: new Date().toISOString(),
      detalhes: { status_code: statusCode, duration_ms: durationMs, professional_count: professionalCount },
      erros: errorMessage ? [{ message: errorMessage }] : [],
    });

    return new Response(
      JSON.stringify({ ok, status_code: statusCode, duration_ms: durationMs, professional_count: professionalCount, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("feegow-healthcheck error:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
