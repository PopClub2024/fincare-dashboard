import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { Plus, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const fmt = (v: number | null | undefined) =>
  v != null ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v) : "—";

interface Props {
  dateFrom: Date;
  dateTo: Date;
  convenioId: string | null;
}

const statusRecursoLabels: Record<string, string> = {
  nao_iniciado: "Não iniciado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  negado: "Negado",
  parcial: "Parcial",
};

const statusRecursoColors: Record<string, string> = {
  nao_iniciado: "bg-muted text-muted-foreground",
  em_andamento: "bg-amber-100 text-amber-700",
  concluido: "bg-emerald-100 text-emerald-700",
  negado: "bg-destructive/20 text-destructive",
  parcial: "bg-blue-100 text-blue-700",
};

interface Convenio { id: string; nome: string; }

export default function ConvenioGlosas({ dateFrom, dateTo, convenioId }: Props) {
  const { clinicaId } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    convenio_id: "", competencia: "", protocolo: "",
    valor_apresentado: "", valor_aprovado: "", valor_glosado: "",
    valor_recursado: "", valor_liberado: "", valor_negado: "",
    status_recurso: "nao_iniciado", observacoes: "",
  });

  const fetchData = useCallback(async () => {
    if (!clinicaId) return;
    setLoading(true);
    let q = supabase
      .from("convenio_glosas")
      .select("*, convenios(nome)")
      .eq("clinica_id", clinicaId)
      .gte("competencia", format(dateFrom, "yyyy-MM-dd"))
      .lte("competencia", format(dateTo, "yyyy-MM-dd"))
      .order("competencia", { ascending: false });
    if (convenioId) q = q.eq("convenio_id", convenioId);
    const { data } = await q;
    setRows(data || []);
    setLoading(false);
  }, [clinicaId, dateFrom, dateTo, convenioId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!clinicaId) return;
    supabase.from("convenios").select("id, nome").eq("clinica_id", clinicaId).eq("ativo", true).order("nome")
      .then(({ data }) => data && setConvenios(data));
  }, [clinicaId]);

  const parseNum = (s: string) => { const v = parseFloat(s.replace(",", ".")); return isNaN(v) ? 0 : v; };

  const handleCreate = async () => {
    if (!clinicaId || !form.convenio_id || !form.competencia) {
      toast.error("Preencha convênio e competência"); return;
    }
    const { error } = await supabase.from("convenio_glosas").insert({
      clinica_id: clinicaId,
      convenio_id: form.convenio_id,
      competencia: form.competencia + "-01",
      protocolo: form.protocolo || null,
      valor_apresentado: parseNum(form.valor_apresentado),
      valor_aprovado: parseNum(form.valor_aprovado),
      valor_glosado: parseNum(form.valor_glosado),
      valor_recursado: parseNum(form.valor_recursado) || null,
      valor_liberado: parseNum(form.valor_liberado) || null,
      valor_negado: parseNum(form.valor_negado) || null,
      status_recurso: form.status_recurso as any,
      observacoes: form.observacoes || null,
    });
    if (error) toast.error("Erro ao criar glosa");
    else { toast.success("Glosa registrada"); setDialogOpen(false); fetchData(); }
  };

  const handleMarkPaid = async (id: string) => {
    const { error } = await supabase.from("convenio_glosas").update({
      pago: true,
      data_pagamento: format(new Date(), "yyyy-MM-dd"),
    }).eq("id", id);
    if (error) toast.error("Erro"); else { toast.success("Marcado como pago"); fetchData(); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Summary cards
  const totals = rows.reduce((acc, r) => ({
    apresentado: acc.apresentado + (r.valor_apresentado || 0),
    aprovado: acc.aprovado + (r.valor_aprovado || 0),
    glosado: acc.glosado + (r.valor_glosado || 0),
    recursado: acc.recursado + (r.valor_recursado || 0),
    liberado: acc.liberado + (r.valor_liberado || 0),
    negado: acc.negado + (r.valor_negado || 0),
  }), { apresentado: 0, aprovado: 0, glosado: 0, recursado: 0, liberado: 0, negado: 0 });

  const pctGlosa = totals.apresentado > 0 ? (totals.glosado / totals.apresentado * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        {[
          { label: "Apresentado", value: fmt(totals.apresentado) },
          { label: "Aprovado", value: fmt(totals.aprovado) },
          { label: "Glosado", value: fmt(totals.glosado), color: "text-destructive" },
          { label: "% Glosa", value: `${pctGlosa.toFixed(1)}%`, color: "text-destructive" },
          { label: "Recursado", value: fmt(totals.recursado) },
          { label: "Liberado", value: fmt(totals.liberado), color: "text-emerald-600" },
        ].map((c) => (
          <Card key={c.label} className="border-0 shadow-md">
            <CardContent className="p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{c.label}</p>
              <p className={`text-lg font-bold ${c.color || ""}`}>{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Adicionar Glosa</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nova Glosa</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="col-span-2">
                <Label>Convênio</Label>
                <Select value={form.convenio_id} onValueChange={(v) => setForm({ ...form, convenio_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {convenios.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Competência</Label>
                <Input type="month" value={form.competencia} onChange={(e) => setForm({ ...form, competencia: e.target.value })} />
              </div>
              <div>
                <Label>Protocolo</Label>
                <Input value={form.protocolo} onChange={(e) => setForm({ ...form, protocolo: e.target.value })} />
              </div>
              {["valor_apresentado", "valor_aprovado", "valor_glosado", "valor_recursado", "valor_liberado", "valor_negado"].map((field) => (
                <div key={field}>
                  <Label>{field.replace("valor_", "").replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase())} (R$)</Label>
                  <Input value={(form as any)[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} placeholder="0,00" />
                </div>
              ))}
              <div>
                <Label>Status Recurso</Label>
                <Select value={form.status_recurso} onValueChange={(v) => setForm({ ...form, status_recurso: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusRecursoLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Observações</Label>
                <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} />
              </div>
              <div className="col-span-2">
                <Button onClick={handleCreate} className="w-full">Registrar Glosa</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Convênio</TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead>Protocolo</TableHead>
                  <TableHead className="text-right">Apresentado</TableHead>
                  <TableHead className="text-right">Glosado</TableHead>
                  <TableHead className="text-right">Recursado</TableHead>
                  <TableHead className="text-right">Liberado</TableHead>
                  <TableHead className="text-right">Negado</TableHead>
                  <TableHead>Recurso</TableHead>
                  <TableHead>Pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      Nenhuma glosa registrada.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm font-medium">{r.convenios?.nome || "—"}</TableCell>
                    <TableCell className="text-sm">{format(new Date(r.competencia), "MMM/yyyy")}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.protocolo || "—"}</TableCell>
                    <TableCell className="text-right text-sm">{fmt(r.valor_apresentado)}</TableCell>
                    <TableCell className="text-right text-sm text-destructive">{fmt(r.valor_glosado)}</TableCell>
                    <TableCell className="text-right text-sm">{fmt(r.valor_recursado)}</TableCell>
                    <TableCell className="text-right text-sm text-emerald-600">{fmt(r.valor_liberado)}</TableCell>
                    <TableCell className="text-right text-sm text-destructive">{fmt(r.valor_negado)}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${statusRecursoColors[r.status_recurso]}`}>
                        {statusRecursoLabels[r.status_recurso]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {r.pago ? (
                        <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {r.data_pagamento ? format(new Date(r.data_pagamento), "dd/MM") : "Sim"}
                        </Badge>
                      ) : (
                        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => handleMarkPaid(r.id)}>
                          Marcar pago
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
