import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function MarketingABTests() {
  const { clinicaId } = useAuth();
  const qc = useQueryClient();
  const [novoNome, setNovoNome] = useState("");
  const [open, setOpen] = useState(false);
  const [analiseLoading, setAnaliseLoading] = useState<string | null>(null);

  const { data: testes = [] } = useQuery({
    queryKey: ["mkt-ab", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("marketing_ab_tests").select("*, marketing_ab_test_variants(*)").eq("clinica_id", clinicaId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const criarTeste = async () => {
    if (!novoNome.trim() || !clinicaId) return;
    const { data: teste, error } = await supabase.from("marketing_ab_tests").insert({ clinica_id: clinicaId, nome: novoNome }).select().single();
    if (error) { toast.error("Erro ao criar teste"); return; }
    await supabase.from("marketing_ab_test_variants").insert([
      { teste_id: teste.id, nome: "Variante A" },
      { teste_id: teste.id, nome: "Variante B" },
    ]);
    toast.success("Teste A/B criado!");
    setNovoNome("");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["mkt-ab"] });
  };

  const analisarTeste = async (teste: any) => {
    setAnaliseLoading(teste.id);
    try {
      const variants = teste.marketing_ab_test_variants || [];
      const resumo = variants.map((v: any) => `${v.nome}: impressoes=${v.impressoes}, cliques=${v.cliques}, conversoes=${v.conversoes}, gasto=R$${v.gasto}`).join("\n");
      const resp = await supabase.functions.invoke("marketing-ai-chat", {
        body: {
          messages: [{
            role: "user",
            content: `Analise este teste A/B "${teste.nome}":\n\n${resumo}\n\nDetermine: qual variante está ganhando, significância estatística estimada, e recomendação (escalar vencedora, continuar testando, ou pausar).`,
          }],
        },
      });
      if (resp.error) throw resp.error;
      const text = typeof resp.data === "string" ? resp.data : resp.data?.choices?.[0]?.message?.content || "";
      await supabase.from("marketing_ab_tests").update({ analise_ia: text }).eq("id", teste.id);
      qc.invalidateQueries({ queryKey: ["mkt-ab"] });
    } catch (e: any) {
      toast.error("Erro: " + (e.message || "erro"));
    } finally {
      setAnaliseLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Novo Teste A/B</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Teste A/B</DialogTitle></DialogHeader>
            <Input placeholder="Nome do teste" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} />
            <Button onClick={criarTeste}>Criar</Button>
          </DialogContent>
        </Dialog>
      </div>

      {testes.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum teste A/B criado</CardContent></Card>
      ) : testes.map((t: any) => (
        <Card key={t.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm">{t.nome}</CardTitle>
              <Badge variant={t.status === "ativo" ? "default" : "secondary"}>{t.status}</Badge>
            </div>
            <Button size="sm" variant="outline" onClick={() => analisarTeste(t)} disabled={analiseLoading === t.id}>
              {analiseLoading === t.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
              Analisar
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Variante</TableHead><TableHead>Impressões</TableHead><TableHead>Cliques</TableHead><TableHead>Conversões</TableHead><TableHead>Gasto</TableHead><TableHead>CTR</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {(t.marketing_ab_test_variants || []).map((v: any) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.nome}</TableCell>
                    <TableCell>{v.impressoes}</TableCell>
                    <TableCell>{v.cliques}</TableCell>
                    <TableCell>{v.conversoes}</TableCell>
                    <TableCell>R$ {Number(v.gasto).toFixed(2)}</TableCell>
                    <TableCell>{v.impressoes > 0 ? ((v.cliques / v.impressoes) * 100).toFixed(2) : "0"}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {t.analise_ia && <div className="mt-3 p-3 bg-muted/50 rounded text-sm whitespace-pre-wrap">{t.analise_ia}</div>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
