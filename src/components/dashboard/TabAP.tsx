import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { useCashKpis } from "@/hooks/useCashKpis";
import { AlertTriangle, Clock, CheckCircle, DollarSign, FileWarning } from "lucide-react";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface Props {
  dateFrom: Date;
  dateTo: Date;
}

interface APByCategoria {
  categoria: string;
  tipo_despesa: string;
  total: number;
  count: number;
}

interface APLancamento {
  id: string;
  descricao: string | null;
  fornecedor: string | null;
  valor: number;
  data_vencimento: string | null;
  data_competencia: string;
  status: string;
  tipo_despesa: string;
  comprovante_id: string | null;
  plano_contas?: { categoria: string; descricao: string } | null;
}

export default function TabAP({ dateFrom, dateTo }: Props) {
  const { clinicaId } = useAuth();
  const { data: cashData, loading: cashLoading } = useCashKpis(dateFrom, dateTo);
  const [apByCategoria, setApByCategoria] = useState<APByCategoria[]>([]);
  const [apLancamentos, setApLancamentos] = useState<APLancamento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clinicaId) return;
    fetchAPDetails();
  }, [clinicaId, dateFrom, dateTo]);

  const fetchAPDetails = async () => {
    setLoading(true);
    try {
      const { data: lancamentos } = await supabase
        .from("contas_pagar_lancamentos")
        .select("id, descricao, fornecedor, valor, data_vencimento, data_competencia, status, tipo_despesa, comprovante_id, plano_contas(categoria, descricao)")
        .eq("clinica_id", clinicaId!)
        .in("status", ["a_classificar", "classificado"])
        .is("data_pagamento", null)
        .lte("data_competencia", format(dateTo, "yyyy-MM-dd"))
        .order("data_vencimento", { ascending: true });

      if (lancamentos) {
        setApLancamentos(lancamentos as unknown as APLancamento[]);

        // Group by categoria
        const byCat: Record<string, { tipo_despesa: string; total: number; count: number }> = {};
        lancamentos.forEach((l: any) => {
          const cat = l.plano_contas?.categoria || "Sem categoria";
          if (!byCat[cat]) byCat[cat] = { tipo_despesa: l.tipo_despesa, total: 0, count: 0 };
          byCat[cat].total += Number(l.valor);
          byCat[cat].count += 1;
        });
        setApByCategoria(
          Object.entries(byCat)
            .map(([k, v]) => ({ categoria: k, ...v }))
            .sort((a, b) => b.total - a.total)
        );
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  };

  const isLoading = loading || cashLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const cards = cashData?.cards;
  const hasAP = cards && cards.ap_total > 0;
  const semComprovante = apLancamentos.filter((l) => !l.comprovante_id);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">AP Total</p>
              <div className="rounded-md bg-accent p-1.5"><DollarSign className="h-4 w-4" /></div>
            </div>
            <p className="text-lg font-bold text-foreground">{fmt(cards?.ap_total ?? 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">AP Vencido</p>
              <div className="rounded-md bg-destructive/10 p-1.5"><AlertTriangle className="h-4 w-4 text-destructive" /></div>
            </div>
            <p className="text-lg font-bold text-destructive">{fmt(cards?.ap_vencido ?? 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">AP a Vencer</p>
              <div className="rounded-md bg-emerald-100 p-1.5"><Clock className="h-4 w-4 text-emerald-600" /></div>
            </div>
            <p className="text-lg font-bold text-emerald-600">{fmt(cards?.ap_a_vencer ?? 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Sem Comprovante</p>
              <div className="rounded-md bg-amber-100 p-1.5"><FileWarning className="h-4 w-4 text-amber-600" /></div>
            </div>
            <p className="text-lg font-bold text-amber-600">{semComprovante.length}</p>
          </CardContent>
        </Card>
      </div>

      {!hasAP && (
        <Card className="border-0 shadow-md">
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
            <p className="text-lg font-semibold">Sem contas a pagar em aberto</p>
            <p className="text-sm text-muted-foreground mt-1">
              Todas as contas do período foram pagas ou ainda não há lançamentos.
            </p>
          </CardContent>
        </Card>
      )}

      {/* AP by Categoria Chart */}
      {apByCategoria.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">AP por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={apByCategoria.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="categoria" className="text-xs" width={180} />
                  <Tooltip formatter={(value: number) => fmt(value)} />
                  <Bar dataKey="total" name="Valor" radius={[0, 4, 4, 0]}>
                    {apByCategoria.slice(0, 10).map((entry, index) => (
                      <Cell key={index} fill={entry.tipo_despesa === "fixa" ? "hsl(204, 67%, 32%)" : "hsl(358, 74%, 44%)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-sm" style={{ backgroundColor: "hsl(204, 67%, 32%)" }} /> Fixo
              </span>
              <span className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-sm" style={{ backgroundColor: "hsl(358, 74%, 44%)" }} /> Variável
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AP Lancamentos Table */}
      {apLancamentos.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Contas a Pagar em Aberto</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornecedor / Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apLancamentos.slice(0, 50).map((l) => {
                  const vencido = l.data_vencimento && new Date(l.data_vencimento) < new Date();
                  return (
                    <TableRow key={l.id} className={vencido ? "bg-destructive/5" : ""}>
                      <TableCell className="text-sm">
                        <div className="font-medium">{l.fornecedor || "—"}</div>
                        {l.descricao && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{l.descricao}</div>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {(l.plano_contas as any)?.categoria || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={l.tipo_despesa === "fixa" ? "default" : "secondary"} className="text-xs">
                          {l.tipo_despesa === "fixa" ? "Fixo" : "Variável"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">{fmt(l.valor)}</TableCell>
                      <TableCell className="text-sm">
                        {l.data_vencimento ? (
                          <span className={vencido ? "text-destructive font-medium" : ""}>
                            {format(new Date(l.data_vencimento + "T12:00:00"), "dd/MM/yyyy")}
                            {vencido && " ⚠️"}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Badge variant={l.status === "a_classificar" ? "destructive" : "outline"} className="text-xs">
                            {l.status === "a_classificar" ? "A classificar" : "Classificado"}
                          </Badge>
                          {!l.comprovante_id && (
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                              Sem comprv.
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {apLancamentos.length > 50 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Mostrando 50 de {apLancamentos.length} lançamentos
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
