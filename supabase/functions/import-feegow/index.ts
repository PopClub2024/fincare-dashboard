// Edge Function: import-feegow
// Importa dados do Feegow API para o Supabase
// Suporta: profissionais, especialidades, convênios, procedimentos, pacientes, agendamentos

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FEEGOW_BASE = "https://api.feegow.com/v1/api";

async function feegowGet(token: string, endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(`${FEEGOW_BASE}/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: { "x-access-token": token } });
  const data = await res.json();
  if (!data.success && !data.content) throw new Error(`Feegow error: ${endpoint}`);
  return data.content || [];
}

// Map Feegow status_id to Medic Pop status
function mapStatus(statusId: number): string {
  const map: Record<number, string> = {
    1: "agendado", 2: "confirmado", 3: "cancelado", 4: "cancelado",
    5: "atendido", 6: "nao_compareceu", 7: "remarcado", 8: "checkin", 9: "em_atendimento",
  };
  return map[statusId] || "agendado";
}

function cleanCpf(cpf: string | null): string | null {
  if (!cpf) return null;
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return null;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function parseDateBR(d: string | null): string | null {
  if (!d) return null;
  // dd-mm-yyyy or yyyy-mm-dd
  if (d.includes("-") && d.length === 10) {
    const parts = d.split("-");
    if (parts[0].length === 4) return d; // yyyy-mm-dd
    return `${parts[2]}-${parts[1]}-${parts[0]}`; // dd-mm-yyyy → yyyy-mm-dd
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { feegow_token, clinica_id, import_type, date_start, date_end } = await req.json();

    if (!feegow_token || !clinica_id) {
      return new Response(JSON.stringify({ error: "feegow_token and clinica_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const results: Record<string, number> = {};

    // ============ ESPECIALIDADES ============
    if (!import_type || import_type === "all" || import_type === "especialidades") {
      const specs = await feegowGet(feegow_token, "specialties/list");
      for (const s of specs) {
        await supabase.from("especialidades").upsert({
          clinica_id, feegow_id: s.especialidade_id,
          nome: s.nome, codigo_tiss: s.codigo_tiss || null, ativo: true,
        }, { onConflict: "feegow_id" });
      }
      results.especialidades = specs.length;
    }

    // ============ CONVÊNIOS ============
    if (!import_type || import_type === "all" || import_type === "convenios") {
      const convs = await feegowGet(feegow_token, "insurance/list");
      for (const c of convs) {
        const { data: conv } = await supabase.from("convenios").upsert({
          clinica_id, feegow_id: c.convenio_id,
          nome: c.nome, registro_ans: c.registro_ans || null,
          cnpj: c.CNPJ || null, ativo: true,
        }, { onConflict: "feegow_id" }).select("id").single();

        // Planos
        if (conv && c.planos) {
          for (const p of c.planos) {
            await supabase.from("convenio_planos").upsert({
              convenio_id: conv.id, feegow_plano_id: p.plano_id, nome: p.plano,
            }, { onConflict: "convenio_id,feegow_plano_id" }).catch(() => {
              // ignore duplicate
            });
          }
        }
      }
      results.convenios = convs.length;
    }

    // ============ PROCEDIMENTOS ============
    if (!import_type || import_type === "all" || import_type === "procedimentos") {
      const procs = await feegowGet(feegow_token, "procedures/list", { limit: "1000" });
      for (const p of procs) {
        await supabase.from("procedimentos").upsert({
          clinica_id, feegow_id: p.procedimento_id,
          nome: p.nome, codigo_tiss: p.codigo || null,
          tipo_procedimento: p.tipo_procedimento,
          valor_particular: (p.valor || 0) / 100, // Feegow armazena em centavos
          tempo_minutos: parseInt(p.tempo) || 10,
          especialidade_ids: p.especialidade_id || [],
          ativo: true,
        }, { onConflict: "feegow_id" });
      }
      results.procedimentos = procs.length;
    }

    // ============ PROFISSIONAIS ============
    if (!import_type || import_type === "all" || import_type === "profissionais") {
      const profs = await feegowGet(feegow_token, "professional/list");
      for (const p of profs) {
        const especs = (p.especialidades || []).map((e: any) => ({
          id: e.especialidade_id, nome: e.nome_especialidade,
          cbos: e.CBOS, rqe: e.rqe,
        }));

        await supabase.from("medicos").upsert({
          clinica_id, feegow_id: p.profissional_id,
          nome: p.nome, tratamento: p.tratamento,
          cpf: cleanCpf(p.cpf), email: p.email || null,
          sexo: p.sexo, conselho: p.conselho,
          documento_conselho: p.documento_conselho,
          uf_conselho: p.uf_conselho, rqe: p.rqe || null,
          especialidades: especs,
          ativo: p.ativo,
          idade_minima: p.age_restriction?.idade_minima,
          idade_maxima: p.age_restriction?.idade_maxima,
        }, { onConflict: "feegow_id" });
      }
      results.profissionais = profs.length;
    }

    // ============ PACIENTES ============
    if (!import_type || import_type === "all" || import_type === "pacientes") {
      let offset = 0;
      const limit = 100;
      let totalImported = 0;

      // Get convenio mapping
      const { data: convMap } = await supabase.from("convenios").select("id, feegow_id").eq("clinica_id", clinica_id);
      const convLookup = Object.fromEntries((convMap || []).map(c => [c.feegow_id, c.id]));

      while (true) {
        const patients = await feegowGet(feegow_token, "patient/list", {
          limit: String(limit), offset: String(offset),
        });
        if (!patients.length) break;

        // Get detailed data for each patient
        for (const p of patients) {
          try {
            const detail = await feegowGet(feegow_token, "patient/search", {
              paciente_id: String(p.patient_id),
            });

            const convId = detail.convenio_id ? convLookup[detail.convenio_id] : null;
            const convInfo = detail.convenios?.[0];

            await supabase.from("pacientes").upsert({
              clinica_id, feegow_id: p.patient_id,
              nome: detail.nome || p.nome,
              nome_social: detail.nome_social || null,
              cpf: cleanCpf(detail.documentos?.cpf),
              rg: detail.documentos?.rg || null,
              data_nascimento: parseDateBR(detail.nascimento),
              sexo: detail.sexo === "Masculino" ? "masculino" : detail.sexo === "Feminino" ? "feminino" : "outro",
              email: Array.isArray(detail.email) ? detail.email[0] : detail.email || p.email,
              telefone: Array.isArray(detail.telefones) ? detail.telefones[0] : null,
              celular: Array.isArray(detail.celulares) ? detail.celulares[0] : p.celular,
              cep: detail.cep || null,
              endereco: detail.endereco || null,
              numero: detail.numero || null,
              complemento: detail.complemento || null,
              bairro: detail.bairro || p.bairro || null,
              cidade: detail.cidade || null,
              estado: detail.estado || null,
              convenio_id: convId,
              plano: convInfo?.plano_id ? String(convInfo.plano_id) : null,
              carteirinha: convInfo?.matricula || null,
              validade_carteirinha: convInfo?.validade ? parseDateBR(convInfo.validade) : null,
              titular: convInfo?.titular || null,
              observacoes: detail.observacao || null,
              profissao: detail.profissao || null,
              indicado_por: detail.indicado_por || null,
              status: "ativo",
              feegow_criado_em: p.criado_em,
              feegow_alterado_em: p.alterado_em,
            }, { onConflict: "clinica_id,feegow_id" });

            totalImported++;
          } catch (e) {
            // Skip individual patient errors
          }
        }

        offset += limit;

        // Safety limit — max 20000 patients per run
        if (offset > 20000) break;
      }
      results.pacientes = totalImported;
    }

    // ============ AGENDAMENTOS ============
    if (!import_type || import_type === "all" || import_type === "agendamentos") {
      const start = date_start || "2021-01-01";
      const end = date_end || new Date().toISOString().split("T")[0];

      // Get lookup maps
      const { data: pacMap } = await supabase.from("pacientes").select("id, feegow_id").eq("clinica_id", clinica_id);
      const pacLookup = Object.fromEntries((pacMap || []).map(p => [p.feegow_id, p.id]));

      const { data: medMap } = await supabase.from("medicos").select("id, feegow_id").eq("clinica_id", clinica_id);
      const medLookup = Object.fromEntries((medMap || []).map(m => [m.feegow_id, m.id]));

      const { data: espMap } = await supabase.from("especialidades").select("id, feegow_id").eq("clinica_id", clinica_id);
      const espLookup = Object.fromEntries((espMap || []).map(e => [e.feegow_id, e.id]));

      const { data: procMap } = await supabase.from("procedimentos").select("id, feegow_id").eq("clinica_id", clinica_id);
      const procLookup = Object.fromEntries((procMap || []).map(p => [p.feegow_id, p.id]));

      const { data: convMap } = await supabase.from("convenios").select("id, feegow_id").eq("clinica_id", clinica_id);
      const convLookup = Object.fromEntries((convMap || []).map(c => [c.feegow_id, c.id]));

      // Iterate month by month
      let totalAppoints = 0;
      const startDate = new Date(start);
      const endDate = new Date(end);
      const current = new Date(startDate);

      while (current <= endDate) {
        const monthStart = current.toISOString().split("T")[0];
        current.setMonth(current.getMonth() + 1);
        const monthEnd = current.toISOString().split("T")[0];

        try {
          const appoints = await feegowGet(feegow_token, "appoints/search", {
            data_start: monthStart, data_end: monthEnd, limit: "10000",
          });

          for (const a of appoints) {
            const pacienteId = pacLookup[a.paciente_id];
            if (!pacienteId) continue; // Skip if patient not imported

            const medicoId = medLookup[a.profissional_id];
            const espId = espLookup[a.especialidade_id];
            const procId = procLookup[a.procedimento_id];
            const convId = a.convenio_id ? convLookup[a.convenio_id] : null;

            // Parse valor
            let valor = 0;
            if (a.valor) {
              const v = String(a.valor).replace("R$", "").replace(/\./g, "").replace(",", ".").trim();
              valor = parseFloat(v) || 0;
            }

            await supabase.from("agendamentos").upsert({
              clinica_id, feegow_id: a.agendamento_id,
              paciente_id: pacienteId,
              medico_id: medicoId || null,
              especialidade_id: espId || null,
              procedimento_id: procId || null,
              data: parseDateBR(a.data),
              horario: a.horario,
              duracao: a.duracao || 0,
              tipo: a.convenio_id ? "convenio" : "particular",
              convenio_id: convId,
              status: mapStatus(a.status_id),
              is_encaixe: a.encaixe || false,
              valor,
              observacao: a.notas || null,
              agendado_por: a.agendado_por || null,
            }, { onConflict: "clinica_id,feegow_id" });

            totalAppoints++;
          }
        } catch (e) {
          // Skip month errors
        }
      }
      results.agendamentos = totalAppoints;

      // Update data_retencao for all patients with atendimentos
      await supabase.rpc("update_retencao_all", { p_clinica_id: clinica_id }).catch(() => {});
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
