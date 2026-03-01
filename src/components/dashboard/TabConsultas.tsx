import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { toast } from "sonner";
import { Users, DollarSign, TrendingUp, UserX } from "lucide-react";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface Props {
  dateFrom: Date;
  dateTo: Date;
}

interface ConsultaRow {
  id: string;
  data_competencia: string;
  procedimento: string | null;
  valor_bruto: number;
  forma_pagamento: string | null;
  status_recebimento: string;
  data_prevista_recebimento: string | null;
  status_presenca: string | null;
  convenio_id: string | null;
  medicos: { nome: string } | null;
  pacientes: { nome: string } | null;
  convenios: { nome: string; prazo_repasse_dias: number | null } | null;
}

interface MedicoReceita {
  nome: string;
  total: number;
}

interface CanalMensal {
  mes: string;
  particular: number;
  convenio: number;
}

export default function TabConsultas({ dateFrom, dateTo }: Props) {
  const { clinicaId } = useAuth();
  const [consultas, setConsultas] = useState<ConsultaRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clinicaId) return;
    setLoading(true);
    supabase
      .from("transacoes_vendas")
      .select("id, data_competencia, procedimento, valor_bruto, forma_pagamento, status_recebimento, data_prevista_recebimento, status_presenca, convenio_id, medicos(nome), pacientes(nome), convenios(nome, prazo_repasse_dias)")
      .eq("clinica_id", clinicaId)
      .gte("data_competencia", format(dateFrom, "yyyy-MM-dd"))
      .lte("data_competencia", format(dateTo, "yyyy-MM-dd"))
      .order("data_competencia", { ascending: false })
      .limit(500)
      .then(({ data, error }) => {
        if (error) { toast.error(error.message); return; }
        setConsultas((data as unknown as ConsultaRow[]) || []);
        setLoading(false);
      });
  }, [clinicaId, dateFrom, dateTo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const totalConsultas = consultas.length;
  const receitaBruta = consultas.reduce((s, c) => s + c.valor_bruto, 0);
  const ticketMedio = totalConsultas > 0 ? receitaBruta / totalConsultas : 0;
  const faltas = consultas.filter((c) => c.status_presenca === "faltou").length;
  const taxaFalta = totalConsultas > 0 ? (faltas / totalConsultas) * 100 : 0;

  // Receita por médico
  const medicoMap = new Map<string, number>();
  consultas.forEach((c) => {
    const nome = (c.medicos as any)?.nome || "Sem médico";
    medicoMap.set(nome, (medicoMap.get(nome) || 0) + c.valor_bruto);
  });
  const medicoData: MedicoReceita[] = Array.from(medicoMap.entries())
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // Receita mensal por canal
  const canalMap = new Map<string, { particular: number; convenio: number }>();
  consultas.forEach((c) => {
    const mes = c.data_competencia.substring(0, 7);
    const entry = canalMap.get(mes) || { particular: 0, convenio: 0 };
    if (c.convenio_id) entry.convenio += c.valor_bruto;
    else entry.particular += c.valor_bruto;
    canalMap.set(mes, entry);
  });
  const canalData: CanalMensal[] = Array.from(canalMap.entries())
    .map(([mes, v]) => ({ mes, ...v }))
    .sort((a, b) => a.mes.localeCompare(b.mes));

  // Detalhe convênio
  const convMap = new Map<string, { prazo: number | null; faturado: number; recebido: number; pendente: number; qtd: number }>();
  consultas.forEach((c) => {
    const nome = c.convenio_id ? ((c.convenios as any)?.nome || "Convênio") : "Particular";
    const prazo = c.convenio_id ? (c.convenios as any)?.prazo_repasse_dias : null;
    const entry = convMap.get(nome) || { prazo, faturado: 0, recebido: 0, pendente: 0, qtd: 0 };
    entry.faturado += c.valor_bruto;
    entry.qtd++;
    if (c.status_recebimento === "recebido") entry.recebido += c.valor_bruto;
    else entry.pendente += c.valor_bruto;
    convMap.set(nome, entry);
  });
  const convData = Array.from(convMap.entries())
    .map(([nome, v]) => ({ nome, ...v }))
    .sort((a, b) => b.faturado - a.faturado);

  const statusBadge = (status: string) => {
    switch (status) {
      case "recebido": return <Badge className="bg-emerald-100 text-emerald-700 border-0">Recebido</Badge>;
      case "a_receber": return <Badge className="bg-amber-100 text-amber-700 border-0">A Receber</Badge>;
      case "inadimplente": return <Badge variant="destructive">Inadimplente</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard icon={<Users className="h-4 w-4" />} label="Total Consultas" value={totalConsultas.toString()} />
        <SummaryCard icon={<DollarSign className="h-4 w-4" />} label="Receita Bruta" value={fmt(receitaBruta)} />
        <SummaryCard icon={<TrendingUp className="h-4 w-4" />} label="Ticket Médio" value={fmt(ticketMedio)} />
        <SummaryCard icon={<UserX className="h-4 w-4" />} label="Taxa de Falta" value={`${taxaFalta.toFixed(1)}%`} negative={taxaFalta > 10} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Receita por Canal */}
        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle className="text-lg">Receita por Canal (Mensal)</CardTitle></CardHeader>
          <CardContent>
            {canalData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={canalData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="mes" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <RechartsTooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Bar dataKey="particular" name="Particular" fill="hsl(204, 67%, 32%)" stackId="a" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="convenio" name="Convênio" fill="hsl(152, 60%, 40%)" stackId="a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados no período</p>
            )}
          </CardContent>
        </Card>

        {/* Receita por Médico */}
        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle className="text-lg">Receita por Médico (Top 10)</CardTitle></CardHeader>
          <CardContent>
            {medicoData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={medicoData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="nome" className="text-xs" width={140} />
                    <RechartsTooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="total" name="Receita" fill="hsl(204, 67%, 32%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados no período</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detalhe por Convênio */}
      <Card className="border-0 shadow-md">
        <CardHeader><CardTitle className="text-lg">Detalhe por Pagador (Convênio / Particular)</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pagador</TableHead>
                <TableHead className="text-right">Prazo Repasse</TableHead>
                <TableHead className="text-right">Faturado</TableHead>
                <TableHead className="text-right">Recebido</TableHead>
                <TableHead className="text-right">Pendente</TableHead>
                <TableHead className="text-right">Consultas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {convData.map((c) => (
                <TableRow key={c.nome}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="text-right">{c.prazo != null ? `${c.prazo}d` : "D+1"}</TableCell>
                  <TableCell className="text-right">{fmt(c.faturado)}</TableCell>
                  <TableCell className="text-right text-emerald-600">{fmt(c.recebido)}</TableCell>
                  <TableCell className="text-right text-amber-600">{fmt(c.pendente)}</TableCell>
                  <TableCell className="text-right">{c.qtd}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Tabela de Consultas */}
      <Card className="border-0 shadow-md">
        <CardHeader><CardTitle className="text-lg">Consultas Realizadas</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Médico</TableHead>
                <TableHead>Procedimento</TableHead>
                <TableHead>Pagador</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Previsão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consultas.slice(0, 50).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="whitespace-nowrap">{c.data_competencia}</TableCell>
                  <TableCell>{(c.pacientes as any)?.nome || "—"}</TableCell>
                  <TableCell>{(c.medicos as any)?.nome || "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{c.procedimento || "—"}</TableCell>
                  <TableCell>{c.convenio_id ? (c.convenios as any)?.nome || "Convênio" : "Particular"}</TableCell>
                  <TableCell className="text-right font-medium">{fmt(c.valor_bruto)}</TableCell>
                  <TableCell>{statusBadge(c.status_recebimento)}</TableCell>
                  <TableCell className="whitespace-nowrap">{c.data_prevista_recebimento || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {consultas.length > 50 && (
            <p className="text-xs text-muted-foreground p-3 text-center">Exibindo 50 de {consultas.length} registros</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ icon, label, value, negative }: { icon: React.ReactNode; label: string; value: string; negative?: boolean }) {
  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <div className="rounded-md bg-accent p-1.5">{icon}</div>
        </div>
        <p className={`text-lg font-bold ${negative ? "text-destructive" : "text-foreground"}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
