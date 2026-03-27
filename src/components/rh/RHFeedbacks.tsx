import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, ThumbsUp, Minus, ThumbsDown, MessageSquare } from "lucide-react";

export default function RHFeedbacks() {
  const { clinicaId } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterTipo, setFilterTipo] = useState("todos");
  const [form, setForm] = useState({ remetente_id: "", destinatario_id: "", tipo: "positivo", mensagem: "" });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ["colaboradores", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("colaboradores").select("id, nome").eq("clinica_id", clinicaId).order("nome");
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const { data: feedbacks = [] } = useQuery({
    queryKey: ["rh-feedbacks", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("rh_feedbacks").select("*, remetente:colaboradores!rh_feedbacks_remetente_id_fkey(nome), destinatario:colaboradores!rh_feedbacks_destinatario_id_fkey(nome)").eq("clinica_id", clinicaId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const criarFeedback = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rh_feedbacks").insert({
        clinica_id: clinicaId,
        remetente_id: form.remetente_id,
        destinatario_id: form.destinatario_id,
        tipo: form.tipo,
        mensagem: form.mensagem,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Feedback enviado!");
      queryClient.invalidateQueries({ queryKey: ["rh-feedbacks"] });
      setDialogOpen(false);
      setForm({ remetente_id: "", destinatario_id: "", tipo: "positivo", mensagem: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const tipoIcon = (tipo: string) => {
    if (tipo === "positivo") return <ThumbsUp className="h-4 w-4 text-green-600" />;
    if (tipo === "negativo") return <ThumbsDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-yellow-600" />;
  };

  const filtered = filterTipo === "todos" ? feedbacks : feedbacks.filter((f: any) => f.tipo === filterTipo);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-6 w-6 text-primary" />
          <div>
            <p className="text-lg font-semibold">{feedbacks.length} feedbacks</p>
            <p className="text-xs text-muted-foreground">
              {feedbacks.filter((f: any) => f.tipo === "positivo").length} positivos · {feedbacks.filter((f: any) => f.tipo === "neutro").length} neutros · {feedbacks.filter((f: any) => f.tipo === "negativo").length} negativos
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="positivo">Positivo</SelectItem>
              <SelectItem value="neutro">Neutro</SelectItem>
              <SelectItem value="negativo">Negativo</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Novo Feedback</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Enviar Feedback</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>De *</Label>
                  <Select value={form.remetente_id} onValueChange={(v) => setForm({ ...form, remetente_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Remetente..." /></SelectTrigger>
                    <SelectContent>{colaboradores.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Para *</Label>
                  <Select value={form.destinatario_id} onValueChange={(v) => setForm({ ...form, destinatario_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Destinatário..." /></SelectTrigger>
                    <SelectContent>{colaboradores.filter((c: any) => c.id !== form.remetente_id).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="positivo">👍 Positivo</SelectItem>
                      <SelectItem value="neutro">➡️ Neutro</SelectItem>
                      <SelectItem value="negativo">👎 Negativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Mensagem *</Label><Textarea value={form.mensagem} onChange={(e) => setForm({ ...form, mensagem: e.target.value })} rows={4} /></div>
                <Button onClick={() => criarFeedback.mutate()} disabled={!form.remetente_id || !form.destinatario_id || !form.mensagem} className="w-full">Enviar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum feedback encontrado</CardContent></Card>
        ) : filtered.map((f: any) => (
          <Card key={f.id}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {tipoIcon(f.tipo)}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{(f as any).remetente?.nome}</span>
                    <span className="text-xs text-muted-foreground">→</span>
                    <span className="font-medium text-sm">{(f as any).destinatario?.nome}</span>
                    <Badge variant="outline" className="ml-auto text-xs">{f.tipo}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{f.mensagem}</p>
                  <p className="text-xs text-muted-foreground mt-1">{format(new Date(f.created_at), "dd/MM/yyyy HH:mm")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
