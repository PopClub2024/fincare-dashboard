import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Building2, Users, ChevronDown, ChevronUp, Trash2 } from "lucide-react";

export default function RHDepartamentos() {
  const { clinicaId } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", descricao: "", responsavel_id: "" });
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: departamentos = [] } = useQuery({
    queryKey: ["rh-departamentos", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("rh_departamentos").select("*, colaboradores(nome)").eq("clinica_id", clinicaId).order("nome");
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ["colaboradores", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("colaboradores").select("id, nome, cargo, departamento_id").eq("clinica_id", clinicaId).order("nome");
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const criarDepartamento = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rh_departamentos").insert({
        clinica_id: clinicaId,
        nome: form.nome,
        descricao: form.descricao || null,
        responsavel_id: form.responsavel_id || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Departamento criado!");
      queryClient.invalidateQueries({ queryKey: ["rh-departamentos"] });
      setDialogOpen(false);
      setForm({ nome: "", descricao: "", responsavel_id: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const excluirDepartamento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rh_departamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Departamento excluído!");
      queryClient.invalidateQueries({ queryKey: ["rh-departamentos"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <div>
            <p className="text-lg font-semibold">{departamentos.length} departamentos</p>
            <p className="text-xs text-muted-foreground">Gerencie a estrutura organizacional</p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Novo Departamento</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar Departamento</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div><Label>Descrição</Label><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
              <div>
                <Label>Responsável</Label>
                <Select value={form.responsavel_id} onValueChange={(v) => setForm({ ...form, responsavel_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {colaboradores.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => criarDepartamento.mutate()} disabled={!form.nome} className="w-full">Criar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {departamentos.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum departamento cadastrado</CardContent></Card>
        ) : departamentos.map((d: any) => {
          const membros = colaboradores.filter((c: any) => c.departamento_id === d.id);
          const isExpanded = expanded === d.id;
          return (
            <Card key={d.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => setExpanded(isExpanded ? null : d.id)}>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    <div>
                      <p className="font-semibold">{d.nome}</p>
                      {d.descricao && <p className="text-xs text-muted-foreground">{d.descricao}</p>}
                    </div>
                    <Badge variant="outline" className="ml-2"><Users className="h-3 w-3 mr-1" />{membros.length}</Badge>
                    {(d as any).colaboradores?.nome && <Badge variant="secondary" className="ml-2">Resp: {(d as any).colaboradores.nome}</Badge>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => excluirDepartamento.mutate(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
                {isExpanded && (
                  <div className="mt-3 pl-8 space-y-1">
                    {membros.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum colaborador neste departamento</p>
                    ) : membros.map((m: any) => (
                      <div key={m.id} className="flex items-center gap-2 text-sm py-1">
                        <span className="font-medium">{m.nome}</span>
                        {m.cargo && <Badge variant="outline" className="text-xs">{m.cargo}</Badge>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
