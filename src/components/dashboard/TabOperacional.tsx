import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface MedicoReceita { nome: string; total: number }
interface SalaReceita { nome: string; total: number }
interface OcupacaoDia { dia: string; ocupacao: number }

export default function TabOperacional({ dateFrom, dateTo }: Props) {
  const { clinicaId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [folhaReceita, setFolhaReceita] = useState(0);
  const [ticketMedio, setTicketMedio] = useState(0);
  const [taxaFalta, setTaxaFalta] = useState(0);
  const [medicoData, setMedicoData] = useState<MedicoReceita[]>([]);
  const [salaData, setSalaData] = useState<SalaReceita[]>([]);
  const [ocupacaoData, setOcupacaoData] = useState<OcupacaoDia[]>([]);

  useEffect(() => {
    if (!clinicaId) return;
    setLoading(true);
    const from = format(dateFrom, "yyyy-MM-dd");
    const to = format(dateTo, "yyyy-MM-dd");

    Promise.all([
      // Vendas para ticket médio e taxa de falta
      supabase
        .from("transacoes_vendas")
        .select("valor_bruto, status_presenca, medico_id, sala_id, medicos(nome), salas:sala_id(nome)")
        .eq("clinica_id", clinicaId)
        .gte("data_competencia", from)
        .lte("data_competencia", to),
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
    ]).then(([vendasRes, cpRes, ocupRes]) => {
      // Vendas
      const vendas = (vendasRes.data || []) as any[];
      const totalVendas = vendas.length;
      const receitaTotal = vendas.reduce((s: number, v: any) => s + (v.valor_bruto || 0), 0);
      setTicketMedio(totalVendas > 0 ? receitaTotal / totalVendas : 0);

      const faltas = vendas.filter((v: any) => v.status_presenca === "faltou").length;
      setTaxaFalta(totalVendas > 0 ? (faltas / totalVendas) * 100 : 0);

      // Médico
      const medMap = new Map<string, number>();
      vendas.forEach((v: any) => {
        const nome = v.medicos?.nome || "Sem médico";
        medMap.set(nome, (medMap.get(nome) || 0) + (v.valor_bruto || 0));
      });
      setMedicoData(
        Array.from(medMap.entries())
          .map(([nome, total]) => ({ nome, total }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 10)
      );

      // Sala
      const salaMap = new Map<string, number>();
      vendas.forEach((v: any) => {
        const nome = v.salas?.nome || "Sem sala";
        salaMap.set(nome, (salaMap.get(nome) || 0) + (v.valor_bruto || 0));
      });
      setSalaData(
        Array.from(salaMap.entries())
          .map(([nome, total]) => ({ nome, total }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 10)
      );

      // Folha / Receita
      const cp = (cpRes.data || []) as any[];
      const pessoal = ["Gastos com Pessoal", "Impostos RH"];
      const folha = cp
        .filter((l: any) => pessoal.includes(l.plano_contas?.categoria))
        .reduce((s: number, l: any) => s + (l.valor || 0), 0);
      setFolhaReceita(receitaTotal > 0 ? (folha / receitaTotal) * 100 : 0);

      // Ocupação
      const ocup = (ocupRes.data || []) as any[];
      setOcupacaoData(
        ocup.map((o: any) => ({
          dia: o.data,
          ocupacao: o.slots_total > 0 ? Math.round((o.slots_ocupados / o.slots_total) * 100) : 0,
        }))
      );

      setLoading(false);
    }).catch((e) => {
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { label: "Folha / Receita", value: `${folhaReceita.toFixed(1)}%` },
          { label: "Ticket Médio", value: fmt(ticketMedio) },
          { label: "Taxa de Falta", value: `${taxaFalta.toFixed(1)}%` },
        ].map((item) => (
          <Card key={item.label} className="border-0 shadow-md">
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle className="text-lg">Receita por Médico</CardTitle></CardHeader>
          <CardContent>
            {medicoData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={medicoData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="nome" className="text-xs" width={140} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="total" name="Receita" fill="hsl(204, 67%, 32%)" radius={[0, 4, 4, 0]} />
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

        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle className="text-lg">Receita por Sala</CardTitle></CardHeader>
          <CardContent>
            {salaData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salaData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="nome" className="text-xs" width={140} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="total" name="Receita" fill="hsl(152, 60%, 40%)" radius={[0, 4, 4, 0]} />
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
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader><CardTitle className="text-lg">Taxa de Ocupação</CardTitle></CardHeader>
        <CardContent>
          {ocupacaoData.length > 0 ? (
            <div className="h-80">
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
  );
}
