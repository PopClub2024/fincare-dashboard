import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, Search, Users, Calendar, ArrowUpDown } from "lucide-react";
import ExportButtons from "@/components/ExportButtons";
import { flattenForExport } from "@/lib/export-utils";

export default function RHColaboradores() {
  const { clinicaId } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterVinculo, setFilterVinculo] = useState("todos");
  const [sortField, setSortField] = useState<string>("nome");
  const [sortAsc, setSortAsc] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", cpf: "", cargo: "", area: "", tipo_vinculo: "clt", salario: "", data_admissao: "", telefone: "", email: "" });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ["colaboradores", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("colaboradores").select("*").eq("clinica_id", clinicaId).order("nome");
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const criarColaborador = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("colaboradores").insert({
        clinica_id: clinicaId,
        nome: form.nome,
        cpf: form.cpf || null,
        cargo: form.cargo || null,
        departamento: form.area || null,
        tipo_contrato: form.tipo_vinculo,
        salario: form.salario ? parseFloat(form.salario) : null,
        data_admissao: form.data_admissao || null,
        telefone: form.telefone || null,
        email: form.email || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Colaborador cadastrado!");
      queryClient.invalidateQueries({ queryKey: ["colaboradores"] });
      setDialogOpen(false);
      setForm({ nome: "", cpf: "", cargo: "", area: "", tipo_vinculo: "clt", salario: "", data_admissao: "", telefone: "", email: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const stats = {
    ativos: colaboradores.filter((c: any) => c.ativo !== false).length,
    inativos: colaboradores.filter((c: any) => c.ativo === false).length,
    total: colaboradores.length,
  };

  const toggleSort = (field: string) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const filtered = colaboradores
    .filter((c: any) => {
      if (search && !c.nome?.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterStatus === "ativo" && c.ativo === false) return false;
      if (filterStatus === "inativo" && c.ativo !== false) return false;
      if (filterVinculo !== "todos" && c.tipo_contrato !== filterVinculo) return false;
      return true;
    })
    .sort((a: any, b: any) => {
      const va = a[sortField] || "";
      const vb = b[sortField] || "";
      return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total", value: stats.total, icon: Users, color: "text-blue-600" },
            { label: "Ativos", value: stats.ativos, icon: Users, color: "text-green-600" },
            { label: "Inativos", value: stats.inativos, icon: Users, color: "text-muted-foreground" },
          ].map((k) => (
            <Card key={k.label}><CardContent className="p-4 flex items-center gap-3"><k.icon className={`h-6 w-6 ${k.color}`} /><div><p className="text-xl font-bold">{k.value}</p><p className="text-xs text-muted-foreground">{k.label}</p></div></CardContent></Card>
          ))}
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Novo Colaborador</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Cadastrar Colaborador</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div><Label>CPF</Label><Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></div>
              <div><Label>Cargo</Label><Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} /></div>
              <div><Label>Departamento</Label><Input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></div>
              <div>
                <Label>Vínculo</Label>
                <Select value={form.tipo_vinculo} onValueChange={(v) => setForm({ ...form, tipo_vinculo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clt">CLT</SelectItem>
                    <SelectItem value="pj">PJ</SelectItem>
                    <SelectItem value="autonomo">Autônomo</SelectItem>
                    <SelectItem value="estagiario">Estagiário</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Salário</Label><Input type="number" value={form.salario} onChange={(e) => setForm({ ...form, salario: e.target.value })} /></div>
              <div><Label>Admissão</Label><Input type="date" value={form.data_admissao} onChange={(e) => setForm({ ...form, data_admissao: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
              <div><Label>E-mail</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <Button onClick={() => criarColaborador.mutate()} disabled={!form.nome} className="mt-4 w-full">Cadastrar</Button>
          </DialogContent>
        </Dialog>
      </div>

      <ExportButtons data={flattenForExport(colaboradores, { Nome: "nome", Cargo: "cargo", Departamento: "departamento", Vinculo: "tipo_contrato", Ativo: "ativo" })} filename="rh-colaboradores" titulo="Colaboradores" />

      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar colaborador..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterVinculo} onValueChange={setFilterVinculo}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Vínculo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="clt">CLT</SelectItem>
            <SelectItem value="pj">PJ</SelectItem>
            <SelectItem value="autonomo">Autônomo</SelectItem>
            <SelectItem value="estagiario">Estagiário</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("nome")}><span className="flex items-center gap-1">Nome <ArrowUpDown className="h-3 w-3" /></span></TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("cargo")}><span className="flex items-center gap-1">Cargo <ArrowUpDown className="h-3 w-3" /></span></TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Vínculo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Admissão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum colaborador encontrado</TableCell></TableRow>
              ) : filtered.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell>{c.cargo || "—"}</TableCell>
                  <TableCell>{c.departamento || "—"}</TableCell>
                  <TableCell><Badge variant="outline">{c.tipo_contrato || "—"}</Badge></TableCell>
                  <TableCell><Badge variant={c.ativo !== false ? "default" : "secondary"}>{c.ativo !== false ? "Ativo" : "Inativo"}</Badge></TableCell>
                  <TableCell>{c.data_admissao ? format(new Date(c.data_admissao), "dd/MM/yyyy") : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
