import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um CFO sênior especialista em saúde e health-tech. Seu papel:

## Personalidade e Estilo
- Rigor financeiro: auditoria, rastreabilidade, consistência competência vs caixa
- Foco em margem, capital de giro, previsibilidade e compliance
- Linguagem executiva, objetiva e acionável
- Mentalidade de sistema de saúde: convênios, glosas, repasses, custo médico, produtividade
- Postura "board-ready": sempre trazer o que mudou, por quê, impacto e próxima ação
- NUNCA invente números. Quando faltar dado, aponte a lacuna e sugira como preencher.
- SEMPRE separe Competência vs Caixa e indique qual base está usando.
- SEMPRE reporte "qualidade dos dados" antes de conclusões.

## Formato de Resposta
Estruture suas respostas em:
1. **Resumo Executivo** (2-3 frases)
2. **Qualidade dos Dados** (score e lacunas)
3. **Indicadores-chave** (com variações MoM quando disponível)
4. **Meta vs Realizado** (quando houver metas)
5. **Riscos** (top 5, priorizados por impacto)
6. **Oportunidades** (top 5)
7. **Plano de Ação** (priorizado por urgência e impacto)
8. **Conciliação** (pendências e correções recomendadas)

Use formatação Markdown. Valores monetários em R$ com separador de milhar. Percentuais com 1 casa decimal.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader || "" } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Não autenticado");

    const body = await req.json();
    const { start_date, end_date, mode = "analise_completa", chat_messages } = body;

    // Get clinica_id
    const { data: usuario } = await supabase
      .from("usuarios")
      .select("clinica_id")
      .eq("user_id", user.id)
      .single();
    if (!usuario) throw new Error("Usuário sem clínica");
    const clinicaId = usuario.clinica_id;

    // Gather context data in parallel
    const [dreResult, cashResult, dqResult, alertsResult, metasResult, importsResult, convenioResult] = await Promise.all([
      supabase.rpc("get_dre", { _start_date: start_date, _end_date: end_date }),
      supabase.rpc("get_cash_kpis", { _start_date: start_date, _end_date: end_date }),
      supabase.rpc("get_data_quality_score", { _start_date: start_date, _end_date: end_date }),
      supabase.from("alertas_eventos").select("*").eq("clinica_id", clinicaId).eq("status", "aberto").order("created_at", { ascending: false }).limit(20),
      supabase.from("metas_financeiras").select("*").eq("clinica_id", clinicaId).gte("competencia", start_date).lte("competencia", end_date),
      supabase.from("import_runs").select("*").eq("clinica_id", clinicaId).order("created_at", { ascending: false }).limit(10),
      supabase.rpc("get_convenio_kpis", { _start_date: start_date, _end_date: end_date }),
    ]);

    const context = {
      periodo: { inicio: start_date, fim: end_date },
      dre: dreResult.data,
      caixa: cashResult.data,
      data_quality: dqResult.data,
      alertas_abertos: alertsResult.data || [],
      metas: metasResult.data || [],
      imports_recentes: importsResult.data || [],
      convenios: convenioResult.data,
    };

    const dataQualityScore = (dqResult.data as any)?.score || 0;

    // Build messages for AI
    const contextMessage = `## Dados do Período (${start_date} a ${end_date})

### Data Quality Score: ${dataQualityScore}/100
${JSON.stringify((dqResult.data as any)?.checks || [], null, 2)}

### DRE
${JSON.stringify(dreResult.data, null, 2)}

### Caixa
${JSON.stringify(cashResult.data, null, 2)}

### Convênios
${JSON.stringify(convenioResult.data, null, 2)}

### Metas
${JSON.stringify(metasResult.data || [], null, 2)}

### Alertas Abertos
${JSON.stringify(alertsResult.data || [], null, 2)}

### Imports Recentes
${JSON.stringify((importsResult.data || []).map((i: any) => ({ tipo: i.tipo, status: i.status, origem: i.origem, created_at: i.created_at, registros_total: i.registros_total })), null, 2)}

${dataQualityScore < 60 ? `\n⚠️ ATENÇÃO: Data Quality Score baixo (${dataQualityScore}/100). NÃO faça conclusões definitivas sobre caixa, resultado ou metas. Liste explicitamente o que falta e as ações necessárias para completar a base de dados.\n` : ""}`;

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: contextMessage },
    ];

    if (chat_messages && Array.isArray(chat_messages)) {
      messages.push(...chat_messages);
    } else {
      messages.push({ role: "user", content: `Faça uma análise completa do tipo "${mode}" para o período ${start_date} a ${end_date}. Siga rigorosamente o formato de resposta definido.` });
    }

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        stream: !chat_messages, // stream for analysis, non-stream for save
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos em Settings → Workspace → Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await aiResponse.text();
      console.error("AI error:", status, t);
      throw new Error("Erro no gateway AI");
    }

    // If chat mode (with messages), stream response
    if (chat_messages) {
      return new Response(aiResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // For analysis mode, collect full response and save
    // Parse streaming response to collect full text
    let fullText = "";
    const reader = aiResponse.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      
      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, newlineIdx);
        buffer = buffer.slice(newlineIdx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) fullText += content;
        } catch { /* partial json */ }
      }
    }

    // Save insight
    const { data: insight, error: insertError } = await supabase
      .from("insights_ia")
      .insert({
        clinica_id: clinicaId,
        periodo_inicio: start_date,
        periodo_fim: end_date,
        tipo: mode,
        data_quality_score: dataQualityScore,
        input_context: context,
        output_markdown: fullText,
        acoes_recomendadas: [],
      })
      .select()
      .single();

    if (insertError) console.error("Error saving insight:", insertError);

    return new Response(JSON.stringify({
      insight_id: insight?.id,
      output_markdown: fullText,
      data_quality_score: dataQualityScore,
      data_quality: dqResult.data,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-cfo-analyze error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
