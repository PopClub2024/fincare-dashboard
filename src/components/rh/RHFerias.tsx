import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { Calendar, Plus, Check, X } from "lucide-react";

export default function RHFerias() {
  const { clinicaId } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ colaborador_id: "", data_inicio: "", data_fim: "", notas: "" });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ["colaboradores", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("colaboradores").select("id, nome").eq("clinica_id", clinicaId).order("nome");
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const { data: ferias = [] } = useQuery({
    queryKey: ["rh-ferias", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("rh_ferias").select("*, colaboradores(nome)").eq("clinica_id", clinicaId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const criarFerias = useMutation({
    mutationFn: async () => {
      const dias = differenceInDays(new Date(form.data_fim), new Date(form.data_inicio)) + 1;
      const { error } = await supabase.from("rh_ferias").insert({
        clinica_id: clinicaId,
        colaborador_id: form.colaborador_id,
        data_inicio: form.data_inicio,
        data_fim: form.data_fim,
        dias_total: dias,
        notas: form.notas || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Férias registradas!");
      queryClient.invalidateQueries({ queryKey: ["rh-ferias"] });
      setDialogOpen(false);
      setForm({ colaborador_id: "", data_inicio: "", data_fim: "", notas: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const atualizarStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("rh_ferias").update({ status } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado!");
      queryClient.invalidateQueries({ queryKey: ["rh-ferias"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const stats = {
    pendentes: ferias.filter((f: any) => f.status === "pendente").length,
    aprovadas: ferias.filter((f: any) => f.status === "aprovada").length,
    emFerias: ferias.filter((f: any) => {
      if (f.status !== "aprovada") return false;
      const hoje = new Date().toISOString().slice(0, 10);
      return f.data_inicio <= hoje && f.data_fim >= hoje;
    }).length,
  };

  const statusColor = (s: string) => {
    if (s === "aprovada") return "default";
    if (s === "rejeitada") return "destructive";
    if (s === "cancelada") return "secondary";
    return "outline";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="p-4 flex items-center gap-3"><Calendar className="h-6 w-6 text-yellow-600" /><div><p className="text-xl font-bold">{stats.pendentes}</p><p className="text-xs text-muted-foreground">Pendentes</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><Check className="h-6 w-6 text-green-600" /><div><p className="text-xl font-bold">{stats.aprovadas}</p><p className="text-xs text-muted-foreground">Aprovadas</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><Calendar className="h-6 w-6 text-blue-600" /><div><p className="text-xl font-bold">{stats.emFerias}</p><p className="text-xs text-muted-foreground">Em Férias Agora</p></div></CardContent></Card>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Nova Solicitação</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Solicitar Férias</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Colaborador *</Label>
                <Select value={form.colaborador_id} onValueChange={(v) => setForm({ ...form, colaborador_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {colaboradores.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Início *</Label><Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} /></div>
                <div><Label>Fim *</Label><Input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} /></div>
              </div>
              <div><Label>Observações</Label><Textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
              <Button onClick={() => criarFerias.mutate()} disabled={!form.colaborador_id || !form.data_inicio || !form.data_fim} className="w-full">Solicitar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead>Dias</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ferias.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma solicitação</TableCell></TableRow>
              ) : ferias.map((f: any) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{(f as any).colaboradores?.nome || "—"}</TableCell>
                  <TableCell>{format(new Date(f.data_inicio), "dd/MM/yyyy")}</TableCell>
                  <TableCell>{format(new Date(f.data_fim), "dd/MM/yyyy")}</TableCell>
                  <TableCell>{f.dias_total}</TableCell>
                  <TableCell><Badge variant={statusColor(f.status)}>{f.status}</Badge></TableCell>
                  <TableCell>
                    {f.status === "pendente" && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => atualizarStatus.mutate({ id: f.id, status: "aprovada" })}><Check className="h-3 w-3" /></Button>
                        <Button size="sm" variant="outline" onClick={() => atualizarStatus.mutate({ id: f.id, status: "rejeitada" })}><X className="h-3 w-3" /></Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
