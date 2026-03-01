import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Parse Brazilian decimal (1.234,56 → 1234.56) or negative with minus
function parseBRL(raw: string): number {
  if (!raw || raw.trim() === "") return 0;
  const cleaned = raw.trim().replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

// Parse dd/MM/yyyy HH:mm → ISO string
function parseDateTimeBR(raw: string): string {
  const [datePart, timePart] = raw.trim().split(" ");
  const [d, m, y] = datePart.split("/");
  const time = timePart || "00:00";
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${time}:00`;
}

// Parse dd/MM/yyyy → yyyy-MM-dd
function parseDateBR(raw: string): string | null {
  if (!raw || raw.trim() === "") return null;
  const [d, m, y] = raw.trim().split("/");
  if (!y) return null;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

// Parse CSV with semicolon delimiter, handling quoted fields
function parseCSV(content: string): string[][] {
  const lines = content.split("\n").filter((l) => l.trim());
  return lines.map((line) => {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ";" && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  });
}

interface ParsedCartao {
  tipo_extrato: "cartao";
  data_venda: string;
  bandeira: string;
  modalidade: string;
  forma_pagamento: string;
  status_transacao: string;
  parcelas: number;
  data_prevista_pagamento: string | null;
  numero_cartao: string;
  autorizacao: string;
  comprovante_venda: string;
  terminal: string;
  valor_bruto: number;
  valor_taxa: number;
  valor_liquido: number;
}

interface ParsedPix {
  tipo_extrato: "pix";
  data_venda: string;
  instituicao_bancaria: string;
  id_transacao_pix: string;
  comprovante_venda: string;
  terminal: string;
  valor_bruto: number;
  valor_taxa: number;
  valor_liquido: number;
  status_transacao: string;
}

function parseCartaoCSV(rows: string[][]): ParsedCartao[] {
  // Skip header row
  const results: ParsedCartao[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 18) continue;
    const status = r[7]; // STATUS DA TRANSAÇÃO
    if (status !== "Aprovada") continue; // Only approved transactions

    results.push({
      tipo_extrato: "cartao",
      data_venda: parseDateTimeBR(r[3]),
      bandeira: r[4],
      modalidade: r[5],
      forma_pagamento: r[6],
      status_transacao: status,
      parcelas: parseInt(r[8]) || 1,
      data_prevista_pagamento: parseDateBR(r[9]),
      numero_cartao: r[10],
      autorizacao: r[11],
      comprovante_venda: r[12],
      terminal: r[14],
      valor_bruto: parseBRL(r[15]),
      valor_taxa: Math.abs(parseBRL(r[16])),
      valor_liquido: parseBRL(r[17]),
    });
  }
  return results;
}

function parsePixCSV(rows: string[][]): ParsedPix[] {
  const results: ParsedPix[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 14) continue;
    const status = r[13]; // STATUS
    if (status !== "Paga") continue; // Only paid transactions

    results.push({
      tipo_extrato: "pix",
      data_venda: parseDateTimeBR(r[3]),
      instituicao_bancaria: r[4],
      id_transacao_pix: r[5],
      comprovante_venda: r[6],
      terminal: r[9],
      valor_bruto: parseBRL(r[10]),
      valor_taxa: Math.abs(parseBRL(r[11])),
      valor_liquido: parseBRL(r[12]),
      status_transacao: status,
    });
  }
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { clinica_id, csv_content, tipo_extrato, nome_arquivo } = body;

    if (!clinica_id || !csv_content || !tipo_extrato) {
      return new Response(
        JSON.stringify({ error: "clinica_id, csv_content e tipo_extrato obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rows = parseCSV(csv_content);
    let parsed: (ParsedCartao | ParsedPix)[] = [];

    if (tipo_extrato === "cartao") {
      parsed = parseCartaoCSV(rows);
    } else if (tipo_extrato === "pix") {
      parsed = parsePixCSV(rows);
    } else {
      return new Response(
        JSON.stringify({ error: "tipo_extrato deve ser 'cartao' ou 'pix'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (parsed.length === 0) {
      return new Response(
        JSON.stringify({ success: true, created: 0, skipped: 0, message: "Nenhuma transação aprovada/paga encontrada" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine period
    const dates = parsed.map((p) => p.data_venda).sort();
    const periodoInicio = dates[0]?.split("T")[0];
    const periodoFim = dates[dates.length - 1]?.split("T")[0];

    // Create archive record
    const { data: arquivo } = await supabase
      .from("arquivos_importados")
      .insert({
        clinica_id,
        nome_arquivo: nome_arquivo || `getnet_${tipo_extrato}_${periodoInicio}_${periodoFim}.csv`,
        tipo: `getnet_${tipo_extrato}`,
        registros_importados: parsed.length,
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim,
        status: "processando",
      })
      .select("id")
      .single();

    const arquivoId = arquivo?.id;

    // Upsert transactions
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const tx of parsed) {
      const record: any = {
        clinica_id,
        tipo_extrato: tx.tipo_extrato,
        data_venda: tx.data_venda,
        status_transacao: tx.status_transacao,
        comprovante_venda: tx.comprovante_venda,
        terminal: (tx as any).terminal,
        valor_bruto: tx.valor_bruto,
        valor_taxa: tx.valor_taxa,
        valor_liquido: tx.valor_liquido,
        arquivo_id: arquivoId,
      };

      if (tx.tipo_extrato === "cartao") {
        const c = tx as ParsedCartao;
        record.bandeira = c.bandeira;
        record.modalidade = c.modalidade;
        record.forma_pagamento = c.forma_pagamento;
        record.parcelas = c.parcelas;
        record.data_prevista_pagamento = c.data_prevista_pagamento;
        record.numero_cartao = c.numero_cartao;
        record.autorizacao = c.autorizacao;
      } else {
        const p = tx as ParsedPix;
        record.id_transacao_pix = p.id_transacao_pix;
        record.instituicao_bancaria = p.instituicao_bancaria;
      }

      const { error } = await supabase
        .from("getnet_transacoes")
        .upsert(record, { onConflict: "clinica_id,tipo_extrato,comprovante_venda" });

      if (error) {
        if (error.code === "23505") {
          skipped++;
        } else {
          errors.push(`CV ${tx.comprovante_venda}: ${error.message}`);
        }
      } else {
        created++;
      }
    }

    // Update arquivo status
    if (arquivoId) {
      await supabase
        .from("arquivos_importados")
        .update({
          status: errors.length > 0 ? "erro_parcial" : "processado",
          registros_importados: created,
          observacao: skipped > 0 ? `${skipped} duplicados ignorados` : null,
        })
        .eq("id", arquivoId);
    }

    // Log
    await supabase.from("integracao_logs").insert({
      clinica_id,
      integracao: "getnet",
      acao: `import_csv_${tipo_extrato}`,
      endpoint: "import-getnet-csv",
      status: errors.length > 0 ? "erro_parcial" : "sucesso",
      registros_processados: parsed.length,
      registros_criados: created,
      registros_ignorados: skipped,
      erros: errors.length > 0 ? errors : null,
      fim: new Date().toISOString(),
      detalhes: { periodo: { inicio: periodoInicio, fim: periodoFim }, tipo_extrato },
    });

    const totais = parsed.reduce(
      (acc, tx) => ({
        bruto: acc.bruto + tx.valor_bruto,
        taxa: acc.taxa + tx.valor_taxa,
        liquido: acc.liquido + tx.valor_liquido,
      }),
      { bruto: 0, taxa: 0, liquido: 0 }
    );

    return new Response(
      JSON.stringify({
        success: true,
        created,
        skipped,
        errors,
        total_transacoes: parsed.length,
        periodo: { inicio: periodoInicio, fim: periodoFim },
        totais,
        arquivo_id: arquivoId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("import-getnet-csv error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
