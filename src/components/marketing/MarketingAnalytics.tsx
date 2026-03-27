import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

export default function MarketingAnalytics() {
  const { clinicaId } = useAuth();
  const [insights, setInsights] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const { data: campanhas = [] } = useQuery({
    queryKey: ["mkt-analytics", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("campanhas_marketing").select("*").eq("clinica_id", clinicaId).order("created_at");
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const chartData = campanhas.map((c: any) => ({
    nome: c.nome?.substring(0, 12) || "—",
    gasto: c.orcamento || 0,
    leads: c.leads || 0,
    conversoes: c.agendamentos_convertidos || 0,
    ctr: c.impressoes > 0 ? ((c.cliques / c.impressoes) * 100) : 0,
  }));

  const totalGasto = campanhas.reduce((s: number, c: any) => s + (c.orcamento || 0), 0);
  const totalLeads = campanhas.reduce((s: number, c: any) => s + (c.leads || 0), 0);
  const totalConv = campanhas.reduce((s: number, c: any) => s + (c.agendamentos_convertidos || 0), 0);
  const avgRoi = campanhas.length > 0 ? (campanhas.reduce((s: number, c: any) => s + (c.roi || 0), 0) / campanhas.length).toFixed(1) : "0";

  const gerarInsights = async () => {
    setLoading(true);
    try {
      const resumo = campanhas.map((c: any) => `${c.nome}: canal=${c.canal}, gasto=R$${c.orcamento}, impressoes=${c.impressoes}, cliques=${c.cliques}, leads=${c.leads}, conversoes=${c.agendamentos_convertidos}, roi=${c.roi}%`).join("\n");
      const resp = await supabase.functions.invoke("marketing-ai-chat", {
        body: {
          messages: [{
            role: "user",
            content: `Analise os dados de todas as campanhas e gere insights detalhados sobre:\n1. Diagnóstico geral\n2. Anomalias detectadas\n3. Tendências\n4. Recomendações de otimização\n\nDados:\n${resumo}\n\nTotais: Gasto=R$${totalGasto}, Leads=${totalLeads}, Conversões=${totalConv}, ROI médio=${avgRoi}%`,
          }],
        },
      });
      if (resp.error) throw resp.error;
      const text = typeof resp.data === "string" ? resp.data : resp.data?.choices?.[0]?.message?.content || "Sem resposta";
      setInsights(text);
    } catch (e: any) {
      toast.error("Erro: " + (e.message || "erro"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Gasto Total", value: `R$ ${totalGasto.toLocaleString()}` },
          { label: "Total Leads", value: totalLeads },
          { label: "Conversões", value: totalConv },
          { label: "ROI Médio", value: `${avgRoi}%` },
        ].map((k) => (
          <Card key={k.label}><CardContent className="p-4"><p className="text-xl font-bold">{k.value}</p><p className="text-xs text-muted-foreground">{k.label}</p></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Performance por Campanha</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <XAxis dataKey="nome" fontSize={11} />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="gasto" stroke="#ef4444" fill="#ef444440" name="Gasto" />
              <Area type="monotone" dataKey="leads" stroke="#3b82f6" fill="#3b82f640" name="Leads" />
              <Area type="monotone" dataKey="conversoes" stroke="#10b981" fill="#10b98140" name="Conversões" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">IA Insights</CardTitle>
          <Button size="sm" onClick={gerarInsights} disabled={loading || campanhas.length === 0}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Gerar Insights
          </Button>
        </CardHeader>
        <CardContent>
          {insights ? (
            <div className="prose prose-sm max-w-none"><ReactMarkdown>{insights}</ReactMarkdown></div>
          ) : (
            <p className="text-sm text-muted-foreground">Clique em "Gerar Insights" para uma análise com IA dos seus dados de marketing.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
