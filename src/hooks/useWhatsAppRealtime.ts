import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export function useWhatsAppRealtime(clinicaId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!clinicaId) return;

    const channel = supabase
      .channel('whatsapp-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_conversas', filter: `clinica_id=eq.${clinicaId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
          queryClient.invalidateQueries({ queryKey: ["whatsapp-dashboard"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clinicaId, queryClient]);
}
