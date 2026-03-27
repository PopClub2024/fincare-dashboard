import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  Brain, TrendingUp, Users, Activity, Lightbulb, Target,
  Play, Loader2, AlertTriangle, Send, Sparkles,
} from "lucide-react";

type ChatMsg = { role: "user" | "assistant"; content: string };

const priorityColor = (p: string) => {
  switch (p) {
    case "high": return "text-red-400 bg-red-500/10 border-red-500/30";
    case "medium": return "text-amber-400 bg-amber-500/10 border-amber-500/30";
    default: return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
  }
};

const categoryIcon: Record<string, React.ReactNode> = {
  objection: <AlertTriangle className="w-4 h-4" />,
  demand: <TrendingUp className="w-4 h-4" />,
  operation: <Activity className="w-4 h-4" />,
  recommendation: <Lightbulb className="w-4 h-4" />,
  strategy: <Target className="w-4 h-4" />,
};

const categoryLabel: Record<string, string> = {
  objection: "Objeção", demand: "Demanda", operation: "Operação",
  recommendation: "Recomendação", strategy: "Estratégia",
};

export default function WhatsAppIntelligence() {
  const { clinicaId } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["whatsapp-intelligence", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return { insights: [], initiatives: [], runs: [] };
      const [insightsRes, initiativesRes, runsRes] = await Promise.all([
        (supabase.from("whatsapp_insight_items" as any).select("*").eq("clinica_id", clinicaId).order("created_at", { ascending: false }).limit(100)),
        (supabase.from("whatsapp_initiatives" as any).select("*").eq("clinica_id", clinicaId).order("created_at", { ascending: false }).limit(50)),
        (supabase.from("whatsapp_insight_runs" as any).select("*").eq("clinica_id", clinicaId).order("started_at", { ascending: false }).limit(10)),
      ]);
      return {
        insights: insightsRes.data || [],
        initiatives: initiativesRes.data || [],
        runs: runsRes.data || [],
      };
    },
    enabled: !!clinicaId,
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg: ChatMsg = { role: "user", content: chatInput.trim() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const { data: result, error } = await supabase.functions.invoke("ai-cfo-analyze", {
        body: { prompt: userMsg.content, context: "whatsapp_intelligence" },
      });
      if (error) throw error;
      const response = result?.analysis || result?.message || "Sem resposta da IA.";
      setChatMessages(prev => [...prev, { role: "assistant", content: response }]);
    } catch {
      toast.error("Erro ao consultar IA");
      setChatMessages(prev => [...prev, { role: "assistant", content: "Desculpe, ocorreu um erro." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const insights = data?.insights || [];
  const initiatives = data?.initiatives || [];
  const runs = data?.runs || [];
  const highPriority = insights.filter((i: any) => i.priority === "high").slice(0, 5);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold">Inteligência</h3>
            <p className="text-xs text-muted-foreground">
              {runs[0] ? `Última análise: ${new Date((runs[0] as any).started_at).toLocaleDateString("pt-BR")}` : "Nenhuma análise executada"}
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="initiatives">Iniciativas</TabsTrigger>
          <TabsTrigger value="chat">Perguntar à IA</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { title: "Total Insights", value: insights.length, icon: Brain },
              { title: "Alta Prioridade", value: insights.filter((i: any) => i.priority === "high").length, icon: AlertTriangle },
              { title: "Iniciativas", value: initiatives.length, icon: Target },
              { title: "Análises", value: runs.length, icon: Activity },
            ].map(kpi => (
              <Card key={kpi.title} className="bg-card/50 border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">{kpi.title}</span>
                    <kpi.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-xl font-bold">{kpi.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {highPriority.length > 0 && (
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-4">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" /> Top Prioridades
                </h4>
                <div className="space-y-2">
                  {highPriority.map((item: any) => (
                    <div key={item.id} className="p-3 rounded-lg border bg-background/50 flex items-start gap-3">
                      <span className="mt-0.5">{categoryIcon[item.category] || <Brain className="w-4 h-4" />}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.summary}</p>
                        <div className="flex gap-2 mt-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${priorityColor(item.priority)}`}>{item.priority}</span>
                          <span className="text-[10px] text-muted-foreground">{categoryLabel[item.category] || item.category}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {insights.length === 0 && (
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-8 text-center text-muted-foreground">
                <Brain className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhum insight ainda. Execute uma análise para gerar insights.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="insights" className="space-y-3">
          {insights.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum insight gerado ainda.</p>
          ) : insights.map((item: any) => (
            <div key={item.id} className="p-3 rounded-lg border bg-card/50 flex items-start gap-3">
              <span className="mt-0.5">{categoryIcon[item.category] || <Brain className="w-4 h-4" />}</span>
              <div className="flex-1">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.summary}</p>
                <div className="flex gap-2 mt-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${priorityColor(item.priority)}`}>{item.priority}</span>
                  <span className="text-[10px] text-muted-foreground">{categoryLabel[item.category] || item.category}</span>
                </div>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="initiatives" className="space-y-3">
          {initiatives.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma iniciativa criada ainda.</p>
          ) : initiatives.map((init: any) => (
            <div key={init.id} className="p-3 rounded-lg border bg-card/50">
              <p className="text-sm font-medium">{init.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{init.description}</p>
              <div className="flex gap-2 mt-1">
                <span className="text-[10px] px-2 py-0.5 rounded-full border bg-muted">{init.status}</span>
                <span className="text-[10px] text-muted-foreground">{init.effort}</span>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="chat">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4 flex flex-col h-[400px]">
              <div className="flex-1 overflow-auto space-y-3 mb-3">
                {chatMessages.length === 0 && (
                  <div className="text-center text-muted-foreground py-12">
                    <Brain className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Faça perguntas sobre suas conversas e performance</p>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-lg p-3 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                      ) : msg.content}
                    </div>
                  </div>
                ))}
                {chatLoading && <div className="flex justify-start"><div className="bg-muted rounded-lg p-3"><Loader2 className="h-4 w-4 animate-spin" /></div></div>}
                <div ref={chatEndRef} />
              </div>
              <div className="flex gap-2">
                <Textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                  placeholder="Pergunte algo..."
                  className="min-h-[40px] max-h-[80px] resize-none text-sm"
                  rows={1}
                />
                <Button size="icon" onClick={sendChat} disabled={!chatInput.trim() || chatLoading}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
