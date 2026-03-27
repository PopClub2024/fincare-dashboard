import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ExportButtons from "@/components/ExportButtons";
import { flattenForExport } from "@/lib/export-utils";

export default function MarketingCampaigns() {
  const { clinicaId } = useAuth();
  const [diagLoading, setDiagLoading] = useState<string | null>(null);
  const [diagnosticos, setDiagnosticos] = useState<Record<string, string>>({});

  const { data: campanhas = [] } = useQuery({
    queryKey: ["mkt-campanhas", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("campanhas_marketing").select("*").eq("clinica_id", clinicaId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const diagnosticarCampanha = async (campanha: any) => {
    setDiagLoading(campanha.id);
    try {
      const resp = await supabase.functions.invoke("marketing-ai-chat", {
        body: {
          messages: [
            {
              role: "user",
              content: `Analise esta campanha de marketing e dê um diagnóstico com recomendações:\n\nNome: ${campanha.nome}\nCanal: ${campanha.canal}\nOrçamento: R$ ${campanha.orcamento}\nImpressões: ${campanha.impressoes}\nCliques: ${campanha.cliques}\nLeads: ${campanha.leads}\nConversões: ${campanha.agendamentos_convertidos}\nROI: ${campanha.roi}%\nStatus: ${campanha.status}\n\nDê um diagnóstico curto (3-4 linhas) com pontos fortes, fracos e uma recomendação.`,
            },
          ],
        },
      });
      if (resp.error) throw resp.error;
      const text = typeof resp.data === "string" ? resp.data : resp.data?.choices?.[0]?.message?.content || "Sem resposta";
      setDiagnosticos((prev) => ({ ...prev, [campanha.id]: text }));
    } catch (e: any) {
      toast.error("Erro ao diagnosticar: " + (e.message || "erro desconhecido"));
    } finally {
      setDiagLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportButtons
          data={flattenForExport(campanhas, { Nome: "nome", Canal: "canal", Orcamento: "orcamento", Impressoes: "impressoes", Leads: "leads", Conversoes: "agendamentos_convertidos", ROI: "roi", Status: "status" })}
          filename="campanhas-marketing"
          titulo="Campanhas"
        />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campanha</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Orçamento</TableHead>
                <TableHead>Impressões</TableHead>
                <TableHead>Cliques</TableHead>
                <TableHead>Leads</TableHead>
                <TableHead>Conv.</TableHead>
                <TableHead>ROI</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>IA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campanhas.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8">Nenhuma campanha cadastrada</TableCell></TableRow>
              ) : campanhas.map((c: any) => (
                <>
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell><Badge variant="outline">{c.canal}</Badge></TableCell>
                    <TableCell>R$ {Number(c.orcamento || 0).toFixed(2)}</TableCell>
                    <TableCell>{c.impressoes?.toLocaleString()}</TableCell>
                    <TableCell>{c.cliques?.toLocaleString()}</TableCell>
                    <TableCell>{c.leads}</TableCell>
                    <TableCell>{c.agendamentos_convertidos}</TableCell>
                    <TableCell className={Number(c.roi) > 0 ? "text-green-600" : "text-red-600"}>{c.roi ? `${c.roi}%` : "—"}</TableCell>
                    <TableCell><Badge variant={c.status === "ativa" ? "default" : "secondary"}>{c.status}</Badge></TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => diagnosticarCampanha(c)} disabled={diagLoading === c.id}>
                        {diagLoading === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {diagnosticos[c.id] && (
                    <TableRow key={c.id + "-diag"}>
                      <TableCell colSpan={10} className="bg-muted/50 text-sm whitespace-pre-wrap">{diagnosticos[c.id]}</TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
