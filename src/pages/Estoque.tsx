import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { PageHeader, KpiCards, FilterPills, DataTable, StatusBadge } from "@/components/medicpop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { Plus, AlertTriangle } from "lucide-react";
import ExportButtons from "@/components/ExportButtons";
import { flattenForExport } from "@/lib/export-utils";

export default function Estoque() {
  const { clinicaId } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("todos");
  const [statusPill, setStatusPill] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ nome: "", categoria: "administrativo", fabricante: "", quantidade_atual: "", quantidade_minima: "5", valor_unitario: "", lote: "", validade: "" });

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["estoque", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("estoque_itens").select("*").eq("clinica_id", clinicaId).order("nome");
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const criarItem = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("estoque_itens").insert({
        clinica_id: clinicaId, nome: form.nome, categoria: form.categoria,
        fabricante: form.fabricante || null, quantidade_atual: parseInt(form.quantidade_atual) || 0,
        quantidade_minima: parseInt(form.quantidade_minima) || 5,
        valor_unitario: form.valor_unitario ? parseFloat(form.valor_unitario) : null,
        lote: form.lote || null, validade: form.validade || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item cadastrado!"); queryClient.invalidateQueries({ queryKey: ["estoque"] }); setDialogOpen(false);
      setForm({ nome: "", categoria: "administrativo", fabricante: "", quantidade_atual: "", quantidade_minima: "5", valor_unitario: "", lote: "", validade: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const alertasBaixo = itens.filter((i: any) => i.quantidade_atual <= i.quantidade_minima);
  const alertasValidade = itens.filter((i: any) => i.validade && differenceInDays(new Date(i.validade), new Date()) <= 30);

  const filtered = itens.filter((i: any) => {
    if (catFilter !== "todos" && i.categoria !== catFilter) return false;
    if (statusPill === "baixo" && i.quantidade_atual > i.quantidade_minima) return false;
    if (statusPill === "vencendo" && !(i.validade && differenceInDays(new Date(i.validade), new Date()) <= 30)) return false;
    if (search && !i.nome?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const kpis = [
    { label: "Total de itens", value: itens.length, isCurrency: false },
    { label: "Estoque baixo", value: alertasBaixo.length, isCurrency: false, sublabel: "abaixo do mínimo", sublabelColor: "#E24B4A" },
    { label: "Vencendo em 30d", value: alertasValidade.length, isCurrency: false, sublabel: "atenção", sublabelColor: "#BA7517" },
    { label: "Categorias", value: new Set(itens.map((i: any) => i.categoria)).size, isCurrency: false },
  ];

  const columns = [
    { key: "nome", header: "Item", width: "25%", render: (row: any) => (<div><p className="font-medium text-[13px] text-foreground">{row.nome}</p>{row.fabricante && <p className="text-[11px] text-muted-foreground">{row.fabricante}</p>}</div>) },
    { key: "categoria", header: "Categoria", width: "14%", render: (row: any) => <StatusBadge status={row.categoria} type="centro_custo" label={row.categoria === "asg" ? "ASG" : row.categoria === "medico" ? "Médico" : "Admin"} /> },
    { key: "qtd", header: "Qtd", width: "8%", align: "right" as const, render: (row: any) => {
      const baixo = row.quantidade_atual <= row.quantidade_minima;
      return <span className={`font-medium ${baixo ? "text-destructive" : "text-foreground"}`}>{row.quantidade_atual}</span>;
    }},
    { key: "min", header: "Mín", width: "8%", align: "right" as const, render: (row: any) => <span className="text-muted-foreground">{row.quantidade_minima}</span> },
    { key: "valor", header: "Valor Unit.", width: "10%", align: "right" as const, render: (row: any) => row.valor_unitario ? <span className="font-medium">R$ {Number(row.valor_unitario).toFixed(2)}</span> : <span className="text-muted-foreground/50">—</span> },
    { key: "lote", header: "Lote", width: "10%", render: (row: any) => <span className="text-muted-foreground">{row.lote || "—"}</span> },
    { key: "validade", header: "Validade", width: "12%", render: (row: any) => {
      if (!row.validade) return <span className="text-muted-foreground/50">—</span>;
      const dias = differenceInDays(new Date(row.validade), new Date());
      return <span className={`${dias < 0 ? "text-destructive font-medium" : dias <= 30 ? "text-warning font-medium" : "text-muted-foreground"}`}>{format(new Date(row.validade), "dd/MM/yy")}</span>;
    }},
    { key: "status", header: "Status", width: "13%", align: "center" as const, render: (row: any) => {
      const baixo = row.quantidade_atual <= row.quantidade_minima;
      const vencendo = row.validade && differenceInDays(new Date(row.validade), new Date()) <= 30;
      if (baixo) return <StatusBadge status="vencido" label="Estoque baixo" />;
      if (vencendo) return <StatusBadge status="alerta" type="financial" label="Vencendo" />;
      return <StatusBadge status="pago" label="OK" />;
    }},
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <PageHeader title="Estoque" subtitle="Administrativo, Médico e ASG" actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9 gap-1.5 text-[13px] font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/90">
                <Plus className="h-3.5 w-3.5" /> Novo Item
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="text-foreground">Cadastrar Item</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><Label className="text-xs text-muted-foreground">Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
                <div><Label className="text-xs text-muted-foreground">Categoria</Label>
                  <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="administrativo">Administrativo</SelectItem><SelectItem value="medico">Médico</SelectItem><SelectItem value="asg">ASG</SelectItem></SelectContent>
                  </Select></div>
                <div><Label className="text-xs text-muted-foreground">Fabricante</Label><Input value={form.fabricante} onChange={(e) => setForm({ ...form, fabricante: e.target.value })} /></div>
                <div><Label className="text-xs text-muted-foreground">Qtd Atual</Label><Input type="number" value={form.quantidade_atual} onChange={(e) => setForm({ ...form, quantidade_atual: e.target.value })} /></div>
                <div><Label className="text-xs text-muted-foreground">Qtd Mínima</Label><Input type="number" value={form.quantidade_minima} onChange={(e) => setForm({ ...form, quantidade_minima: e.target.value })} /></div>
                <div><Label className="text-xs text-muted-foreground">Valor Unit.</Label><Input type="number" step="0.01" value={form.valor_unitario} onChange={(e) => setForm({ ...form, valor_unitario: e.target.value })} /></div>
                <div><Label className="text-xs text-muted-foreground">Lote</Label><Input value={form.lote} onChange={(e) => setForm({ ...form, lote: e.target.value })} /></div>
                <div><Label className="text-xs text-muted-foreground">Validade</Label><Input type="date" value={form.validade} onChange={(e) => setForm({ ...form, validade: e.target.value })} /></div>
              </div>
              <Button onClick={() => criarItem.mutate()} disabled={!form.nome} className="mt-4 w-full font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/90">Cadastrar</Button>
            </DialogContent>
          </Dialog>
        } />

        <KpiCards items={kpis} />

        <FilterPills
          pills={[
            { key: "todos", label: "Todos", count: itens.length },
            { key: "baixo", label: "Estoque baixo", count: alertasBaixo.length, color: { bg: "transparent", text: "#E24B4A", border: "rgba(226,75,74,0.3)" } },
            { key: "vencendo", label: "Vencendo", count: alertasValidade.length, color: { bg: "transparent", text: "#BA7517", border: "rgba(186,117,23,0.3)" } },
          ]}
          activePill={statusPill}
          onPillChange={setStatusPill}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar item..."
          extraActions={
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="h-9 w-[160px] text-[13px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas categorias</SelectItem>
                <SelectItem value="administrativo">Administrativo</SelectItem>
                <SelectItem value="medico">Médico</SelectItem>
                <SelectItem value="asg">ASG</SelectItem>
              </SelectContent>
            </Select>
          }
        />

        <DataTable
          columns={columns}
          data={filtered}
          loading={isLoading}
          exportFilename="estoque"
          exportTitle="Estoque"
          pagination={{ page, pageSize: 20, total: filtered.length, onPageChange: setPage }}
        />
      </div>
    </DashboardLayout>
  );
}
