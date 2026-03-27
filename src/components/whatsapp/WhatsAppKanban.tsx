import { useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PIPELINE_ETAPAS } from "@/types/whatsapp";
import { Loader2 } from "lucide-react";

export default function WhatsAppKanban() {
  const { clinicaId } = useAuth();
  const queryClient = useQueryClient();
  const dragItem = useRef<string | null>(null);

  const { data: conversas = [], isLoading } = useQuery({
    queryKey: ["whatsapp-conversas-kanban", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("whatsapp_conversas").select("*").eq("clinica_id", clinicaId).order("ultima_mensagem_em", { ascending: false }) as any;
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const onDragStart = (e: React.DragEvent, conversaId: string) => {
    dragItem.current = conversaId;
    e.dataTransfer.effectAllowed = "move";
    (e.target as HTMLElement).style.opacity = "0.5";
  };

  const onDragEnd = (e: React.DragEvent) => {
    dragItem.current = null;
    (e.target as HTMLElement).style.opacity = "1";
  };

  const onDrop = async (e: React.DragEvent, etapaKey: string) => {
    e.preventDefault();
    const conversaId = dragItem.current;
    if (!conversaId) return;

    await supabase.from("whatsapp_conversas").update({ pipeline_etapa: etapaKey } as any).eq("id", conversaId);
    queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas-kanban"] });
    queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
    toast.success(`Movido para ${PIPELINE_ETAPAS.find(e => e.key === etapaKey)?.label}`);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-3 min-w-max">
        {PIPELINE_ETAPAS.map(etapa => {
          const etapaConversas = conversas.filter((c: any) => c.pipeline_etapa === etapa.key);
          const isPositive = ["atendido", "confirmado"].includes(etapa.key);
          const isNegative = ["cancelou", "perdido", "faltou"].includes(etapa.key);

          return (
            <div
              key={etapa.key}
              className={`w-56 flex flex-col rounded-xl border backdrop-blur-sm ${
                isPositive ? "bg-emerald-950/20 border-emerald-700/30" :
                isNegative ? "bg-red-950/20 border-red-700/30" :
                "bg-card border-border"
              }`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(e, etapa.key)}
            >
              {/* Header */}
              <div
                className="p-2.5 border-b rounded-t-xl flex justify-between items-center"
                style={{ borderTopWidth: 3, borderTopColor: etapa.cor }}
              >
                <span className="text-xs font-bold uppercase tracking-wide">{etapa.label}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted font-mono">{etapaConversas.length}</span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[60vh] min-h-[200px]">
                {etapaConversas.map((c: any) => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, c.id)}
                    onDragEnd={onDragEnd}
                    className="bg-card border rounded-lg p-2.5 shadow-sm cursor-grab active:cursor-grabbing hover:border-primary/50 transition-all"
                  >
                    <p className="text-xs font-medium truncate">{c.nome_contato || c.telefone}</p>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">{c.ultima_mensagem}</p>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {c.atendimento === "humano" && <Badge className="text-[8px] h-3 bg-blue-500">Humano</Badge>}
                      {c.atendimento === "fila_espera" && <Badge variant="destructive" className="text-[8px] h-3">Fila</Badge>}
                      {c.nao_lidas > 0 && <Badge className="text-[8px] h-3 bg-green-500">{c.nao_lidas}</Badge>}
                      {c.tags?.slice(0, 2).map((t: string) => (
                        <Badge key={t} variant="outline" className="text-[8px] h-3">{t}</Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
