import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { toast } from "sonner";

export interface CashMonth {
  mes: string;
  mes_label: string;
  entradas: number;
  saidas: number;
  saldo: number;
  entradas_op?: number;
  recuperacoes?: number;
  mao_obra?: number;
  custos_var?: number;
  custos_fix?: number;
  marketing?: number;
  impostos?: number;
  emprestimos?: number;
  aporte?: number;
  retirada?: number;
  saldo_op?: number;
  saldo_final?: number;
  fonte?: string;
}

export interface CashCards {
  saldo_inicial: number;
  entradas: number;
  saidas: number;
  saldo_final: number;
  ar_total: number;
  ar_vencido: number;
  ar_a_vencer: number;
  ap_total: number;
  ap_vencido: number;
  ap_a_vencer: number;
  ncg: number;
  capital_giro: number;
  entradas_conciliadas: number;
  entradas_nao_identificadas: number;
  saidas_conciliadas: number;
  saidas_nao_identificadas: number;
  pct_conciliacao: number;
}

export interface AgingData {
  "0_7": number;
  "8_15": number;
  "16_30": number;
  "31_60": number;
  "61_90": number;
  "90_plus": number;
}

export interface TopSaida {
  categoria: string | null;
  total: number;
}

export interface CashKpisData {
  cards: CashCards;
  mensal: CashMonth[];
  aging: AgingData;
  top_saidas: TopSaida[];
  has_live_data: boolean;
  has_bank_data: boolean;
}

export function useCashKpis(dateFrom: Date, dateTo: Date) {
  const { clinicaId } = useAuth();
  const [data, setData] = useState<CashKpisData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!clinicaId) return;
    setLoading(true);
    try {
      const { data: result, error } = await supabase.rpc("get_cash_kpis", {
        _start_date: format(dateFrom, "yyyy-MM-dd"),
        _end_date: format(dateTo, "yyyy-MM-dd"),
      });
      if (error) throw error;
      setData(result as unknown as CashKpisData);
    } catch (e: any) {
      toast.error("Erro ao carregar KPIs de caixa: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [clinicaId, dateFrom, dateTo]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, refetch: fetch };
}
