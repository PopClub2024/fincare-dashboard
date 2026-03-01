import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { Plus, Save, Check } from "lucide-react";
import { toast } from "sonner";

const fmt = (v: number | null | undefined) =>
  v != null ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v) : "—";

interface Props {
  dateFrom: Date;
  dateTo: Date;
  convenioId: string | null;
}

interface Faturamento {
  id: string;
  convenio_id: string;
  convenios: { nome: string } | null;
  competencia: string;
  periodo_referencia: string | null;
  numero_nf: string | null;
  data_emissao: string | null;
  valor_nf: number | null;
  valor_calculado: number;
  valor_enviado: number | null;
  valor_liberado: number | null;
  glosa_estimada: number | null;
  previsao_pagamento: string | null;
  status_pagamento: string;
  data_pagamento: string | null;
  observacoes: string | null;
}

interface Convenio {
  id: string;
  nome: string;
}

const statusColors: Record<string, string> = {
  a_emitir: "bg-muted text-muted-foreground",
  emitida: "bg-blue-100 text-blue-700",
  enviada: "bg-amber-100 text-amber-700",
  a_receber: "bg-secondary/20 text-secondary",
  paga: "bg-emerald-100 text-emerald-700",
  atrasada: "bg-destructive/20 text-destructive",
};

const statusLabels: Record<string, string> = {
  a_emitir: "A Emitir",
  emitida: "Emitida",
  enviada: "Enviada",
  a_receber: "A Receber",
  paga: "Paga",
  atrasada: "Atrasada",
};

export default function ConvenioFaturamento({ dateFrom, dateTo, convenioId }: Props) {
  const { clinicaId } = useAuth();
  const [rows, setRows] = useState<Faturamento[]>([]);
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newNf, setNewNf] = useState({ convenio_id: "", competencia: "", numero_nf: "", valor_nf: "" });

  const fetchData = useCallback(async () => {
    if (!clinicaId) return;
    setLoading(true);
    let q = supabase
      .from("convenio_faturamentos_nf")
      .select("*, convenios(nome)")
      .eq("clinica_id", clinicaId)
      .gte("competencia", format(dateFrom, "yyyy-MM-dd"))
      .lte("competencia", format(dateTo, "yyyy-MM-dd"))
      .order("competencia", { ascending: false });

    if (convenioId) q = q.eq("convenio_id", convenioId);

    const { data } = await q;
    setRows((data as any) || []);
    setLoading(false);
  }, [clinicaId, dateFrom, dateTo, convenioId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!clinicaId) return;
    supabase
      .from("convenios")
      .select("id, nome")
      .eq("clinica_id", clinicaId)
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => data && setConvenios(data));
  }, [clinicaId]);

  const handleSaveValorEnviado = async (id: string) => {
    const val = parseFloat(editValue.replace(/[^\d.,]/g, "").replace(",", "."));
    if (isNaN(val)) {
      toast.error("Valor inválido");
      return;
    }
    const { error } = await supabase
      .from("convenio_faturamentos_nf")
      .update({ valor_enviado: val })
      .eq("id", id);
    if (error) {
      toast.error("Erro ao salvar");
    } else {
      toast.success("Valor enviado salvo");
      setEditingId(null);
      fetchData();
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    const updates: any = { status_pagamento: status };
    if (status === "paga") updates.data_pagamento = format(new Date(), "yyyy-MM-dd");
    const { error } = await supabase.from("convenio_faturamentos_nf").update(updates).eq("id", id);
    if (error) toast.error("Erro ao atualizar status");
    else {
      toast.success("Status atualizado");
      fetchData();
    }
  };

  const handleCreate = async () => {
    if (!clinicaId || !newNf.convenio_id || !newNf.competencia) {
      toast.error("Preencha convênio e competência");
      return;
    }
    const comp = newNf.competencia + "-01";
    const { error } = await supabase.from("convenio_faturamentos_nf").insert({
      clinica_id: clinicaId,
      convenio_id: newNf.convenio_id,
      competencia: comp,
      numero_nf: newNf.numero_nf || null,
      valor_nf: newNf.valor_nf ? parseFloat(newNf.valor_nf.replace(",", ".")) : null,
    });
    if (error) {
      if (error.code === "23505") toast.error("Já existe NF para este convênio/competência");
      else toast.error("Erro ao criar NF");
    } else {
      toast.success("NF criada");
      setDialogOpen(false);
      setNewNf({ convenio_id: "", competencia: "", numero_nf: "", valor_nf: "" });
      fetchData();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> Criar NF
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova NF / Faturamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Convênio</Label>
                <Select value={newNf.convenio_id} onValueChange={(v) => setNewNf({ ...newNf, convenio_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {convenios.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Competência (mês)</Label>
                <Input type="month" value={newNf.competencia} onChange={(e) => setNewNf({ ...newNf, competencia: e.target.value })} />
              </div>
              <div>
                <Label>Nº NF</Label>
                <Input value={newNf.numero_nf} onChange={(e) => setNewNf({ ...newNf, numero_nf: e.target.value })} />
              </div>
              <div>
                <Label>Valor NF (R$)</Label>
                <Input value={newNf.valor_nf} onChange={(e) => setNewNf({ ...newNf, valor_nf: e.target.value })} placeholder="0,00" />
              </div>
              <Button onClick={handleCreate} className="w-full">Criar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Convênio</TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead>NF</TableHead>
                  <TableHead className="text-right">Calculado</TableHead>
                  <TableHead className="text-right">Valor NF</TableHead>
                  <TableHead className="text-right bg-amber-50">Valor Enviado ✏️</TableHead>
                  <TableHead className="text-right">Liberado</TableHead>
                  <TableHead className="text-right">Glosa Est.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prev. Pgto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      Nenhuma NF encontrada. Clique em "Criar NF" para adicionar.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r) => {
                  const diff = r.valor_nf != null ? r.valor_nf - r.valor_calculado : null;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium text-sm">{(r as any).convenios?.nome || "—"}</TableCell>
                      <TableCell className="text-sm">{format(new Date(r.competencia), "MMM/yyyy")}</TableCell>
                      <TableCell className="text-sm">{r.numero_nf || "—"}</TableCell>
                      <TableCell className="text-right text-sm">{fmt(r.valor_calculado)}</TableCell>
                      <TableCell className="text-right text-sm">
                        {fmt(r.valor_nf)}
                        {diff != null && diff !== 0 && (
                          <span className={`ml-1 text-xs ${diff > 0 ? "text-emerald-600" : "text-destructive"}`}>
                            ({diff > 0 ? "+" : ""}{fmt(diff)})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right bg-amber-50/50">
                        {editingId === r.id ? (
                          <div className="flex items-center gap-1 justify-end">
                            <Input
                              className="w-28 h-7 text-right text-sm"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleSaveValorEnviado(r.id)}
                              autoFocus
                            />
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleSaveValorEnviado(r.id)}>
                              <Save className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            className="text-sm font-medium hover:underline cursor-pointer"
                            onClick={() => { setEditingId(r.id); setEditValue(r.valor_enviado?.toString() || ""); }}
                          >
                            {r.valor_enviado != null ? fmt(r.valor_enviado) : "Editar"}
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm text-emerald-600">{fmt(r.valor_liberado)}</TableCell>
                      <TableCell className="text-right text-sm text-destructive">{fmt(r.glosa_estimada)}</TableCell>
                      <TableCell>
                        <Select value={r.status_pagamento} onValueChange={(v) => handleStatusChange(r.id, v)}>
                          <SelectTrigger className="h-7 w-[110px] text-xs border-0">
                            <Badge className={`${statusColors[r.status_pagamento]} text-xs`}>
                              {statusLabels[r.status_pagamento]}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(statusLabels).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.previsao_pagamento ? format(new Date(r.previsao_pagamento), "dd/MM/yy") : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
