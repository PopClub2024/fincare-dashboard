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
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { clinica_id, comprovante_id, image_base64 } = await req.json();
    if (!clinica_id || !comprovante_id) {
      return new Response(JSON.stringify({ error: "clinica_id and comprovante_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get comprovante record
    const { data: comprovante, error: compErr } = await supabase
      .from("comprovantes")
      .select("*")
      .eq("id", comprovante_id)
      .single();
    if (compErr || !comprovante) {
      return new Response(JSON.stringify({ error: "Comprovante não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get plano de contas for context
    const { data: planoContas } = await supabase
      .from("plano_contas")
      .select("id, codigo, codigo_estruturado, descricao, indicador, categoria")
      .eq("clinica_id", clinica_id)
      .eq("ativo", true);

    const planoList = (planoContas || [])
      .map((p: any) => `${p.codigo_estruturado} - ${p.descricao} (${p.categoria})`)
      .join("\n");

    // Build AI prompt
    const systemPrompt = `Você é um assistente financeiro especializado em clínicas médicas. Analise o comprovante de pagamento e extraia os campos estruturados. Use o plano de contas abaixo para classificar:

${planoList}

Retorne os dados usando a função extract_comprovante_data.`;

    const userContent = image_base64
      ? [
          { type: "text", text: "Analise este comprovante de pagamento e extraia os dados." },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image_base64}` } },
        ]
      : [{ type: "text", text: `Analise o comprovante no URL: ${comprovante.arquivo_url}` }];

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_comprovante_data",
            description: "Extrair dados do comprovante de pagamento",
            parameters: {
              type: "object",
              properties: {
                fornecedor: { type: "string", description: "Nome do fornecedor/beneficiário" },
                valor: { type: "number", description: "Valor do pagamento" },
                data_pagamento: { type: "string", description: "Data do pagamento (YYYY-MM-DD)" },
                descricao: { type: "string", description: "Descrição do pagamento" },
                forma_pagamento: { type: "string", enum: ["pix","dinheiro","convenio_nf","cartao_credito","cartao_debito"] },
                canal_pagamento: { type: "string", enum: ["qrcode","chave_celular","chave_cnpj","maquininha","boleto","deposito","outro"] },
                banco_referencia: { type: "string", description: "Banco de referência" },
                plano_contas_codigo_estruturado: { type: "string", description: "Código estruturado do plano de contas mais adequado" },
                confianca: { type: "number", description: "Nível de confiança 0-100" },
              },
              required: ["fornecedor", "valor", "data_pagamento"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_comprovante_data" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      await supabase.from("comprovantes").update({ status: "erro", erro_processamento: "IA não retornou dados estruturados" }).eq("id", comprovante_id);
      return new Response(JSON.stringify({ error: "IA não extraiu dados" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = JSON.parse(toolCall.function.arguments);

    // Find plano_contas match
    let planoContasId = null;
    if (extracted.plano_contas_codigo_estruturado) {
      const { data: plano } = await supabase
        .from("plano_contas")
        .select("id")
        .eq("clinica_id", clinica_id)
        .eq("codigo_estruturado", extracted.plano_contas_codigo_estruturado)
        .maybeSingle();
      planoContasId = plano?.id || null;
    }

    // Update comprovante
    await supabase.from("comprovantes").update({
      status: "processado",
      dados_extraidos: extracted,
    }).eq("id", comprovante_id);

    // Create lancamento
    const { data: lancamento, error: lancErr } = await supabase
      .from("contas_pagar_lancamentos")
      .insert({
        clinica_id,
        plano_contas_id: planoContasId,
        descricao: extracted.descricao || comprovante.arquivo_nome,
        fornecedor: extracted.fornecedor,
        valor: extracted.valor,
        data_competencia: extracted.data_pagamento || new Date().toISOString().split("T")[0],
        data_pagamento: extracted.data_pagamento,
        forma_pagamento: extracted.forma_pagamento || null,
        canal_pagamento: extracted.canal_pagamento || null,
        banco_referencia: extracted.banco_referencia || null,
        comprovante_id,
        status: planoContasId ? "classificado" : "a_classificar",
      })
      .select()
      .single();

    if (lancErr) {
      return new Response(JSON.stringify({ error: lancErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Link lancamento to comprovante
    await supabase.from("comprovantes").update({ lancamento_id: lancamento.id }).eq("id", comprovante_id);

    return new Response(JSON.stringify({ success: true, lancamento, extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-comprovante error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
