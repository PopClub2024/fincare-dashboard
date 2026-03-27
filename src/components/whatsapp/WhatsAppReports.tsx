import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, MessageSquare, Users, Clock, BarChart3 } from "lucide-react";
import { PIPELINE_ETAPAS } from "@/types/whatsapp";
import { format } from "date-fns";

export default function WhatsAppReports() {
  const { clinicaId } = useAuth();
  const [period, setPeriod] = useState<"7" | "30" | "90">("30");

  const { data: reportData, isLoading } = useQuery({
    queryKey: ["whatsapp-reports", clinicaId, period],
    queryFn: async () => {
      if (!clinicaId) return null;
      const daysAgo = new Date(Date.now() - parseInt(period) * 86400000).toISOString();

      const [conversas, msgs, filaData] = await Promise.all([
        supabase.from("whatsapp_conversas").select("id, pipeline_etapa, atendimento, created_at, tags").eq("clinica_id", clinicaId).gte("created_at", daysAgo) as any,
        supabase.from("whatsapp_chat_mensagens").select("id, direcao, tipo_conteudo, created_at").eq("clinica_id", clinicaId).gte("created_at", daysAgo) as any,
        supabase.from("whatsapp_fila_humano").select("id, status, created_at, atendido_em").eq("clinica_id", clinicaId).gte("created_at", daysAgo) as any,
      ]);

      const conversasData = conversas.data || [];
      const msgsData = msgs.data || [];
      const filaHist = filaData.data || [];

      // Pipeline journey
      const pipelineJourney: Record<string, number> = {};
      conversasData.forEach((c: any) => {
        const etapa = c.pipeline_etapa || "novo_contato";
        pipelineJourney[etapa] = (pipelineJourney[etapa] || 0) + 1;
      });

      // Message stats
      const totalMsgs = msgsData.length;
      const enviadas = msgsData.filter((m: any) => m.direcao === "enviada").length;
      const recebidas = msgsData.filter((m: any) => m.direcao === "recebida").length;
      const audios = msgsData.filter((m: any) => m.tipo_conteudo === "audio").length;
      const imagens = msgsData.filter((m: any) => m.tipo_conteudo === "imagem").length;

      // Atendimento stats
      const iaCount = conversasData.filter((c: any) => c.atendimento === "ia").length;
      const humanoCount = conversasData.filter((c: any) => c.atendimento === "humano").length;
      const filaCount = conversasData.filter((c: any) => c.atendimento === "fila_espera").length;

      // Human queue metrics
      const atendidos = filaHist.filter((f: any) => f.atendido_em);
      const tempoMedioFila = atendidos.length > 0
        ? Math.round(atendidos.reduce((sum: number, f: any) => sum + (new Date(f.atendido_em).getTime() - new Date(f.created_at).getTime()), 0) / atendidos.length / 60000)
        : 0;

      return {
        totalConversas: conversasData.length,
        totalMsgs, enviadas, recebidas, audios, imagens,
        iaCount, humanoCount, filaCount,
        pipelineJourney,
        filaAtendidos: atendidos.length,
        tempoMedioFila,
      };
    },
    enabled: !!clinicaId,
  });

  const exportCSV = () => {
    if (!reportData) return;
    const lines = [
      "Métrica,Valor",
      `Total Conversas,${reportData.totalConversas}`,
      `Total Mensagens,${reportData.totalMsgs}`,
      `Enviadas,${reportData.enviadas}`,
      `Recebidas,${reportData.recebidas}`,
      `Audios,${reportData.audios}`,
      `Imagens,${reportData.imagens}`,
      `Atendimento IA,${reportData.iaCount}`,
      `Atendimento Humano,${reportData.humanoCount}`,
      `Fila Espera,${reportData.filaCount}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `whatsapp-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!reportData) return null;

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 bg-muted p-1 rounded-lg">
          {(["7", "30", "90"] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${period === p ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {p} dias
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-3 w-3 mr-1" /> Exportar CSV
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Conversas", value: reportData.totalConversas, icon: MessageSquare },
          { label: "Mensagens", value: reportData.totalMsgs, icon: BarChart3 },
          { label: "TMA Fila", value: `${reportData.tempoMedioFila}min`, icon: Clock },
          { label: "Atend. Humano", value: reportData.filaAtendidos, icon: Users },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{kpi.label}</span>
                <kpi.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xl font-bold">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Message breakdown */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Mensagens por Tipo</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <TableRow><TableCell>Enviadas</TableCell><TableCell className="text-right font-medium">{reportData.enviadas}</TableCell></TableRow>
                <TableRow><TableCell>Recebidas</TableCell><TableCell className="text-right font-medium">{reportData.recebidas}</TableCell></TableRow>
                <TableRow><TableCell>Áudios</TableCell><TableCell className="text-right font-medium">{reportData.audios}</TableCell></TableRow>
                <TableRow><TableCell>Imagens</TableCell><TableCell className="text-right font-medium">{reportData.imagens}</TableCell></TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pipeline journey */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Jornada do Pipeline</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {PIPELINE_ETAPAS.filter(e => (reportData.pipelineJourney[e.key] || 0) > 0).map(etapa => (
                  <TableRow key={etapa.key}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: etapa.cor }} />
                        {etapa.label}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">{reportData.pipelineJourney[etapa.key]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Atendimento breakdown */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Distribuição de Atendimento</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
              <p className="text-2xl font-bold text-blue-400">{reportData.iaCount}</p>
              <p className="text-xs text-muted-foreground">IA</p>
            </div>
            <div className="flex-1 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
              <p className="text-2xl font-bold text-emerald-400">{reportData.humanoCount}</p>
              <p className="text-xs text-muted-foreground">Humano</p>
            </div>
            <div className="flex-1 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
              <p className="text-2xl font-bold text-amber-400">{reportData.filaCount}</p>
              <p className="text-xs text-muted-foreground">Fila</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
