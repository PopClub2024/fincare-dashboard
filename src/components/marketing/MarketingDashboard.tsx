import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, MousePointer, Target, DollarSign, Eye, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function MarketingDashboard() {
  const { clinicaId } = useAuth();

  const { data: campanhas = [] } = useQuery({
    queryKey: ["mkt-campanhas-dash", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("campanhas_marketing").select("*").eq("clinica_id", clinicaId);
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const totalGasto = campanhas.reduce((s: number, c: any) => s + (c.orcamento || 0), 0);
  const totalImpress = campanhas.reduce((s: number, c: any) => s + (c.impressoes || 0), 0);
  const totalCliques = campanhas.reduce((s: number, c: any) => s + (c.cliques || 0), 0);
  const totalLeads = campanhas.reduce((s: number, c: any) => s + (c.leads || 0), 0);
  const totalConv = campanhas.reduce((s: number, c: any) => s + (c.agendamentos_convertidos || 0), 0);
  const ctr = totalImpress > 0 ? ((totalCliques / totalImpress) * 100).toFixed(2) : "0";
  const cpc = totalCliques > 0 ? (totalGasto / totalCliques).toFixed(2) : "0";
  const cpl = totalLeads > 0 ? (totalGasto / totalLeads).toFixed(2) : "0";

  const kpis = [
    { label: "Gasto Total", value: `R$ ${totalGasto.toLocaleString()}`, icon: DollarSign, color: "text-red-500" },
    { label: "Impressões", value: totalImpress.toLocaleString(), icon: Eye, color: "text-blue-500" },
    { label: "Cliques", value: totalCliques.toLocaleString(), icon: MousePointer, color: "text-green-500" },
    { label: "CTR", value: `${ctr}%`, icon: TrendingUp, color: "text-yellow-500" },
    { label: "CPC", value: `R$ ${cpc}`, icon: BarChart3, color: "text-purple-500" },
    { label: "Leads", value: totalLeads, icon: Target, color: "text-emerald-500" },
    { label: "Conversões", value: totalConv, icon: Target, color: "text-indigo-500" },
    { label: "CPL", value: `R$ ${cpl}`, icon: DollarSign, color: "text-orange-500" },
  ];

  const canalData = campanhas.reduce((acc: any[], c: any) => {
    const existing = acc.find((a) => a.canal === (c.canal || "Outro"));
    if (existing) {
      existing.leads += c.leads || 0;
      existing.gasto += c.orcamento || 0;
      existing.cliques += c.cliques || 0;
    } else {
      acc.push({ canal: c.canal || "Outro", leads: c.leads || 0, gasto: c.orcamento || 0, cliques: c.cliques || 0 });
    }
    return acc;
  }, []);

  const trendData = campanhas
    .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((c: any) => ({
      nome: c.nome?.substring(0, 15) || "—",
      impressoes: c.impressoes || 0,
      cliques: c.cliques || 0,
      leads: c.leads || 0,
    }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <k.icon className={`h-5 w-5 ${k.color} mb-1`} />
              <p className="text-xl font-bold">{k.value}</p>
              <p className="text-xs text-muted-foreground">{k.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Tendência por Campanha</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trendData}>
                <XAxis dataKey="nome" fontSize={11} />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="impressoes" stroke="#3b82f6" fill="#3b82f680" />
                <Area type="monotone" dataKey="cliques" stroke="#10b981" fill="#10b98180" />
                <Area type="monotone" dataKey="leads" stroke="#f59e0b" fill="#f59e0b80" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Distribuição de Gasto por Canal</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={canalData} dataKey="gasto" nameKey="canal" cx="50%" cy="50%" outerRadius={100} label>
                  {canalData.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Leads por Canal</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={canalData}>
                <XAxis dataKey="canal" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="leads" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Cliques por Canal</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={canalData}>
                <XAxis dataKey="canal" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="cliques" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
