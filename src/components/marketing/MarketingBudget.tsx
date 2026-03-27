import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Loader2 } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function MarketingBudget() {
  const { clinicaId } = useAuth();
  const [budgetTotal, setBudgetTotal] = useState("");
  const [recomendacao, setRecomendacao] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: campanhas = [] } = useQuery({
    queryKey: ["mkt-budget", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("campanhas_marketing").select("*").eq("clinica_id", clinicaId);
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const canalData = campanhas.reduce((acc: any[], c: any) => {
    const canal = c.canal || "Outro";
    const existing = acc.find((a) => a.canal === canal);
    if (existing) {
      existing.gasto += c.orcamento || 0;
      existing.leads += c.leads || 0;
      existing.conversoes += c.agendamentos_convertidos || 0;
    } else {
      acc.push({ canal, gasto: c.orcamento || 0, leads: c.leads || 0, conversoes: c.agendamentos_convertidos || 0 });
    }
    return acc;
  }, []);

  const totalGasto = canalData.reduce((s, c) => s + c.gasto, 0);

  const simular = async () => {
    if (!budgetTotal || !clinicaId) return;
    setLoading(true);
    try {
      const resumo = canalData.map((c) => `${c.canal}: gasto=R$${c.gasto}, leads=${c.leads}, conversoes=${c.conversoes}, CPL=R$${c.leads > 0 ? (c.gasto / c.leads).toFixed(2) : "N/A"}`).join("\n");
      const resp = await supabase.functions.invoke("marketing-ai-chat", {
        body: {
          messages: [{
            role: "user",
            content: `Tenho um orçamento total de R$ ${budgetTotal} para marketing. Com base no desempenho histórico abaixo, recomende a melhor redistribuição de budget por canal:\n\n${resumo}\n\nGasto atual total: R$ ${totalGasto}\n\nDê a alocação recomendada em % e R$ para cada canal, com justificativa.`,
          }],
        },
      });
      if (resp.error) throw resp.error;
      const text = typeof resp.data === "string" ? resp.data : resp.data?.choices?.[0]?.message?.content || "";
      setRecomendacao(text);
    } catch (e: any) {
      toast.error("Erro: " + (e.message || "erro"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Distribuição Atual de Gasto</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={canalData} dataKey="gasto" nameKey="canal" cx="50%" cy="50%" outerRadius={100} label={(e) => `${e.canal}: R$${e.gasto}`}>
                  {canalData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Simulador de Orçamento</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">Orçamento mensal total (R$)</label>
              <Input type="number" placeholder="5000" value={budgetTotal} onChange={(e) => setBudgetTotal(e.target.value)} />
            </div>
            <Button className="w-full" onClick={simular} disabled={loading || !budgetTotal}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Simular Redistribuição com IA
            </Button>
          </CardContent>
        </Card>
      </div>

      {recomendacao && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Recomendação da IA</CardTitle></CardHeader>
          <CardContent><div className="prose prose-sm max-w-none"><ReactMarkdown>{recomendacao}</ReactMarkdown></div></CardContent>
        </Card>
      )}
    </div>
  );
}
