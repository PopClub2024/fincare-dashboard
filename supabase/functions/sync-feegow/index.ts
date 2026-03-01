import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FEEGOW_BASE_URL = "https://api.feegow.com/v1";

interface SyncResult {
  medicos: number;
  salas: number;
  convenios: number;
  pacientes: number;
  agendamentos: number;
  errors: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const feegowApiKey = Deno.env.get("FEEGOW_API_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get clinica_id from request body or use the first clinic
  let clinicaId: string;
  try {
    const body = await req.json().catch(() => ({}));
    clinicaId = body.clinica_id;
  } catch {
    clinicaId = "";
  }

  if (!clinicaId) {
    const { data: clinicas } = await supabase
      .from("clinicas")
      .select("id")
      .limit(1)
      .single();
    if (!clinicas) {
      return new Response(
        JSON.stringify({ error: "Nenhuma clínica encontrada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    clinicaId = clinicas.id;
  }

  // Create sync log entry
  const { data: syncLog } = await supabase
    .from("sync_log")
    .insert({
      clinica_id: clinicaId,
      integracao_tipo: "feegow",
      status: "em_andamento",
    })
    .select()
    .single();

  const result: SyncResult = {
    medicos: 0,
    salas: 0,
    convenios: 0,
    pacientes: 0,
    agendamentos: 0,
    errors: [],
  };

  const feegowHeaders = {
    "x-access-token": feegowApiKey,
    "Content-Type": "application/json",
  };

  try {
    // 1. Sync Médicos (Profissionais)
    try {
      const res = await fetch(`${FEEGOW_BASE_URL}/professional/list`, {
        headers: feegowHeaders,
      });
      if (res.ok) {
        const data = await res.json();
        const professionals = data.content || [];
        for (const prof of professionals) {
          const { error } = await supabase.from("medicos").upsert(
            {
              clinica_id: clinicaId,
              feegow_id: String(prof.professional_id || prof.id),
              nome: prof.name || prof.nome || "Sem nome",
              especialidade: prof.specialty_name || prof.especialidade || null,
              crm: prof.crm || null,
              documento: prof.cpf || null,
              ativo: prof.active !== false,
            },
            { onConflict: "clinica_id,feegow_id" }
          );
          if (!error) result.medicos++;
          else result.errors.push(`Médico ${prof.name}: ${error.message}`);
        }
      } else {
        result.errors.push(`Médicos: HTTP ${res.status}`);
      }
    } catch (e) {
      result.errors.push(`Médicos: ${e.message}`);
    }

    // 2. Sync Salas/Locais
    try {
      const res = await fetch(`${FEEGOW_BASE_URL}/treatment-place/list`, {
        headers: feegowHeaders,
      });
      if (res.ok) {
        const data = await res.json();
        const places = data.content || [];
        for (const place of places) {
          const { error } = await supabase.from("salas").upsert(
            {
              clinica_id: clinicaId,
              feegow_id: String(place.treatment_place_id || place.id),
              nome: place.name || place.nome || "Sem nome",
              capacidade: place.capacity || 1,
              ativo: place.active !== false,
            },
            { onConflict: "clinica_id,feegow_id" }
          );
          if (!error) result.salas++;
          else result.errors.push(`Sala ${place.name}: ${error.message}`);
        }
      } else {
        result.errors.push(`Salas: HTTP ${res.status}`);
      }
    } catch (e) {
      result.errors.push(`Salas: ${e.message}`);
    }

    // 3. Sync Convênios
    try {
      const res = await fetch(`${FEEGOW_BASE_URL}/insurance/list`, {
        headers: feegowHeaders,
      });
      if (res.ok) {
        const data = await res.json();
        const insurances = data.content || [];
        for (const ins of insurances) {
          const { error } = await supabase.from("convenios").upsert(
            {
              clinica_id: clinicaId,
              feegow_id: String(ins.insurance_id || ins.id),
              nome: ins.name || ins.nome || "Sem nome",
              ativo: ins.active !== false,
            },
            { onConflict: "clinica_id,feegow_id" }
          );
          if (!error) result.convenios++;
          else result.errors.push(`Convênio ${ins.name}: ${error.message}`);
        }
      } else {
        result.errors.push(`Convênios: HTTP ${res.status}`);
      }
    } catch (e) {
      result.errors.push(`Convênios: ${e.message}`);
    }

    // 4. Sync Pacientes
    try {
      const res = await fetch(`${FEEGOW_BASE_URL}/patient/list`, {
        headers: feegowHeaders,
      });
      if (res.ok) {
        const data = await res.json();
        const patients = data.content || [];
        for (const pat of patients) {
          const { error } = await supabase.from("pacientes").upsert(
            {
              clinica_id: clinicaId,
              feegow_id: String(pat.patient_id || pat.id),
              nome: pat.name || pat.nome || "Sem nome",
              data_cadastro: pat.created_at || pat.data_cadastro || null,
            },
            { onConflict: "clinica_id,feegow_id" }
          );
          if (!error) result.pacientes++;
          else result.errors.push(`Paciente: ${error.message}`);
        }
      } else {
        result.errors.push(`Pacientes: HTTP ${res.status}`);
      }
    } catch (e) {
      result.errors.push(`Pacientes: ${e.message}`);
    }

    // 5. Sync Agendamentos/Consultas
    try {
      const today = new Date().toISOString().split("T")[0];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
        .toISOString()
        .split("T")[0];

      const res = await fetch(
        `${FEEGOW_BASE_URL}/appoints/search?date_start=${thirtyDaysAgo}&date_end=${today}`,
        { headers: feegowHeaders }
      );
      if (res.ok) {
        const data = await res.json();
        const appointments = data.content || [];
        for (const appt of appointments) {
          // Map Feegow status to our status_presenca enum
          let statusPresenca: string | null = null;
          const feegowStatus = String(appt.status || "").toLowerCase();
          if (feegowStatus.includes("atend") || feegowStatus.includes("realiz")) {
            statusPresenca = "atendido";
          } else if (feegowStatus.includes("falt") || feegowStatus.includes("no-show")) {
            statusPresenca = "faltou";
          } else if (feegowStatus.includes("cancel")) {
            statusPresenca = "cancelado";
          } else {
            statusPresenca = "confirmado";
          }

          // Find medico by feegow_id
          const medicoFeegowId = String(appt.professional_id || "");
          const { data: medico } = await supabase
            .from("medicos")
            .select("id")
            .eq("clinica_id", clinicaId)
            .eq("feegow_id", medicoFeegowId)
            .maybeSingle();

          // Find paciente by feegow_id
          const pacienteFeegowId = String(appt.patient_id || "");
          const { data: paciente } = await supabase
            .from("pacientes")
            .select("id")
            .eq("clinica_id", clinicaId)
            .eq("feegow_id", pacienteFeegowId)
            .maybeSingle();

          const { error } = await supabase.from("transacoes_vendas").upsert(
            {
              clinica_id: clinicaId,
              feegow_id: String(appt.schedule_id || appt.id),
              data_competencia: appt.date || today,
              valor_bruto: Number(appt.total_value || appt.value || 0),
              descricao: appt.procedure_name || appt.notes || null,
              medico_id: medico?.id || null,
              paciente_id: paciente?.id || null,
              status_presenca: statusPresenca,
              forma_pagamento: appt.payment_method || null,
            },
            { onConflict: "clinica_id,feegow_id" }
          );
          if (!error) result.agendamentos++;
          else result.errors.push(`Agendamento: ${error.message}`);
        }
      } else {
        result.errors.push(`Agendamentos: HTTP ${res.status}`);
      }
    } catch (e) {
      result.errors.push(`Agendamentos: ${e.message}`);
    }

    // Update sync log
    const totalProcessed =
      result.medicos +
      result.salas +
      result.convenios +
      result.pacientes +
      result.agendamentos;

    await supabase
      .from("sync_log")
      .update({
        status: result.errors.length > 0 ? "erro" : "sucesso",
        fim: new Date().toISOString(),
        registros_processados: totalProcessed,
        erros: result.errors.length > 0 ? result.errors : null,
        detalhes: `Médicos: ${result.medicos}, Salas: ${result.salas}, Convênios: ${result.convenios}, Pacientes: ${result.pacientes}, Agendamentos: ${result.agendamentos}`,
      })
      .eq("id", syncLog?.id);

    // Update integration status
    await supabase
      .from("integracoes")
      .upsert(
        {
          clinica_id: clinicaId,
          tipo: "feegow",
          status: result.errors.length > 0 ? "erro" : "ativo",
          ultima_sincronizacao: new Date().toISOString(),
        },
        { onConflict: "clinica_id,tipo" }
      );

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    // Update sync log with error
    if (syncLog?.id) {
      await supabase
        .from("sync_log")
        .update({
          status: "erro",
          fim: new Date().toISOString(),
          erros: [e.message],
        })
        .eq("id", syncLog.id);
    }

    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
