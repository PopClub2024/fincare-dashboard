import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
import { format } from "date-fns";
import { Plus, UserMinus } from "lucide-react";

export default function RHDesligamentos() {
  const { clinicaId } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ colaborador_id: "", data_desligamento: "", motivo: "", decisao: "empresa", causa: "", custo: "", observacoes: "" });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ["colaboradores", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("colaboradores").select("id, nome").eq("clinica_id", clinicaId).order("nome");
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const { data: desligamentos = [] } = useQuery({
    queryKey: ["rh-desligamentos", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("rh_desligamentos").select("*, colaboradores(nome)").eq("clinica_id", clinicaId).order("data_desligamento", { ascending: false });
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const criarDesligamento = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rh_desligamentos").insert({
        clinica_id: clinicaId,
        colaborador_id: form.colaborador_id,
        data_desligamento: form.data_desligamento,
        motivo: form.motivo || null,
        decisao: form.decisao,
        causa: form.causa || null,
        custo: form.custo ? parseFloat(form.custo) : 0,
        observacoes: form.observacoes || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Desligamento registrado!");
      queryClient.invalidateQueries({ queryKey: ["rh-desligamentos"] });
      setDialogOpen(false);
      setForm({ colaborador_id: "", data_desligamento: "", motivo: "", decisao: "empresa", causa: "", custo: "", observacoes: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const custoTotal = desligamentos.reduce((acc: number, d: any) => acc + (Number(d.custo) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-2 gap-4">
          <Card><CardContent className="p-4 flex items-center gap-3"><UserMinus className="h-6 w-6 text-red-600" /><div><p className="text-xl font-bold">{desligamentos.length}</p><p className="text-xs text-muted-foreground">Total Desligamentos</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><UserMinus className="h-6 w-6 text-orange-600" /><div><p className="text-xl font-bold">R$ {custoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p><p className="text-xs text-muted-foreground">Custo Total</p></div></CardContent></Card>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button variant="destructive"><Plus className="h-4 w-4 mr-2" /> Registrar Desligamento</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar Desligamento</DialogTitle></DialogHeader>
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
              <div><Label>Data *</Label><Input type="date" value={form.data_desligamento} onChange={(e) => setForm({ ...form, data_desligamento: e.target.value })} /></div>
              <div>
                <Label>Decisão</Label>
                <Select value={form.decisao} onValueChange={(v) => setForm({ ...form, decisao: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="empresa">Empresa</SelectItem>
                    <SelectItem value="colaborador">Colaborador</SelectItem>
                    <SelectItem value="acordo">Acordo mútuo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Motivo</Label><Input value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} /></div>
              <div><Label>Custo (R$)</Label><Input type="number" value={form.custo} onChange={(e) => setForm({ ...form, custo: e.target.value })} /></div>
              <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
              <Button onClick={() => criarDesligamento.mutate()} disabled={!form.colaborador_id || !form.data_desligamento} className="w-full">Registrar</Button>
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
                <TableHead>Data</TableHead>
                <TableHead>Decisão</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Custo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {desligamentos.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum desligamento registrado</TableCell></TableRow>
              ) : desligamentos.map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{(d as any).colaboradores?.nome || "—"}</TableCell>
                  <TableCell>{format(new Date(d.data_desligamento), "dd/MM/yyyy")}</TableCell>
                  <TableCell><Badge variant={d.decisao === "empresa" ? "destructive" : d.decisao === "colaborador" ? "secondary" : "outline"}>{d.decisao}</Badge></TableCell>
                  <TableCell>{d.motivo || "—"}</TableCell>
                  <TableCell>R$ {Number(d.custo || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
