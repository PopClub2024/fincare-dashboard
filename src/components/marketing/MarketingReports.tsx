import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileText, Trash2, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";

export default function MarketingReports() {
  const { clinicaId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", descricao: "", agendamento: "manual" });
  const [gerandoId, setGerandoId] = useState<string | null>(null);
  const [reportContent, setReportContent] = useState<Record<string, string>>({});

  const { data: templates = [] } = useQuery({
    queryKey: ["mkt-report-templates", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("marketing_report_templates").select("*").eq("clinica_id", clinicaId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const criar = async () => {
    if (!form.nome || !clinicaId) return;
    const { error } = await supabase.from("marketing_report_templates").insert({
      clinica_id: clinicaId,
      nome: form.nome,
      descricao: form.descricao,
      agendamento: form.agendamento,
    });
    if (error) toast.error("Erro");
    else { toast.success("Template criado!"); setOpen(false); qc.invalidateQueries({ queryKey: ["mkt-report-templates"] }); }
  };

  const gerarReport = async (template: any) => {
    setGerandoId(template.id);
    try {
      const { data: campanhas } = await supabase.from("campanhas_marketing").select("*").eq("clinica_id", clinicaId!);
      const resumo = (campanhas || []).map((c: any) => `${c.nome}: canal=${c.canal}, gasto=R$${c.orcamento}, impressoes=${c.impressoes}, cliques=${c.cliques}, leads=${c.leads}, conv=${c.agendamentos_convertidos}, roi=${c.roi}%`).join("\n");

      const resp = await supabase.functions.invoke("marketing-ai-chat", {
        body: {
          messages: [{
            role: "user",
            content: `Gere um relatório de marketing completo chamado "${template.nome}" (${template.descricao || "sem descrição"}).\n\nDados das campanhas:\n${resumo}\n\nInclua: resumo executivo, performance por campanha, insights, recomendações e próximos passos. Formate com markdown.`,
          }],
        },
      });
      if (resp.error) throw resp.error;
      const text = typeof resp.data === "string" ? resp.data : resp.data?.choices?.[0]?.message?.content || "";
      setReportContent((prev) => ({ ...prev, [template.id]: text }));

      await supabase.from("marketing_historico_reports").insert({
        clinica_id: clinicaId!,
        template_id: template.id,
        conteudo_json: { texto: text },
      });
      await supabase.from("marketing_report_templates").update({ ultimo_envio: new Date().toISOString() }).eq("id", template.id);
      qc.invalidateQueries({ queryKey: ["mkt-report-templates"] });
      toast.success("Relatório gerado!");
    } catch (e: any) {
      toast.error("Erro: " + (e.message || "erro"));
    } finally {
      setGerandoId(null);
    }
  };

  const deletar = async (id: string) => {
    await supabase.from("marketing_report_templates").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["mkt-report-templates"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Novo Template</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Template de Relatório</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Nome do relatório" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              <Textarea placeholder="Descrição / Seções desejadas" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              <Select value={form.agendamento} onValueChange={(v) => setForm({ ...form, agendamento: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                </SelectContent>
              </Select>
              <Button className="w-full" onClick={criar}>Criar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {templates.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum template de relatório</CardContent></Card>
      ) : templates.map((t: any) => (
        <Card key={t.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-sm">{t.nome}</CardTitle>
                <p className="text-xs text-muted-foreground">{t.descricao}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{t.agendamento}</Badge>
              {t.ultimo_envio && <span className="text-xs text-muted-foreground">Último: {format(new Date(t.ultimo_envio), "dd/MM/yyyy")}</span>}
              <Button size="sm" onClick={() => gerarReport(t)} disabled={gerandoId === t.id}>
                {gerandoId === t.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                Gerar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => deletar(t.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          {reportContent[t.id] && (
            <CardContent><div className="prose prose-sm max-w-none"><ReactMarkdown>{reportContent[t.id]}</ReactMarkdown></div></CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}
