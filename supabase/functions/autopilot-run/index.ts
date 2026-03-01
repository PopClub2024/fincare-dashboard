import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) throw new Error("Não autenticado");

    const { data: usuario } = await supabaseUser.from("usuarios").select("clinica_id").eq("user_id", user.id).single();
    if (!usuario) throw new Error("Sem clínica");
    const clinicaId = usuario.clinica_id;

    const body = await req.json();
    const { trigger = "manual", start_date, end_date } = body;

    // Create run record
    const { data: run, error: runError } = await supabaseAdmin
      .from("autopilot_runs")
      .insert({ clinica_id: clinicaId, trigger, status: "em_andamento", steps: [] })
      .select()
      .single();
    if (runError) throw runError;

    const steps: any[] = [];
    let hasError = false;

    // Step 1: Recalculate Data Quality / KPIs
    const step1Start = Date.now();
    try {
      const { data: dqData } = await supabaseUser.rpc("get_data_quality_score", { _start_date: start_date, _end_date: end_date });
      const { data: dreData } = await supabaseUser.rpc("get_dre", { _start_date: start_date, _end_date: end_date });
      const { data: cashData } = await supabaseUser.rpc("get_cash_kpis", { _start_date: start_date, _end_date: end_date });

      // Upsert KPI snapshot
      await supabaseAdmin.from("kpi_snapshots").upsert({
        clinica_id: clinicaId,
        periodo: start_date,
        granularidade: "mensal",
        kpis: { dre: dreData, caixa: cashData },
        data_quality_score: (dqData as any)?.score || 0,
        data_quality_breakdown: dqData,
      }, { onConflict: "clinica_id,periodo,granularidade" });

      steps.push({ step: "recalculate_kpis", status: "ok", duration_ms: Date.now() - step1Start, score: (dqData as any)?.score });
    } catch (e: any) {
      steps.push({ step: "recalculate_kpis", status: "error", duration_ms: Date.now() - step1Start, error: e.message });
      hasError = true;
    }

    // Step 2: Evaluate Alerts
    const step2Start = Date.now();
    try {
      // Auto-generate alerts based on data conditions
      const alerts: any[] = [];

      // Check for missing imports
      const { data: recentImports } = await supabaseAdmin
        .from("import_runs")
        .select("tipo, status, created_at")
        .eq("clinica_id", clinicaId)
        .order("created_at", { ascending: false })
        .limit(5);

      const lastBankImport = recentImports?.find((i: any) => i.tipo === "ofx");
      if (!lastBankImport || new Date(lastBankImport.created_at) < new Date(Date.now() - 7 * 86400000)) {
        alerts.push({ tipo: "import_atrasado", severidade: "warning", titulo: "Extrato bancário desatualizado", descricao: "Último import de OFX há mais de 7 dias. Importar para manter conciliação em dia." });
      }

      // Check overdue AP
      const { count: apVencido } = await supabaseAdmin
        .from("contas_pagar_lancamentos")
        .select("*", { count: "exact", head: true })
        .eq("clinica_id", clinicaId)
        .is("data_pagamento", null)
        .in("status", ["a_classificar", "classificado"])
        .lt("data_vencimento", new Date().toISOString().split("T")[0]);

      if (apVencido && apVencido > 0) {
        alerts.push({ tipo: "ap_vencido", severidade: "critical", titulo: `${apVencido} contas a pagar vencidas`, descricao: "Verificar e regularizar pagamentos em atraso." });
      }

      // Check high glosa rate
      const { data: convenioKpis } = await supabaseUser.rpc("get_convenio_kpis", { _start_date: start_date, _end_date: end_date });
      const pctGlosa = (convenioKpis as any)?.glosas?.pct_glosa || 0;
      if (pctGlosa > 5) {
        alerts.push({ tipo: "glosa_alta", severidade: "warning", titulo: `Taxa de glosa elevada: ${pctGlosa}%`, descricao: "Avaliar convênios com maior taxa de glosa e iniciar recursos." });
      }

      // Dedupe and insert alerts
      for (const alert of alerts) {
        const { data: existing } = await supabaseAdmin
          .from("alertas_eventos")
          .select("id")
          .eq("clinica_id", clinicaId)
          .eq("tipo", alert.tipo)
          .eq("status", "aberto")
          .limit(1);

        if (!existing || existing.length === 0) {
          await supabaseAdmin.from("alertas_eventos").insert({ clinica_id: clinicaId, ...alert });
        }
      }

      steps.push({ step: "evaluate_alerts", status: "ok", duration_ms: Date.now() - step2Start, alerts_generated: alerts.length });
    } catch (e: any) {
      steps.push({ step: "evaluate_alerts", status: "error", duration_ms: Date.now() - step2Start, error: e.message });
      hasError = true;
    }

    // Step 3: AI CFO Analyze
    const step3Start = Date.now();
    try {
      const analyzeResp = await fetch(`${supabaseUrl}/functions/v1/ai-cfo-analyze`, {
        method: "POST",
        headers: {
          Authorization: authHeader || `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ start_date, end_date, mode: "analise_completa" }),
      });

      if (!analyzeResp.ok) {
        const errText = await analyzeResp.text();
        throw new Error(`AI analyze failed: ${analyzeResp.status} ${errText}`);
      }

      const analyzeResult = await analyzeResp.json();
      steps.push({ step: "ai_cfo_analyze", status: "ok", duration_ms: Date.now() - step3Start, insight_id: analyzeResult.insight_id, data_quality_score: analyzeResult.data_quality_score });
    } catch (e: any) {
      steps.push({ step: "ai_cfo_analyze", status: "error", duration_ms: Date.now() - step3Start, error: e.message });
      hasError = true;
    }

    // Update run
    await supabaseAdmin.from("autopilot_runs").update({
      status: hasError ? "parcial" : "sucesso",
      steps,
      finished_at: new Date().toISOString(),
    }).eq("id", run.id);

    return new Response(JSON.stringify({ run_id: run.id, status: hasError ? "parcial" : "sucesso", steps }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("autopilot-run error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
