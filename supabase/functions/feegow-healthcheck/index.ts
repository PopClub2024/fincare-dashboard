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
  const feegowApiKey = Deno.env.get("FEEGOW_API_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json().catch(() => ({}));
    const clinicaId = body.clinica_id;

    if (!clinicaId) {
      return new Response(JSON.stringify({ error: "clinica_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!feegowApiKey) {
      // Log failure
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
        JSON.stringify({
          ok: false,
          error: "Token Feegow não configurado no servidor",
          status_code: null,
          duration_ms: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const startTime = Date.now();
    let statusCode = 0;
    let ok = false;
    let errorMessage: string | null = null;
    let professionalCount = 0;

    try {
      const res = await fetch("https://api.feegow.com/v1/api/professional/list", {
        headers: {
          "x-access-token": feegowApiKey,
          "Content-Type": "application/json",
        },
      });

      statusCode = res.status;
      const text = await res.text();

      if (res.ok) {
        ok = true;
        try {
          const data = JSON.parse(text);
          professionalCount = (data.content || []).length;
        } catch {
          // response not JSON but still 200
        }
      } else if (statusCode === 401 || statusCode === 403) {
        errorMessage = "Token inválido ou sem permissão. Verifique o token Feegow.";
      } else {
        errorMessage = `Feegow retornou HTTP ${statusCode}: ${text.substring(0, 200)}`;
      }
    } catch (e) {
      errorMessage = `Erro de rede: ${e.message}`;
    }

    const durationMs = Date.now() - startTime;

    // Log result
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
      JSON.stringify({
        ok,
        status_code: statusCode,
        duration_ms: durationMs,
        professional_count: professionalCount,
        error: errorMessage,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("feegow-healthcheck error:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
