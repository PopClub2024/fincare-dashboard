import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";

export default function TVRecepcao() {
  const { clinicaId } = useAuth();
  const [currentCall, setCurrentCall] = useState<any>(null);

  const { data: chamadas = [] } = useQuery({
    queryKey: ["chamadas-tv", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase
        .from("chamadas_paciente")
        .select("*")
        .eq("clinica_id", clinicaId)
        .eq("status", "chamando")
        .order("chamado_em", { ascending: false })
        .limit(1);
      return data || [];
    },
    enabled: !!clinicaId,
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (chamadas.length > 0) {
      const chamada = chamadas[0];
      setCurrentCall(chamada);
      // Marca como exibido após 15s
      const timer = setTimeout(async () => {
        await supabase.from("chamadas_paciente").update({ exibido: true } as any).eq("id", (chamada as any).id);
        setCurrentCall(null);
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [chamadas]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-teal-700 flex items-center justify-center p-8">
      {currentCall ? (
        <div className="text-center animate-in fade-in duration-500">
          <Bell className="h-20 w-20 text-yellow-400 mx-auto mb-8 animate-bounce" />
          <h1 className="text-7xl font-bold text-white mb-6">{currentCall.paciente_nome}</h1>
          <div className="bg-white/20 rounded-2xl px-12 py-6 inline-block">
            <p className="text-4xl text-white/90 font-medium">{currentCall.consultorio}</p>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <img src="/logo.png" alt="Medic Pop" className="h-24 mx-auto mb-8 opacity-50" />
          <h1 className="text-5xl font-light text-white/60">Medic Pop</h1>
          <p className="text-xl text-white/40 mt-4">Aguardando chamada...</p>
        </div>
      )}
    </div>
  );
}
