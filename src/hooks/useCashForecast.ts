import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { toast } from "sonner";

export interface ForecastWeek {
  semana: string;
  semana_label: string;
  total: number;
  particular: number;
  convenio: number;
  qtd: number;
}

export interface SaidaProgramada {
  semana: string;
  semana_label: string;
  total: number;
  qtd: number;
}

export interface ResumoCanal {
  convenio: string;
  prazo_repasse_dias: number | null;
  total_faturado: number;
  recebido: number;
  pendente: number;
  qtd_consultas: number;
}

export interface CashForecastData {
  previsao_entradas: ForecastWeek[];
  saidas_programadas: SaidaProgramada[];
  total_a_receber: number;
  total_particular: number;
  total_convenio: number;
  resumo_canal: ResumoCanal[];
}

export function useCashForecast(dateFrom: Date, dateTo: Date) {
  const { clinicaId } = useAuth();
  const [data, setData] = useState<CashForecastData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!clinicaId) return;
    setLoading(true);
    try {
      const { data: result, error } = await supabase.rpc("get_cash_forecast", {
        _start_date: format(dateFrom, "yyyy-MM-dd"),
        _end_date: format(dateTo, "yyyy-MM-dd"),
      });
      if (error) throw error;
      setData(result as unknown as CashForecastData);
    } catch (e: any) {
      toast.error("Erro ao carregar previsão de caixa: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [clinicaId, dateFrom, dateTo]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, refetch: fetch };
}
