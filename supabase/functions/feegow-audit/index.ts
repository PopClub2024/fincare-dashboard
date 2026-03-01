import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FEEGOW_BASE = "https://api.feegow.com/v1/api";

async function feegowFetch(url: string, headers: Record<string, string>) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.substring(0, 300)}`);
  }
  return res.json();
}

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
    const dateStart = body.date_start || "2026-01-01";
    const dateEnd = body.date_end || "2026-01-07"; // sample 1 week

    if (!clinicaId) {
      return new Response(JSON.stringify({ error: "clinica_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const report: Record<string, any> = {
      periodo: `${dateStart} a ${dateEnd}`,
      endpoints_testados: [],
      campos_encontrados: {},
      campos_ausentes: {},
      metricas: {},
    };

    // ── 1. Sample appoints/search ──
    try {
      const [d, m, y] = [dateStart.slice(8, 10), dateStart.slice(5, 7), dateStart.slice(0, 4)];
      const [d2, m2, y2] = [dateEnd.slice(8, 10), dateEnd.slice(5, 7), dateEnd.slice(0, 4)];
      const url = `${FEEGOW_BASE}/appoints/search?data_start=${d}-${m}-${y}&data_end=${d2}-${m2}-${y2}&list_procedures=1`;
      const data = await feegowFetch(url, feegowHeaders);
      const items = Array.isArray(data.content) ? data.content : [];

      report.endpoints_testados.push("appoints/search");
      report.appoints_sample_count = items.length;

      if (items.length > 0) {
        // Collect all field names across samples
        const allFields = new Set<string>();
        items.slice(0, 20).forEach((item: any) => {
          Object.keys(item).forEach(k => allFields.add(k));
        });
        report.campos_encontrados.appoints = Array.from(allFields).sort();

        // Check for financial fields
        const financialFields = ["valor", "value", "valor_total", "desconto", "discount", "valor_liquido", "net_value", "valor_bruto"];
        const found = financialFields.filter(f => allFields.has(f));
        const missing = financialFields.filter(f => !allFields.has(f));
        report.campos_encontrados.appoints_financial = found;
        report.campos_ausentes.appoints_financial = missing;

        // Check procedure sub-fields
        const procItem = items.find((i: any) => i.procedimentos?.length > 0 || i.procedures?.length > 0);
        if (procItem) {
          const proc = procItem.procedimentos?.[0] || procItem.procedures?.[0] || {};
          report.campos_encontrados.appoints_procedure_fields = Object.keys(proc).sort();
        }

        // Sample first record (anonymized)
        const sample = items[0];
        report.sample_appoint = Object.fromEntries(
          Object.entries(sample).map(([k, v]) => {
            if (typeof v === "string" && v.length > 50) return [k, v.substring(0, 50) + "..."];
            return [k, v];
          })
        );

        // Metrics
        let noValor = 0, noMedico = 0, noEspec = 0, noProc = 0;
        for (const item of items) {
          const val = Number(item.valor ?? item.value ?? item.valor_total_agendamento ?? 0);
          if (val === 0) noValor++;
          if (!item.profissional_id && !item.professional_id) noMedico++;
          if (!item.especialidade_nome && !item.specialty_name) noEspec++;
          const procs = item.procedimentos || item.procedures || [];
          if (!procs.length) noProc++;
        }
        report.metricas.appoints = {
          total: items.length,
          pct_valor_zero: Math.round(noValor / items.length * 100),
          pct_sem_medico: Math.round(noMedico / items.length * 100),
          pct_sem_especialidade: Math.round(noEspec / items.length * 100),
          pct_sem_procedimento: Math.round(noProc / items.length * 100),
        };
      }
    } catch (e: any) {
      report.errors_appoints = e.message;
    }

    // ── 2. Sample list-sales ──
    try {
      const url = `${FEEGOW_BASE}/financial/list-sales?date_start=${dateStart}&date_end=${dateEnd}`;
      const data = await feegowFetch(url, feegowHeaders);
      const items = Array.isArray(data.content) ? data.content : [];

      report.endpoints_testados.push("financial/list-sales");
      report.list_sales_sample_count = items.length;

      if (items.length > 0) {
        const allFields = new Set<string>();
        items.slice(0, 20).forEach((item: any) => Object.keys(item).forEach(k => allFields.add(k)));
        report.campos_encontrados.list_sales = Array.from(allFields).sort();

        report.sample_list_sale = Object.fromEntries(
          Object.entries(items[0]).map(([k, v]) => {
            if (typeof v === "string" && v.length > 50) return [k, v.substring(0, 50) + "..."];
            return [k, v];
          })
        );
      }
    } catch (e: any) {
      report.errors_list_sales = e.message;
    }

    // ── 3. Sample list-invoice ──
    try {
      const [d, m, y] = [dateStart.slice(8, 10), dateStart.slice(5, 7), dateStart.slice(0, 4)];
      const [d2, m2, y2] = [dateEnd.slice(8, 10), dateEnd.slice(5, 7), dateEnd.slice(0, 4)];
      const url = `${FEEGOW_BASE}/financial/list-invoice?date_start=${d}-${m}-${y}&date_end=${d2}-${m2}-${y2}`;
      const data = await feegowFetch(url, feegowHeaders);
      const items = Array.isArray(data.content) ? data.content : (data.content ? [data.content] : []);

      report.endpoints_testados.push("financial/list-invoice");
      report.list_invoice_sample_count = items.length;

      if (items.length > 0) {
        const allFields = new Set<string>();
        items.slice(0, 10).forEach((item: any) => Object.keys(item).forEach(k => allFields.add(k)));
        report.campos_encontrados.list_invoice = Array.from(allFields).sort();

        // Check for items/procedures sub-objects
        const withItems = items.find((i: any) => i.items || i.procedures || i.itens);
        if (withItems) {
          const subItems = withItems.items || withItems.procedures || withItems.itens || [];
          if (Array.isArray(subItems) && subItems.length > 0) {
            report.campos_encontrados.invoice_item_fields = Object.keys(subItems[0]).sort();
          }
        }

        // Check for payments sub-objects
        const withPayments = items.find((i: any) => i.payments || i.pagamentos);
        if (withPayments) {
          const payments = withPayments.payments || withPayments.pagamentos || [];
          if (Array.isArray(payments) && payments.length > 0) {
            report.campos_encontrados.invoice_payment_fields = Object.keys(payments[0]).sort();
          }
        }

        // Anonymized sample
        report.sample_invoice = Object.fromEntries(
          Object.entries(items[0]).map(([k, v]) => {
            if (typeof v === "string" && v.length > 100) return [k, v.substring(0, 100) + "..."];
            if (Array.isArray(v) && v.length > 3) return [k, v.slice(0, 3)];
            return [k, v];
          })
        );
      }
    } catch (e: any) {
      report.errors_list_invoice = e.message;
    }

    // ── 4. Try other financial endpoints ──
    const extraEndpoints = [
      { name: "financial/list-invoice (YYYY-MM-DD)", url: `${FEEGOW_BASE}/financial/list-invoice?date_start=${dateStart}&date_end=${dateEnd}` },
      { name: "financial/list-invoice (tipo C)", url: `${FEEGOW_BASE}/financial/list-invoice?date_start=${dateStart}&date_end=${dateEnd}&tipo_transacao=C` },
    ];
    for (const ep of extraEndpoints) {
      try {
        const data = await feegowFetch(ep.url, feegowHeaders);
        const items = Array.isArray(data.content) ? data.content : [];
        report[`extra_${ep.name.replace(/[^a-z0-9]/gi, '_')}`] = {
          count: items.length,
          fields: items.length > 0 ? Object.keys(items[0]).sort() : [],
          sample: items[0] || null,
        };
      } catch (e: any) {
        report[`extra_${ep.name.replace(/[^a-z0-9]/gi, '_')}`] = { error: e.message };
      }
    }

    // ── 5. Check current DB state ──
    const { count: totalVendas } = await supabase
      .from("transacoes_vendas")
      .select("id", { count: "exact", head: true })
      .eq("clinica_id", clinicaId);

    const { data: sampleVendas } = await supabase
      .from("transacoes_vendas")
      .select("valor_bruto, desconto, valor_liquido, medico_id, especialidade, procedimento")
      .eq("clinica_id", clinicaId)
      .limit(100);

    if (sampleVendas) {
      let noMed = 0, noEsp = 0, noProc = 0, noVal = 0, noDesc = 0;
      for (const r of sampleVendas) {
        if (!r.medico_id) noMed++;
        if (!r.especialidade) noEsp++;
        if (!r.procedimento) noProc++;
        if (Number(r.valor_bruto) === 0) noVal++;
        if (Number(r.desconto) === 0) noDesc++;
      }
      report.metricas.db_current = {
        total_vendas: totalVendas,
        sample_size: sampleVendas.length,
        pct_sem_medico: Math.round(noMed / sampleVendas.length * 100),
        pct_sem_especialidade: Math.round(noEsp / sampleVendas.length * 100),
        pct_sem_procedimento: Math.round(noProc / sampleVendas.length * 100),
        pct_valor_bruto_zero: Math.round(noVal / sampleVendas.length * 100),
        pct_desconto_zero: Math.round(noDesc / sampleVendas.length * 100),
      };
    }

    // ── 6. Save report ──
    await supabase.from("auditoria_integracoes").insert({
      clinica_id: clinicaId,
      integracao: "feegow",
      periodo: `${dateStart} a ${dateEnd}`,
      relatorio_json: report,
    });

    await supabase.from("integracao_logs").insert({
      clinica_id: clinicaId,
      integracao: "feegow_audit",
      acao: "audit",
      endpoint: "multiple",
      status: "sucesso",
      detalhes: report,
    });

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
