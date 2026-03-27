import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, MessageSquare, Users, Calendar, Clock, TrendingUp, TrendingDown } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PIPELINE_ETAPAS } from "@/types/whatsapp";

export default function WhatsAppDashboard() {
  const { clinicaId } = useAuth();

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["whatsapp-dashboard", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return null;
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();

      const [conversas, msgHoje, filaHumana, pipelineData] = await Promise.all([
        supabase.from("whatsapp_conversas").select("id, pipeline_etapa, atendimento, created_at, ultima_mensagem_em", { count: "exact" }).eq("clinica_id", clinicaId) as any,
        supabase.from("whatsapp_chat_mensagens").select("id, created_at, direcao", { count: "exact" }).eq("clinica_id", clinicaId).gte("created_at", today) as any,
        supabase.from("whatsapp_fila_humano").select("id", { count: "exact" }).eq("clinica_id", clinicaId).eq("status", "aguardando") as any,
        supabase.from("whatsapp_conversas").select("pipeline_etapa").eq("clinica_id", clinicaId) as any,
      ]);

      const totalConversas = conversas.count || 0;
      const msgsHoje = msgHoje.count || 0;
      const filaCount = filaHumana.count || 0;

      // Pipeline distribution
      const pipelineCounts: Record<string, number> = {};
      (pipelineData.data || []).forEach((c: any) => {
        const etapa = c.pipeline_etapa || "novo_contato";
        pipelineCounts[etapa] = (pipelineCounts[etapa] || 0) + 1;
      });

      // Chart data - messages per day (last 7 days)
      const chartData: { name: string; msgs: number }[] = [];
      const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        chartData.push({ name: days[d.getDay()], msgs: 0 });
      }

      // Count messages per day
      const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
      const { data: weekMsgs } = await supabase
        .from("whatsapp_chat_mensagens")
        .select("created_at")
        .eq("clinica_id", clinicaId)
        .gte("created_at", sevenDaysAgo) as any;

      (weekMsgs || []).forEach((m: any) => {
        const d = new Date(m.created_at);
        const daysAgo = Math.floor((now.getTime() - d.getTime()) / 86400000);
        const idx = 6 - daysAgo;
        if (idx >= 0 && idx < 7) chartData[idx].msgs++;
      });

      return { totalConversas, msgsHoje, filaCount, pipelineCounts, chartData };
    },
    enabled: !!clinicaId,
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!metrics) return null;

  const kpis = [
    { label: "Total Conversas", value: metrics.totalConversas, icon: MessageSquare, color: "text-cyan-400" },
    { label: "Mensagens Hoje", value: metrics.msgsHoje, icon: TrendingUp, color: "text-emerald-400" },
    { label: "Na Fila Humana", value: metrics.filaCount, icon: Users, color: metrics.filaCount > 0 ? "text-red-400" : "text-slate-400" },
    { label: "Agendados", value: metrics.pipelineCounts["agendado"] || 0, icon: Calendar, color: "text-violet-400" },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground">{kpi.label}</span>
                <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              </div>
              <p className="text-2xl font-bold">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-6">
        {/* Chart */}
        <Card className="col-span-4 bg-slate-900/50 border-slate-800">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold mb-4">Volume de Mensagens (7 dias)</h3>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.chartData}>
                  <defs>
                    <linearGradient id="colorMsgs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} stroke="hsl(var(--muted-foreground))" />
                  <YAxis axisLine={false} tickLine={false} fontSize={12} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderRadius: "8px", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }} />
                  <Area type="monotone" dataKey="msgs" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorMsgs)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pipeline Distribution */}
        <Card className="col-span-3 bg-slate-900/50 border-slate-800">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold mb-4">Distribuição Pipeline</h3>
            <div className="space-y-3">
              {PIPELINE_ETAPAS.filter(e => (metrics.pipelineCounts[e.key] || 0) > 0).slice(0, 8).map((etapa) => {
                const count = metrics.pipelineCounts[etapa.key] || 0;
                const maxCount = Math.max(...Object.values(metrics.pipelineCounts), 1);
                return (
                  <div key={etapa.key}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{etapa.label}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${(count / maxCount) * 100}%`, backgroundColor: etapa.cor }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
