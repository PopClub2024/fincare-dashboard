import { useState, useCallback, useEffect } from "react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Brain, Play, Wrench, AlertTriangle, CheckCircle2, XCircle,
  TrendingUp, Shield, Clock, Loader2, MessageSquare, Send, BarChart3,
  ChevronRight, RefreshCw,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

interface DataQualityCheck {
  name: string;
  ok: boolean;
  weight: number;
  value?: number;
  action: string;
}

interface InsightRecord {
  id: string;
  periodo_inicio: string;
  periodo_fim: string;
  tipo: string;
  data_quality_score: number;
  output_markdown: string;
  created_at: string;
}

interface AlertRecord {
  id: string;
  tipo: string;
  severidade: string;
  titulo: string;
  descricao: string;
  status: string;
  created_at: string;
}

type ChatMsg = { role: "user" | "assistant"; content: string };

export default function CfoAssistente() {
  const { clinicaId } = useAuth();
  const [dateFrom] = useState(() => startOfMonth(subMonths(new Date(), 2)));
  const [dateTo] = useState(() => endOfMonth(new Date()));

  const [dqScore, setDqScore] = useState<number>(0);
  const [dqChecks, setDqChecks] = useState<DataQualityCheck[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [insights, setInsights] = useState<InsightRecord[]>([]);
  const [latestInsight, setLatestInsight] = useState<InsightRecord | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeSteps, setAnalyzeSteps] = useState<any[]>([]);

  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const startDate = format(dateFrom, "yyyy-MM-dd");
  const endDate = format(dateTo, "yyyy-MM-dd");

  const loadData = useCallback(async () => {
    if (!clinicaId) return;
    const [dqRes, alertsRes, insightsRes] = await Promise.all([
      supabase.rpc("get_data_quality_score", { _start_date: startDate, _end_date: endDate }),
      supabase.from("alertas_eventos").select("*").eq("status", "aberto").order("created_at", { ascending: false }).limit(20),
      supabase.from("insights_ia").select("*").order("created_at", { ascending: false }).limit(10),
    ]);

    if (dqRes.data) {
      const d = dqRes.data as any;
      setDqScore(d.score || 0);
      setDqChecks(d.checks || []);
    }
    if (alertsRes.data) setAlerts(alertsRes.data as any);
    if (insightsRes.data) {
      setInsights(insightsRes.data as any);
      if ((insightsRes.data as any[]).length > 0) setLatestInsight((insightsRes.data as any[])[0]);
    }
  }, [clinicaId, startDate, endDate]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalyzeSteps([]);
    try {
      const { data, error } = await supabase.functions.invoke("autopilot-run", {
        body: { trigger: "manual", start_date: startDate, end_date: endDate },
      });
      if (error) throw error;
      setAnalyzeSteps(data.steps || []);
      toast.success("Análise concluída!");
      await loadData();
    } catch (e: any) {
      toast.error("Erro na análise: " + e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg: ChatMsg = { role: "user", content: chatInput };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    let assistantText = "";
    const updateAssistant = (chunk: string) => {
      assistantText += chunk;
      setChatMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantText } : m);
        }
        return [...prev, { role: "assistant", content: assistantText }];
      });
    };

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-cfo-analyze`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          chat_messages: newMessages,
        }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) { toast.error("Rate limit. Tente novamente em alguns segundos."); return; }
        if (resp.status === 402) { toast.error("Créditos insuficientes."); return; }
        throw new Error("Falha no streaming");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) updateAssistant(content);
          } catch { buf = line + "\n" + buf; break; }
        }
      }
    } catch (e: any) {
      toast.error("Erro no chat: " + e.message);
    } finally {
      setChatLoading(false);
    }
  };

  const scoreColor = dqScore >= 80 ? "text-success" : dqScore >= 50 ? "text-warning" : "text-destructive";
  const scoreLabel = dqScore >= 80 ? "Boa" : dqScore >= 50 ? "Parcial" : "Insuficiente";

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" />
              CFO Assistente
            </h1>
            <p className="text-sm text-muted-foreground">Análise contínua de DRE, Caixa, Conciliação e Qualidade de Dados</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
            </Button>
            <Button size="sm" onClick={handleAnalyze} disabled={analyzing}>
              {analyzing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
              Analisar agora
            </Button>
          </div>
        </div>

        {/* Analyze progress */}
        {analyzeSteps.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3">
                {analyzeSteps.map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs">
                    {s.status === "ok" ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-destructive" />}
                    <span className="font-medium">{s.step}</span>
                    <span className="text-muted-foreground">{s.duration_ms}ms</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top row: Data Quality + Alerts */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" /> Data Quality Score
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-end gap-3">
                <span className={`text-4xl font-bold ${scoreColor}`}>{dqScore}</span>
                <span className="text-muted-foreground text-sm mb-1">/ 100 — {scoreLabel}</span>
              </div>
              <Progress value={dqScore} className="h-2" />
              <div className="space-y-1.5 mt-3">
                {dqChecks.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      {c.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <XCircle className="h-3.5 w-3.5 text-destructive" />}
                      <span>{c.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{c.weight}pts</span>
                      {!c.ok && <span className="text-destructive">{c.action}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Alertas Abertos
                {alerts.length > 0 && <Badge variant="destructive" className="text-xs">{alerts.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum alerta aberto.</p>
              ) : (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {alerts.map((a) => (
                      <div key={a.id} className="flex items-start gap-2 p-2 rounded-md bg-muted/50">
                        {a.severidade === "critical" ? <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" /> : <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />}
                        <div>
                          <p className="text-xs font-medium">{a.titulo}</p>
                          <p className="text-xs text-muted-foreground">{a.descricao}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main tabs */}
        <Tabs defaultValue="analysis" className="space-y-4">
          <TabsList className="inline-flex h-9 gap-0.5 rounded-lg bg-muted p-1">
            <TabsTrigger value="analysis" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <BarChart3 className="h-3.5 w-3.5" /> Última Análise
            </TabsTrigger>
            <TabsTrigger value="chat" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <MessageSquare className="h-3.5 w-3.5" /> Chat CFO
            </TabsTrigger>
            <TabsTrigger value="history" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Clock className="h-3.5 w-3.5" /> Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analysis">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Análise CFO</CardTitle>
                <CardDescription>
                  {latestInsight
                    ? `Gerada em ${new Date(latestInsight.created_at).toLocaleString("pt-BR")} — Score: ${latestInsight.data_quality_score}/100`
                    : "Clique em 'Analisar agora' para gerar a primeira análise."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {latestInsight?.output_markdown ? (
                  <ScrollArea className="h-[500px]">
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown>{latestInsight.output_markdown}</ReactMarkdown>
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Brain className="h-12 w-12 mb-3 opacity-30" />
                    <p className="text-sm">Nenhuma análise disponível ainda.</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={handleAnalyze} disabled={analyzing}>
                      {analyzing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                      Gerar análise
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chat">
            <Card className="flex flex-col h-[600px]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Chat com CFO Assistente</CardTitle>
                <CardDescription>Pergunte sobre DRE, Caixa, Convênios, Metas — o assistente usa seus dados reais.</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col min-h-0">
                <ScrollArea className="flex-1 pr-2">
                  <div className="space-y-4 pb-4">
                    {chatMessages.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <MessageSquare className="h-10 w-10 mb-2 opacity-30" />
                        <p className="text-sm">Inicie uma conversa com o CFO Assistente</p>
                        <div className="flex flex-wrap gap-2 mt-4 max-w-md justify-center">
                          {["Qual a margem de contribuição do mês?", "Quais convênios têm maior glosa?", "Como está o capital de giro?"].map((q) => (
                            <Button key={q} variant="outline" size="sm" className="text-xs" onClick={() => { setChatInput(q); }}>
                              {q}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                    {chatMessages.map((m, i) => (
                      <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          {m.role === "assistant" ? (
                            <div className="prose prose-sm max-w-none dark:prose-invert">
                              <ReactMarkdown>{m.content}</ReactMarkdown>
                            </div>
                          ) : m.content}
                        </div>
                      </div>
                    ))}
                    {chatLoading && chatMessages[chatMessages.length - 1]?.role !== "assistant" && (
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-lg px-3 py-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
                <Separator className="my-2" />
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Pergunte ao CFO Assistente..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleChat()}
                    disabled={chatLoading}
                  />
                  <Button size="icon" onClick={handleChat} disabled={chatLoading || !chatInput.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Histórico de Análises</CardTitle>
              </CardHeader>
              <CardContent>
                {insights.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma análise registrada.</p>
                ) : (
                  <div className="space-y-2">
                    {insights.map((ins) => (
                      <button
                        key={ins.id}
                        onClick={() => setLatestInsight(ins)}
                        className="w-full flex items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/50 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium">{ins.tipo.replace(/_/g, " ")}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(ins.created_at).toLocaleString("pt-BR")} — {ins.periodo_inicio} a {ins.periodo_fim}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={ins.data_quality_score >= 80 ? "default" : ins.data_quality_score >= 50 ? "secondary" : "destructive"} className="text-xs">
                            DQ: {ins.data_quality_score}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
