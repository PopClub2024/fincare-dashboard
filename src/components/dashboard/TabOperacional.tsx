import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, LineChart, Line } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { toast } from "sonner";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface Props {
  dateFrom: Date;
  dateTo: Date;
}

interface MedicoRow { nome: string; atend: number; receita: number; faltas: number; desconto: number }
interface EspRow { nome: string; atend: number; receita: number }
interface OcupacaoDia { dia: string; ocupacao: number }

export default function TabOperacional({ dateFrom, dateTo }: Props) {
  const { clinicaId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [folhaReceita, setFolhaReceita] = useState(0);
  const [ticketMedio, setTicketMedio] = useState(0);
  const [taxaFalta, setTaxaFalta] = useState(0);
  const [totalDesconto, setTotalDesconto] = useState(0);
  const [pctDesconto, setPctDesconto] = useState(0);
  const [totalAtend, setTotalAtend] = useState(0);
  const [receitaTotal, setReceitaTotal] = useState(0);
  const [medicoData, setMedicoData] = useState<MedicoRow[]>([]);
  const [espData, setEspData] = useState<EspRow[]>([]);
  const [ocupacaoData, setOcupacaoData] = useState<OcupacaoDia[]>([]);

  useEffect(() => {
    if (!clinicaId) return;
    setLoading(true);
    const from = format(dateFrom, "yyyy-MM-dd");
    const to = format(dateTo, "yyyy-MM-dd");

    // Try operacao_producao first, fallback to transacoes_vendas
    const opQuery = supabase
      .from("operacao_producao")
      .select("valor_bruto, desconto, valor_liquido, status_presenca, medico_id, especialidade, medicos(nome)")
      .eq("clinica_id", clinicaId)
      .gte("data_competencia", from)
      .lte("data_competencia", to);

    const tvFallback = supabase
      .from("transacoes_vendas")
      .select("valor_bruto, desconto, status_presenca, medico_id, especialidade, medicos(nome)")
      .eq("clinica_id", clinicaId)
      .gte("data_competencia", from)
      .lte("data_competencia", to)
      .not("feegow_id", "like", "inv_%")
      .limit(1000);

    Promise.all([
      opQuery,
      tvFallback,
      // Folha (CP com categoria pessoal)
      supabase
        .from("contas_pagar_lancamentos")
        .select("valor, plano_contas:plano_contas_id(categoria)")
        .eq("clinica_id", clinicaId)
        .gte("data_competencia", from)
        .lte("data_competencia", to)
        .neq("status", "cancelado"),
      // Ocupação
      supabase
        .from("agenda_ocupacao")
        .select("data, slots_ocupados, slots_total")
        .eq("clinica_id", clinicaId)
        .gte("data", from)
        .lte("data", to)
        .order("data"),
    ]).then(([opRes, tvRes, cpRes, ocupRes]) => {
      // Use operacao_producao if available, otherwise fallback to transacoes_vendas
      const rawOps = (opRes.data || []) as any[];
      const ops = rawOps.length > 0 ? rawOps : ((tvRes.data || []) as any[]).map((v: any) => ({
        ...v, desconto: v.desconto || 0, valor_liquido: (v.valor_bruto || 0) - (v.desconto || 0),
      }));
      const total = ops.length;
      setTotalAtend(total);

      const receita = ops.reduce((s: number, v: any) => s + (v.valor_bruto || 0), 0);
      setReceitaTotal(receita);
      setTicketMedio(total > 0 ? receita / total : 0);

      const descontoTotal = ops.reduce((s: number, v: any) => s + (v.desconto || 0), 0);
      setTotalDesconto(descontoTotal);
      setPctDesconto(receita > 0 ? (descontoTotal / receita) * 100 : 0);

      const faltas = ops.filter((v: any) => v.status_presenca === "faltou").length;
      setTaxaFalta(total > 0 ? (faltas / total) * 100 : 0);

      // Por Médico
      const medMap = new Map<string, MedicoRow>();
      ops.forEach((v: any) => {
        const nome = v.medicos?.nome || "Sem profissional";
        const e = medMap.get(nome) || { nome, atend: 0, receita: 0, faltas: 0, desconto: 0 };
        e.atend++;
        e.receita += v.valor_bruto || 0;
        e.desconto += v.desconto || 0;
        if (v.status_presenca === "faltou") e.faltas++;
        medMap.set(nome, e);
      });
      setMedicoData(Array.from(medMap.values()).sort((a, b) => b.receita - a.receita).slice(0, 15));

      // Por Especialidade
      const eMap = new Map<string, EspRow>();
      ops.forEach((v: any) => {
        const nome = v.especialidade || "Geral";
        const e = eMap.get(nome) || { nome, atend: 0, receita: 0 };
        e.atend++;
        e.receita += v.valor_bruto || 0;
        eMap.set(nome, e);
      });
      setEspData(Array.from(eMap.values()).sort((a, b) => b.receita - a.receita).slice(0, 10));

      // Folha / Receita
      const cp = (cpRes.data || []) as any[];
      const pessoal = ["Gastos com Pessoal", "Impostos RH"];
      const folha = cp
        .filter((l: any) => pessoal.includes(l.plano_contas?.categoria))
        .reduce((s: number, l: any) => s + (l.valor || 0), 0);
      setFolhaReceita(receita > 0 ? (folha / receita) * 100 : 0);

      // Ocupação
      const ocup = (ocupRes.data || []) as any[];
      setOcupacaoData(
        ocup.map((o: any) => ({
          dia: o.data,
          ocupacao: o.slots_total > 0 ? Math.round((o.slots_ocupados / o.slots_total) * 100) : 0,
        }))
      );

      setLoading(false);
    }).catch(() => {
      toast.error("Erro ao carregar dados operacionais");
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

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {[
          { label: "Total Atendimentos", value: totalAtend.toString() },
          { label: "Folha / Receita", value: `${folhaReceita.toFixed(1)}%` },
          { label: "Ticket Médio", value: fmt(ticketMedio) },
          { label: "Taxa de Falta", value: `${taxaFalta.toFixed(1)}%` },
          { label: "Desconto Total", value: `${pctDesconto.toFixed(1)}% (${fmt(totalDesconto)})` },
        ].map((item) => (
          <Card key={item.label} className="border-0 shadow-md">
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-xl font-bold text-foreground">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Receita por Especialidade */}
        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle className="text-lg">Receita por Especialidade</CardTitle></CardHeader>
          <CardContent>
            {espData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={espData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="nome" className="text-xs" width={140} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="receita" name="Receita" fill="hsl(152, 60%, 40%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                Sincronize com o Feegow para ver dados
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ocupação */}
        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle className="text-lg">Taxa de Ocupação</CardTitle></CardHeader>
          <CardContent>
            {ocupacaoData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ocupacaoData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="dia" className="text-xs" />
                    <YAxis className="text-xs" domain={[0, 100]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="ocupacao" name="Ocupação %" stroke="hsl(204, 67%, 32%)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                Sincronize com o Feegow para ver dados de ocupação
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ranking por Médico */}
      <Card className="border-0 shadow-md">
        <CardHeader><CardTitle className="text-lg">Produtividade por Profissional</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {medicoData.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profissional</TableHead>
                  <TableHead className="text-right">Atendimentos</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Ticket Médio</TableHead>
                  <TableHead className="text-right">Faltas</TableHead>
                  <TableHead className="text-right">Desconto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {medicoData.map((m) => (
                  <TableRow key={m.nome}>
                    <TableCell className="font-medium">{m.nome}</TableCell>
                    <TableCell className="text-right">{m.atend}</TableCell>
                    <TableCell className="text-right">{fmt(m.receita)}</TableCell>
                    <TableCell className="text-right">{fmt(m.atend > 0 ? m.receita / m.atend : 0)}</TableCell>
                    <TableCell className="text-right">{m.faltas}</TableCell>
                    <TableCell className="text-right">{fmt(m.desconto)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Sincronize com o Feegow para ver dados
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
