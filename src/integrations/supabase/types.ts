export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      agenda_ocupacao: {
        Row: {
          clinica_id: string
          created_at: string
          data: string
          feegow_id: string | null
          id: string
          medico_id: string | null
          sala_id: string | null
          slots_ocupados: number
          slots_total: number
        }
        Insert: {
          clinica_id: string
          created_at?: string
          data: string
          feegow_id?: string | null
          id?: string
          medico_id?: string | null
          sala_id?: string | null
          slots_ocupados?: number
          slots_total?: number
        }
        Update: {
          clinica_id?: string
          created_at?: string
          data?: string
          feegow_id?: string | null
          id?: string
          medico_id?: string | null
          sala_id?: string | null
          slots_ocupados?: number
          slots_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "agenda_ocupacao_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_ocupacao_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_ocupacao_sala_id_fkey"
            columns: ["sala_id"]
            isOneToOne: false
            referencedRelation: "salas"
            referencedColumns: ["id"]
          },
        ]
      }
      agendamentos: {
        Row: {
          agendado_por: string | null
          clinica_id: string
          convenio_id: string | null
          created_at: string | null
          data: string
          duracao: number | null
          especialidade_id: string | null
          feegow_id: string | null
          horario: string | null
          id: string
          is_encaixe: boolean | null
          medico_id: string | null
          observacao: string | null
          paciente_id: string | null
          procedimento_id: string | null
          status: string | null
          tipo: string | null
          updated_at: string | null
          valor: number | null
        }
        Insert: {
          agendado_por?: string | null
          clinica_id: string
          convenio_id?: string | null
          created_at?: string | null
          data: string
          duracao?: number | null
          especialidade_id?: string | null
          feegow_id?: string | null
          horario?: string | null
          id?: string
          is_encaixe?: boolean | null
          medico_id?: string | null
          observacao?: string | null
          paciente_id?: string | null
          procedimento_id?: string | null
          status?: string | null
          tipo?: string | null
          updated_at?: string | null
          valor?: number | null
        }
        Update: {
          agendado_por?: string | null
          clinica_id?: string
          convenio_id?: string | null
          created_at?: string | null
          data?: string
          duracao?: number | null
          especialidade_id?: string | null
          feegow_id?: string | null
          horario?: string | null
          id?: string
          is_encaixe?: boolean | null
          medico_id?: string | null
          observacao?: string | null
          paciente_id?: string | null
          procedimento_id?: string | null
          status?: string | null
          tipo?: string | null
          updated_at?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_convenio_id_fkey"
            columns: ["convenio_id"]
            isOneToOne: false
            referencedRelation: "convenios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_especialidade_id_fkey"
            columns: ["especialidade_id"]
            isOneToOne: false
            referencedRelation: "especialidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_procedimento_id_fkey"
            columns: ["procedimento_id"]
            isOneToOne: false
            referencedRelation: "procedimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      agentes_ia: {
        Row: {
          ativo: boolean | null
          clinica_id: string
          config: Json | null
          created_at: string | null
          id: string
          modelo: string | null
          nome: string
          prompt_sistema: string | null
          temperatura: number | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          clinica_id: string
          config?: Json | null
          created_at?: string | null
          id?: string
          modelo?: string | null
          nome: string
          prompt_sistema?: string | null
          temperatura?: number | null
          tipo: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          clinica_id?: string
          config?: Json | null
          created_at?: string | null
          id?: string
          modelo?: string | null
          nome?: string
          prompt_sistema?: string | null
          temperatura?: number | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agentes_ia_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      agentes_ia_logs: {
        Row: {
          agente_id: string | null
          clinica_id: string
          created_at: string | null
          duracao_ms: number | null
          id: string
          input_text: string | null
          modelo: string | null
          output_text: string | null
          tokens_usados: number | null
        }
        Insert: {
          agente_id?: string | null
          clinica_id: string
          created_at?: string | null
          duracao_ms?: number | null
          id?: string
          input_text?: string | null
          modelo?: string | null
          output_text?: string | null
          tokens_usados?: number | null
        }
        Update: {
          agente_id?: string | null
          clinica_id?: string
          created_at?: string | null
          duracao_ms?: number | null
          id?: string
          input_text?: string | null
          modelo?: string | null
          output_text?: string | null
          tokens_usados?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agentes_ia_logs_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes_ia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agentes_ia_logs_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      ajustes_contabeis: {
        Row: {
          ativo: boolean
          clinica_id: string
          created_at: string
          data_fim: string | null
          data_inicio: string
          descricao: string | null
          id: string
          tipo: string
          updated_at: string
          valor_mensal: number
        }
        Insert: {
          ativo?: boolean
          clinica_id: string
          created_at?: string
          data_fim?: string | null
          data_inicio: string
          descricao?: string | null
          id?: string
          tipo: string
          updated_at?: string
          valor_mensal: number
        }
        Update: {
          ativo?: boolean
          clinica_id?: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          id?: string
          tipo?: string
          updated_at?: string
          valor_mensal?: number
        }
        Relationships: [
          {
            foreignKeyName: "ajustes_contabeis_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      alertas_eventos: {
        Row: {
          clinica_id: string
          contexto: Json | null
          created_at: string
          descricao: string | null
          id: string
          resolvido_em: string | null
          severidade: Database["public"]["Enums"]["severidade_alerta"]
          status: Database["public"]["Enums"]["status_alerta"]
          tipo: string
          titulo: string
        }
        Insert: {
          clinica_id: string
          contexto?: Json | null
          created_at?: string
          descricao?: string | null
          id?: string
          resolvido_em?: string | null
          severidade?: Database["public"]["Enums"]["severidade_alerta"]
          status?: Database["public"]["Enums"]["status_alerta"]
          tipo: string
          titulo: string
        }
        Update: {
          clinica_id?: string
          contexto?: Json | null
          created_at?: string
          descricao?: string | null
          id?: string
          resolvido_em?: string | null
          severidade?: Database["public"]["Enums"]["severidade_alerta"]
          status?: Database["public"]["Enums"]["status_alerta"]
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertas_eventos_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      anamneses: {
        Row: {
          agendamento_id: string | null
          alergias: string | null
          antecedentes: string | null
          clinica_id: string
          conduta: string | null
          created_at: string | null
          exame_fisico: string | null
          hipotese_diagnostica: string | null
          historia_doenca: string | null
          id: string
          medicamentos: string | null
          medico_id: string | null
          observacoes: string | null
          paciente_id: string | null
          queixa_principal: string | null
          updated_at: string | null
        }
        Insert: {
          agendamento_id?: string | null
          alergias?: string | null
          antecedentes?: string | null
          clinica_id: string
          conduta?: string | null
          created_at?: string | null
          exame_fisico?: string | null
          hipotese_diagnostica?: string | null
          historia_doenca?: string | null
          id?: string
          medicamentos?: string | null
          medico_id?: string | null
          observacoes?: string | null
          paciente_id?: string | null
          queixa_principal?: string | null
          updated_at?: string | null
        }
        Update: {
          agendamento_id?: string | null
          alergias?: string | null
          antecedentes?: string | null
          clinica_id?: string
          conduta?: string | null
          created_at?: string | null
          exame_fisico?: string | null
          hipotese_diagnostica?: string | null
          historia_doenca?: string | null
          id?: string
          medicamentos?: string | null
          medico_id?: string | null
          observacoes?: string | null
          paciente_id?: string | null
          queixa_principal?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anamneses_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamneses_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamneses_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamneses_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      arquivos_importados: {
        Row: {
          arquivo_url: string | null
          clinica_id: string
          created_at: string
          id: string
          nome_arquivo: string
          observacao: string | null
          periodo_fim: string | null
          periodo_inicio: string | null
          registros_importados: number | null
          status: string
          tamanho_bytes: number | null
          tipo: string
          uploaded_by: string | null
        }
        Insert: {
          arquivo_url?: string | null
          clinica_id: string
          created_at?: string
          id?: string
          nome_arquivo: string
          observacao?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          registros_importados?: number | null
          status?: string
          tamanho_bytes?: number | null
          tipo: string
          uploaded_by?: string | null
        }
        Update: {
          arquivo_url?: string | null
          clinica_id?: string
          created_at?: string
          id?: string
          nome_arquivo?: string
          observacao?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          registros_importados?: number | null
          status?: string
          tamanho_bytes?: number | null
          tipo?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arquivos_importados_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      atestados: {
        Row: {
          agendamento_id: string | null
          cid: string | null
          clinica_id: string
          conteudo: string | null
          created_at: string | null
          data_emissao: string | null
          dias_afastamento: number | null
          id: string
          medico_id: string | null
          paciente_id: string | null
          tipo: string | null
        }
        Insert: {
          agendamento_id?: string | null
          cid?: string | null
          clinica_id: string
          conteudo?: string | null
          created_at?: string | null
          data_emissao?: string | null
          dias_afastamento?: number | null
          id?: string
          medico_id?: string | null
          paciente_id?: string | null
          tipo?: string | null
        }
        Update: {
          agendamento_id?: string | null
          cid?: string | null
          clinica_id?: string
          conteudo?: string | null
          created_at?: string | null
          data_emissao?: string | null
          dias_afastamento?: number | null
          id?: string
          medico_id?: string | null
          paciente_id?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "atestados_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atestados_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atestados_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atestados_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_integracoes: {
        Row: {
          clinica_id: string
          created_at: string
          id: string
          integracao: string
          periodo: string
          relatorio_json: Json
        }
        Insert: {
          clinica_id: string
          created_at?: string
          id?: string
          integracao: string
          periodo: string
          relatorio_json?: Json
        }
        Update: {
          clinica_id?: string
          created_at?: string
          id?: string
          integracao?: string
          periodo?: string
          relatorio_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_integracoes_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      autofix_logs: {
        Row: {
          acao: string
          clinica_id: string
          created_at: string
          dados_antes: Json | null
          dados_depois: Json | null
          entidade_id: string | null
          entidade_tipo: string | null
          id: string
          tipo: string
          user_id: string | null
        }
        Insert: {
          acao: string
          clinica_id: string
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          id?: string
          tipo?: string
          user_id?: string | null
        }
        Update: {
          acao?: string
          clinica_id?: string
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          id?: string
          tipo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "autofix_logs_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      autopilot_runs: {
        Row: {
          clinica_id: string
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          status: Database["public"]["Enums"]["status_autopilot"]
          steps: Json | null
          trigger: Database["public"]["Enums"]["trigger_autopilot"]
        }
        Insert: {
          clinica_id: string
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          status?: Database["public"]["Enums"]["status_autopilot"]
          steps?: Json | null
          trigger?: Database["public"]["Enums"]["trigger_autopilot"]
        }
        Update: {
          clinica_id?: string
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          status?: Database["public"]["Enums"]["status_autopilot"]
          steps?: Json | null
          trigger?: Database["public"]["Enums"]["trigger_autopilot"]
        }
        Relationships: [
          {
            foreignKeyName: "autopilot_runs_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      caixa_historico_mensal: {
        Row: {
          ano: number
          aporte_nao_operacional: number
          clinica_id: string
          created_at: string
          entradas_operacionais: number
          id: string
          mes: number
          recuperacoes_glosa: number
          retirada_nao_operacional: number
          saidas_custos_fixos: number
          saidas_custos_variaveis: number
          saidas_emprestimos: number
          saidas_impostos: number
          saidas_mao_obra: number
          saidas_marketing: number
          saldo_final: number
          saldo_operacional: number
        }
        Insert: {
          ano: number
          aporte_nao_operacional?: number
          clinica_id: string
          created_at?: string
          entradas_operacionais?: number
          id?: string
          mes: number
          recuperacoes_glosa?: number
          retirada_nao_operacional?: number
          saidas_custos_fixos?: number
          saidas_custos_variaveis?: number
          saidas_emprestimos?: number
          saidas_impostos?: number
          saidas_mao_obra?: number
          saidas_marketing?: number
          saldo_final?: number
          saldo_operacional?: number
        }
        Update: {
          ano?: number
          aporte_nao_operacional?: number
          clinica_id?: string
          created_at?: string
          entradas_operacionais?: number
          id?: string
          mes?: number
          recuperacoes_glosa?: number
          retirada_nao_operacional?: number
          saidas_custos_fixos?: number
          saidas_custos_variaveis?: number
          saidas_emprestimos?: number
          saidas_impostos?: number
          saidas_mao_obra?: number
          saidas_marketing?: number
          saldo_final?: number
          saldo_operacional?: number
        }
        Relationships: [
          {
            foreignKeyName: "caixa_historico_mensal_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      chamadas_paciente: {
        Row: {
          agendamento_id: string | null
          atendido_em: string | null
          chamado_em: string | null
          clinica_id: string
          created_at: string | null
          id: string
          medico_id: string | null
          paciente_id: string | null
          sala_id: string | null
          status: string | null
        }
        Insert: {
          agendamento_id?: string | null
          atendido_em?: string | null
          chamado_em?: string | null
          clinica_id: string
          created_at?: string | null
          id?: string
          medico_id?: string | null
          paciente_id?: string | null
          sala_id?: string | null
          status?: string | null
        }
        Update: {
          agendamento_id?: string | null
          atendido_em?: string | null
          chamado_em?: string | null
          clinica_id?: string
          created_at?: string | null
          id?: string
          medico_id?: string | null
          paciente_id?: string | null
          sala_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chamadas_paciente_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamadas_paciente_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamadas_paciente_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamadas_paciente_sala_id_fkey"
            columns: ["sala_id"]
            isOneToOne: false
            referencedRelation: "salas_consultorios"
            referencedColumns: ["id"]
          },
        ]
      }
      chaves_api: {
        Row: {
          ativo: boolean | null
          chave_encriptada: string
          clinica_id: string
          created_at: string | null
          id: string
          resultado_teste: string | null
          servico: string
          status: string | null
          ultimo_teste: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          chave_encriptada: string
          clinica_id: string
          created_at?: string | null
          id?: string
          resultado_teste?: string | null
          servico: string
          status?: string | null
          ultimo_teste?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          chave_encriptada?: string
          clinica_id?: string
          created_at?: string | null
          id?: string
          resultado_teste?: string | null
          servico?: string
          status?: string | null
          ultimo_teste?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chaves_api_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          agendamento_id: string | null
          clinica_id: string
          created_at: string | null
          hora_chamada: string | null
          hora_chegada: string | null
          hora_fim_atendimento: string | null
          hora_inicio_atendimento: string | null
          id: string
          medico_id: string | null
          observacao: string | null
          paciente_id: string | null
          sala_id: string | null
          status: string | null
        }
        Insert: {
          agendamento_id?: string | null
          clinica_id: string
          created_at?: string | null
          hora_chamada?: string | null
          hora_chegada?: string | null
          hora_fim_atendimento?: string | null
          hora_inicio_atendimento?: string | null
          id?: string
          medico_id?: string | null
          observacao?: string | null
          paciente_id?: string | null
          sala_id?: string | null
          status?: string | null
        }
        Update: {
          agendamento_id?: string | null
          clinica_id?: string
          created_at?: string | null
          hora_chamada?: string | null
          hora_chegada?: string | null
          hora_fim_atendimento?: string | null
          hora_inicio_atendimento?: string | null
          id?: string
          medico_id?: string | null
          observacao?: string | null
          paciente_id?: string | null
          sala_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkins_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_sala_id_fkey"
            columns: ["sala_id"]
            isOneToOne: false
            referencedRelation: "salas_consultorios"
            referencedColumns: ["id"]
          },
        ]
      }
      clinicas: {
        Row: {
          cnpj: string | null
          configuracoes: Json | null
          created_at: string
          email: string | null
          endereco: string | null
          id: string
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          configuracoes?: Json | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          configuracoes?: Json | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      colaborador_documentos: {
        Row: {
          arquivo_url: string | null
          clinica_id: string
          colaborador_id: string | null
          created_at: string | null
          id: string
          nome: string
          tipo: string | null
        }
        Insert: {
          arquivo_url?: string | null
          clinica_id: string
          colaborador_id?: string | null
          created_at?: string | null
          id?: string
          nome: string
          tipo?: string | null
        }
        Update: {
          arquivo_url?: string | null
          clinica_id?: string
          colaborador_id?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "colaborador_documentos_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaborador_documentos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      colaboradores: {
        Row: {
          ativo: boolean | null
          cargo: string | null
          clinica_id: string
          cpf: string | null
          created_at: string | null
          data_admissao: string | null
          data_demissao: string | null
          departamento: string | null
          departamento_id: string | null
          email: string | null
          gestor_id: string | null
          id: string
          nome: string
          salario: number | null
          telefone: string | null
          tipo_contrato: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          cargo?: string | null
          clinica_id: string
          cpf?: string | null
          created_at?: string | null
          data_admissao?: string | null
          data_demissao?: string | null
          departamento?: string | null
          departamento_id?: string | null
          email?: string | null
          gestor_id?: string | null
          id?: string
          nome: string
          salario?: number | null
          telefone?: string | null
          tipo_contrato?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          cargo?: string | null
          clinica_id?: string
          cpf?: string | null
          created_at?: string | null
          data_admissao?: string | null
          data_demissao?: string | null
          departamento?: string | null
          departamento_id?: string | null
          email?: string | null
          gestor_id?: string | null
          id?: string
          nome?: string
          salario?: number | null
          telefone?: string | null
          tipo_contrato?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "colaboradores_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaboradores_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "rh_departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaboradores_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      comprovantes: {
        Row: {
          arquivo_hash: string | null
          arquivo_nome: string | null
          arquivo_url: string
          clinica_id: string
          created_at: string
          dados_extraidos: Json | null
          erro_processamento: string | null
          id: string
          lancamento_id: string | null
          status: Database["public"]["Enums"]["status_comprovante"]
          tipo_arquivo: string | null
          updated_at: string
        }
        Insert: {
          arquivo_hash?: string | null
          arquivo_nome?: string | null
          arquivo_url: string
          clinica_id: string
          created_at?: string
          dados_extraidos?: Json | null
          erro_processamento?: string | null
          id?: string
          lancamento_id?: string | null
          status?: Database["public"]["Enums"]["status_comprovante"]
          tipo_arquivo?: string | null
          updated_at?: string
        }
        Update: {
          arquivo_hash?: string | null
          arquivo_nome?: string | null
          arquivo_url?: string
          clinica_id?: string
          created_at?: string
          dados_extraidos?: Json | null
          erro_processamento?: string | null
          id?: string
          lancamento_id?: string | null
          status?: Database["public"]["Enums"]["status_comprovante"]
          tipo_arquivo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comprovantes_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comprovantes_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "contas_pagar_lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      conciliacao_despesas: {
        Row: {
          clinica_id: string
          conciliado_em: string | null
          conciliado_por: string | null
          created_at: string
          divergencia: number | null
          id: string
          lancamento_id: string
          match_key: string | null
          metodo_match: string | null
          observacao: string | null
          rule_applied: string | null
          score: number | null
          status: string
          transacao_bancaria_id: string | null
          updated_at: string
        }
        Insert: {
          clinica_id: string
          conciliado_em?: string | null
          conciliado_por?: string | null
          created_at?: string
          divergencia?: number | null
          id?: string
          lancamento_id: string
          match_key?: string | null
          metodo_match?: string | null
          observacao?: string | null
          rule_applied?: string | null
          score?: number | null
          status?: string
          transacao_bancaria_id?: string | null
          updated_at?: string
        }
        Update: {
          clinica_id?: string
          conciliado_em?: string | null
          conciliado_por?: string | null
          created_at?: string
          divergencia?: number | null
          id?: string
          lancamento_id?: string
          match_key?: string | null
          metodo_match?: string | null
          observacao?: string | null
          rule_applied?: string | null
          score?: number | null
          status?: string
          transacao_bancaria_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conciliacao_despesas_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacao_despesas_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "contas_pagar_lancamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacao_despesas_transacao_bancaria_id_fkey"
            columns: ["transacao_bancaria_id"]
            isOneToOne: false
            referencedRelation: "transacoes_bancarias"
            referencedColumns: ["id"]
          },
        ]
      }
      conciliacao_recebiveis: {
        Row: {
          banco_tx_id: string | null
          clinica_id: string
          created_at: string
          divergencia: number | null
          getnet_resumo_id: string | null
          id: string
          observacao: string | null
          rule_applied: string | null
          score: number | null
          status: string
          updated_at: string
        }
        Insert: {
          banco_tx_id?: string | null
          clinica_id: string
          created_at?: string
          divergencia?: number | null
          getnet_resumo_id?: string | null
          id?: string
          observacao?: string | null
          rule_applied?: string | null
          score?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          banco_tx_id?: string | null
          clinica_id?: string
          created_at?: string
          divergencia?: number | null
          getnet_resumo_id?: string | null
          id?: string
          observacao?: string | null
          rule_applied?: string | null
          score?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conciliacao_recebiveis_banco_tx_id_fkey"
            columns: ["banco_tx_id"]
            isOneToOne: false
            referencedRelation: "transacoes_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacao_recebiveis_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacao_recebiveis_getnet_resumo_id_fkey"
            columns: ["getnet_resumo_id"]
            isOneToOne: false
            referencedRelation: "getnet_recebiveis_resumo"
            referencedColumns: ["id"]
          },
        ]
      }
      conciliacao_receitas: {
        Row: {
          camada: Database["public"]["Enums"]["camada_conciliacao"]
          clinica_id: string
          competencia: string
          created_at: string
          data_liquidacao: string | null
          id: string
          motivo_divergencia: string | null
          refs: Json | null
          score: number | null
          status: Database["public"]["Enums"]["status_conciliacao_receita"]
        }
        Insert: {
          camada: Database["public"]["Enums"]["camada_conciliacao"]
          clinica_id: string
          competencia: string
          created_at?: string
          data_liquidacao?: string | null
          id?: string
          motivo_divergencia?: string | null
          refs?: Json | null
          score?: number | null
          status?: Database["public"]["Enums"]["status_conciliacao_receita"]
        }
        Update: {
          camada?: Database["public"]["Enums"]["camada_conciliacao"]
          clinica_id?: string
          competencia?: string
          created_at?: string
          data_liquidacao?: string | null
          id?: string
          motivo_divergencia?: string | null
          refs?: Json | null
          score?: number | null
          status?: Database["public"]["Enums"]["status_conciliacao_receita"]
        }
        Relationships: [
          {
            foreignKeyName: "conciliacao_receitas_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      conciliacao_vendas_gateway: {
        Row: {
          clinica_id: string
          created_at: string
          divergencia: number | null
          feegow_venda_id: string | null
          getnet_detalhado_id: string | null
          id: string
          match_confidence: string | null
          rule_applied: string | null
          score: number | null
          status: string
        }
        Insert: {
          clinica_id: string
          created_at?: string
          divergencia?: number | null
          feegow_venda_id?: string | null
          getnet_detalhado_id?: string | null
          id?: string
          match_confidence?: string | null
          rule_applied?: string | null
          score?: number | null
          status?: string
        }
        Update: {
          clinica_id?: string
          created_at?: string
          divergencia?: number | null
          feegow_venda_id?: string | null
          getnet_detalhado_id?: string | null
          id?: string
          match_confidence?: string | null
          rule_applied?: string | null
          score?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "conciliacao_vendas_gateway_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacao_vendas_gateway_feegow_venda_id_fkey"
            columns: ["feegow_venda_id"]
            isOneToOne: false
            referencedRelation: "transacoes_vendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacao_vendas_gateway_getnet_detalhado_id_fkey"
            columns: ["getnet_detalhado_id"]
            isOneToOne: false
            referencedRelation: "getnet_recebiveis_detalhado"
            referencedColumns: ["id"]
          },
        ]
      }
      conciliacoes: {
        Row: {
          clinica_id: string
          created_at: string
          divergencia: number | null
          id: string
          metodo_match: string | null
          observacao: string | null
          recebimento_id: string | null
          score: number | null
          status: Database["public"]["Enums"]["status_conciliacao"]
          tipo: string | null
          transacao_bancaria_id: string | null
          venda_id: string | null
        }
        Insert: {
          clinica_id: string
          created_at?: string
          divergencia?: number | null
          id?: string
          metodo_match?: string | null
          observacao?: string | null
          recebimento_id?: string | null
          score?: number | null
          status?: Database["public"]["Enums"]["status_conciliacao"]
          tipo?: string | null
          transacao_bancaria_id?: string | null
          venda_id?: string | null
        }
        Update: {
          clinica_id?: string
          created_at?: string
          divergencia?: number | null
          id?: string
          metodo_match?: string | null
          observacao?: string | null
          recebimento_id?: string | null
          score?: number | null
          status?: Database["public"]["Enums"]["status_conciliacao"]
          tipo?: string | null
          transacao_bancaria_id?: string | null
          venda_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conciliacoes_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacoes_recebimento_id_fkey"
            columns: ["recebimento_id"]
            isOneToOne: false
            referencedRelation: "transacoes_recebimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacoes_transacao_bancaria_id_fkey"
            columns: ["transacao_bancaria_id"]
            isOneToOne: false
            referencedRelation: "transacoes_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacoes_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "transacoes_vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_sistema: {
        Row: {
          chave: string
          clinica_id: string
          descricao: string | null
          id: string
          updated_at: string | null
          valor: Json | null
        }
        Insert: {
          chave: string
          clinica_id: string
          descricao?: string | null
          id?: string
          updated_at?: string | null
          valor?: Json | null
        }
        Update: {
          chave?: string
          clinica_id?: string
          descricao?: string | null
          id?: string
          updated_at?: string | null
          valor?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_sistema_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      conta_paciente: {
        Row: {
          agendamento_id: string | null
          clinica_id: string
          created_at: string | null
          desconto: number | null
          descricao: string | null
          forma_pagamento: string | null
          id: string
          paciente_id: string
          pago_em: string | null
          status: string | null
          valor: number
          valor_final: number | null
        }
        Insert: {
          agendamento_id?: string | null
          clinica_id: string
          created_at?: string | null
          desconto?: number | null
          descricao?: string | null
          forma_pagamento?: string | null
          id?: string
          paciente_id: string
          pago_em?: string | null
          status?: string | null
          valor?: number
          valor_final?: number | null
        }
        Update: {
          agendamento_id?: string | null
          clinica_id?: string
          created_at?: string | null
          desconto?: number | null
          descricao?: string | null
          forma_pagamento?: string | null
          id?: string
          paciente_id?: string
          pago_em?: string | null
          status?: string | null
          valor?: number
          valor_final?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conta_paciente_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conta_paciente_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conta_paciente_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_bancarias: {
        Row: {
          agencia: string
          apelido: string | null
          ativo: boolean
          banco: string
          clinica_id: string
          conta: string
          created_at: string
          id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          agencia: string
          apelido?: string | null
          ativo?: boolean
          banco: string
          clinica_id: string
          conta: string
          created_at?: string
          id?: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          agencia?: string
          apelido?: string | null
          ativo?: boolean
          banco?: string
          clinica_id?: string
          conta?: string
          created_at?: string
          id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contas_bancarias_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_pagar: {
        Row: {
          categoria: string | null
          clinica_id: string
          created_at: string
          data_pagamento: string | null
          data_vencimento: string
          descricao: string | null
          fornecedor: string
          id: string
          observacao: string | null
          status: Database["public"]["Enums"]["status_conta"]
          updated_at: string
          valor: number
        }
        Insert: {
          categoria?: string | null
          clinica_id: string
          created_at?: string
          data_pagamento?: string | null
          data_vencimento: string
          descricao?: string | null
          fornecedor: string
          id?: string
          observacao?: string | null
          status?: Database["public"]["Enums"]["status_conta"]
          updated_at?: string
          valor: number
        }
        Update: {
          categoria?: string | null
          clinica_id?: string
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string
          descricao?: string | null
          fornecedor?: string
          id?: string
          observacao?: string | null
          status?: Database["public"]["Enums"]["status_conta"]
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "contas_pagar_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_pagar_lancamentos: {
        Row: {
          banco_referencia: string | null
          canal_pagamento: Database["public"]["Enums"]["canal_pagamento"] | null
          clinica_id: string
          competencia_referencia: string | null
          comprovante_id: string | null
          created_at: string
          data_competencia: string
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          forma_pagamento_raw: string | null
          fornecedor: string | null
          id: string
          match_rule: string | null
          match_score: number | null
          medico_id: string | null
          needs_review: boolean
          observacao: string | null
          ofx_transaction_id: string | null
          plano_contas_id: string | null
          ref_dia_trabalhado: string | null
          status: Database["public"]["Enums"]["status_lancamento_cp"]
          tipo_despesa: Database["public"]["Enums"]["tipo_despesa"]
          tipo_despesa_raw: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          banco_referencia?: string | null
          canal_pagamento?:
            | Database["public"]["Enums"]["canal_pagamento"]
            | null
          clinica_id: string
          competencia_referencia?: string | null
          comprovante_id?: string | null
          created_at?: string
          data_competencia: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          forma_pagamento_raw?: string | null
          fornecedor?: string | null
          id?: string
          match_rule?: string | null
          match_score?: number | null
          medico_id?: string | null
          needs_review?: boolean
          observacao?: string | null
          ofx_transaction_id?: string | null
          plano_contas_id?: string | null
          ref_dia_trabalhado?: string | null
          status?: Database["public"]["Enums"]["status_lancamento_cp"]
          tipo_despesa?: Database["public"]["Enums"]["tipo_despesa"]
          tipo_despesa_raw?: string | null
          updated_at?: string
          valor?: number
        }
        Update: {
          banco_referencia?: string | null
          canal_pagamento?:
            | Database["public"]["Enums"]["canal_pagamento"]
            | null
          clinica_id?: string
          competencia_referencia?: string | null
          comprovante_id?: string | null
          created_at?: string
          data_competencia?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          forma_pagamento_raw?: string | null
          fornecedor?: string | null
          id?: string
          match_rule?: string | null
          match_score?: number | null
          medico_id?: string | null
          needs_review?: boolean
          observacao?: string | null
          ofx_transaction_id?: string | null
          plano_contas_id?: string | null
          ref_dia_trabalhado?: string | null
          status?: Database["public"]["Enums"]["status_lancamento_cp"]
          tipo_despesa?: Database["public"]["Enums"]["tipo_despesa"]
          tipo_despesa_raw?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "contas_pagar_lancamentos_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_lancamentos_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_lancamentos_plano_contas_id_fkey"
            columns: ["plano_contas_id"]
            isOneToOne: false
            referencedRelation: "plano_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_lancamento_comprovante"
            columns: ["comprovante_id"]
            isOneToOne: false
            referencedRelation: "comprovantes"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_receber_agregado: {
        Row: {
          bandeira: string | null
          clinica_id: string
          competencia: string
          conciliacao_id: string | null
          created_at: string
          data_base: string | null
          data_prevista_recebimento: string | null
          data_recebimento: string | null
          id: string
          meio: Database["public"]["Enums"]["meio_recebimento"]
          nf_id: string | null
          origem_dado: Database["public"]["Enums"]["origem_dado_cr"] | null
          origem_ref: Json | null
          referencias_json: Json | null
          status: Database["public"]["Enums"]["status_recebivel_agg"]
          tipo_recebivel: Database["public"]["Enums"]["tipo_recebivel"]
          updated_at: string
          valor_esperado: number
          valor_recebido: number
        }
        Insert: {
          bandeira?: string | null
          clinica_id: string
          competencia: string
          conciliacao_id?: string | null
          created_at?: string
          data_base?: string | null
          data_prevista_recebimento?: string | null
          data_recebimento?: string | null
          id?: string
          meio: Database["public"]["Enums"]["meio_recebimento"]
          nf_id?: string | null
          origem_dado?: Database["public"]["Enums"]["origem_dado_cr"] | null
          origem_ref?: Json | null
          referencias_json?: Json | null
          status?: Database["public"]["Enums"]["status_recebivel_agg"]
          tipo_recebivel: Database["public"]["Enums"]["tipo_recebivel"]
          updated_at?: string
          valor_esperado?: number
          valor_recebido?: number
        }
        Update: {
          bandeira?: string | null
          clinica_id?: string
          competencia?: string
          conciliacao_id?: string | null
          created_at?: string
          data_base?: string | null
          data_prevista_recebimento?: string | null
          data_recebimento?: string | null
          id?: string
          meio?: Database["public"]["Enums"]["meio_recebimento"]
          nf_id?: string | null
          origem_dado?: Database["public"]["Enums"]["origem_dado_cr"] | null
          origem_ref?: Json | null
          referencias_json?: Json | null
          status?: Database["public"]["Enums"]["status_recebivel_agg"]
          tipo_recebivel?: Database["public"]["Enums"]["tipo_recebivel"]
          updated_at?: string
          valor_esperado?: number
          valor_recebido?: number
        }
        Relationships: [
          {
            foreignKeyName: "contas_receber_agregado_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_documentos: {
        Row: {
          arquivo_url: string | null
          clinica_id: string
          contrato_id: string | null
          created_at: string | null
          id: string
          nome: string
          tipo: string | null
        }
        Insert: {
          arquivo_url?: string | null
          clinica_id: string
          contrato_id?: string | null
          created_at?: string | null
          id?: string
          nome: string
          tipo?: string | null
        }
        Update: {
          arquivo_url?: string | null
          clinica_id?: string
          contrato_id?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contrato_documentos_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_documentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos_prestadores"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_prestadores: {
        Row: {
          ativo: boolean | null
          clinica_id: string
          created_at: string | null
          documento_url: string | null
          id: string
          medico_id: string | null
          observacoes: string | null
          percentual_repasse: number | null
          tipo: string | null
          updated_at: string | null
          valor_fixo: number | null
          vigente_ate: string | null
          vigente_de: string
        }
        Insert: {
          ativo?: boolean | null
          clinica_id: string
          created_at?: string | null
          documento_url?: string | null
          id?: string
          medico_id?: string | null
          observacoes?: string | null
          percentual_repasse?: number | null
          tipo?: string | null
          updated_at?: string | null
          valor_fixo?: number | null
          vigente_ate?: string | null
          vigente_de: string
        }
        Update: {
          ativo?: boolean | null
          clinica_id?: string
          created_at?: string | null
          documento_url?: string | null
          id?: string
          medico_id?: string | null
          observacoes?: string | null
          percentual_repasse?: number | null
          tipo?: string | null
          updated_at?: string | null
          valor_fixo?: number | null
          vigente_ate?: string | null
          vigente_de?: string
        }
        Relationships: [
          {
            foreignKeyName: "contratos_prestadores_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_prestadores_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
        ]
      }
      convenio_faturamentos_nf: {
        Row: {
          clinica_id: string
          competencia: string
          convenio_id: string
          created_at: string
          data_emissao: string | null
          data_pagamento: string | null
          glosa_estimada: number | null
          id: string
          metadata: Json | null
          numero_nf: string | null
          observacoes: string | null
          pendencia_recuperada: number | null
          periodo_referencia: string | null
          previsao_pagamento: string | null
          status_pagamento: Database["public"]["Enums"]["status_pagamento_nf"]
          updated_at: string
          valor_calculado: number
          valor_enviado: number | null
          valor_liberado: number | null
          valor_nf: number | null
        }
        Insert: {
          clinica_id: string
          competencia: string
          convenio_id: string
          created_at?: string
          data_emissao?: string | null
          data_pagamento?: string | null
          glosa_estimada?: number | null
          id?: string
          metadata?: Json | null
          numero_nf?: string | null
          observacoes?: string | null
          pendencia_recuperada?: number | null
          periodo_referencia?: string | null
          previsao_pagamento?: string | null
          status_pagamento?: Database["public"]["Enums"]["status_pagamento_nf"]
          updated_at?: string
          valor_calculado?: number
          valor_enviado?: number | null
          valor_liberado?: number | null
          valor_nf?: number | null
        }
        Update: {
          clinica_id?: string
          competencia?: string
          convenio_id?: string
          created_at?: string
          data_emissao?: string | null
          data_pagamento?: string | null
          glosa_estimada?: number | null
          id?: string
          metadata?: Json | null
          numero_nf?: string | null
          observacoes?: string | null
          pendencia_recuperada?: number | null
          periodo_referencia?: string | null
          previsao_pagamento?: string | null
          status_pagamento?: Database["public"]["Enums"]["status_pagamento_nf"]
          updated_at?: string
          valor_calculado?: number
          valor_enviado?: number | null
          valor_liberado?: number | null
          valor_nf?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "convenio_faturamentos_nf_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convenio_faturamentos_nf_convenio_id_fkey"
            columns: ["convenio_id"]
            isOneToOne: false
            referencedRelation: "convenios"
            referencedColumns: ["id"]
          },
        ]
      }
      convenio_glosas: {
        Row: {
          clinica_id: string
          competencia: string
          convenio_id: string
          created_at: string
          data_pagamento: string | null
          glosa_devida: number | null
          id: string
          metadata: Json | null
          nf_id: string | null
          observacao_pagamento: string | null
          observacoes: string | null
          pago: boolean
          protocolo: string | null
          status_recurso: Database["public"]["Enums"]["status_recurso_glosa"]
          updated_at: string
          valor_a_recorrer: number | null
          valor_apresentado: number
          valor_aprovado: number
          valor_glosado: number
          valor_liberado: number | null
          valor_negado: number | null
          valor_pago_recurso: number | null
          valor_recursado: number | null
        }
        Insert: {
          clinica_id: string
          competencia: string
          convenio_id: string
          created_at?: string
          data_pagamento?: string | null
          glosa_devida?: number | null
          id?: string
          metadata?: Json | null
          nf_id?: string | null
          observacao_pagamento?: string | null
          observacoes?: string | null
          pago?: boolean
          protocolo?: string | null
          status_recurso?: Database["public"]["Enums"]["status_recurso_glosa"]
          updated_at?: string
          valor_a_recorrer?: number | null
          valor_apresentado?: number
          valor_aprovado?: number
          valor_glosado?: number
          valor_liberado?: number | null
          valor_negado?: number | null
          valor_pago_recurso?: number | null
          valor_recursado?: number | null
        }
        Update: {
          clinica_id?: string
          competencia?: string
          convenio_id?: string
          created_at?: string
          data_pagamento?: string | null
          glosa_devida?: number | null
          id?: string
          metadata?: Json | null
          nf_id?: string | null
          observacao_pagamento?: string | null
          observacoes?: string | null
          pago?: boolean
          protocolo?: string | null
          status_recurso?: Database["public"]["Enums"]["status_recurso_glosa"]
          updated_at?: string
          valor_a_recorrer?: number | null
          valor_apresentado?: number
          valor_aprovado?: number
          valor_glosado?: number
          valor_liberado?: number | null
          valor_negado?: number | null
          valor_pago_recurso?: number | null
          valor_recursado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "convenio_glosas_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convenio_glosas_convenio_id_fkey"
            columns: ["convenio_id"]
            isOneToOne: false
            referencedRelation: "convenios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convenio_glosas_nf_id_fkey"
            columns: ["nf_id"]
            isOneToOne: false
            referencedRelation: "convenio_faturamentos_nf"
            referencedColumns: ["id"]
          },
        ]
      }
      convenio_planos: {
        Row: {
          ativo: boolean | null
          codigo_ans: string | null
          convenio_id: string
          created_at: string | null
          feegow_plano_id: string | null
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean | null
          codigo_ans?: string | null
          convenio_id: string
          created_at?: string | null
          feegow_plano_id?: string | null
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean | null
          codigo_ans?: string | null
          convenio_id?: string
          created_at?: string | null
          feegow_plano_id?: string | null
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "convenio_planos_convenio_id_fkey"
            columns: ["convenio_id"]
            isOneToOne: false
            referencedRelation: "convenios"
            referencedColumns: ["id"]
          },
        ]
      }
      convenio_producao_itens: {
        Row: {
          clinica_id: string
          convenio_id: string
          created_at: string
          data_competencia: string
          desconto: number
          especialidade: string | null
          feegow_invoice_id: string | null
          feegow_item_key: string | null
          id: string
          linha_receita: Database["public"]["Enums"]["linha_receita_convenio"]
          medico_id: string | null
          metadata: Json | null
          procedimento_id: string | null
          procedimento_nome: string | null
          quantidade: number
          valor_bruto: number
          valor_liquido: number
        }
        Insert: {
          clinica_id: string
          convenio_id: string
          created_at?: string
          data_competencia: string
          desconto?: number
          especialidade?: string | null
          feegow_invoice_id?: string | null
          feegow_item_key?: string | null
          id?: string
          linha_receita?: Database["public"]["Enums"]["linha_receita_convenio"]
          medico_id?: string | null
          metadata?: Json | null
          procedimento_id?: string | null
          procedimento_nome?: string | null
          quantidade?: number
          valor_bruto?: number
          valor_liquido?: number
        }
        Update: {
          clinica_id?: string
          convenio_id?: string
          created_at?: string
          data_competencia?: string
          desconto?: number
          especialidade?: string | null
          feegow_invoice_id?: string | null
          feegow_item_key?: string | null
          id?: string
          linha_receita?: Database["public"]["Enums"]["linha_receita_convenio"]
          medico_id?: string | null
          metadata?: Json | null
          procedimento_id?: string | null
          procedimento_nome?: string | null
          quantidade?: number
          valor_bruto?: number
          valor_liquido?: number
        }
        Relationships: [
          {
            foreignKeyName: "convenio_producao_itens_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convenio_producao_itens_convenio_id_fkey"
            columns: ["convenio_id"]
            isOneToOne: false
            referencedRelation: "convenios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convenio_producao_itens_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
        ]
      }
      convenios: {
        Row: {
          ativo: boolean
          clinica_id: string
          cnpj: string | null
          created_at: string
          credenciador_pagador: string | null
          feegow_id: string | null
          id: string
          nome: string
          prazo_repasse_dias: number | null
          registro_ans: string | null
          taxa_adm_percent: number | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          clinica_id: string
          cnpj?: string | null
          created_at?: string
          credenciador_pagador?: string | null
          feegow_id?: string | null
          id?: string
          nome: string
          prazo_repasse_dias?: number | null
          registro_ans?: string | null
          taxa_adm_percent?: number | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          clinica_id?: string
          cnpj?: string | null
          created_at?: string
          credenciador_pagador?: string | null
          feegow_id?: string | null
          id?: string
          nome?: string
          prazo_repasse_dias?: number | null
          registro_ans?: string | null
          taxa_adm_percent?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "convenios_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      convenios_nf: {
        Row: {
          banco_tx_id: string | null
          clinica_id: string
          competencia: string
          convenio_id: string
          created_at: string
          credenciador_pagador: string | null
          data_emissao: string | null
          data_envio: string | null
          id: string
          motivo_glosa: string | null
          numero_nf: string | null
          observacoes: string | null
          periodo_atendimentos_fim: string | null
          periodo_atendimentos_inicio: string | null
          status: Database["public"]["Enums"]["status_nf_convenio"]
          updated_at: string
          valor_esperado: number
          valor_faturado: number
          valor_glosado: number
          valor_recebido: number
        }
        Insert: {
          banco_tx_id?: string | null
          clinica_id: string
          competencia: string
          convenio_id: string
          created_at?: string
          credenciador_pagador?: string | null
          data_emissao?: string | null
          data_envio?: string | null
          id?: string
          motivo_glosa?: string | null
          numero_nf?: string | null
          observacoes?: string | null
          periodo_atendimentos_fim?: string | null
          periodo_atendimentos_inicio?: string | null
          status?: Database["public"]["Enums"]["status_nf_convenio"]
          updated_at?: string
          valor_esperado?: number
          valor_faturado?: number
          valor_glosado?: number
          valor_recebido?: number
        }
        Update: {
          banco_tx_id?: string | null
          clinica_id?: string
          competencia?: string
          convenio_id?: string
          created_at?: string
          credenciador_pagador?: string | null
          data_emissao?: string | null
          data_envio?: string | null
          id?: string
          motivo_glosa?: string | null
          numero_nf?: string | null
          observacoes?: string | null
          periodo_atendimentos_fim?: string | null
          periodo_atendimentos_inicio?: string | null
          status?: Database["public"]["Enums"]["status_nf_convenio"]
          updated_at?: string
          valor_esperado?: number
          valor_faturado?: number
          valor_glosado?: number
          valor_recebido?: number
        }
        Relationships: [
          {
            foreignKeyName: "convenios_nf_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convenios_nf_convenio_id_fkey"
            columns: ["convenio_id"]
            isOneToOne: false
            referencedRelation: "convenios"
            referencedColumns: ["id"]
          },
        ]
      }
      cronometro_atendimento: {
        Row: {
          checkin_id: string | null
          clinica_id: string
          created_at: string | null
          duracao_segundos: number | null
          fim: string | null
          id: string
          inicio: string | null
          medico_id: string | null
          paciente_id: string | null
          status: string | null
        }
        Insert: {
          checkin_id?: string | null
          clinica_id: string
          created_at?: string | null
          duracao_segundos?: number | null
          fim?: string | null
          id?: string
          inicio?: string | null
          medico_id?: string | null
          paciente_id?: string | null
          status?: string | null
        }
        Update: {
          checkin_id?: string | null
          clinica_id?: string
          created_at?: string | null
          duracao_segundos?: number | null
          fim?: string | null
          id?: string
          inicio?: string | null
          medico_id?: string | null
          paciente_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cronometro_atendimento_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronometro_atendimento_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronometro_atendimento_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronometro_atendimento_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      custo_fixo_itens: {
        Row: {
          ativo: boolean
          clinica_id: string
          codigo_pc: string | null
          created_at: string
          descricao: string
          fonte_funcionarios: boolean
          grupo: string
          id: string
          observacao: string | null
          recorrencia: string
          updated_at: string
          valor_mensal: number
        }
        Insert: {
          ativo?: boolean
          clinica_id: string
          codigo_pc?: string | null
          created_at?: string
          descricao: string
          fonte_funcionarios?: boolean
          grupo: string
          id?: string
          observacao?: string | null
          recorrencia?: string
          updated_at?: string
          valor_mensal?: number
        }
        Update: {
          ativo?: boolean
          clinica_id?: string
          codigo_pc?: string | null
          created_at?: string
          descricao?: string
          fonte_funcionarios?: boolean
          grupo?: string
          id?: string
          observacao?: string | null
          recorrencia?: string
          updated_at?: string
          valor_mensal?: number
        }
        Relationships: [
          {
            foreignKeyName: "custo_fixo_itens_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas: {
        Row: {
          categoria: string
          clinica_id: string
          created_at: string
          data_competencia: string
          data_pagamento: string | null
          descricao: string | null
          fornecedor: string | null
          id: string
          subcategoria: string | null
          tipo: Database["public"]["Enums"]["tipo_despesa"]
          updated_at: string
          valor: number
        }
        Insert: {
          categoria: string
          clinica_id: string
          created_at?: string
          data_competencia: string
          data_pagamento?: string | null
          descricao?: string | null
          fornecedor?: string | null
          id?: string
          subcategoria?: string | null
          tipo: Database["public"]["Enums"]["tipo_despesa"]
          updated_at?: string
          valor: number
        }
        Update: {
          categoria?: string
          clinica_id?: string
          created_at?: string
          data_competencia?: string
          data_pagamento?: string | null
          descricao?: string | null
          fornecedor?: string | null
          id?: string
          subcategoria?: string | null
          tipo?: Database["public"]["Enums"]["tipo_despesa"]
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesas_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      divida_pagamentos: {
        Row: {
          clinica_id: string
          conta_pagar_id: string | null
          created_at: string
          data_pagamento: string
          divida_id: string
          id: string
          juros_pago: number | null
          observacao: string | null
          origem: Database["public"]["Enums"]["origem_pagamento"]
          principal_amortizado: number | null
          transacao_bancaria_id: string | null
          valor_pago: number
        }
        Insert: {
          clinica_id: string
          conta_pagar_id?: string | null
          created_at?: string
          data_pagamento: string
          divida_id: string
          id?: string
          juros_pago?: number | null
          observacao?: string | null
          origem?: Database["public"]["Enums"]["origem_pagamento"]
          principal_amortizado?: number | null
          transacao_bancaria_id?: string | null
          valor_pago: number
        }
        Update: {
          clinica_id?: string
          conta_pagar_id?: string | null
          created_at?: string
          data_pagamento?: string
          divida_id?: string
          id?: string
          juros_pago?: number | null
          observacao?: string | null
          origem?: Database["public"]["Enums"]["origem_pagamento"]
          principal_amortizado?: number | null
          transacao_bancaria_id?: string | null
          valor_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "divida_pagamentos_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "divida_pagamentos_divida_id_fkey"
            columns: ["divida_id"]
            isOneToOne: false
            referencedRelation: "dividas"
            referencedColumns: ["id"]
          },
        ]
      }
      divida_parcelas_previstas: {
        Row: {
          amortizacao: number | null
          clinica_id: string
          competencia: string
          created_at: string
          divida_id: string
          id: string
          juros: number | null
          pago: boolean
          pmt: number
          saldo_devedor: number | null
        }
        Insert: {
          amortizacao?: number | null
          clinica_id: string
          competencia: string
          created_at?: string
          divida_id: string
          id?: string
          juros?: number | null
          pago?: boolean
          pmt: number
          saldo_devedor?: number | null
        }
        Update: {
          amortizacao?: number | null
          clinica_id?: string
          competencia?: string
          created_at?: string
          divida_id?: string
          id?: string
          juros?: number | null
          pago?: boolean
          pmt?: number
          saldo_devedor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "divida_parcelas_previstas_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "divida_parcelas_previstas_divida_id_fkey"
            columns: ["divida_id"]
            isOneToOne: false
            referencedRelation: "dividas"
            referencedColumns: ["id"]
          },
        ]
      }
      dividas: {
        Row: {
          ativo: boolean
          clinica_id: string
          created_at: string
          credor: string
          custo_efetivo: number | null
          data_inicio: string | null
          data_vencimento: string | null
          descricao: string | null
          id: string
          nome: string | null
          saldo: number
          saldo_inicial: number | null
          taxa_juros: number | null
          tipo: Database["public"]["Enums"]["tipo_divida"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          clinica_id: string
          created_at?: string
          credor: string
          custo_efetivo?: number | null
          data_inicio?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          id?: string
          nome?: string | null
          saldo: number
          saldo_inicial?: number | null
          taxa_juros?: number | null
          tipo?: Database["public"]["Enums"]["tipo_divida"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          clinica_id?: string
          created_at?: string
          credor?: string
          custo_efetivo?: number | null
          data_inicio?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          id?: string
          nome?: string | null
          saldo?: number
          saldo_inicial?: number | null
          taxa_juros?: number | null
          tipo?: Database["public"]["Enums"]["tipo_divida"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dividas_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_upload: {
        Row: {
          arquivo_url: string | null
          categoria: string | null
          clinica_id: string
          contrato_id: string | null
          created_at: string | null
          funcionario_id: string | null
          id: string
          nome: string
          observacoes: string | null
          paciente_id: string | null
          tamanho_bytes: number | null
          tipo_mime: string | null
          uploaded_by: string | null
        }
        Insert: {
          arquivo_url?: string | null
          categoria?: string | null
          clinica_id: string
          contrato_id?: string | null
          created_at?: string | null
          funcionario_id?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          paciente_id?: string | null
          tamanho_bytes?: number | null
          tipo_mime?: string | null
          uploaded_by?: string | null
        }
        Update: {
          arquivo_url?: string | null
          categoria?: string | null
          clinica_id?: string
          contrato_id?: string | null
          created_at?: string | null
          funcionario_id?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          paciente_id?: string | null
          tamanho_bytes?: number | null
          tipo_mime?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_upload_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_upload_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos_prestadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_upload_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_upload_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_historico_mensal: {
        Row: {
          ano: number
          cf: number
          clinica_id: string
          created_at: string
          id: string
          impostos: number
          mc: number
          mc_pct: number
          mes: number
          regime_tributario: string | null
          repasses: number
          resultado: number
          resultado_pct: number
          rt: number
          taxa_cartao: number
        }
        Insert: {
          ano: number
          cf?: number
          clinica_id: string
          created_at?: string
          id?: string
          impostos?: number
          mc?: number
          mc_pct?: number
          mes: number
          regime_tributario?: string | null
          repasses?: number
          resultado?: number
          resultado_pct?: number
          rt?: number
          taxa_cartao?: number
        }
        Update: {
          ano?: number
          cf?: number
          clinica_id?: string
          created_at?: string
          id?: string
          impostos?: number
          mc?: number
          mc_pct?: number
          mes?: number
          regime_tributario?: string | null
          repasses?: number
          resultado?: number
          resultado_pct?: number
          rt?: number
          taxa_cartao?: number
        }
        Relationships: [
          {
            foreignKeyName: "dre_historico_mensal_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_mapeamento_contas: {
        Row: {
          ativo: boolean
          clinica_id: string
          created_at: string
          id: string
          linha_dre: string
          plano_contas_id: string
        }
        Insert: {
          ativo?: boolean
          clinica_id: string
          created_at?: string
          id?: string
          linha_dre: string
          plano_contas_id: string
        }
        Update: {
          ativo?: boolean
          clinica_id?: string
          created_at?: string
          id?: string
          linha_dre?: string
          plano_contas_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dre_mapeamento_contas_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dre_mapeamento_contas_plano_contas_id_fkey"
            columns: ["plano_contas_id"]
            isOneToOne: false
            referencedRelation: "plano_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      encaminhamentos: {
        Row: {
          agendamento_id: string | null
          clinica_id: string
          created_at: string | null
          especialidade_destino: string | null
          id: string
          medico_id: string | null
          motivo: string | null
          observacoes: string | null
          paciente_id: string | null
          status: string | null
        }
        Insert: {
          agendamento_id?: string | null
          clinica_id: string
          created_at?: string | null
          especialidade_destino?: string | null
          id?: string
          medico_id?: string | null
          motivo?: string | null
          observacoes?: string | null
          paciente_id?: string | null
          status?: string | null
        }
        Update: {
          agendamento_id?: string | null
          clinica_id?: string
          created_at?: string | null
          especialidade_destino?: string | null
          id?: string
          medico_id?: string | null
          motivo?: string | null
          observacoes?: string | null
          paciente_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "encaminhamentos_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encaminhamentos_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encaminhamentos_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encaminhamentos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      escalas_horarios: {
        Row: {
          ativo: boolean | null
          clinica_id: string
          created_at: string | null
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id: string
          intervalo_minutos: number | null
          medico_id: string | null
          sala_id: string | null
          vigente_ate: string | null
          vigente_de: string | null
        }
        Insert: {
          ativo?: boolean | null
          clinica_id: string
          created_at?: string | null
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id?: string
          intervalo_minutos?: number | null
          medico_id?: string | null
          sala_id?: string | null
          vigente_ate?: string | null
          vigente_de?: string | null
        }
        Update: {
          ativo?: boolean | null
          clinica_id?: string
          created_at?: string | null
          dia_semana?: number
          hora_fim?: string
          hora_inicio?: string
          id?: string
          intervalo_minutos?: number | null
          medico_id?: string | null
          sala_id?: string | null
          vigente_ate?: string | null
          vigente_de?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escalas_horarios_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_horarios_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_horarios_sala_id_fkey"
            columns: ["sala_id"]
            isOneToOne: false
            referencedRelation: "salas_consultorios"
            referencedColumns: ["id"]
          },
        ]
      }
      especialidades: {
        Row: {
          ativo: boolean | null
          clinica_id: string
          codigo_tiss: string | null
          created_at: string | null
          feegow_id: string | null
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean | null
          clinica_id: string
          codigo_tiss?: string | null
          created_at?: string | null
          feegow_id?: string | null
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean | null
          clinica_id?: string
          codigo_tiss?: string | null
          created_at?: string | null
          feegow_id?: string | null
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "especialidades_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_categorias: {
        Row: {
          clinica_id: string
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
        }
        Insert: {
          clinica_id: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
        }
        Update: {
          clinica_id?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_categorias_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_itens: {
        Row: {
          ativo: boolean | null
          categoria_id: string | null
          clinica_id: string
          codigo: string | null
          created_at: string | null
          custo_unitario: number | null
          estoque_atual: number | null
          estoque_minimo: number | null
          fornecedor: string | null
          id: string
          nome: string
          unidade: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          categoria_id?: string | null
          clinica_id: string
          codigo?: string | null
          created_at?: string | null
          custo_unitario?: number | null
          estoque_atual?: number | null
          estoque_minimo?: number | null
          fornecedor?: string | null
          id?: string
          nome: string
          unidade?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          categoria_id?: string | null
          clinica_id?: string
          codigo?: string | null
          created_at?: string | null
          custo_unitario?: number | null
          estoque_atual?: number | null
          estoque_minimo?: number | null
          fornecedor?: string | null
          id?: string
          nome?: string
          unidade?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_itens_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "estoque_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_itens_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_movimentacoes: {
        Row: {
          clinica_id: string
          created_at: string | null
          custo_unitario: number | null
          id: string
          item_id: string
          motivo: string | null
          quantidade: number
          referencia_id: string | null
          tipo: string
          usuario_id: string | null
        }
        Insert: {
          clinica_id: string
          created_at?: string | null
          custo_unitario?: number | null
          id?: string
          item_id: string
          motivo?: string | null
          quantidade: number
          referencia_id?: string | null
          tipo: string
          usuario_id?: string | null
        }
        Update: {
          clinica_id?: string
          created_at?: string | null
          custo_unitario?: number | null
          id?: string
          item_id?: string
          motivo?: string | null
          quantidade?: number
          referencia_id?: string | null
          tipo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_movimentacoes_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      feegow_sync_log: {
        Row: {
          clinica_id: string
          created_at: string
          id: string
          payload: Json
          rascunho_id: string | null
          response: Json | null
          status: Database["public"]["Enums"]["status_sync_log"]
          tipo: Database["public"]["Enums"]["tipo_sync_feegow"]
        }
        Insert: {
          clinica_id: string
          created_at?: string
          id?: string
          payload?: Json
          rascunho_id?: string | null
          response?: Json | null
          status?: Database["public"]["Enums"]["status_sync_log"]
          tipo: Database["public"]["Enums"]["tipo_sync_feegow"]
        }
        Update: {
          clinica_id?: string
          created_at?: string
          id?: string
          payload?: Json
          rascunho_id?: string | null
          response?: Json | null
          status?: Database["public"]["Enums"]["status_sync_log"]
          tipo?: Database["public"]["Enums"]["tipo_sync_feegow"]
        }
        Relationships: [
          {
            foreignKeyName: "feegow_sync_log_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feegow_sync_log_rascunho_id_fkey"
            columns: ["rascunho_id"]
            isOneToOne: false
            referencedRelation: "precos_rascunho"
            referencedColumns: ["id"]
          },
        ]
      }
      feegow_sync_runs: {
        Row: {
          clinica_id: string
          created_at: string
          errors: Json | null
          finished_at: string | null
          healthcheck_ok: boolean | null
          id: string
          month: number
          status: string
          sync_invoices_ok: boolean | null
          totals: Json | null
          validate_sales_ok: boolean | null
          year: number
        }
        Insert: {
          clinica_id: string
          created_at?: string
          errors?: Json | null
          finished_at?: string | null
          healthcheck_ok?: boolean | null
          id?: string
          month: number
          status?: string
          sync_invoices_ok?: boolean | null
          totals?: Json | null
          validate_sales_ok?: boolean | null
          year: number
        }
        Update: {
          clinica_id?: string
          created_at?: string
          errors?: Json | null
          finished_at?: string | null
          healthcheck_ok?: boolean | null
          id?: string
          month?: number
          status?: string
          sync_invoices_ok?: boolean | null
          totals?: Json | null
          validate_sales_ok?: boolean | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "feegow_sync_runs_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios: {
        Row: {
          ativo: boolean
          auxilio_transporte: number
          bolsa_mensal: number
          cargo: string
          clinica_id: string
          created_at: string
          decimo_terceiro_pct: number
          diarias_semanais: number
          ferias_pct: number
          fgts_pct: number
          id: string
          insalubridade: number
          inss_patronal_pct: number
          nome: string
          passagem_dia: number
          salario_bruto: number
          semanas_mes: number
          tipo: Database["public"]["Enums"]["tipo_funcionario"]
          updated_at: string
          vale_transporte: number
          valor_diaria: number
          valor_mensal_prestador: number
        }
        Insert: {
          ativo?: boolean
          auxilio_transporte?: number
          bolsa_mensal?: number
          cargo: string
          clinica_id: string
          created_at?: string
          decimo_terceiro_pct?: number
          diarias_semanais?: number
          ferias_pct?: number
          fgts_pct?: number
          id?: string
          insalubridade?: number
          inss_patronal_pct?: number
          nome: string
          passagem_dia?: number
          salario_bruto?: number
          semanas_mes?: number
          tipo?: Database["public"]["Enums"]["tipo_funcionario"]
          updated_at?: string
          vale_transporte?: number
          valor_diaria?: number
          valor_mensal_prestador?: number
        }
        Update: {
          ativo?: boolean
          auxilio_transporte?: number
          bolsa_mensal?: number
          cargo?: string
          clinica_id?: string
          created_at?: string
          decimo_terceiro_pct?: number
          diarias_semanais?: number
          ferias_pct?: number
          fgts_pct?: number
          id?: string
          insalubridade?: number
          inss_patronal_pct?: number
          nome?: string
          passagem_dia?: number
          salario_bruto?: number
          semanas_mes?: number
          tipo?: Database["public"]["Enums"]["tipo_funcionario"]
          updated_at?: string
          vale_transporte?: number
          valor_diaria?: number
          valor_mensal_prestador?: number
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      getnet_recebiveis_detalhado: {
        Row: {
          arquivo_id: string | null
          autorizacao: string | null
          bandeira_modalidade: string | null
          clinica_id: string
          created_at: string
          data_vencimento: string
          data_venda: string | null
          descontos: number | null
          hora_venda: string | null
          id: string
          lancamento: string | null
          meio_pagamento: string | null
          mes_ref: string
          nsu: string | null
          raw_hash: string | null
          resumo_id: string | null
          terminal_logico: string | null
          tipo_lancamento: string | null
          valor_liquidado: number | null
          valor_liquido: number
          valor_venda: number | null
        }
        Insert: {
          arquivo_id?: string | null
          autorizacao?: string | null
          bandeira_modalidade?: string | null
          clinica_id: string
          created_at?: string
          data_vencimento: string
          data_venda?: string | null
          descontos?: number | null
          hora_venda?: string | null
          id?: string
          lancamento?: string | null
          meio_pagamento?: string | null
          mes_ref: string
          nsu?: string | null
          raw_hash?: string | null
          resumo_id?: string | null
          terminal_logico?: string | null
          tipo_lancamento?: string | null
          valor_liquidado?: number | null
          valor_liquido?: number
          valor_venda?: number | null
        }
        Update: {
          arquivo_id?: string | null
          autorizacao?: string | null
          bandeira_modalidade?: string | null
          clinica_id?: string
          created_at?: string
          data_vencimento?: string
          data_venda?: string | null
          descontos?: number | null
          hora_venda?: string | null
          id?: string
          lancamento?: string | null
          meio_pagamento?: string | null
          mes_ref?: string
          nsu?: string | null
          raw_hash?: string | null
          resumo_id?: string | null
          terminal_logico?: string | null
          tipo_lancamento?: string | null
          valor_liquidado?: number | null
          valor_liquido?: number
          valor_venda?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "getnet_recebiveis_detalhado_arquivo_id_fkey"
            columns: ["arquivo_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "getnet_recebiveis_detalhado_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "getnet_recebiveis_detalhado_resumo_id_fkey"
            columns: ["resumo_id"]
            isOneToOne: false
            referencedRelation: "getnet_recebiveis_resumo"
            referencedColumns: ["id"]
          },
        ]
      }
      getnet_recebiveis_resumo: {
        Row: {
          agencia: string | null
          arquivo_id: string | null
          banco: string | null
          bandeira_modalidade: string | null
          clinica_id: string
          conta_corrente: string | null
          created_at: string
          data_vencimento: string
          id: string
          meio_pagamento: string | null
          mes_ref: string
          raw_hash: string | null
          recebimento: string | null
          status: string | null
          valor_liquido: number
        }
        Insert: {
          agencia?: string | null
          arquivo_id?: string | null
          banco?: string | null
          bandeira_modalidade?: string | null
          clinica_id: string
          conta_corrente?: string | null
          created_at?: string
          data_vencimento: string
          id?: string
          meio_pagamento?: string | null
          mes_ref: string
          raw_hash?: string | null
          recebimento?: string | null
          status?: string | null
          valor_liquido?: number
        }
        Update: {
          agencia?: string | null
          arquivo_id?: string | null
          banco?: string | null
          bandeira_modalidade?: string | null
          clinica_id?: string
          conta_corrente?: string | null
          created_at?: string
          data_vencimento?: string
          id?: string
          meio_pagamento?: string | null
          mes_ref?: string
          raw_hash?: string | null
          recebimento?: string | null
          status?: string | null
          valor_liquido?: number
        }
        Relationships: [
          {
            foreignKeyName: "getnet_recebiveis_resumo_arquivo_id_fkey"
            columns: ["arquivo_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "getnet_recebiveis_resumo_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      getnet_recebiveis_sintetico: {
        Row: {
          arquivo_id: string | null
          bandeira_modalidade: string | null
          clinica_id: string
          created_at: string
          data_ultima_movimentacao: string | null
          id: string
          meio_pagamento: string | null
          mes_ref: string
          quantidade: number | null
          raw_hash: string | null
          valor_liquido: number
        }
        Insert: {
          arquivo_id?: string | null
          bandeira_modalidade?: string | null
          clinica_id: string
          created_at?: string
          data_ultima_movimentacao?: string | null
          id?: string
          meio_pagamento?: string | null
          mes_ref: string
          quantidade?: number | null
          raw_hash?: string | null
          valor_liquido?: number
        }
        Update: {
          arquivo_id?: string | null
          bandeira_modalidade?: string | null
          clinica_id?: string
          created_at?: string
          data_ultima_movimentacao?: string | null
          id?: string
          meio_pagamento?: string | null
          mes_ref?: string
          quantidade?: number | null
          raw_hash?: string | null
          valor_liquido?: number
        }
        Relationships: [
          {
            foreignKeyName: "getnet_recebiveis_sintetico_arquivo_id_fkey"
            columns: ["arquivo_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "getnet_recebiveis_sintetico_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      getnet_transacoes: {
        Row: {
          arquivo_id: string | null
          autorizacao: string | null
          bandeira: string | null
          clinica_id: string
          comprovante_venda: string | null
          created_at: string
          data_prevista_pagamento: string | null
          data_venda: string
          forma_pagamento: string | null
          id: string
          id_transacao_pix: string | null
          instituicao_bancaria: string | null
          modalidade: string | null
          numero_cartao: string | null
          parcelas: number | null
          status_conciliacao: string
          status_transacao: string | null
          terminal: string | null
          tipo_extrato: string
          transacao_bancaria_id: string | null
          valor_bruto: number
          valor_liquido: number
          valor_taxa: number
          venda_id: string | null
        }
        Insert: {
          arquivo_id?: string | null
          autorizacao?: string | null
          bandeira?: string | null
          clinica_id: string
          comprovante_venda?: string | null
          created_at?: string
          data_prevista_pagamento?: string | null
          data_venda: string
          forma_pagamento?: string | null
          id?: string
          id_transacao_pix?: string | null
          instituicao_bancaria?: string | null
          modalidade?: string | null
          numero_cartao?: string | null
          parcelas?: number | null
          status_conciliacao?: string
          status_transacao?: string | null
          terminal?: string | null
          tipo_extrato: string
          transacao_bancaria_id?: string | null
          valor_bruto: number
          valor_liquido: number
          valor_taxa?: number
          venda_id?: string | null
        }
        Update: {
          arquivo_id?: string | null
          autorizacao?: string | null
          bandeira?: string | null
          clinica_id?: string
          comprovante_venda?: string | null
          created_at?: string
          data_prevista_pagamento?: string | null
          data_venda?: string
          forma_pagamento?: string | null
          id?: string
          id_transacao_pix?: string | null
          instituicao_bancaria?: string | null
          modalidade?: string | null
          numero_cartao?: string | null
          parcelas?: number | null
          status_conciliacao?: string
          status_transacao?: string | null
          terminal?: string | null
          tipo_extrato?: string
          transacao_bancaria_id?: string | null
          valor_bruto?: number
          valor_liquido?: number
          valor_taxa?: number
          venda_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "getnet_transacoes_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "getnet_transacoes_transacao_bancaria_id_fkey"
            columns: ["transacao_bancaria_id"]
            isOneToOne: false
            referencedRelation: "transacoes_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "getnet_transacoes_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "transacoes_vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      guias_tiss: {
        Row: {
          agendamento_id: string | null
          clinica_id: string
          convenio_id: string | null
          created_at: string | null
          data_autorizacao: string | null
          data_emissao: string | null
          id: string
          medico_id: string | null
          numero_guia: string | null
          observacoes: string | null
          paciente_id: string | null
          procedimentos: Json | null
          senha_autorizacao: string | null
          status: string | null
          tipo_guia: string | null
          updated_at: string | null
          valor_total: number | null
          xml_tiss: string | null
        }
        Insert: {
          agendamento_id?: string | null
          clinica_id: string
          convenio_id?: string | null
          created_at?: string | null
          data_autorizacao?: string | null
          data_emissao?: string | null
          id?: string
          medico_id?: string | null
          numero_guia?: string | null
          observacoes?: string | null
          paciente_id?: string | null
          procedimentos?: Json | null
          senha_autorizacao?: string | null
          status?: string | null
          tipo_guia?: string | null
          updated_at?: string | null
          valor_total?: number | null
          xml_tiss?: string | null
        }
        Update: {
          agendamento_id?: string | null
          clinica_id?: string
          convenio_id?: string | null
          created_at?: string | null
          data_autorizacao?: string | null
          data_emissao?: string | null
          id?: string
          medico_id?: string | null
          numero_guia?: string | null
          observacoes?: string | null
          paciente_id?: string | null
          procedimentos?: Json | null
          senha_autorizacao?: string | null
          status?: string | null
          tipo_guia?: string | null
          updated_at?: string | null
          valor_total?: number | null
          xml_tiss?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guias_tiss_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guias_tiss_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guias_tiss_convenio_id_fkey"
            columns: ["convenio_id"]
            isOneToOne: false
            referencedRelation: "convenios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guias_tiss_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guias_tiss_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      import_runs: {
        Row: {
          arquivo_hash: string | null
          arquivo_nome: string | null
          clinica_id: string
          created_at: string
          detalhes: Json | null
          erros: Json | null
          finished_at: string | null
          id: string
          origem: string
          periodo_fim: string | null
          periodo_inicio: string | null
          registros_atualizados: number | null
          registros_criados: number | null
          registros_ignorados: number | null
          registros_rejeitados: number | null
          registros_total: number | null
          status: string
          tipo: string
        }
        Insert: {
          arquivo_hash?: string | null
          arquivo_nome?: string | null
          clinica_id: string
          created_at?: string
          detalhes?: Json | null
          erros?: Json | null
          finished_at?: string | null
          id?: string
          origem?: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          registros_atualizados?: number | null
          registros_criados?: number | null
          registros_ignorados?: number | null
          registros_rejeitados?: number | null
          registros_total?: number | null
          status?: string
          tipo: string
        }
        Update: {
          arquivo_hash?: string | null
          arquivo_nome?: string | null
          clinica_id?: string
          created_at?: string
          detalhes?: Json | null
          erros?: Json | null
          finished_at?: string | null
          id?: string
          origem?: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          registros_atualizados?: number | null
          registros_criados?: number | null
          registros_ignorados?: number | null
          registros_rejeitados?: number | null
          registros_total?: number | null
          status?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_runs_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      imposto_pagamentos: {
        Row: {
          clinica_id: string
          conta_pagar_id: string | null
          created_at: string
          data_pagamento: string
          id: string
          impostos_devidos_id: string
          origem: Database["public"]["Enums"]["origem_pagamento"]
          transacao_bancaria_id: string | null
          valor_pago: number
        }
        Insert: {
          clinica_id: string
          conta_pagar_id?: string | null
          created_at?: string
          data_pagamento: string
          id?: string
          impostos_devidos_id: string
          origem?: Database["public"]["Enums"]["origem_pagamento"]
          transacao_bancaria_id?: string | null
          valor_pago: number
        }
        Update: {
          clinica_id?: string
          conta_pagar_id?: string | null
          created_at?: string
          data_pagamento?: string
          id?: string
          impostos_devidos_id?: string
          origem?: Database["public"]["Enums"]["origem_pagamento"]
          transacao_bancaria_id?: string | null
          valor_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "imposto_pagamentos_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imposto_pagamentos_impostos_devidos_id_fkey"
            columns: ["impostos_devidos_id"]
            isOneToOne: false
            referencedRelation: "impostos_devidos"
            referencedColumns: ["id"]
          },
        ]
      }
      impostos_devidos: {
        Row: {
          clinica_id: string
          competencia: string
          created_at: string
          dia_vencimento_fixo: number | null
          forma_pagamento: string | null
          id: string
          imposto: Database["public"]["Enums"]["tipo_imposto"]
          qtd_parcelas: number | null
          status: Database["public"]["Enums"]["status_imposto"]
          valor_devido: number
          valor_pago: number
          valor_parcela: number | null
          vencimento: string | null
        }
        Insert: {
          clinica_id: string
          competencia: string
          created_at?: string
          dia_vencimento_fixo?: number | null
          forma_pagamento?: string | null
          id?: string
          imposto: Database["public"]["Enums"]["tipo_imposto"]
          qtd_parcelas?: number | null
          status?: Database["public"]["Enums"]["status_imposto"]
          valor_devido: number
          valor_pago?: number
          valor_parcela?: number | null
          vencimento?: string | null
        }
        Update: {
          clinica_id?: string
          competencia?: string
          created_at?: string
          dia_vencimento_fixo?: number | null
          forma_pagamento?: string | null
          id?: string
          imposto?: Database["public"]["Enums"]["tipo_imposto"]
          qtd_parcelas?: number | null
          status?: Database["public"]["Enums"]["status_imposto"]
          valor_devido?: number
          valor_pago?: number
          valor_parcela?: number | null
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "impostos_devidos_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      insights_ia: {
        Row: {
          acoes_recomendadas: Json | null
          clinica_id: string
          created_at: string
          data_quality_score: number | null
          id: string
          input_context: Json | null
          output_markdown: string | null
          periodo_fim: string
          periodo_inicio: string
          tipo: Database["public"]["Enums"]["tipo_insight"]
        }
        Insert: {
          acoes_recomendadas?: Json | null
          clinica_id: string
          created_at?: string
          data_quality_score?: number | null
          id?: string
          input_context?: Json | null
          output_markdown?: string | null
          periodo_fim: string
          periodo_inicio: string
          tipo?: Database["public"]["Enums"]["tipo_insight"]
        }
        Update: {
          acoes_recomendadas?: Json | null
          clinica_id?: string
          created_at?: string
          data_quality_score?: number | null
          id?: string
          input_context?: Json | null
          output_markdown?: string | null
          periodo_fim?: string
          periodo_inicio?: string
          tipo?: Database["public"]["Enums"]["tipo_insight"]
        }
        Relationships: [
          {
            foreignKeyName: "insights_ia_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      integracao_jobs: {
        Row: {
          clinica_id: string
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          job_type: string
          params: Json
          progress: Json | null
          started_at: string | null
          status: string
        }
        Insert: {
          clinica_id: string
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          job_type: string
          params?: Json
          progress?: Json | null
          started_at?: string | null
          status?: string
        }
        Update: {
          clinica_id?: string
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          job_type?: string
          params?: Json
          progress?: Json | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "integracao_jobs_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      integracao_logs: {
        Row: {
          acao: string | null
          clinica_id: string
          created_at: string
          detalhes: Json | null
          endpoint: string | null
          erros: Json | null
          fim: string | null
          id: string
          inicio: string
          integracao: string
          registros_atualizados: number | null
          registros_criados: number | null
          registros_ignorados: number | null
          registros_processados: number | null
          request_hash: string | null
          status: string
        }
        Insert: {
          acao?: string | null
          clinica_id: string
          created_at?: string
          detalhes?: Json | null
          endpoint?: string | null
          erros?: Json | null
          fim?: string | null
          id?: string
          inicio?: string
          integracao: string
          registros_atualizados?: number | null
          registros_criados?: number | null
          registros_ignorados?: number | null
          registros_processados?: number | null
          request_hash?: string | null
          status?: string
        }
        Update: {
          acao?: string | null
          clinica_id?: string
          created_at?: string
          detalhes?: Json | null
          endpoint?: string | null
          erros?: Json | null
          fim?: string | null
          id?: string
          inicio?: string
          integracao?: string
          registros_atualizados?: number | null
          registros_criados?: number | null
          registros_ignorados?: number | null
          registros_processados?: number | null
          request_hash?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "integracao_logs_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      integracoes: {
        Row: {
          clinica_id: string
          configuracoes: Json | null
          created_at: string
          id: string
          status: Database["public"]["Enums"]["status_integracao"]
          tipo: string
          ultima_sincronizacao: string | null
          updated_at: string
        }
        Insert: {
          clinica_id: string
          configuracoes?: Json | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["status_integracao"]
          tipo: string
          ultima_sincronizacao?: string | null
          updated_at?: string
        }
        Update: {
          clinica_id?: string
          configuracoes?: Json | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["status_integracao"]
          tipo?: string
          ultima_sincronizacao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integracoes_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_snapshots: {
        Row: {
          clinica_id: string
          created_at: string
          data_quality_breakdown: Json | null
          data_quality_score: number | null
          granularidade: string
          id: string
          kpis: Json
          periodo: string
        }
        Insert: {
          clinica_id: string
          created_at?: string
          data_quality_breakdown?: Json | null
          data_quality_score?: number | null
          granularidade?: string
          id?: string
          kpis?: Json
          periodo: string
        }
        Update: {
          clinica_id?: string
          created_at?: string
          data_quality_breakdown?: Json | null
          data_quality_score?: number | null
          granularidade?: string
          id?: string
          kpis?: Json
          periodo?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_snapshots_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      laudos: {
        Row: {
          agendamento_id: string | null
          assinado_em: string | null
          clinica_id: string
          conclusao: string | null
          conteudo: string | null
          created_at: string | null
          id: string
          medico_id: string | null
          paciente_id: string | null
          status: string | null
          tipo: string | null
        }
        Insert: {
          agendamento_id?: string | null
          assinado_em?: string | null
          clinica_id: string
          conclusao?: string | null
          conteudo?: string | null
          created_at?: string | null
          id?: string
          medico_id?: string | null
          paciente_id?: string | null
          status?: string | null
          tipo?: string | null
        }
        Update: {
          agendamento_id?: string | null
          assinado_em?: string | null
          clinica_id?: string
          conclusao?: string | null
          conteudo?: string | null
          created_at?: string | null
          id?: string
          medico_id?: string | null
          paciente_id?: string | null
          status?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "laudos_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laudos_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laudos_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laudos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes_faturamento: {
        Row: {
          clinica_id: string
          competencia: string
          convenio_id: string | null
          created_at: string | null
          data_envio: string | null
          data_resposta: string | null
          id: string
          numero_lote: string | null
          quantidade_guias: number | null
          status: string | null
          updated_at: string | null
          valor_total: number | null
          xml_lote: string | null
        }
        Insert: {
          clinica_id: string
          competencia: string
          convenio_id?: string | null
          created_at?: string | null
          data_envio?: string | null
          data_resposta?: string | null
          id?: string
          numero_lote?: string | null
          quantidade_guias?: number | null
          status?: string | null
          updated_at?: string | null
          valor_total?: number | null
          xml_lote?: string | null
        }
        Update: {
          clinica_id?: string
          competencia?: string
          convenio_id?: string | null
          created_at?: string | null
          data_envio?: string | null
          data_resposta?: string | null
          id?: string
          numero_lote?: string | null
          quantidade_guias?: number | null
          status?: string | null
          updated_at?: string | null
          valor_total?: number | null
          xml_lote?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lotes_faturamento_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_faturamento_convenio_id_fkey"
            columns: ["convenio_id"]
            isOneToOne: false
            referencedRelation: "convenios"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_calendario: {
        Row: {
          clinica_id: string
          created_at: string | null
          criativo_id: string | null
          data_publicacao: string | null
          descricao: string | null
          id: string
          plataforma: string | null
          status: string | null
          titulo: string
        }
        Insert: {
          clinica_id: string
          created_at?: string | null
          criativo_id?: string | null
          data_publicacao?: string | null
          descricao?: string | null
          id?: string
          plataforma?: string | null
          status?: string | null
          titulo: string
        }
        Update: {
          clinica_id?: string
          created_at?: string | null
          criativo_id?: string | null
          data_publicacao?: string | null
          descricao?: string | null
          id?: string
          plataforma?: string | null
          status?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_calendario_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_calendario_criativo_id_fkey"
            columns: ["criativo_id"]
            isOneToOne: false
            referencedRelation: "marketing_criativos"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_campanhas: {
        Row: {
          clinica_id: string
          conversoes: number | null
          created_at: string | null
          data_fim: string | null
          data_inicio: string | null
          gasto_total: number | null
          id: string
          leads_gerados: number | null
          nome: string
          orcamento: number | null
          plataforma: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          clinica_id: string
          conversoes?: number | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          gasto_total?: number | null
          id?: string
          leads_gerados?: number | null
          nome: string
          orcamento?: number | null
          plataforma?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          clinica_id?: string
          conversoes?: number | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          gasto_total?: number | null
          id?: string
          leads_gerados?: number | null
          nome?: string
          orcamento?: number | null
          plataforma?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campanhas_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_criativos: {
        Row: {
          arquivo_url: string | null
          campanha_id: string | null
          clinica_id: string
          created_at: string | null
          descricao: string | null
          id: string
          plataforma: string | null
          status: string | null
          tipo: string | null
          titulo: string | null
        }
        Insert: {
          arquivo_url?: string | null
          campanha_id?: string | null
          clinica_id: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          plataforma?: string | null
          status?: string | null
          tipo?: string | null
          titulo?: string | null
        }
        Update: {
          arquivo_url?: string | null
          campanha_id?: string | null
          clinica_id?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          plataforma?: string | null
          status?: string | null
          tipo?: string | null
          titulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_criativos_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas_marketing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_criativos_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "marketing_campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_criativos_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_gastos: {
        Row: {
          campanha: string | null
          canal: string
          clinica_id: string
          created_at: string
          id: string
          periodo_fim: string
          periodo_inicio: string
          updated_at: string
          valor: number
        }
        Insert: {
          campanha?: string | null
          canal: string
          clinica_id: string
          created_at?: string
          id?: string
          periodo_fim: string
          periodo_inicio: string
          updated_at?: string
          valor: number
        }
        Update: {
          campanha?: string | null
          canal?: string
          clinica_id?: string
          created_at?: string
          id?: string
          periodo_fim?: string
          periodo_inicio?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketing_gastos_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_leads: {
        Row: {
          campanha_id: string | null
          clinica_id: string
          convertido_em: string | null
          created_at: string | null
          email: string | null
          id: string
          nome: string | null
          origem: string | null
          paciente_id: string | null
          status: string | null
          telefone: string | null
        }
        Insert: {
          campanha_id?: string | null
          clinica_id: string
          convertido_em?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          nome?: string | null
          origem?: string | null
          paciente_id?: string | null
          status?: string | null
          telefone?: string | null
        }
        Update: {
          campanha_id?: string | null
          clinica_id?: string
          convertido_em?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          nome?: string | null
          origem?: string | null
          paciente_id?: string | null
          status?: string | null
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_leads_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas_marketing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_leads_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "marketing_campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_leads_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_leads_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      medicos: {
        Row: {
          ativo: boolean
          clinica_id: string
          conselho: string | null
          cpf: string | null
          created_at: string
          crm: string | null
          documento: string | null
          documento_conselho: string | null
          email: string | null
          especialidade: string | null
          especialidades: Json | null
          feegow_id: string | null
          id: string
          idade_maxima: number | null
          idade_minima: number | null
          nome: string
          rqe: string | null
          sexo: string | null
          tratamento: string | null
          uf_conselho: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          clinica_id: string
          conselho?: string | null
          cpf?: string | null
          created_at?: string
          crm?: string | null
          documento?: string | null
          documento_conselho?: string | null
          email?: string | null
          especialidade?: string | null
          especialidades?: Json | null
          feegow_id?: string | null
          id?: string
          idade_maxima?: number | null
          idade_minima?: number | null
          nome: string
          rqe?: string | null
          sexo?: string | null
          tratamento?: string | null
          uf_conselho?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          clinica_id?: string
          conselho?: string | null
          cpf?: string | null
          created_at?: string
          crm?: string | null
          documento?: string | null
          documento_conselho?: string | null
          email?: string | null
          especialidade?: string | null
          especialidades?: Json | null
          feegow_id?: string | null
          id?: string
          idade_maxima?: number | null
          idade_minima?: number | null
          nome?: string
          rqe?: string | null
          sexo?: string | null
          tratamento?: string | null
          uf_conselho?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medicos_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      metas_financeiras: {
        Row: {
          clinica_id: string
          competencia: string
          created_at: string
          id: string
          indicador: string
          meta_valor: number
          observacao: string | null
          realizado_valor: number | null
          unidade: string | null
          updated_at: string
        }
        Insert: {
          clinica_id: string
          competencia: string
          created_at?: string
          id?: string
          indicador: string
          meta_valor?: number
          observacao?: string | null
          realizado_valor?: number | null
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          clinica_id?: string
          competencia?: string
          created_at?: string
          id?: string
          indicador?: string
          meta_valor?: number
          observacao?: string | null
          realizado_valor?: number | null
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "metas_financeiras_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      nps_pesquisas: {
        Row: {
          agendamento_id: string | null
          canal: string | null
          clinica_id: string
          comentario: string | null
          created_at: string | null
          id: string
          nota: number | null
          paciente_id: string | null
          respondido_em: string | null
        }
        Insert: {
          agendamento_id?: string | null
          canal?: string | null
          clinica_id: string
          comentario?: string | null
          created_at?: string | null
          id?: string
          nota?: number | null
          paciente_id?: string | null
          respondido_em?: string | null
        }
        Update: {
          agendamento_id?: string | null
          canal?: string | null
          clinica_id?: string
          comentario?: string | null
          created_at?: string | null
          id?: string
          nota?: number | null
          paciente_id?: string | null
          respondido_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nps_pesquisas_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_pesquisas_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      nps_respostas: {
        Row: {
          canal: string | null
          clinica_id: string
          comentario: string | null
          created_at: string | null
          id: string
          medico_id: string | null
          nota: number | null
          paciente_id: string | null
        }
        Insert: {
          canal?: string | null
          clinica_id: string
          comentario?: string | null
          created_at?: string | null
          id?: string
          medico_id?: string | null
          nota?: number | null
          paciente_id?: string | null
        }
        Update: {
          canal?: string | null
          clinica_id?: string
          comentario?: string | null
          created_at?: string | null
          id?: string
          medico_id?: string | null
          nota?: number | null
          paciente_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nps_respostas_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_respostas_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_respostas_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      operacao_producao: {
        Row: {
          clinica_id: string
          created_at: string
          data_competencia: string
          desconto: number
          especialidade: string | null
          feegow_agendamento_id: string | null
          feegow_refs: Json | null
          forma_pagamento_original: string | null
          id: string
          medico_id: string | null
          paciente_id: string | null
          procedimento_id: string | null
          procedimento_nome: string | null
          status_presenca: Database["public"]["Enums"]["status_presenca_op"]
          tipo: Database["public"]["Enums"]["tipo_operacao"]
          valor_bruto: number
          valor_liquido: number
        }
        Insert: {
          clinica_id: string
          created_at?: string
          data_competencia: string
          desconto?: number
          especialidade?: string | null
          feegow_agendamento_id?: string | null
          feegow_refs?: Json | null
          forma_pagamento_original?: string | null
          id?: string
          medico_id?: string | null
          paciente_id?: string | null
          procedimento_id?: string | null
          procedimento_nome?: string | null
          status_presenca?: Database["public"]["Enums"]["status_presenca_op"]
          tipo?: Database["public"]["Enums"]["tipo_operacao"]
          valor_bruto?: number
          valor_liquido?: number
        }
        Update: {
          clinica_id?: string
          created_at?: string
          data_competencia?: string
          desconto?: number
          especialidade?: string | null
          feegow_agendamento_id?: string | null
          feegow_refs?: Json | null
          forma_pagamento_original?: string | null
          id?: string
          medico_id?: string | null
          paciente_id?: string | null
          procedimento_id?: string | null
          procedimento_nome?: string | null
          status_presenca?: Database["public"]["Enums"]["status_presenca_op"]
          tipo?: Database["public"]["Enums"]["tipo_operacao"]
          valor_bruto?: number
          valor_liquido?: number
        }
        Relationships: [
          {
            foreignKeyName: "operacao_producao_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operacao_producao_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
        ]
      }
      pacientes: {
        Row: {
          bairro: string | null
          carteirinha: string | null
          celular: string | null
          cep: string | null
          cidade: string | null
          clinica_id: string
          complemento: string | null
          convenio_id: string | null
          cpf: string | null
          created_at: string
          data_cadastro: string | null
          data_nascimento: string | null
          data_retencao: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          feegow_alterado_em: string | null
          feegow_criado_em: string | null
          feegow_id: string | null
          id: string
          indicado_por: string | null
          nome: string
          nome_social: string | null
          numero: string | null
          observacoes: string | null
          plano: string | null
          primeira_consulta: string | null
          profissao: string | null
          rg: string | null
          sexo: string | null
          status: string | null
          telefone: string | null
          titular: string | null
          updated_at: string
          validade_carteirinha: string | null
        }
        Insert: {
          bairro?: string | null
          carteirinha?: string | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          clinica_id: string
          complemento?: string | null
          convenio_id?: string | null
          cpf?: string | null
          created_at?: string
          data_cadastro?: string | null
          data_nascimento?: string | null
          data_retencao?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          feegow_alterado_em?: string | null
          feegow_criado_em?: string | null
          feegow_id?: string | null
          id?: string
          indicado_por?: string | null
          nome: string
          nome_social?: string | null
          numero?: string | null
          observacoes?: string | null
          plano?: string | null
          primeira_consulta?: string | null
          profissao?: string | null
          rg?: string | null
          sexo?: string | null
          status?: string | null
          telefone?: string | null
          titular?: string | null
          updated_at?: string
          validade_carteirinha?: string | null
        }
        Update: {
          bairro?: string | null
          carteirinha?: string | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          clinica_id?: string
          complemento?: string | null
          convenio_id?: string | null
          cpf?: string | null
          created_at?: string
          data_cadastro?: string | null
          data_nascimento?: string | null
          data_retencao?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          feegow_alterado_em?: string | null
          feegow_criado_em?: string | null
          feegow_id?: string | null
          id?: string
          indicado_por?: string | null
          nome?: string
          nome_social?: string | null
          numero?: string | null
          observacoes?: string | null
          plano?: string | null
          primeira_consulta?: string | null
          profissao?: string | null
          rg?: string | null
          sexo?: string | null
          status?: string | null
          telefone?: string | null
          titular?: string | null
          updated_at?: string
          validade_carteirinha?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pacientes_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pacientes_convenio_id_fkey"
            columns: ["convenio_id"]
            isOneToOne: false
            referencedRelation: "convenios"
            referencedColumns: ["id"]
          },
        ]
      }
      pagadores: {
        Row: {
          ativo: boolean
          cf_alocado_pct: number | null
          cf_alocado_valor: number | null
          clinica_id: string
          codigo_feegow: string | null
          comissao_faturista_pct: number | null
          created_at: string
          id: string
          nome: string
          tipo: Database["public"]["Enums"]["tipo_pagador"]
          updated_at: string
          usa_comissao_faturista: boolean
          usa_taxa_cartao: boolean
        }
        Insert: {
          ativo?: boolean
          cf_alocado_pct?: number | null
          cf_alocado_valor?: number | null
          clinica_id: string
          codigo_feegow?: string | null
          comissao_faturista_pct?: number | null
          created_at?: string
          id?: string
          nome: string
          tipo?: Database["public"]["Enums"]["tipo_pagador"]
          updated_at?: string
          usa_comissao_faturista?: boolean
          usa_taxa_cartao?: boolean
        }
        Update: {
          ativo?: boolean
          cf_alocado_pct?: number | null
          cf_alocado_valor?: number | null
          clinica_id?: string
          codigo_feegow?: string | null
          comissao_faturista_pct?: number | null
          created_at?: string
          id?: string
          nome?: string
          tipo?: Database["public"]["Enums"]["tipo_pagador"]
          updated_at?: string
          usa_comissao_faturista?: boolean
          usa_taxa_cartao?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pagadores_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      parametros_financeiros: {
        Row: {
          chave: string
          clinica_id: string
          created_at: string
          descricao: string | null
          id: string
          updated_at: string
          valor: string
        }
        Insert: {
          chave: string
          clinica_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          updated_at?: string
          valor: string
        }
        Update: {
          chave?: string
          clinica_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          updated_at?: string
          valor?: string
        }
        Relationships: [
          {
            foreignKeyName: "parametros_financeiros_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      permissoes_modulo: {
        Row: {
          clinica_id: string
          created_at: string
          id: string
          modulo: string
          pode_editar: boolean
          pode_visualizar: boolean
          user_id: string
        }
        Insert: {
          clinica_id: string
          created_at?: string
          id?: string
          modulo: string
          pode_editar?: boolean
          pode_visualizar?: boolean
          user_id: string
        }
        Update: {
          clinica_id?: string
          created_at?: string
          id?: string
          modulo?: string
          pode_editar?: boolean
          pode_visualizar?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permissoes_modulo_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoas: {
        Row: {
          ativo: boolean | null
          clinica_id: string
          cpf_cnpj: string | null
          created_at: string | null
          email: string | null
          endereco: string | null
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          tipo: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          clinica_id: string
          cpf_cnpj?: string | null
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
          tipo?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          clinica_id?: string
          cpf_cnpj?: string | null
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          tipo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pessoas_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_contas: {
        Row: {
          ativo: boolean
          categoria: string
          clinica_id: string
          codigo: number
          codigo_estruturado: string
          created_at: string
          descricao: string
          id: string
          indicador: Database["public"]["Enums"]["indicador_plano"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria: string
          clinica_id: string
          codigo: number
          codigo_estruturado: string
          created_at?: string
          descricao: string
          id?: string
          indicador?: Database["public"]["Enums"]["indicador_plano"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          clinica_id?: string
          codigo?: number
          codigo_estruturado?: string
          created_at?: string
          descricao?: string
          id?: string
          indicador?: Database["public"]["Enums"]["indicador_plano"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plano_contas_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      playbooks: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          clinica_id: string
          conteudo_markdown: string | null
          created_at: string | null
          descricao: string | null
          id: string
          ordem: number | null
          titulo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          clinica_id: string
          conteudo_markdown?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          ordem?: number | null
          titulo: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          clinica_id?: string
          conteudo_markdown?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          ordem?: number | null
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playbooks_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      prazos_recebimento: {
        Row: {
          clinica_id: string
          created_at: string
          descricao: string | null
          id: string
          prazo_dias: number
          referencia: string
          tipo: string
          updated_at: string
        }
        Insert: {
          clinica_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          prazo_dias?: number
          referencia: string
          tipo: string
          updated_at?: string
        }
        Update: {
          clinica_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          prazo_dias?: number
          referencia?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prazos_recebimento_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      precos_procedimento: {
        Row: {
          clinica_id: string
          created_at: string
          custo_variavel: number | null
          desconto_pct: number | null
          id: string
          observacao: string | null
          origem: Database["public"]["Enums"]["origem_preco"]
          pagador_id: string
          preco_bruto: number
          procedimento_id: string
          repasse_medico: number | null
          repasse_medico_pct: number | null
          status: Database["public"]["Enums"]["status_preco"]
          vigente_ate: string | null
          vigente_de: string
        }
        Insert: {
          clinica_id: string
          created_at?: string
          custo_variavel?: number | null
          desconto_pct?: number | null
          id?: string
          observacao?: string | null
          origem?: Database["public"]["Enums"]["origem_preco"]
          pagador_id: string
          preco_bruto: number
          procedimento_id: string
          repasse_medico?: number | null
          repasse_medico_pct?: number | null
          status?: Database["public"]["Enums"]["status_preco"]
          vigente_ate?: string | null
          vigente_de: string
        }
        Update: {
          clinica_id?: string
          created_at?: string
          custo_variavel?: number | null
          desconto_pct?: number | null
          id?: string
          observacao?: string | null
          origem?: Database["public"]["Enums"]["origem_preco"]
          pagador_id?: string
          preco_bruto?: number
          procedimento_id?: string
          repasse_medico?: number | null
          repasse_medico_pct?: number | null
          status?: Database["public"]["Enums"]["status_preco"]
          vigente_ate?: string | null
          vigente_de?: string
        }
        Relationships: [
          {
            foreignKeyName: "precos_procedimento_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precos_procedimento_pagador_id_fkey"
            columns: ["pagador_id"]
            isOneToOne: false
            referencedRelation: "pagadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precos_procedimento_procedimento_id_fkey"
            columns: ["procedimento_id"]
            isOneToOne: false
            referencedRelation: "procedimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      precos_rascunho: {
        Row: {
          clinica_id: string
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          nome_cenario: string
          status: Database["public"]["Enums"]["status_rascunho"]
          updated_at: string
        }
        Insert: {
          clinica_id: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome_cenario: string
          status?: Database["public"]["Enums"]["status_rascunho"]
          updated_at?: string
        }
        Update: {
          clinica_id?: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome_cenario?: string
          status?: Database["public"]["Enums"]["status_rascunho"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "precos_rascunho_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      precos_rascunho_itens: {
        Row: {
          clinica_id: string
          created_at: string
          feegow_response: Json | null
          id: string
          novo_preco_bruto: number
          novo_repasse: number | null
          observacao: string | null
          pagador_id: string
          procedimento_id: string
          rascunho_id: string
          status_sync_feegow: Database["public"]["Enums"]["status_sync_feegow"]
          vigente_de: string
        }
        Insert: {
          clinica_id: string
          created_at?: string
          feegow_response?: Json | null
          id?: string
          novo_preco_bruto: number
          novo_repasse?: number | null
          observacao?: string | null
          pagador_id: string
          procedimento_id: string
          rascunho_id: string
          status_sync_feegow?: Database["public"]["Enums"]["status_sync_feegow"]
          vigente_de: string
        }
        Update: {
          clinica_id?: string
          created_at?: string
          feegow_response?: Json | null
          id?: string
          novo_preco_bruto?: number
          novo_repasse?: number | null
          observacao?: string | null
          pagador_id?: string
          procedimento_id?: string
          rascunho_id?: string
          status_sync_feegow?: Database["public"]["Enums"]["status_sync_feegow"]
          vigente_de?: string
        }
        Relationships: [
          {
            foreignKeyName: "precos_rascunho_itens_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precos_rascunho_itens_pagador_id_fkey"
            columns: ["pagador_id"]
            isOneToOne: false
            referencedRelation: "pagadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precos_rascunho_itens_procedimento_id_fkey"
            columns: ["procedimento_id"]
            isOneToOne: false
            referencedRelation: "procedimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precos_rascunho_itens_rascunho_id_fkey"
            columns: ["rascunho_id"]
            isOneToOne: false
            referencedRelation: "precos_rascunho"
            referencedColumns: ["id"]
          },
        ]
      }
      premissas_precificacao: {
        Row: {
          aliquota_lp_pct: number
          cf_total_mensal: number
          clinica_id: string
          comissao_faturista_pct: number
          created_at: string
          id: string
          meta_lucro_conservador: number
          meta_lucro_excelente: number
          meta_lucro_ideal: number
          meta_lucro_saudavel: number
          meta_lucro_sobrevivencia: number
          taxa_cartao_pct: number
          updated_at: string
        }
        Insert: {
          aliquota_lp_pct?: number
          cf_total_mensal?: number
          clinica_id: string
          comissao_faturista_pct?: number
          created_at?: string
          id?: string
          meta_lucro_conservador?: number
          meta_lucro_excelente?: number
          meta_lucro_ideal?: number
          meta_lucro_saudavel?: number
          meta_lucro_sobrevivencia?: number
          taxa_cartao_pct?: number
          updated_at?: string
        }
        Update: {
          aliquota_lp_pct?: number
          cf_total_mensal?: number
          clinica_id?: string
          comissao_faturista_pct?: number
          created_at?: string
          id?: string
          meta_lucro_conservador?: number
          meta_lucro_excelente?: number
          meta_lucro_ideal?: number
          meta_lucro_saudavel?: number
          meta_lucro_sobrevivencia?: number
          taxa_cartao_pct?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "premissas_precificacao_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: true
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      prescricoes: {
        Row: {
          agendamento_id: string | null
          clinica_id: string
          created_at: string | null
          id: string
          itens: Json | null
          medico_id: string | null
          observacoes: string | null
          paciente_id: string | null
          status: string | null
        }
        Insert: {
          agendamento_id?: string | null
          clinica_id: string
          created_at?: string | null
          id?: string
          itens?: Json | null
          medico_id?: string | null
          observacoes?: string | null
          paciente_id?: string | null
          status?: string | null
        }
        Update: {
          agendamento_id?: string | null
          clinica_id?: string
          created_at?: string | null
          id?: string
          itens?: Json | null
          medico_id?: string | null
          observacoes?: string | null
          paciente_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescricoes_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescricoes_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescricoes_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescricoes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      procedimentos: {
        Row: {
          ativo: boolean
          clinica_id: string
          codigo_feegow: string | null
          codigo_tiss: string | null
          created_at: string
          especialidade: string | null
          especialidade_ids: Json | null
          feegow_id: string | null
          id: string
          nome: string
          tempo_minutos: number | null
          tipo: Database["public"]["Enums"]["tipo_procedimento"]
          tipo_procedimento: string | null
          updated_at: string
          valor_particular: number | null
        }
        Insert: {
          ativo?: boolean
          clinica_id: string
          codigo_feegow?: string | null
          codigo_tiss?: string | null
          created_at?: string
          especialidade?: string | null
          especialidade_ids?: Json | null
          feegow_id?: string | null
          id?: string
          nome: string
          tempo_minutos?: number | null
          tipo?: Database["public"]["Enums"]["tipo_procedimento"]
          tipo_procedimento?: string | null
          updated_at?: string
          valor_particular?: number | null
        }
        Update: {
          ativo?: boolean
          clinica_id?: string
          codigo_feegow?: string | null
          codigo_tiss?: string | null
          created_at?: string
          especialidade?: string | null
          especialidade_ids?: Json | null
          feegow_id?: string | null
          id?: string
          nome?: string
          tempo_minutos?: number | null
          tipo?: Database["public"]["Enums"]["tipo_procedimento"]
          tipo_procedimento?: string | null
          updated_at?: string
          valor_particular?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "procedimentos_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_cache: {
        Row: {
          clinica_id: string
          created_at: string | null
          expires_at: string | null
          id: string
          query_hash: string
          resposta: string | null
        }
        Insert: {
          clinica_id: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          query_hash: string
          resposta?: string | null
        }
        Update: {
          clinica_id?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          query_hash?: string
          resposta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rag_cache_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_chunks: {
        Row: {
          clinica_id: string
          conteudo: string
          created_at: string | null
          embedding: string | null
          id: string
          knowledge_base_id: string | null
          metadata: Json | null
        }
        Insert: {
          clinica_id: string
          conteudo: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          knowledge_base_id?: string | null
          metadata?: Json | null
        }
        Update: {
          clinica_id?: string
          conteudo?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          knowledge_base_id?: string | null
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "rag_chunks_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rag_chunks_knowledge_base_id_fkey"
            columns: ["knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "rag_knowledge_bases"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_conversations: {
        Row: {
          clinica_id: string
          created_at: string | null
          id: string
          mensagens: Json | null
          titulo: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          clinica_id: string
          created_at?: string | null
          id?: string
          mensagens?: Json | null
          titulo?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          clinica_id?: string
          created_at?: string | null
          id?: string
          mensagens?: Json | null
          titulo?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rag_conversations_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_knowledge_bases: {
        Row: {
          ativo: boolean | null
          clinica_id: string
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          tipo: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          clinica_id: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          tipo?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          clinica_id?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          tipo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rag_knowledge_bases_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      receita_canal_mensal: {
        Row: {
          ano: number
          canal: string
          clinica_id: string
          created_at: string
          id: string
          mes: number
          valor: number
        }
        Insert: {
          ano: number
          canal: string
          clinica_id: string
          created_at?: string
          id?: string
          mes: number
          valor?: number
        }
        Update: {
          ano?: number
          canal?: string
          clinica_id?: string
          created_at?: string
          id?: string
          mes?: number
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "receita_canal_mensal_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      recibos: {
        Row: {
          agendamento_id: string | null
          assinatura_url: string | null
          clinica_id: string
          conteudo_editavel: string | null
          created_at: string | null
          data_emissao: string | null
          descricao: string | null
          id: string
          medico_id: string | null
          numero: string | null
          paciente_id: string | null
          status: string | null
          tipo: string | null
          valor: number
        }
        Insert: {
          agendamento_id?: string | null
          assinatura_url?: string | null
          clinica_id: string
          conteudo_editavel?: string | null
          created_at?: string | null
          data_emissao?: string | null
          descricao?: string | null
          id?: string
          medico_id?: string | null
          numero?: string | null
          paciente_id?: string | null
          status?: string | null
          tipo?: string | null
          valor?: number
        }
        Update: {
          agendamento_id?: string | null
          assinatura_url?: string | null
          clinica_id?: string
          conteudo_editavel?: string | null
          created_at?: string | null
          data_emissao?: string | null
          descricao?: string | null
          id?: string
          medico_id?: string | null
          numero?: string | null
          paciente_id?: string | null
          status?: string | null
          tipo?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "recibos_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recibos_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recibos_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recibos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      registros_ponto: {
        Row: {
          clinica_id: string
          created_at: string | null
          data: string
          entrada: string | null
          funcionario_id: string | null
          horas_trabalhadas: number | null
          id: string
          observacao: string | null
          saida: string | null
        }
        Insert: {
          clinica_id: string
          created_at?: string | null
          data: string
          entrada?: string | null
          funcionario_id?: string | null
          horas_trabalhadas?: number | null
          id?: string
          observacao?: string | null
          saida?: string | null
        }
        Update: {
          clinica_id?: string
          created_at?: string | null
          data?: string
          entrada?: string | null
          funcionario_id?: string | null
          horas_trabalhadas?: number | null
          id?: string
          observacao?: string | null
          saida?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registros_ponto_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_ponto_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      regras_conciliacao_debito: {
        Row: {
          ativo: boolean
          clinica_id: string
          created_at: string
          descricao_regex: string
          destino_id: string | null
          id: string
          imposto: Database["public"]["Enums"]["tipo_imposto"] | null
          janela_dias: number
          prioridade: number
          tipo_destino: Database["public"]["Enums"]["tipo_destino_regra"]
          tolerancia_abs: number
          tolerancia_pct: number
        }
        Insert: {
          ativo?: boolean
          clinica_id: string
          created_at?: string
          descricao_regex: string
          destino_id?: string | null
          id?: string
          imposto?: Database["public"]["Enums"]["tipo_imposto"] | null
          janela_dias?: number
          prioridade?: number
          tipo_destino: Database["public"]["Enums"]["tipo_destino_regra"]
          tolerancia_abs?: number
          tolerancia_pct?: number
        }
        Update: {
          ativo?: boolean
          clinica_id?: string
          created_at?: string
          descricao_regex?: string
          destino_id?: string | null
          id?: string
          imposto?: Database["public"]["Enums"]["tipo_imposto"] | null
          janela_dias?: number
          prioridade?: number
          tipo_destino?: Database["public"]["Enums"]["tipo_destino_regra"]
          tolerancia_abs?: number
          tolerancia_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "regras_conciliacao_debito_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      resultados_exames: {
        Row: {
          arquivo_url: string | null
          clinica_id: string
          created_at: string | null
          data_exame: string | null
          id: string
          medico_id: string | null
          observacoes: string | null
          paciente_id: string | null
          resultado: string | null
          tipo_exame: string | null
        }
        Insert: {
          arquivo_url?: string | null
          clinica_id: string
          created_at?: string | null
          data_exame?: string | null
          id?: string
          medico_id?: string | null
          observacoes?: string | null
          paciente_id?: string | null
          resultado?: string | null
          tipo_exame?: string | null
        }
        Update: {
          arquivo_url?: string | null
          clinica_id?: string
          created_at?: string | null
          data_exame?: string | null
          id?: string
          medico_id?: string | null
          observacoes?: string | null
          paciente_id?: string | null
          resultado?: string | null
          tipo_exame?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resultados_exames_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resultados_exames_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resultados_exames_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_departamentos: {
        Row: {
          clinica_id: string
          created_at: string
          descricao: string | null
          id: string
          nome: string
          responsavel_id: string | null
        }
        Insert: {
          clinica_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          responsavel_id?: string | null
        }
        Update: {
          clinica_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          responsavel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rh_departamentos_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_departamentos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_desligamentos: {
        Row: {
          causa: string | null
          clinica_id: string
          colaborador_id: string
          created_at: string
          custo: number | null
          data_desligamento: string
          decisao: string | null
          id: string
          motivo: string | null
          observacoes: string | null
        }
        Insert: {
          causa?: string | null
          clinica_id: string
          colaborador_id: string
          created_at?: string
          custo?: number | null
          data_desligamento: string
          decisao?: string | null
          id?: string
          motivo?: string | null
          observacoes?: string | null
        }
        Update: {
          causa?: string | null
          clinica_id?: string
          colaborador_id?: string
          created_at?: string
          custo?: number | null
          data_desligamento?: string
          decisao?: string | null
          id?: string
          motivo?: string | null
          observacoes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rh_desligamentos_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_desligamentos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_escalas: {
        Row: {
          clinica_id: string
          colaborador_id: string
          created_at: string
          dia_semana: number
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          turno: string
        }
        Insert: {
          clinica_id: string
          colaborador_id: string
          created_at?: string
          dia_semana: number
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          turno?: string
        }
        Update: {
          clinica_id?: string
          colaborador_id?: string
          created_at?: string
          dia_semana?: number
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          turno?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_escalas_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_escalas_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_feedbacks: {
        Row: {
          clinica_id: string
          created_at: string
          destinatario_id: string
          id: string
          mensagem: string
          remetente_id: string
          tipo: string
        }
        Insert: {
          clinica_id: string
          created_at?: string
          destinatario_id: string
          id?: string
          mensagem: string
          remetente_id: string
          tipo?: string
        }
        Update: {
          clinica_id?: string
          created_at?: string
          destinatario_id?: string
          id?: string
          mensagem?: string
          remetente_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_feedbacks_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_feedbacks_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_feedbacks_remetente_id_fkey"
            columns: ["remetente_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_ferias: {
        Row: {
          aprovado_por: string | null
          clinica_id: string
          colaborador_id: string
          created_at: string
          data_fim: string
          data_inicio: string
          dias_total: number
          id: string
          notas: string | null
          status: string
          updated_at: string
        }
        Insert: {
          aprovado_por?: string | null
          clinica_id: string
          colaborador_id: string
          created_at?: string
          data_fim: string
          data_inicio: string
          dias_total?: number
          id?: string
          notas?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          aprovado_por?: string | null
          clinica_id?: string
          colaborador_id?: string
          created_at?: string
          data_fim?: string
          data_inicio?: string
          dias_total?: number
          id?: string
          notas?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_ferias_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_ferias_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_ferias_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      salas: {
        Row: {
          ativo: boolean
          capacidade: number | null
          clinica_id: string
          created_at: string
          feegow_id: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          capacidade?: number | null
          clinica_id: string
          created_at?: string
          feegow_id?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          capacidade?: number | null
          clinica_id?: string
          created_at?: string
          feegow_id?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salas_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      salas_consultorios: {
        Row: {
          andar: string | null
          ativo: boolean | null
          clinica_id: string
          created_at: string | null
          equipamentos: Json | null
          id: string
          nome: string
          tipo: string | null
          updated_at: string | null
        }
        Insert: {
          andar?: string | null
          ativo?: boolean | null
          clinica_id: string
          created_at?: string | null
          equipamentos?: Json | null
          id?: string
          nome: string
          tipo?: string | null
          updated_at?: string | null
        }
        Update: {
          andar?: string | null
          ativo?: boolean | null
          clinica_id?: string
          created_at?: string | null
          equipamentos?: Json | null
          id?: string
          nome?: string
          tipo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salas_consultorios_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_log: {
        Row: {
          clinica_id: string
          detalhes: string | null
          erros: Json | null
          fim: string | null
          id: string
          inicio: string
          integracao_tipo: string
          registros_processados: number | null
          status: Database["public"]["Enums"]["status_sync"]
        }
        Insert: {
          clinica_id: string
          detalhes?: string | null
          erros?: Json | null
          fim?: string | null
          id?: string
          inicio?: string
          integracao_tipo: string
          registros_processados?: number | null
          status?: Database["public"]["Enums"]["status_sync"]
        }
        Update: {
          clinica_id?: string
          detalhes?: string | null
          erros?: Json | null
          fim?: string | null
          id?: string
          inicio?: string
          integracao_tipo?: string
          registros_processados?: number | null
          status?: Database["public"]["Enums"]["status_sync"]
        }
        Relationships: [
          {
            foreignKeyName: "sync_log_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      taxas_config: {
        Row: {
          ativo: boolean
          base_calculo: string
          clinica_id: string
          codigo: string
          created_at: string
          id: string
          nome: string
          percentual: number
          tipo: string
          vigente_ate: string | null
          vigente_de: string
        }
        Insert: {
          ativo?: boolean
          base_calculo: string
          clinica_id: string
          codigo: string
          created_at?: string
          id?: string
          nome: string
          percentual: number
          tipo: string
          vigente_ate?: string | null
          vigente_de: string
        }
        Update: {
          ativo?: boolean
          base_calculo?: string
          clinica_id?: string
          codigo?: string
          created_at?: string
          id?: string
          nome?: string
          percentual?: number
          tipo?: string
          vigente_ate?: string | null
          vigente_de?: string
        }
        Relationships: [
          {
            foreignKeyName: "taxas_config_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_paciente: {
        Row: {
          clinica_id: string
          created_at: string | null
          descricao: string | null
          id: string
          metadata: Json | null
          paciente_id: string
          referencia_id: string | null
          tipo: string
          titulo: string | null
        }
        Insert: {
          clinica_id: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          metadata?: Json | null
          paciente_id: string
          referencia_id?: string | null
          tipo: string
          titulo?: string | null
        }
        Update: {
          clinica_id?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          metadata?: Json | null
          paciente_id?: string
          referencia_id?: string | null
          tipo?: string
          titulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timeline_paciente_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_paciente_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      transacoes_bancarias: {
        Row: {
          banco: string | null
          categoria_auto: string | null
          clinica_id: string
          conciliacao_id: string | null
          conta: string | null
          conta_bancaria_id: string | null
          created_at: string
          data_transacao: string
          descricao: string | null
          fitid: string
          id: string
          status: string
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          banco?: string | null
          categoria_auto?: string | null
          clinica_id: string
          conciliacao_id?: string | null
          conta?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          data_transacao: string
          descricao?: string | null
          fitid: string
          id?: string
          status?: string
          tipo: string
          updated_at?: string
          valor?: number
        }
        Update: {
          banco?: string | null
          categoria_auto?: string | null
          clinica_id?: string
          conciliacao_id?: string | null
          conta?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          data_transacao?: string
          descricao?: string | null
          fitid?: string
          id?: string
          status?: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "transacoes_bancarias_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_bancarias_conciliacao_id_fkey"
            columns: ["conciliacao_id"]
            isOneToOne: false
            referencedRelation: "conciliacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_bancarias_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
        ]
      }
      transacoes_recebimentos: {
        Row: {
          autorizacao: string | null
          bandeira: string | null
          clinica_id: string
          created_at: string
          data_liquidacao: string | null
          data_recebimento: string
          forma_pagamento: string | null
          getnet_id: string | null
          id: string
          nsu: string | null
          observacao: string | null
          origem: string
          parcelas: number | null
          referencia_externa: string | null
          taxa: number | null
          tid: string | null
          transacao_bancaria_id: string | null
          updated_at: string
          valor: number
          valor_liquido: number | null
          venda_id: string | null
        }
        Insert: {
          autorizacao?: string | null
          bandeira?: string | null
          clinica_id: string
          created_at?: string
          data_liquidacao?: string | null
          data_recebimento: string
          forma_pagamento?: string | null
          getnet_id?: string | null
          id?: string
          nsu?: string | null
          observacao?: string | null
          origem?: string
          parcelas?: number | null
          referencia_externa?: string | null
          taxa?: number | null
          tid?: string | null
          transacao_bancaria_id?: string | null
          updated_at?: string
          valor: number
          valor_liquido?: number | null
          venda_id?: string | null
        }
        Update: {
          autorizacao?: string | null
          bandeira?: string | null
          clinica_id?: string
          created_at?: string
          data_liquidacao?: string | null
          data_recebimento?: string
          forma_pagamento?: string | null
          getnet_id?: string | null
          id?: string
          nsu?: string | null
          observacao?: string | null
          origem?: string
          parcelas?: number | null
          referencia_externa?: string | null
          taxa?: number | null
          tid?: string | null
          transacao_bancaria_id?: string | null
          updated_at?: string
          valor?: number
          valor_liquido?: number | null
          venda_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transacoes_recebimentos_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_recebimentos_transacao_bancaria_id_fkey"
            columns: ["transacao_bancaria_id"]
            isOneToOne: false
            referencedRelation: "transacoes_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_recebimentos_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "transacoes_vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      transacoes_vendas: {
        Row: {
          banco_referencia: string | null
          canal_pagamento: Database["public"]["Enums"]["canal_pagamento"] | null
          clinica_id: string
          convenio_id: string | null
          created_at: string
          custo_direto_csv: number
          data_caixa: string | null
          data_competencia: string
          data_prevista_recebimento: string | null
          desconto: number
          descricao: string | null
          especialidade: string | null
          feegow_id: string | null
          forma_pagamento: string | null
          forma_pagamento_enum:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id: string
          impostos_taxas: number
          invoice_id: string | null
          linha_receita: Database["public"]["Enums"]["linha_receita"] | null
          medico_id: string | null
          observacao: string | null
          origem: string | null
          paciente_id: string | null
          parcela_atual: number | null
          parcelas: number | null
          procedimento: string | null
          quantidade: number
          sala_id: string | null
          status_conciliacao: Database["public"]["Enums"]["status_conciliacao"]
          status_presenca: Database["public"]["Enums"]["status_presenca"] | null
          status_recebimento: Database["public"]["Enums"]["status_recebimento"]
          updated_at: string
          valor_bruto: number
          valor_liquido: number | null
          valor_pago: number | null
        }
        Insert: {
          banco_referencia?: string | null
          canal_pagamento?:
            | Database["public"]["Enums"]["canal_pagamento"]
            | null
          clinica_id: string
          convenio_id?: string | null
          created_at?: string
          custo_direto_csv?: number
          data_caixa?: string | null
          data_competencia: string
          data_prevista_recebimento?: string | null
          desconto?: number
          descricao?: string | null
          especialidade?: string | null
          feegow_id?: string | null
          forma_pagamento?: string | null
          forma_pagamento_enum?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          impostos_taxas?: number
          invoice_id?: string | null
          linha_receita?: Database["public"]["Enums"]["linha_receita"] | null
          medico_id?: string | null
          observacao?: string | null
          origem?: string | null
          paciente_id?: string | null
          parcela_atual?: number | null
          parcelas?: number | null
          procedimento?: string | null
          quantidade?: number
          sala_id?: string | null
          status_conciliacao?: Database["public"]["Enums"]["status_conciliacao"]
          status_presenca?:
            | Database["public"]["Enums"]["status_presenca"]
            | null
          status_recebimento?: Database["public"]["Enums"]["status_recebimento"]
          updated_at?: string
          valor_bruto?: number
          valor_liquido?: number | null
          valor_pago?: number | null
        }
        Update: {
          banco_referencia?: string | null
          canal_pagamento?:
            | Database["public"]["Enums"]["canal_pagamento"]
            | null
          clinica_id?: string
          convenio_id?: string | null
          created_at?: string
          custo_direto_csv?: number
          data_caixa?: string | null
          data_competencia?: string
          data_prevista_recebimento?: string | null
          desconto?: number
          descricao?: string | null
          especialidade?: string | null
          feegow_id?: string | null
          forma_pagamento?: string | null
          forma_pagamento_enum?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          impostos_taxas?: number
          invoice_id?: string | null
          linha_receita?: Database["public"]["Enums"]["linha_receita"] | null
          medico_id?: string | null
          observacao?: string | null
          origem?: string | null
          paciente_id?: string | null
          parcela_atual?: number | null
          parcelas?: number | null
          procedimento?: string | null
          quantidade?: number
          sala_id?: string | null
          status_conciliacao?: Database["public"]["Enums"]["status_conciliacao"]
          status_presenca?:
            | Database["public"]["Enums"]["status_presenca"]
            | null
          status_recebimento?: Database["public"]["Enums"]["status_recebimento"]
          updated_at?: string
          valor_bruto?: number
          valor_liquido?: number | null
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transacoes_vendas_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_vendas_convenio_id_fkey"
            columns: ["convenio_id"]
            isOneToOne: false
            referencedRelation: "convenios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_vendas_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_vendas_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_vendas_sala_id_fkey"
            columns: ["sala_id"]
            isOneToOne: false
            referencedRelation: "salas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          avatar_url: string | null
          clinica_id: string
          created_at: string
          email: string | null
          id: string
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          clinica_id: string
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          clinica_id?: string
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios_permissoes: {
        Row: {
          created_at: string | null
          id: string
          modulo: string
          pode_editar: boolean | null
          pode_excluir: boolean | null
          pode_ver: boolean | null
          usuario_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          modulo: string
          pode_editar?: boolean | null
          pode_excluir?: boolean | null
          pode_ver?: boolean | null
          usuario_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          modulo?: string
          pode_editar?: boolean | null
          pode_excluir?: boolean | null
          pode_ver?: boolean | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_permissoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["user_id"]
          },
        ]
      }
      vendas_itens: {
        Row: {
          clinica_id: string
          convenio: string | null
          created_at: string
          data_competencia: string
          desconto_item: number
          especialidade: string | null
          feegow_invoice_id: string
          feegow_item_id: string
          id: string
          medico_id: string | null
          procedimento_id: string | null
          procedimento_nome: string | null
          quantidade: number
          tipo: string | null
          valor_bruto_item: number
          valor_liquido_item: number
        }
        Insert: {
          clinica_id: string
          convenio?: string | null
          created_at?: string
          data_competencia: string
          desconto_item?: number
          especialidade?: string | null
          feegow_invoice_id: string
          feegow_item_id: string
          id?: string
          medico_id?: string | null
          procedimento_id?: string | null
          procedimento_nome?: string | null
          quantidade?: number
          tipo?: string | null
          valor_bruto_item?: number
          valor_liquido_item?: number
        }
        Update: {
          clinica_id?: string
          convenio?: string | null
          created_at?: string
          data_competencia?: string
          desconto_item?: number
          especialidade?: string | null
          feegow_invoice_id?: string
          feegow_item_id?: string
          id?: string
          medico_id?: string | null
          procedimento_id?: string | null
          procedimento_nome?: string | null
          quantidade?: number
          tipo?: string | null
          valor_bruto_item?: number
          valor_liquido_item?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendas_itens_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_itens_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas_pagamentos: {
        Row: {
          bandeira: string | null
          clinica_id: string
          created_at: string
          data_pagamento: string | null
          feegow_invoice_id: string
          feegow_payment_id: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          forma_pagamento_feegow_id: number | null
          id: string
          nsu_tid_autorizacao: string | null
          parcelas: number | null
          valor_pago: number
        }
        Insert: {
          bandeira?: string | null
          clinica_id: string
          created_at?: string
          data_pagamento?: string | null
          feegow_invoice_id: string
          feegow_payment_id?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          forma_pagamento_feegow_id?: number | null
          id?: string
          nsu_tid_autorizacao?: string | null
          parcelas?: number | null
          valor_pago?: number
        }
        Update: {
          bandeira?: string | null
          clinica_id?: string
          created_at?: string
          data_pagamento?: string | null
          feegow_invoice_id?: string
          feegow_payment_id?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          forma_pagamento_feegow_id?: number | null
          id?: string
          nsu_tid_autorizacao?: string | null
          parcelas?: number | null
          valor_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendas_pagamentos_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_campanhas: {
        Row: {
          agendado_para: string | null
          clinica_id: string
          created_at: string | null
          destinatarios: Json | null
          entregues: number | null
          enviados: number | null
          id: string
          lidos: number | null
          nome: string
          status: string | null
          template_id: string | null
        }
        Insert: {
          agendado_para?: string | null
          clinica_id: string
          created_at?: string | null
          destinatarios?: Json | null
          entregues?: number | null
          enviados?: number | null
          id?: string
          lidos?: number | null
          nome: string
          status?: string | null
          template_id?: string | null
        }
        Update: {
          agendado_para?: string | null
          clinica_id?: string
          created_at?: string | null
          destinatarios?: Json | null
          entregues?: number | null
          enviados?: number | null
          id?: string
          lidos?: number | null
          nome?: string
          status?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_campanhas_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_campanhas_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversas: {
        Row: {
          atendente_id: string | null
          clinica_id: string
          created_at: string | null
          id: string
          nome_contato: string | null
          paciente_id: string | null
          status: string | null
          tags: string[] | null
          telefone: string
          ultima_mensagem: string | null
          ultima_mensagem_em: string | null
          updated_at: string | null
        }
        Insert: {
          atendente_id?: string | null
          clinica_id: string
          created_at?: string | null
          id?: string
          nome_contato?: string | null
          paciente_id?: string | null
          status?: string | null
          tags?: string[] | null
          telefone: string
          ultima_mensagem?: string | null
          ultima_mensagem_em?: string | null
          updated_at?: string | null
        }
        Update: {
          atendente_id?: string | null
          clinica_id?: string
          created_at?: string | null
          id?: string
          nome_contato?: string | null
          paciente_id?: string | null
          status?: string | null
          tags?: string[] | null
          telefone?: string
          ultima_mensagem?: string | null
          ultima_mensagem_em?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversas_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversas_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_fila_humano: {
        Row: {
          atendente_id: string | null
          atendido_em: string | null
          clinica_id: string
          conversa_id: string | null
          created_at: string | null
          id: string
          motivo: string | null
          prioridade: number | null
          status: string | null
        }
        Insert: {
          atendente_id?: string | null
          atendido_em?: string | null
          clinica_id: string
          conversa_id?: string | null
          created_at?: string | null
          id?: string
          motivo?: string | null
          prioridade?: number | null
          status?: string | null
        }
        Update: {
          atendente_id?: string | null
          atendido_em?: string | null
          clinica_id?: string
          conversa_id?: string | null
          created_at?: string | null
          id?: string
          motivo?: string | null
          prioridade?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_fila_humano_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_fila_humano_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_mensagens: {
        Row: {
          clinica_id: string
          conteudo: string | null
          conversa_id: string | null
          created_at: string | null
          direcao: string
          id: string
          media_url: string | null
          status: string | null
          tipo: string | null
          wamid: string | null
        }
        Insert: {
          clinica_id: string
          conteudo?: string | null
          conversa_id?: string | null
          created_at?: string | null
          direcao: string
          id?: string
          media_url?: string | null
          status?: string | null
          tipo?: string | null
          wamid?: string | null
        }
        Update: {
          clinica_id?: string
          conteudo?: string | null
          conversa_id?: string | null
          created_at?: string | null
          direcao?: string
          id?: string
          media_url?: string | null
          status?: string | null
          tipo?: string | null
          wamid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_mensagens_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_pipeline_contatos: {
        Row: {
          clinica_id: string
          conversa_id: string | null
          created_at: string | null
          etapa: string | null
          id: string
          observacoes: string | null
          procedimento_interesse: string | null
          updated_at: string | null
          valor_estimado: number | null
        }
        Insert: {
          clinica_id: string
          conversa_id?: string | null
          created_at?: string | null
          etapa?: string | null
          id?: string
          observacoes?: string | null
          procedimento_interesse?: string | null
          updated_at?: string | null
          valor_estimado?: number | null
        }
        Update: {
          clinica_id?: string
          conversa_id?: string | null
          created_at?: string | null
          etapa?: string | null
          id?: string
          observacoes?: string | null
          procedimento_interesse?: string | null
          updated_at?: string | null
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_pipeline_contatos_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_pipeline_contatos_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_respostas_prontas: {
        Row: {
          atalho: string | null
          categoria: string | null
          clinica_id: string
          conteudo: string
          created_at: string | null
          id: string
          titulo: string
        }
        Insert: {
          atalho?: string | null
          categoria?: string | null
          clinica_id: string
          conteudo: string
          created_at?: string | null
          id?: string
          titulo: string
        }
        Update: {
          atalho?: string | null
          categoria?: string | null
          clinica_id?: string
          conteudo?: string
          created_at?: string | null
          id?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_respostas_prontas_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_tags: {
        Row: {
          clinica_id: string
          cor: string | null
          created_at: string | null
          id: string
          nome: string
        }
        Insert: {
          clinica_id: string
          cor?: string | null
          created_at?: string | null
          id?: string
          nome: string
        }
        Update: {
          clinica_id?: string
          cor?: string | null
          created_at?: string | null
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_tags_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          aprovado: boolean | null
          categoria: string | null
          clinica_id: string
          corpo: string
          created_at: string | null
          id: string
          mensagem: string | null
          nome: string
          variaveis: Json | null
        }
        Insert: {
          aprovado?: boolean | null
          categoria?: string | null
          clinica_id: string
          corpo: string
          created_at?: string | null
          id?: string
          mensagem?: string | null
          nome: string
          variaveis?: Json | null
        }
        Update: {
          aprovado?: boolean | null
          categoria?: string | null
          clinica_id?: string
          corpo?: string
          created_at?: string | null
          id?: string
          mensagem?: string | null
          nome?: string
          variaveis?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      api_keys: {
        Row: {
          ativo: boolean | null
          chave_encriptada: string | null
          clinica_id: string | null
          created_at: string | null
          id: string | null
          resultado_teste: string | null
          servico: string | null
          status: string | null
          ultimo_teste: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          chave_encriptada?: string | null
          clinica_id?: string | null
          created_at?: string | null
          id?: string | null
          resultado_teste?: string | null
          servico?: string | null
          status?: string | null
          ultimo_teste?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          chave_encriptada?: string | null
          clinica_id?: string | null
          created_at?: string | null
          id?: string | null
          resultado_teste?: string | null
          servico?: string | null
          status?: string | null
          ultimo_teste?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chaves_api_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      calendario_postagens: {
        Row: {
          clinica_id: string | null
          created_at: string | null
          criativo_id: string | null
          data_publicacao: string | null
          descricao: string | null
          id: string | null
          plataforma: string | null
          status: string | null
          titulo: string | null
        }
        Insert: {
          clinica_id?: string | null
          created_at?: string | null
          criativo_id?: string | null
          data_publicacao?: string | null
          descricao?: string | null
          id?: string | null
          plataforma?: string | null
          status?: string | null
          titulo?: string | null
        }
        Update: {
          clinica_id?: string | null
          created_at?: string | null
          criativo_id?: string | null
          data_publicacao?: string | null
          descricao?: string | null
          id?: string | null
          plataforma?: string | null
          status?: string | null
          titulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_calendario_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_calendario_criativo_id_fkey"
            columns: ["criativo_id"]
            isOneToOne: false
            referencedRelation: "marketing_criativos"
            referencedColumns: ["id"]
          },
        ]
      }
      campanhas_marketing: {
        Row: {
          clinica_id: string | null
          conversoes: number | null
          created_at: string | null
          data_fim: string | null
          data_inicio: string | null
          gasto_total: number | null
          id: string | null
          leads_gerados: number | null
          nome: string | null
          orcamento: number | null
          plataforma: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          clinica_id?: string | null
          conversoes?: number | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          gasto_total?: number | null
          id?: string | null
          leads_gerados?: number | null
          nome?: string | null
          orcamento?: number | null
          plataforma?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          clinica_id?: string | null
          conversoes?: number | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          gasto_total?: number | null
          id?: string | null
          leads_gerados?: number | null
          nome?: string | null
          orcamento?: number | null
          plataforma?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campanhas_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_documentos: {
        Row: {
          arquivo_url: string | null
          categoria: string | null
          clinica_id: string | null
          created_at: string | null
          id: string | null
          nome: string | null
          observacoes: string | null
          tamanho_bytes: number | null
          tipo_mime: string | null
        }
        Insert: {
          arquivo_url?: string | null
          categoria?: string | null
          clinica_id?: string | null
          created_at?: string | null
          id?: string | null
          nome?: string | null
          observacoes?: string | null
          tamanho_bytes?: number | null
          tipo_mime?: string | null
        }
        Update: {
          arquivo_url?: string | null
          categoria?: string | null
          clinica_id?: string | null
          created_at?: string | null
          id?: string | null
          nome?: string | null
          observacoes?: string | null
          tamanho_bytes?: number | null
          tipo_mime?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_upload_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_chat_mensagens: {
        Row: {
          clinica_id: string | null
          conteudo: string | null
          conversa_id: string | null
          created_at: string | null
          direcao: string | null
          id: string | null
          media_url: string | null
          status: string | null
          tipo: string | null
          wamid: string | null
        }
        Insert: {
          clinica_id?: string | null
          conteudo?: string | null
          conversa_id?: string | null
          created_at?: string | null
          direcao?: string | null
          id?: string | null
          media_url?: string | null
          status?: string | null
          tipo?: string | null
          wamid?: string | null
        }
        Update: {
          clinica_id?: string | null
          conteudo?: string | null
          conversa_id?: string | null
          created_at?: string | null
          direcao?: string | null
          id?: string | null
          media_url?: string | null
          status?: string | null
          tipo?: string | null
          wamid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_mensagens_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_cash_forecast: {
        Args: { _end_date: string; _start_date: string }
        Returns: Json
      }
      get_cash_kpis: {
        Args: { _end_date: string; _filtros?: Json; _start_date: string }
        Returns: Json
      }
      get_convenio_kpis: {
        Args: { _convenio_id?: string; _end_date: string; _start_date: string }
        Returns: Json
      }
      get_data_quality_score: {
        Args: { _end_date: string; _start_date: string }
        Returns: Json
      }
      get_discount_summary: {
        Args: { _end_date: string; _start_date: string }
        Returns: Json
      }
      get_dre: {
        Args: { _end_date: string; _filtros?: Json; _start_date: string }
        Returns: Json
      }
      get_user_clinica_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      onboard_clinica: {
        Args: {
          _cnpj?: string
          _email_usuario?: string
          _nome_clinica: string
          _nome_usuario?: string
        }
        Returns: string
      }
      seed_plano_contas: { Args: { _clinica_id: string }; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      upsert_taxa_vigencia: {
        Args: {
          _base_calculo: string
          _clinica_id: string
          _codigo: string
          _nome: string
          _percentual: number
          _tipo: string
          _vigente_de: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "gestor" | "operador_caixa" | "visualizador"
      camada_conciliacao:
        | "feegow_getnet_venda"
        | "getnet_recebivel_banco"
        | "convenio_nf_banco"
        | "pix_banco"
      canal_pagamento:
        | "qrcode"
        | "chave_celular"
        | "chave_cnpj"
        | "maquininha"
        | "boleto"
        | "deposito"
        | "outro"
      forma_pagamento:
        | "pix"
        | "dinheiro"
        | "convenio_nf"
        | "cartao_credito"
        | "cartao_debito"
        | "boleto"
        | "transferencia"
        | "debito_automatico"
        | "ted_doc"
        | "outros"
      indicador_plano: "credito" | "debito"
      linha_receita:
        | "prestacao_servicos"
        | "consulta"
        | "exame"
        | "procedimento"
        | "produto"
      linha_receita_convenio:
        | "consulta"
        | "exame"
        | "prestacao_servicos"
        | "outros"
      meio_recebimento:
        | "cartao_credito"
        | "cartao_debito"
        | "pix"
        | "dinheiro"
        | "convenio"
        | "boleto"
        | "transferencia"
        | "outros"
      origem_dado_cr:
        | "feegow_caixa"
        | "feegow_invoice"
        | "getnet_vendas"
        | "banco_credito"
        | "manual"
      origem_pagamento: "extrato" | "manual"
      origem_preco: "importado_planilha" | "manual" | "sync_feegow"
      severidade_alerta: "info" | "warning" | "critical"
      status_alerta: "aberto" | "resolvido" | "ignorado"
      status_autopilot: "sucesso" | "erro" | "parcial" | "em_andamento"
      status_comprovante: "pendente" | "processado" | "erro" | "rejeitado"
      status_conciliacao: "pendente" | "conciliado" | "divergente"
      status_conciliacao_receita: "conciliado" | "pendente" | "divergente"
      status_conta: "pendente" | "pago" | "vencido" | "cancelado"
      status_imposto: "aberto" | "parcial" | "pago"
      status_integracao: "ativo" | "inativo" | "erro"
      status_lancamento_cp:
        | "a_classificar"
        | "classificado"
        | "pago"
        | "cancelado"
        | "pendente_conciliacao"
        | "divergente"
      status_nf_convenio:
        | "rascunho"
        | "enviada"
        | "a_receber"
        | "paga"
        | "glosa_parcial"
        | "glosa_total"
        | "divergente"
      status_pagamento_nf:
        | "a_emitir"
        | "emitida"
        | "enviada"
        | "a_receber"
        | "paga"
        | "atrasada"
      status_preco: "publicado" | "inativo"
      status_presenca:
        | "confirmado"
        | "atendido"
        | "faltou"
        | "cancelado"
        | "agendado"
        | "em_espera"
        | "em_atendimento"
        | "cancelado_paciente"
      status_presenca_op:
        | "agendado"
        | "confirmado"
        | "em_espera"
        | "em_atendimento"
        | "atendido"
        | "faltou"
        | "cancelado"
        | "cancelado_paciente"
      status_rascunho: "rascunho" | "aprovado" | "publicado" | "cancelado"
      status_recebimento: "a_receber" | "recebido" | "inadimplente" | "glosado"
      status_recebivel_agg: "pendente" | "parcial" | "recebido" | "divergente"
      status_recurso_glosa:
        | "nao_iniciado"
        | "em_andamento"
        | "concluido"
        | "negado"
        | "parcial"
      status_sync: "em_andamento" | "sucesso" | "erro"
      status_sync_feegow: "nao_enviado" | "enviado" | "confirmado" | "erro"
      status_sync_log: "sucesso" | "erro" | "parcial"
      tipo_despesa: "fixa" | "variavel"
      tipo_destino_regra: "divida" | "imposto" | "conta_pagar"
      tipo_divida: "curto_prazo" | "longo_prazo"
      tipo_funcionario: "clt" | "diarista" | "estagiario" | "prestador"
      tipo_imposto: "simples" | "fgts" | "inss" | "iss"
      tipo_insight:
        | "analise_completa"
        | "alertas"
        | "conciliacao"
        | "metas"
        | "resumo_diario"
        | "resumo_mensal"
      tipo_operacao: "consulta" | "exame" | "servico"
      tipo_pagador: "particular" | "convenio"
      tipo_procedimento: "consulta" | "exame" | "procedimento" | "servico"
      tipo_recebivel: "getnet" | "pix_banco" | "dinheiro" | "convenio_nf"
      tipo_sync_feegow: "sync_procedimentos" | "update_precos"
      trigger_autopilot:
        | "feegow_sync"
        | "import_bank"
        | "import_getnet"
        | "reconciliation"
        | "manual"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "gestor", "operador_caixa", "visualizador"],
      camada_conciliacao: [
        "feegow_getnet_venda",
        "getnet_recebivel_banco",
        "convenio_nf_banco",
        "pix_banco",
      ],
      canal_pagamento: [
        "qrcode",
        "chave_celular",
        "chave_cnpj",
        "maquininha",
        "boleto",
        "deposito",
        "outro",
      ],
      forma_pagamento: [
        "pix",
        "dinheiro",
        "convenio_nf",
        "cartao_credito",
        "cartao_debito",
        "boleto",
        "transferencia",
        "debito_automatico",
        "ted_doc",
        "outros",
      ],
      indicador_plano: ["credito", "debito"],
      linha_receita: [
        "prestacao_servicos",
        "consulta",
        "exame",
        "procedimento",
        "produto",
      ],
      linha_receita_convenio: [
        "consulta",
        "exame",
        "prestacao_servicos",
        "outros",
      ],
      meio_recebimento: [
        "cartao_credito",
        "cartao_debito",
        "pix",
        "dinheiro",
        "convenio",
        "boleto",
        "transferencia",
        "outros",
      ],
      origem_dado_cr: [
        "feegow_caixa",
        "feegow_invoice",
        "getnet_vendas",
        "banco_credito",
        "manual",
      ],
      origem_pagamento: ["extrato", "manual"],
      origem_preco: ["importado_planilha", "manual", "sync_feegow"],
      severidade_alerta: ["info", "warning", "critical"],
      status_alerta: ["aberto", "resolvido", "ignorado"],
      status_autopilot: ["sucesso", "erro", "parcial", "em_andamento"],
      status_comprovante: ["pendente", "processado", "erro", "rejeitado"],
      status_conciliacao: ["pendente", "conciliado", "divergente"],
      status_conciliacao_receita: ["conciliado", "pendente", "divergente"],
      status_conta: ["pendente", "pago", "vencido", "cancelado"],
      status_imposto: ["aberto", "parcial", "pago"],
      status_integracao: ["ativo", "inativo", "erro"],
      status_lancamento_cp: [
        "a_classificar",
        "classificado",
        "pago",
        "cancelado",
        "pendente_conciliacao",
        "divergente",
      ],
      status_nf_convenio: [
        "rascunho",
        "enviada",
        "a_receber",
        "paga",
        "glosa_parcial",
        "glosa_total",
        "divergente",
      ],
      status_pagamento_nf: [
        "a_emitir",
        "emitida",
        "enviada",
        "a_receber",
        "paga",
        "atrasada",
      ],
      status_preco: ["publicado", "inativo"],
      status_presenca: [
        "confirmado",
        "atendido",
        "faltou",
        "cancelado",
        "agendado",
        "em_espera",
        "em_atendimento",
        "cancelado_paciente",
      ],
      status_presenca_op: [
        "agendado",
        "confirmado",
        "em_espera",
        "em_atendimento",
        "atendido",
        "faltou",
        "cancelado",
        "cancelado_paciente",
      ],
      status_rascunho: ["rascunho", "aprovado", "publicado", "cancelado"],
      status_recebimento: ["a_receber", "recebido", "inadimplente", "glosado"],
      status_recebivel_agg: ["pendente", "parcial", "recebido", "divergente"],
      status_recurso_glosa: [
        "nao_iniciado",
        "em_andamento",
        "concluido",
        "negado",
        "parcial",
      ],
      status_sync: ["em_andamento", "sucesso", "erro"],
      status_sync_feegow: ["nao_enviado", "enviado", "confirmado", "erro"],
      status_sync_log: ["sucesso", "erro", "parcial"],
      tipo_despesa: ["fixa", "variavel"],
      tipo_destino_regra: ["divida", "imposto", "conta_pagar"],
      tipo_divida: ["curto_prazo", "longo_prazo"],
      tipo_funcionario: ["clt", "diarista", "estagiario", "prestador"],
      tipo_imposto: ["simples", "fgts", "inss", "iss"],
      tipo_insight: [
        "analise_completa",
        "alertas",
        "conciliacao",
        "metas",
        "resumo_diario",
        "resumo_mensal",
      ],
      tipo_operacao: ["consulta", "exame", "servico"],
      tipo_pagador: ["particular", "convenio"],
      tipo_procedimento: ["consulta", "exame", "procedimento", "servico"],
      tipo_recebivel: ["getnet", "pix_banco", "dinheiro", "convenio_nf"],
      tipo_sync_feegow: ["sync_procedimentos", "update_precos"],
      trigger_autopilot: [
        "feegow_sync",
        "import_bank",
        "import_getnet",
        "reconciliation",
        "manual",
      ],
    },
  },
} as const
