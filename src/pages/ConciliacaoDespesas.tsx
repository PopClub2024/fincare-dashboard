import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, AlertTriangle, Clock, RefreshCw, Undo2, Eye, EyeOff,
} from "lucide-react";
import ExportButtons from "@/components/ExportButtons";
import { flattenForExport } from "@/lib/export-utils";

interface ConciliacaoDespesa {
  id: string;
  lancamento_id: string;
  transacao_bancaria_id: string | null;
  status: string;
  match_key: string | null;
  score: number | null;
  metodo_match: string | null;
  rule_applied: string | null;
  divergencia: number | null;
  observacao: string | null;
  conciliado_em: string | null;
  created_at: string;
  lancamento?: {
    descricao: string | null;
    fornecedor: string | null;
    valor: number;
    data_competencia: string;
    data_vencimento: string | null;
    forma_pagamento: string | null;
    status: string;
  };
  transacao_bancaria?: {
    descricao: string | null;
    valor: number;
    data_transacao: string;
  } | null;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ConciliacaoDespesas() {
  const { clinicaId } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<ConciliacaoDespesa[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clinicaId) return;
    setLoading(true);
    const { data: rows, error } = await supabase
      .from("conciliacao_despesas")
      .select(`
        id, lancamento_id, transacao_bancaria_id, status, match_key, score,
        metodo_match, rule_applied, divergencia, observacao, conciliado_em, created_at
      `)
      .eq("clinica_id", clinicaId)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const lancIds = [...new Set((rows || []).map((r: any) => r.lancamento_id).filter(Boolean))];
    const bankIds = [...new Set((rows || []).map((r: any) => r.transacao_bancaria_id).filter(Boolean))];

    const [lancRes, bankRes] = await Promise.all([
      lancIds.length > 0
        ? supabase.from("contas_pagar_lancamentos").select("id, descricao, fornecedor, valor, data_competencia, data_vencimento, forma_pagamento, status").in("id", lancIds)
        : { data: [] },
      bankIds.length > 0
        ? supabase.from("transacoes_bancarias").select("id, descricao, valor, data_transacao").in("id", bankIds)
        : { data: [] },
    ]);

    const lancMap = new Map((lancRes.data || []).map((l: any) => [l.id, l]));
    const bankMap = new Map((bankRes.data || []).map((b: any) => [b.id, b]));

    setData((rows || []).map((r: any) => ({
      ...r,
      lancamento: lancMap.get(r.lancamento_id) || undefined,
      transacao_bancaria: r.transacao_bancaria_id ? bankMap.get(r.transacao_bancaria_id) || null : null,
    })));
    setLoading(false);
  }, [clinicaId, toast]);

  useEffect(() => { load(); }, [load]);

  const confirmMatch = async (item: ConciliacaoDespesa) => {
    if (!item.transacao_bancaria_id || !clinicaId) return;
    setActionLoading(item.id);
    try {
      // Update conciliacao_despesas
      await supabase.from("conciliacao_despesas").update({
        status: "conciliado",
        conciliado_em: new Date().toISOString(),
        metodo_match: "manual_confirm",
      }).eq("id", item.id);

      // Update lancamento to pago
      const bankDate = item.transacao_bancaria?.data_transacao?.split("T")[0] || new Date().toISOString().split("T")[0];
      await supabase.from("contas_pagar_lancamentos").update({
        status: "pago",
        data_pagamento: bankDate,
        match_score: item.score,
        match_rule: "manual_confirm",
        needs_review: false,
      }).eq("id", item.lancamento_id);

      // Mark bank transaction
      await supabase.from("transacoes_bancarias")
        .update({ status: "conciliado", categoria_auto: `ap_manual:${item.lancamento_id}` })
        .eq("id", item.transacao_bancaria_id);

      toast({ title: "Conciliado", description: "Match confirmado com sucesso." });
      load();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setActionLoading(null);
  };

  const undoMatch = async (item: ConciliacaoDespesa) => {
    if (!clinicaId) return;
    setActionLoading(item.id);
    try {
      const prevTxId = item.transacao_bancaria_id;

      // Reset conciliacao to pendente
      await supabase.from("conciliacao_despesas").update({
        status: "pendente",
        transacao_bancaria_id: null,
        score: 0,
        conciliado_em: null,
        metodo_match: null,
        rule_applied: null,
        divergencia: 0,
      }).eq("id", item.id);

      // Reset lancamento
      await supabase.from("contas_pagar_lancamentos").update({
        status: "pendente_conciliacao",
        data_pagamento: null,
        match_score: null,
        match_rule: null,
        needs_review: false,
      }).eq("id", item.lancamento_id);

      // Release bank transaction
      if (prevTxId) {
        await supabase.from("transacoes_bancarias")
          .update({ status: "pendente", categoria_auto: null })
          .eq("id", prevTxId);
      }

      toast({ title: "Desfeito", description: "Conciliação revertida." });
      load();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setActionLoading(null);
  };

  const ignoreItem = async (item: ConciliacaoDespesa) => {
    setActionLoading(item.id);
    try {
      await supabase.from("conciliacao_despesas").update({
        status: "ignorado",
        observacao: (item.observacao || "") + " [ignorado manualmente]",
      }).eq("id", item.id);

      toast({ title: "Ignorado", description: "Item removido da fila." });
      load();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setActionLoading(null);
  };

  const counts = {
    pendente: data.filter(d => d.status === "pendente").length,
    conciliado: data.filter(d => d.status === "conciliado").length,
    divergente: data.filter(d => d.status === "divergente").length,
  };

  const renderRow = (d: ConciliacaoDespesa, tab: string) => (
    <TableRow key={d.id}>
      <TableCell><StatusBadge status={d.status} /></TableCell>
      <TableCell className="text-sm font-medium">{d.lancamento?.fornecedor || "-"}</TableCell>
      <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">
        {d.lancamento?.descricao || "-"}
      </TableCell>
      <TableCell className="text-right font-mono text-sm">
        {d.lancamento ? fmt(d.lancamento.valor) : "-"}
      </TableCell>
      <TableCell className="text-xs">
        {d.lancamento ? new Date(d.lancamento.data_competencia).toLocaleDateString("pt-BR") : "-"}
      </TableCell>
      {tab !== "pendente" && (
        <>
          <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">
            {d.transacao_bancaria?.descricao || "-"}
          </TableCell>
          <TableCell className="text-right font-mono text-sm">
            {d.transacao_bancaria ? fmt(Math.abs(d.transacao_bancaria.valor)) : "-"}
          </TableCell>
          <TableCell className="text-right font-mono text-xs">
            {d.divergencia != null && d.divergencia > 0
              ? <span className="text-amber-600">{fmt(d.divergencia)}</span>
              : <span className="text-emerald-600">R$ 0,00</span>}
          </TableCell>
          <TableCell className="text-xs">{d.score != null ? `${d.score.toFixed(0)}%` : "-"}</TableCell>
        </>
      )}
      <TableCell>
        <Badge variant="outline" className="text-xs">{d.lancamento?.forma_pagamento || "-"}</Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex gap-1 justify-end">
          {tab === "divergente" && (
            <>
              <Button size="sm" variant="default" disabled={actionLoading === d.id} onClick={() => confirmMatch(d)}>
                <CheckCircle2 className="mr-1 h-3 w-3" />Confirmar
              </Button>
              <Button size="sm" variant="outline" disabled={actionLoading === d.id} onClick={() => ignoreItem(d)}>
                <EyeOff className="mr-1 h-3 w-3" />Ignorar
              </Button>
            </>
          )}
          {tab === "conciliado" && (
            <Button size="sm" variant="outline" disabled={actionLoading === d.id} onClick={() => undoMatch(d)}>
              <Undo2 className="mr-1 h-3 w-3" />Desfazer
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Conciliação de Despesas</h1>
            <p className="text-sm text-muted-foreground">Comprovantes × Extrato Bancário</p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading} size="sm">
            <RefreshCw className="mr-1 h-4 w-4" />Atualizar
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle>
              <Clock className="h-5 w-5 text-amber-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{counts.pendente}</p>
              <p className="text-xs text-muted-foreground">aguardando extrato</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Conciliados</CardTitle>
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{counts.conciliado}</p>
              <p className="text-xs text-muted-foreground">comprovante ↔ extrato</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Divergentes</CardTitle>
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{counts.divergente}</p>
              <p className="text-xs text-muted-foreground">revisão necessária</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pendente">
          <TabsList>
            <TabsTrigger value="pendente">Pendentes ({counts.pendente})</TabsTrigger>
            <TabsTrigger value="divergente">Divergências ({counts.divergente})</TabsTrigger>
            <TabsTrigger value="conciliado">Conciliados ({counts.conciliado})</TabsTrigger>
          </TabsList>

          {["pendente", "divergente", "conciliado"].map((tab) => (
            <TabsContent key={tab} value={tab}>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead>Descrição AP</TableHead>
                        <TableHead className="text-right">Valor AP</TableHead>
                        <TableHead>Data</TableHead>
                        {tab !== "pendente" && <TableHead>Memo Extrato</TableHead>}
                        {tab !== "pendente" && <TableHead className="text-right">Valor Extrato</TableHead>}
                        {tab !== "pendente" && <TableHead className="text-right">Divergência</TableHead>}
                        {tab !== "pendente" && <TableHead>Score</TableHead>}
                        <TableHead>Forma Pgto</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.filter((d) => d.status === tab).map((d) => renderRow(d, tab))}
                      {data.filter((d) => d.status === tab).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={11} className="py-8 text-center text-sm text-muted-foreground">
                            {tab === "pendente"
                              ? "Nenhum comprovante pendente. Importe comprovantes via Make ou manualmente."
                              : tab === "divergente"
                              ? "Nenhuma divergência. Execute a conciliação após importar o extrato."
                              : "Nenhuma despesa conciliada ainda."}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "conciliado")
    return <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"><CheckCircle2 className="mr-1 h-3 w-3" />Conciliado</Badge>;
  if (status === "divergente")
    return <Badge variant="outline" className="border-amber-500/30 text-amber-600"><AlertTriangle className="mr-1 h-3 w-3" />Divergente</Badge>;
  if (status === "ignorado")
    return <Badge variant="outline" className="border-muted text-muted-foreground"><EyeOff className="mr-1 h-3 w-3" />Ignorado</Badge>;
  return <Badge variant="outline" className="border-muted text-muted-foreground"><Clock className="mr-1 h-3 w-3" />Pendente</Badge>;
}
