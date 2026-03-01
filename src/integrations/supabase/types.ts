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
      conciliacoes: {
        Row: {
          clinica_id: string
          created_at: string
          divergencia: number | null
          id: string
          observacao: string | null
          recebimento_id: string | null
          status: Database["public"]["Enums"]["status_conciliacao"]
          venda_id: string | null
        }
        Insert: {
          clinica_id: string
          created_at?: string
          divergencia?: number | null
          id?: string
          observacao?: string | null
          recebimento_id?: string | null
          status?: Database["public"]["Enums"]["status_conciliacao"]
          venda_id?: string | null
        }
        Update: {
          clinica_id?: string
          created_at?: string
          divergencia?: number | null
          id?: string
          observacao?: string | null
          recebimento_id?: string | null
          status?: Database["public"]["Enums"]["status_conciliacao"]
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
            foreignKeyName: "conciliacoes_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "transacoes_vendas"
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
      convenios: {
        Row: {
          ativo: boolean
          clinica_id: string
          created_at: string
          feegow_id: string | null
          id: string
          nome: string
          prazo_repasse_dias: number | null
          taxa_adm_percent: number | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          clinica_id: string
          created_at?: string
          feegow_id?: string | null
          id?: string
          nome: string
          prazo_repasse_dias?: number | null
          taxa_adm_percent?: number | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          clinica_id?: string
          created_at?: string
          feegow_id?: string | null
          id?: string
          nome?: string
          prazo_repasse_dias?: number | null
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
      dividas: {
        Row: {
          clinica_id: string
          created_at: string
          credor: string
          custo_efetivo: number | null
          data_inicio: string | null
          data_vencimento: string | null
          descricao: string | null
          id: string
          saldo: number
          taxa_juros: number | null
          tipo: Database["public"]["Enums"]["tipo_divida"]
          updated_at: string
        }
        Insert: {
          clinica_id: string
          created_at?: string
          credor: string
          custo_efetivo?: number | null
          data_inicio?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          id?: string
          saldo: number
          taxa_juros?: number | null
          tipo?: Database["public"]["Enums"]["tipo_divida"]
          updated_at?: string
        }
        Update: {
          clinica_id?: string
          created_at?: string
          credor?: string
          custo_efetivo?: number | null
          data_inicio?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          id?: string
          saldo?: number
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
      medicos: {
        Row: {
          ativo: boolean
          clinica_id: string
          created_at: string
          crm: string | null
          documento: string | null
          especialidade: string | null
          feegow_id: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          clinica_id: string
          created_at?: string
          crm?: string | null
          documento?: string | null
          especialidade?: string | null
          feegow_id?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          clinica_id?: string
          created_at?: string
          crm?: string | null
          documento?: string | null
          especialidade?: string | null
          feegow_id?: string | null
          id?: string
          nome?: string
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
      pacientes: {
        Row: {
          clinica_id: string
          created_at: string
          data_cadastro: string | null
          feegow_id: string | null
          id: string
          nome: string
          primeira_consulta: string | null
          updated_at: string
        }
        Insert: {
          clinica_id: string
          created_at?: string
          data_cadastro?: string | null
          feegow_id?: string | null
          id?: string
          nome: string
          primeira_consulta?: string | null
          updated_at?: string
        }
        Update: {
          clinica_id?: string
          created_at?: string
          data_cadastro?: string | null
          feegow_id?: string | null
          id?: string
          nome?: string
          primeira_consulta?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pacientes_clinica_id_fkey"
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
      transacoes_recebimentos: {
        Row: {
          clinica_id: string
          created_at: string
          data_recebimento: string
          getnet_id: string | null
          id: string
          observacao: string | null
          origem: string
          referencia_externa: string | null
          updated_at: string
          valor: number
          venda_id: string | null
        }
        Insert: {
          clinica_id: string
          created_at?: string
          data_recebimento: string
          getnet_id?: string | null
          id?: string
          observacao?: string | null
          origem?: string
          referencia_externa?: string | null
          updated_at?: string
          valor: number
          venda_id?: string | null
        }
        Update: {
          clinica_id?: string
          created_at?: string
          data_recebimento?: string
          getnet_id?: string | null
          id?: string
          observacao?: string | null
          origem?: string
          referencia_externa?: string | null
          updated_at?: string
          valor?: number
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
          clinica_id: string
          convenio_id: string | null
          created_at: string
          custo_direto_csv: number
          data_caixa: string | null
          data_competencia: string
          data_prevista_recebimento: string | null
          desconto: number
          descricao: string | null
          feegow_id: string | null
          forma_pagamento: string | null
          id: string
          impostos_taxas: number
          medico_id: string | null
          observacao: string | null
          paciente_id: string | null
          quantidade: number
          sala_id: string | null
          status_conciliacao: Database["public"]["Enums"]["status_conciliacao"]
          status_presenca: Database["public"]["Enums"]["status_presenca"] | null
          status_recebimento: Database["public"]["Enums"]["status_recebimento"]
          updated_at: string
          valor_bruto: number
          valor_liquido: number | null
        }
        Insert: {
          clinica_id: string
          convenio_id?: string | null
          created_at?: string
          custo_direto_csv?: number
          data_caixa?: string | null
          data_competencia: string
          data_prevista_recebimento?: string | null
          desconto?: number
          descricao?: string | null
          feegow_id?: string | null
          forma_pagamento?: string | null
          id?: string
          impostos_taxas?: number
          medico_id?: string | null
          observacao?: string | null
          paciente_id?: string | null
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
        }
        Update: {
          clinica_id?: string
          convenio_id?: string | null
          created_at?: string
          custo_direto_csv?: number
          data_caixa?: string | null
          data_competencia?: string
          data_prevista_recebimento?: string | null
          desconto?: number
          descricao?: string | null
          feegow_id?: string | null
          forma_pagamento?: string | null
          id?: string
          impostos_taxas?: number
          medico_id?: string | null
          observacao?: string | null
          paciente_id?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
    }
    Enums: {
      app_role: "admin" | "gestor" | "operador_caixa" | "visualizador"
      status_conciliacao: "pendente" | "conciliado" | "divergente"
      status_conta: "pendente" | "pago" | "vencido" | "cancelado"
      status_integracao: "ativo" | "inativo" | "erro"
      status_presenca: "confirmado" | "atendido" | "faltou" | "cancelado"
      status_recebimento: "a_receber" | "recebido" | "inadimplente" | "glosado"
      status_sync: "em_andamento" | "sucesso" | "erro"
      tipo_despesa: "fixa" | "variavel"
      tipo_divida: "curto_prazo" | "longo_prazo"
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
      status_conciliacao: ["pendente", "conciliado", "divergente"],
      status_conta: ["pendente", "pago", "vencido", "cancelado"],
      status_integracao: ["ativo", "inativo", "erro"],
      status_presenca: ["confirmado", "atendido", "faltou", "cancelado"],
      status_recebimento: ["a_receber", "recebido", "inadimplente", "glosado"],
      status_sync: ["em_andamento", "sucesso", "erro"],
      tipo_despesa: ["fixa", "variavel"],
      tipo_divida: ["curto_prazo", "longo_prazo"],
    },
  },
} as const
