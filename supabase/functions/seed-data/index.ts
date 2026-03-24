import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { clinica_id, action } = await req.json();
    if (!clinica_id) throw new Error("clinica_id obrigatório");

    if (action === "plano_contas") {
      await supabase.rpc("seed_plano_contas", { _clinica_id: clinica_id });
      return new Response(JSON.stringify({ ok: true, message: "Plano de contas importado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "dre_mapeamento") {
      await supabase.rpc("seed_dre_mapeamento", { _clinica_id: clinica_id });
      return new Response(JSON.stringify({ ok: true, message: "Mapeamento DRE importado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Ação desconhecida: ${action}`);
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
