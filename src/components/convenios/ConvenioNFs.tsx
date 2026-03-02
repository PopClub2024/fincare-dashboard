import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, FileText, AlertCircle, CheckCircle2 } from "lucide-react";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface Props {
  dateFrom: Date;
  dateTo: Date;
  convenioId: string | null;
}

interface NF {
  id: string;
  convenio_id: string;
  competencia: string;
  numero_nf: string | null;
  data_emissao: string | null;
  data_envio: string | null;
  valor_faturado: number;
  valor_esperado: number;
  valor_recebido: number;
  valor_glosado: number;
  status: string;
  credenciador_pagador: string | null;
  observacoes: string | null;
  convenios?: { nome: string } | null;
}

interface Convenio {
  id: string;
  nome: string;
}

const statusLabels: Record<string, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  a_receber: "A Receber",
  paga: "Paga",
  glosa_parcial: "Glosa Parcial",
  glosa_total: "Glosa Total",
  divergente: "Divergente",
};

const statusVariant = (s: string) => {
  switch (s) {
    case "paga": return "default" as const;
    case "a_receber": case "enviada": return "outline" as const;
    case "glosa_parcial": return "secondary" as const;
    case "glosa_total": case "divergente": return "destructive" as const;
    default: return "outline" as const;
  }
};

export default function ConvenioNFs({ dateFrom, dateTo, convenioId }: Props) {
  const { clinicaId } = useAuth();
  const [nfs, setNfs] = useState<NF[]>([]);
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingNf, setEditingNf] = useState<NF | null>(null);

  // Form state
  const [formConvenioId, setFormConvenioId] = useState("");
  const [formCompetencia, setFormCompetencia] = useState(format(new Date(), "yyyy-MM-01"));
  const [formNumeroNf, setFormNumeroNf] = useState("");
  const [formDataEmissao, setFormDataEmissao] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formValorFaturado, setFormValorFaturado] = useState("");
  const [formValorEsperado, setFormValorEsperado] = useState("");
  const [formCredenciador, setFormCredenciador] = useState("");
  const [formObs, setFormObs] = useState("");
  const [formStatus, setFormStatus] = useState("a_receber");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clinicaId) return;
    fetchAll();
  }, [clinicaId, dateFrom, dateTo, convenioId]);

  const fetchAll = async () => {
    setLoading(true);
    const [nfRes, convRes] = await Promise.all([
      (() => {
        let q = supabase
          .from("convenios_nf")
          .select("*, convenios(nome)")
          .eq("clinica_id", clinicaId!)
          .gte("competencia", format(dateFrom, "yyyy-MM-dd"))
          .lte("competencia", format(dateTo, "yyyy-MM-dd"))
          .order("competencia", { ascending: false });
        if (convenioId) q = q.eq("convenio_id", convenioId);
        return q;
      })(),
      supabase.from("convenios").select("id, nome").eq("clinica_id", clinicaId!).eq("ativo", true).order("nome"),
    ]);
    setNfs((nfRes.data as any[]) || []);
    setConvenios((convRes.data as any[]) || []);
    setLoading(false);
  };

  const openNew = () => {
    setEditingNf(null);
    setFormConvenioId(convenioId || "");
    setFormCompetencia(format(new Date(), "yyyy-MM-01"));
    setFormNumeroNf("");
    setFormDataEmissao(format(new Date(), "yyyy-MM-dd"));
    setFormValorFaturado("");
    setFormValorEsperado("");
    setFormCredenciador("");
    setFormObs("");
    setFormStatus("a_receber");
    setShowDialog(true);
  };

  const openEdit = (nf: NF) => {
    setEditingNf(nf);
    setFormConvenioId(nf.convenio_id);
    setFormCompetencia(nf.competencia);
    setFormNumeroNf(nf.numero_nf || "");
    setFormDataEmissao(nf.data_emissao || "");
    setFormValorFaturado(String(nf.valor_faturado));
    setFormValorEsperado(String(nf.valor_esperado));
    setFormCredenciador(nf.credenciador_pagador || "");
    setFormObs(nf.observacoes || "");
    setFormStatus(nf.status);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!clinicaId || !formConvenioId) return;
    setSaving(true);
    const payload = {
      clinica_id: clinicaId,
      convenio_id: formConvenioId,
      competencia: formCompetencia,
      numero_nf: formNumeroNf || null,
      data_emissao: formDataEmissao || null,
      valor_faturado: Number(formValorFaturado) || 0,
      valor_esperado: Number(formValorEsperado) || Number(formValorFaturado) || 0,
      credenciador_pagador: formCredenciador || null,
      observacoes: formObs || null,
      status: formStatus as any,
    };

    let error;
    if (editingNf) {
      ({ error } = await supabase.from("convenios_nf").update(payload).eq("id", editingNf.id));
    } else {
      ({ error } = await supabase.from("convenios_nf").insert(payload));
    }

    if (error) {
      toast.error("Erro: " + error.message);
    } else {
      toast.success(editingNf ? "NF atualizada!" : "NF criada!");
      setShowDialog(false);
      fetchAll();
    }
    setSaving(false);
  };

  const totals = useMemo(() => {
    const faturado = nfs.reduce((s, n) => s + n.valor_faturado, 0);
    const esperado = nfs.reduce((s, n) => s + n.valor_esperado, 0);
    const recebido = nfs.reduce((s, n) => s + n.valor_recebido, 0);
    const glosado = nfs.reduce((s, n) => s + n.valor_glosado, 0);
    return { faturado, esperado, recebido, glosado };
  }, [nfs]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Faturado</p><p className="text-lg font-bold">{fmt(totals.faturado)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Esperado</p><p className="text-lg font-bold">{fmt(totals.esperado)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Recebido</p><p className="text-lg font-bold text-emerald-600">{fmt(totals.recebido)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Glosado</p><p className="text-lg font-bold text-destructive">{fmt(totals.glosado)}</p></CardContent></Card>
      </div>

      <div className="flex items-center justify-between">
        <Badge variant="secondary">{nfs.length} NFs</Badge>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova NF</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : nfs.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <FileText className="mx-auto mb-3 h-8 w-8" />
              <p>Nenhuma NF de convênio registrada.</p>
              <p className="text-xs mt-1">Clique em "Nova NF" para criar.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Convênio</TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead>Nº NF</TableHead>
                  <TableHead className="text-right">Faturado</TableHead>
                  <TableHead className="text-right">Esperado</TableHead>
                  <TableHead className="text-right">Recebido</TableHead>
                  <TableHead className="text-right">Glosa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nfs.map((nf) => (
                  <TableRow key={nf.id}>
                    <TableCell className="font-medium text-sm">{nf.convenios?.nome || "—"}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {new Date(nf.competencia + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell className="text-sm">{nf.numero_nf || "—"}</TableCell>
                    <TableCell className="text-right text-sm">{fmt(nf.valor_faturado)}</TableCell>
                    <TableCell className="text-right text-sm">{fmt(nf.valor_esperado)}</TableCell>
                    <TableCell className="text-right text-sm text-emerald-600">{nf.valor_recebido > 0 ? fmt(nf.valor_recebido) : "—"}</TableCell>
                    <TableCell className="text-right text-sm text-destructive">{nf.valor_glosado > 0 ? fmt(nf.valor_glosado) : "—"}</TableCell>
                    <TableCell><Badge variant={statusVariant(nf.status)}>{statusLabels[nf.status] || nf.status}</Badge></TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEdit(nf)}>Editar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog NF */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingNf ? "Editar NF Convênio" : "Nova NF Convênio"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Convênio</Label>
              <Select value={formConvenioId} onValueChange={setFormConvenioId}>
                <SelectTrigger><SelectValue placeholder="Selecionar convênio" /></SelectTrigger>
                <SelectContent>
                  {convenios.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Competência</Label><Input type="date" value={formCompetencia} onChange={e => setFormCompetencia(e.target.value)} /></div>
              <div><Label>Nº NF</Label><Input value={formNumeroNf} onChange={e => setFormNumeroNf(e.target.value)} placeholder="Ex: 12345" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Valor Faturado</Label><Input type="number" step="0.01" value={formValorFaturado} onChange={e => setFormValorFaturado(e.target.value)} /></div>
              <div><Label>Valor Esperado</Label><Input type="number" step="0.01" value={formValorEsperado} onChange={e => setFormValorEsperado(e.target.value)} placeholder="Mesmo que faturado" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data Emissão</Label><Input type="date" value={formDataEmissao} onChange={e => setFormDataEmissao(e.target.value)} /></div>
              <div>
                <Label>Status</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="enviada">Enviada</SelectItem>
                    <SelectItem value="a_receber">A Receber</SelectItem>
                    <SelectItem value="paga">Paga</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Credenciador/Pagador (para match no extrato)</Label>
              <Input value={formCredenciador} onChange={e => setFormCredenciador(e.target.value)} placeholder="Ex: UNIMED, SUL AMERICA" />
              <p className="text-xs text-muted-foreground mt-1">Texto que aparece no memo do extrato bancário quando o convênio paga.</p>
            </div>
            <div><Label>Observações</Label><Textarea value={formObs} onChange={e => setFormObs(e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !formConvenioId}>
              {saving ? "Salvando..." : editingNf ? "Atualizar" : "Criar NF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
