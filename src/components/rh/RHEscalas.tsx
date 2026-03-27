import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Calendar, Trash2 } from "lucide-react";

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const TURNOS = [
  { value: "manha", label: "Manhã" },
  { value: "tarde", label: "Tarde" },
  { value: "noite", label: "Noite" },
  { value: "integral", label: "Integral" },
];

export default function RHEscalas() {
  const { clinicaId } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ colaborador_id: "", dia_semana: "1", turno: "integral", hora_inicio: "08:00", hora_fim: "18:00" });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ["colaboradores", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("colaboradores").select("id, nome").eq("clinica_id", clinicaId).order("nome");
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const { data: escalas = [] } = useQuery({
    queryKey: ["rh-escalas", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("rh_escalas").select("*, colaboradores(nome)").eq("clinica_id", clinicaId).order("dia_semana");
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const criarEscala = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rh_escalas").insert({
        clinica_id: clinicaId,
        colaborador_id: form.colaborador_id,
        dia_semana: parseInt(form.dia_semana),
        turno: form.turno,
        hora_inicio: form.hora_inicio,
        hora_fim: form.hora_fim,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Escala criada!");
      queryClient.invalidateQueries({ queryKey: ["rh-escalas"] });
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const excluirEscala = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rh_escalas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Escala removida!");
      queryClient.invalidateQueries({ queryKey: ["rh-escalas"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Group by day of week
  const byDay = DIAS_SEMANA.map((dia, idx) => ({
    dia,
    idx,
    escalas: escalas.filter((e: any) => e.dia_semana === idx),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="h-6 w-6 text-primary" />
          <div>
            <p className="text-lg font-semibold">Escalas de Trabalho</p>
            <p className="text-xs text-muted-foreground">{escalas.length} registros configurados</p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Nova Escala</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar Escala</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Colaborador *</Label>
                <Select value={form.colaborador_id} onValueChange={(v) => setForm({ ...form, colaborador_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{colaboradores.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Dia da Semana</Label>
                <Select value={form.dia_semana} onValueChange={(v) => setForm({ ...form, dia_semana: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DIAS_SEMANA.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Turno</Label>
                <Select value={form.turno} onValueChange={(v) => setForm({ ...form, turno: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TURNOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Início</Label><Input type="time" value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} /></div>
                <div><Label>Fim</Label><Input type="time" value={form.hora_fim} onChange={(e) => setForm({ ...form, hora_fim: e.target.value })} /></div>
              </div>
              <Button onClick={() => criarEscala.mutate()} disabled={!form.colaborador_id} className="w-full">Criar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {byDay.filter(d => d.escalas.length > 0).map(({ dia, escalas: dayEscalas }) => (
          <Card key={dia}>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{dia}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {dayEscalas.map((e: any) => (
                <div key={e.id} className="flex items-center justify-between rounded-md border p-2">
                  <div>
                    <p className="text-sm font-medium">{(e as any).colaboradores?.nome}</p>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-xs">{e.turno}</Badge>
                      <span className="text-xs text-muted-foreground">{e.hora_inicio?.slice(0,5)} - {e.hora_fim?.slice(0,5)}</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => excluirEscala.mutate(e.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
        {byDay.every(d => d.escalas.length === 0) && (
          <Card className="col-span-full"><CardContent className="p-8 text-center text-muted-foreground">Nenhuma escala configurada</CardContent></Card>
        )}
      </div>
    </div>
  );
}
