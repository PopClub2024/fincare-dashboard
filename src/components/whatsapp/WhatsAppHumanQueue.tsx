import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { toast } from "sonner";
import { UserRound } from "lucide-react";

interface Props {
  onSelectConversa?: (conversaId: string) => void;
}

export default function WhatsAppHumanQueue({ onSelectConversa }: Props) {
  const { clinicaId, user } = useAuth();
  const queryClient = useQueryClient();

  const { data: filaHumana = [] } = useQuery({
    queryKey: ["fila-humana", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await (supabase.from("whatsapp_fila_humano")
        .select("*, whatsapp_conversas(nome_contato, telefone, tags)")
        .eq("clinica_id", clinicaId).eq("status", "aguardando")
        .order("prioridade").order("created_at") as any);
      return data || [];
    },
    enabled: !!clinicaId,
    refetchInterval: 5000,
  });

  const assumirAtendimento = async (conversaId: string) => {
    await supabase.from("whatsapp_conversas").update({ atendimento: "humano", atendente_id: user?.id } as any).eq("id", conversaId);
    await supabase.from("whatsapp_fila_humano").update({
      status: "em_atendimento", atendente_id: user?.id, atendido_em: new Date().toISOString()
    } as any).eq("conversa_id", conversaId).eq("status", "aguardando");
    queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
    queryClient.invalidateQueries({ queryKey: ["fila-humana"] });
    toast.success("Atendimento assumido!");
    onSelectConversa?.(conversaId);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Fila de Atendimento Humano</CardTitle>
        <CardDescription>Conversas onde a IA não conseguiu resolver ou o paciente solicitou atendente</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contato</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Na fila há</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filaHumana.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma conversa na fila</TableCell></TableRow>
            ) : filaHumana.map((f: any) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.whatsapp_conversas?.nome_contato || "—"}</TableCell>
                <TableCell className="font-mono text-xs">{f.whatsapp_conversas?.telefone}</TableCell>
                <TableCell className="text-xs">{f.motivo}</TableCell>
                <TableCell className="text-xs">{format(new Date(f.entrou_fila_em || f.created_at), "HH:mm")}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {f.whatsapp_conversas?.tags?.map((t: string) => <Badge key={t} variant="outline" className="text-[8px]">{t}</Badge>)}
                  </div>
                </TableCell>
                <TableCell>
                  <Button size="sm" onClick={() => assumirAtendimento(f.conversa_id)}>
                    <UserRound className="h-3 w-3 mr-1" /> Assumir
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
