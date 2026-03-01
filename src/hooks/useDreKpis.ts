import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { toast } from "sonner";

export interface DreMonth {
  mes: string;
  mes_label: string;
  rt: number;
  impostos: number;
  taxa_cartao: number;
  taxa_cartao_real?: number;
  taxa_cartao_estimada?: number;
  has_getnet?: boolean;
  repasses: number;
  mc: number;
  mc_pct: number;
  cf: number;
  resultado: number;
  resultado_pct: number;
  receita_cartao?: number;
  imposto_info?: Record<string, unknown>;
  taxa_info?: Record<string, unknown>;
  fonte?: string;
}

export interface DreCards {
  rt: number;
  impostos: number;
  taxa_cartao: number;
  repasses: number;
  mc: number;
  mc_pct: number;
  cf: number;
  resultado: number;
  resultado_pct: number;
  pe?: number;
  fonte?: string;
}

export interface DreData {
  cards: DreCards;
  mensal: DreMonth[];
}

export function useDreKpis(dateFrom: Date, dateTo: Date) {
  const { clinicaId } = useAuth();
  const [data, setData] = useState<DreData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!clinicaId) return;
    setLoading(true);
    try {
      const { data: result, error } = await supabase.rpc("get_dre", {
        _start_date: format(dateFrom, "yyyy-MM-dd"),
        _end_date: format(dateTo, "yyyy-MM-dd"),
      });
      if (error) throw error;
      setData(result as unknown as DreData);
    } catch (e: any) {
      toast.error("Erro ao carregar DRE: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [clinicaId, dateFrom, dateTo]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, refetch: fetch };
}
