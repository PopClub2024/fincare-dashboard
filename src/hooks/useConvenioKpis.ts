import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export function useConvenioKpis(dateFrom: Date, dateTo: Date, convenioId: string | null) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const { data: result, error } = await supabase.rpc("get_convenio_kpis", {
          _start_date: format(dateFrom, "yyyy-MM-dd"),
          _end_date: format(dateTo, "yyyy-MM-dd"),
          _convenio_id: convenioId || null,
        });
        if (!error && result) {
          setData(result);
        }
      } catch {
        // silently handle
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [dateFrom, dateTo, convenioId]);

  return { data, loading };
}
